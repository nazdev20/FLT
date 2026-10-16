import { NextResponse } from 'next/server';
import { authenticateSupabaseUser, getSupabaseAdminClient } from '../../../../lib/paymongo-server';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const user = await authenticateSupabaseUser(request);
    if (!user) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });

    const url = new URL(request.url);
    const reference = url.searchParams.get('reference') || '';
    if (!/^FLT-[A-F0-9]{20}$/.test(reference)) {
      return NextResponse.json({ error: 'Invalid payment reference.' }, { status: 400 });
    }

    const admin = getSupabaseAdminClient();
    const { data: payment, error } = await admin
      .from('bet_payment_submissions')
      .select('id,amount,payment_reference,payment_status,status,review_note,bet_id')
      .eq('payment_reference', reference)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: 'Could not load payment status.' }, { status: 500 });
    }
    if (!payment) return NextResponse.json({ error: 'Payment not found.' }, { status: 404 });

    const { data: bet, error: betError } = await admin
      .from('bets')
      .select('id,status,battle_id,side,stake')
      .eq('id', payment.bet_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (betError) {
      return NextResponse.json({ error: 'Could not load bet status.' }, { status: 500 });
    }

    let battleTitle = 'Battle';
    if (bet?.battle_id) {
      const { data: battle } = await admin
        .from('battles')
        .select('title')
        .eq('id', bet.battle_id)
        .maybeSingle();
      if (battle?.title) battleTitle = battle.title;
    }

    return NextResponse.json({
      payment_reference: payment.payment_reference,
      amount: Number(payment.amount),
      payment_status: payment.payment_status,
      bet_status: bet?.status || 'unknown',
      review_note: payment.review_note,
      battle_title: battleTitle,
      side: bet?.side || null,
    });
  } catch {
    return NextResponse.json({ error: 'Unable to load payment status.' }, { status: 500 });
  }
}
