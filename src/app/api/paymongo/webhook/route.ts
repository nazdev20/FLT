import { NextResponse } from 'next/server';
import {
  getPayMongoConfig,
  getSupabaseAdminClient,
  payMongoBasicAuthorization,
  verifyPayMongoSignature,
} from '../../../../lib/paymongo-server';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const rawBody = await request.text();

  try {
    const { mode, secretKey } = getPayMongoConfig();
    const webhookSecret = process.env.PAYMONGO_WEBHOOK_SECRET || '';
    if (!webhookSecret) {
      return NextResponse.json({ error: 'Webhook is not configured.' }, { status: 503 });
    }

    if (!verifyPayMongoSignature(
      rawBody,
      request.headers.get('paymongo-signature'),
      webhookSecret,
      mode
    )) {
      return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 401 });
    }

    let event: any;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
    }

    const eventAttributes = event?.data?.attributes;
    const eventType = eventAttributes?.type || event?.data?.type;
    if (eventType !== 'checkout_session.payment.paid') {
      return NextResponse.json({ received: true, ignored: true });
    }

    const webhookSession = eventAttributes?.data || event?.data?.data;
    const sessionId = webhookSession?.id;
    const webhookReference = webhookSession?.attributes?.reference_number;
    const webhookLivemode = eventAttributes?.livemode ?? webhookSession?.attributes?.livemode;

    if (typeof sessionId !== 'string' || typeof webhookReference !== 'string' ||
        typeof webhookLivemode !== 'boolean' || webhookLivemode !== (mode === 'live')) {
      return NextResponse.json({ error: 'Invalid PayMongo event fields.' }, { status: 400 });
    }

    // Verify the webhook payload against PayMongo's API before changing FLT records.
    const verifyResponse = await fetch(
      `https://api.paymongo.com/v2/checkout_sessions/${encodeURIComponent(sessionId)}`,
      {
        method: 'GET',
        headers: { Authorization: payMongoBasicAuthorization(secretKey) },
        cache: 'no-store',
      }
    );
    const verifyJson = await verifyResponse.json().catch(() => null);
    if (!verifyResponse.ok) {
      return NextResponse.json({ error: 'Could not verify checkout with PayMongo.' }, { status: 502 });
    }

    const session = verifyJson?.data;
    const attributes = session?.attributes;
    if (
      session?.id !== sessionId ||
      attributes?.reference_number !== webhookReference ||
      attributes?.livemode !== (mode === 'live')
    ) {
      return NextResponse.json({ error: 'Checkout session does not match the webhook.' }, { status: 400 });
    }

    const paidPayment = Array.isArray(attributes?.payments)
      ? attributes.payments.find((payment: any) => payment?.attributes?.status === 'paid')
      : null;
    if (!paidPayment || typeof paidPayment.id !== 'string') {
      // Return a non-2xx response so PayMongo can retry if its resource has not updated yet.
      return NextResponse.json({ error: 'PayMongo has not confirmed a paid transaction yet.' }, { status: 503 });
    }

    const paymentAttributes = paidPayment.attributes;
    if (paymentAttributes.currency !== 'PHP' ||
        paymentAttributes.livemode !== (mode === 'live')) {
      return NextResponse.json({ error: 'Payment currency or mode does not match.' }, { status: 400 });
    }

    const lineItems = attributes.line_items;
    if (!Array.isArray(lineItems) || lineItems.length !== 1) {
      return NextResponse.json({ error: 'Unexpected checkout line items.' }, { status: 400 });
    }
    const lineItem = lineItems[0];
    const quantity = Number(lineItem?.quantity);
    const lineAmountMinor = Number(lineItem?.amount) * quantity;
    if (
      lineItem?.currency !== 'PHP' ||
      !Number.isSafeInteger(quantity) || quantity !== 1 ||
      !Number.isSafeInteger(lineAmountMinor) ||
      !Number.isSafeInteger(Number(paymentAttributes.amount)) ||
      Number(paymentAttributes.amount) !== lineAmountMinor
    ) {
      return NextResponse.json({ error: 'Paid amount does not match the checkout amount.' }, { status: 400 });
    }

    const admin = getSupabaseAdminClient();
    const { data: paymentRecord, error: lookupError } = await admin
      .from('bet_payment_submissions')
      .select('id,amount,payment_reference,payment_status,paymongo_checkout_session_id,paymongo_livemode')
      .eq('payment_reference', attributes.reference_number)
      .maybeSingle();

    if (lookupError) {
      return NextResponse.json({ error: 'Could not load FLT payment record.' }, { status: 500 });
    }
    if (!paymentRecord) {
      return NextResponse.json({ error: 'No FLT payment matches this PayMongo reference.' }, { status: 404 });
    }
    if (
      paymentRecord.paymongo_checkout_session_id !== sessionId ||
      paymentRecord.paymongo_livemode !== (mode === 'live') ||
      Math.round(Number(paymentRecord.amount) * 100) !== lineAmountMinor
    ) {
      return NextResponse.json({ error: 'PayMongo details do not match the FLT payment record.' }, { status: 400 });
    }

    const { error: confirmError } = await admin.rpc('confirm_paymongo_bet_payment', {
      p_payment_reference: attributes.reference_number,
      p_checkout_session_id: sessionId,
      p_paymongo_payment_id: paidPayment.id,
      p_amount_minor: lineAmountMinor,
      p_currency: paymentAttributes.currency,
      p_livemode: mode === 'live',
    });

    if (confirmError) {
      console.error('FLT PayMongo confirmation failed:', confirmError.message);
      return NextResponse.json({ error: 'Could not record verified payment.' }, { status: 500 });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('PayMongo webhook handler error:', error);
    return NextResponse.json({ error: 'Webhook processing failed.' }, { status: 500 });
  }
}
