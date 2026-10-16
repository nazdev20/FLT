import { NextResponse } from 'next/server';
import {
  authenticateSupabaseUser,
  getAppBaseUrl,
  getPayMongoConfig,
  getSupabaseAdminClient,
  payMongoBasicAuthorization,
} from '../../../../lib/paymongo-server';

export const runtime = 'nodejs';

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  let admin: ReturnType<typeof getSupabaseAdminClient> | null = null;
  let paymentReference = '';

  try {
    const { mode, secretKey } = getPayMongoConfig();
    const user = await authenticateSupabaseUser(request);
    if (!user) return jsonError('Please sign in again before paying.', 401);

    const body = await request.json().catch(() => null);
    const battleId = typeof body?.battleId === 'string' ? body.battleId : '';
    const side = body?.side;
    const amount = Number(body?.amount);
    const idempotencyKey = typeof body?.idempotencyKey === 'string' ? body.idempotencyKey : '';

    if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(battleId)) {
      return jsonError('Invalid battle.', 400);
    }
    if (side !== 'A' && side !== 'B') return jsonError('Choose a valid battle side.', 400);
    if (!Number.isFinite(amount) || amount < 10 || amount > 100000 || Math.round(amount * 100) !== amount * 100) {
      return jsonError('Enter an amount from ₱10.00 to ₱100,000.00, with up to two decimal places.', 400);
    }
    if (idempotencyKey.length < 16 || idempotencyKey.length > 120) {
      return jsonError('Invalid payment request. Please try again.', 400);
    }

    admin = getSupabaseAdminClient();

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    if (profileError) throw new Error('Unable to verify your account role.');
    if (!profile || profile.role !== 'user') {
      return jsonError('Only bettor accounts can make payments.', 403);
    }

    const { data: battle, error: battleError } = await admin
      .from('battles')
      .select('id,title,status,betting_closes_at')
      .eq('id', battleId)
      .maybeSingle();
    if (battleError) throw new Error('Unable to verify the battle.');
    if (!battle || battle.status !== 'open' || !battle.betting_closes_at ||
        Date.now() >= new Date(battle.betting_closes_at).getTime()) {
      return jsonError('Betting is closed for this battle.', 409);
    }

    const { data: created, error: createError } = await admin.rpc('create_paymongo_bet', {
      p_user_id: user.id,
      p_battle_id: battleId,
      p_side: side,
      p_amount: amount,
      p_idempotency_key: idempotencyKey,
    });

    if (createError) {
      const message = createError.message || '';
      if (message.includes('BETTING_WINDOW_CLOSED')) return jsonError('Betting is closed for this battle.', 409);
      if (message.includes('USER_NOT_ALLOWED_TO_BET')) return jsonError('Only bettor accounts can make payments.', 403);
      if (message.includes('IDEMPOTENCY_KEY_CONFLICT')) return jsonError('Payment request conflict. Refresh and try again.', 409);
      if (message.includes('INVALID_BET_AMOUNT')) return jsonError('Invalid payment amount.', 400);
      throw new Error('Unable to create your pending payment record.');
    }

    const payment = created as {
      bet_id: string;
      payment_id: string;
      payment_reference: string;
      checkout_url: string | null;
      payment_status: string;
      bet_status: string;
      reused: boolean;
    };

    paymentReference = payment.payment_reference;
    if (payment.payment_status === 'paid') {
      return jsonError('This payment has already completed.', 409);
    }
    if (payment.payment_status === 'failed' || payment.bet_status === 'rejected') {
      return jsonError('This payment attempt failed. Please start a new payment.', 409);
    }
    if (payment.checkout_url) {
      return NextResponse.json({
        checkout_url: payment.checkout_url,
        payment_reference: payment.payment_reference,
        bet_id: payment.bet_id,
      });
    }

    const appBaseUrl = getAppBaseUrl(request);
    const successUrl = new URL('/payment-result', appBaseUrl);
    successUrl.searchParams.set('reference', payment.payment_reference);
    const cancelUrl = new URL('/payment-result', appBaseUrl);
    cancelUrl.searchParams.set('reference', payment.payment_reference);
    cancelUrl.searchParams.set('cancelled', '1');

    const checkoutResponse = await fetch('https://api.paymongo.com/v2/checkout_sessions', {
      method: 'POST',
      headers: {
        Authorization: payMongoBasicAuthorization(secretKey),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: {
          attributes: {
            line_items: [{
              name: `FLT Bet — ${battle.title}`.slice(0, 120),
              amount: Math.round(amount * 100),
              currency: 'PHP',
              quantity: 1,
            }],
            // The in-app QR/reference workflow is removed. Customers pay on PayMongo's hosted page.
            payment_method_types: ['card', 'gcash'],
            success_url: successUrl.toString(),
            cancel_url: cancelUrl.toString(),
            reference_number: payment.payment_reference,
            description: `FLT battle bet: ${battle.title}`.slice(0, 255),
            metadata: {
              bet_id: payment.bet_id,
              user_id: user.id,
              battle_id: battleId,
              side,
            },
          },
        },
      }),
      cache: 'no-store',
    });

    const checkoutJson = await checkoutResponse.json().catch(() => null);
    if (!checkoutResponse.ok) {
      await admin.rpc('mark_paymongo_bet_failed', {
        p_payment_reference: payment.payment_reference,
        p_reason: 'PayMongo could not create the checkout session.',
      });
      return jsonError('PayMongo could not start checkout. Please try again.', 502);
    }

    const session = checkoutJson?.data;
    const checkoutUrl = session?.attributes?.checkout_url;
    const sessionId = session?.id;
    const livemode = session?.attributes?.livemode;

    if (
      typeof sessionId !== 'string' ||
      typeof checkoutUrl !== 'string' ||
      !checkoutUrl.startsWith('https://checkout.paymongo.com/') ||
      typeof livemode !== 'boolean' ||
      livemode !== (mode === 'live')
    ) {
      await admin.rpc('mark_paymongo_bet_failed', {
        p_payment_reference: payment.payment_reference,
        p_reason: 'PayMongo returned an invalid checkout session.',
      });
      return jsonError('PayMongo returned an invalid checkout response.', 502);
    }

    const { data: attached, error: attachError } = await admin
      .from('bet_payment_submissions')
      .update({
        paymongo_checkout_session_id: sessionId,
        paymongo_checkout_url: checkoutUrl,
        paymongo_livemode: livemode,
      })
      .eq('id', payment.payment_id)
      .eq('payment_status', 'pending')
      .select('id')
      .maybeSingle();

    if (attachError || !attached) {
      await admin.rpc('mark_paymongo_bet_failed', {
        p_payment_reference: payment.payment_reference,
        p_reason: 'Unable to attach PayMongo checkout session to the payment record.',
      });
      return jsonError('Unable to securely link checkout to your payment record. Please try again.', 500);
    }

    return NextResponse.json({
      checkout_url: checkoutUrl,
      payment_reference: payment.payment_reference,
      bet_id: payment.bet_id,
    });
  } catch (error) {
    if (admin && paymentReference) {
      try {
        await admin.rpc('mark_paymongo_bet_failed', {
          p_payment_reference: paymentReference,
          p_reason: 'Checkout initialization failed.',
        });
      } catch { /* keep the original response */ }
    }
    const message = error instanceof Error ? error.message : 'Unable to start payment.';
    if (message.includes('PAYMONGO_MODE') || message.includes('PAYMONGO_SECRET_KEY')) {
      return jsonError('PayMongo test-mode configuration is missing or mismatched.', 503);
    }
    if (message.includes('server-side Supabase')) {
      return jsonError('Server-side payment database configuration is missing.', 503);
    }
    return jsonError(message || 'Unable to start payment.', 500);
  }
}
