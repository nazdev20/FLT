'use client';

import React, { useEffect, useState } from 'react';
import { getClient } from '../../lib/flt-service';
import { AlertCircle, CheckCircle2, Clock, Loader2, ShieldCheck } from 'lucide-react';

type PaymentStatus = {
  payment_reference: string;
  amount: number;
  payment_status: 'pending' | 'paid' | 'failed';
  bet_status: string;
  review_note: string | null;
  battle_title: string;
  side: 'A' | 'B' | null;
};

function formatPHP(amount: number) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(amount);
}

export default function PaymentResultPage() {
  const [payment, setPayment] = useState<PaymentStatus | null>(null);
  const [message, setMessage] = useState('Checking the payment record with FLT...');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let attempts = 0;
    let interval: ReturnType<typeof setInterval> | undefined;
    const params = new URLSearchParams(window.location.search);
    const reference = params.get('reference') || '';
    const cancelled = params.get('cancelled') === '1';

    async function checkStatus() {
      if (!active) return;
      attempts += 1;

      try {
        const client = getClient();
        if (!client) {
          setMessage('Sign in to FLT to check your payment status.');
          setIsLoading(false);
          return;
        }

        const { data, error } = await client.auth.getSession();
        const token = data.session?.access_token;
        if (error || !token) {
          setMessage('Your FLT session has expired. Sign in again to check payment status.');
          setIsLoading(false);
          return;
        }

        const response = await fetch(`/api/paymongo/status?reference=${encodeURIComponent(reference)}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        const result = await response.json().catch(() => null);
        if (!response.ok) throw new Error(result?.error || 'Could not retrieve payment status.');
        if (!active) return;

        setPayment(result as PaymentStatus);
        if (result.payment_status === 'paid') {
          setMessage(result.bet_status === 'accepted'
            ? 'PayMongo payment verified. Your bet is accepted.'
            : 'PayMongo confirms the payment, but betting has closed. Your bet was not accepted and requires refund review.');
          setIsLoading(false);
          if (interval) clearInterval(interval);
          return;
        }
        if (result.payment_status === 'failed') {
          setMessage('This checkout attempt failed. No bet was accepted.');
          setIsLoading(false);
          if (interval) clearInterval(interval);
          return;
        }

        setMessage(cancelled
          ? 'Checkout was cancelled or left incomplete. If you already paid, this page will wait for PayMongo to confirm it.'
          : 'Waiting for PayMongo to confirm the payment. Returning to this page does not itself mark the payment as successful.');
        setIsLoading(attempts < 40);
        if (attempts >= 40 && interval) clearInterval(interval);
      } catch (error) {
        if (!active) return;
        setMessage(error instanceof Error ? error.message : 'Could not retrieve payment status.');
        setIsLoading(false);
      }
    }

    if (!reference) {
      setMessage('No payment reference was provided.');
      setIsLoading(false);
      return () => { active = false; };
    }

    void checkStatus();
    interval = setInterval(() => { void checkStatus(); }, 3000);

    return () => {
      active = false;
      if (interval) clearInterval(interval);
    };
  }, []);

  const isPaid = payment?.payment_status === 'paid';
  const isAccepted = isPaid && payment?.bet_status === 'accepted';
  const isFailed = payment?.payment_status === 'failed';

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center px-4 py-10">
      <section className="w-full max-w-xl rounded-3xl border border-zinc-800 bg-zinc-900 p-7 sm:p-9 text-center shadow-2xl space-y-5">
        <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full border ${
          isAccepted ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
          : isPaid ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
          : isFailed ? 'border-rose-500/30 bg-rose-500/10 text-rose-400'
          : 'border-sky-500/30 bg-sky-500/10 text-sky-300'
        }`}>
          {isAccepted ? <CheckCircle2 className="h-8 w-8" />
            : isPaid || isFailed ? <AlertCircle className="h-8 w-8" />
            : isLoading ? <Loader2 className="h-8 w-8 animate-spin" />
            : <Clock className="h-8 w-8" />}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-400">FLT Payment Status</p>
          <h1 className="text-2xl font-black text-white">
            {isAccepted ? 'Payment Verified'
              : isPaid ? 'Payment Received'
              : isFailed ? 'Payment Failed'
              : 'Payment Pending'}
          </h1>
          <p className="text-sm text-zinc-300">{message}</p>
        </div>

        {payment && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-left text-sm space-y-3">
            <div className="flex justify-between gap-4"><span className="text-zinc-400">Battle</span><span className="text-right font-bold">{payment.battle_title}</span></div>
            <div className="flex justify-between gap-4"><span className="text-zinc-400">Amount</span><span className="font-mono font-bold">{formatPHP(payment.amount)}</span></div>
            <div className="flex justify-between gap-4"><span className="text-zinc-400">Payment status</span><span className={`font-bold uppercase ${isPaid ? 'text-emerald-400' : isFailed ? 'text-rose-400' : 'text-amber-300'}`}>{payment.payment_status}</span></div>
            <div className="flex justify-between gap-4"><span className="text-zinc-400">Bet status</span><span className="font-bold">{payment.bet_status.replaceAll('_', ' ')}</span></div>
            <div className="border-t border-zinc-800 pt-3"><p className="text-[11px] text-zinc-500">Reference</p><p className="break-all font-mono text-xs text-zinc-300">{payment.payment_reference}</p></div>
            {payment.review_note && <p className="text-xs text-zinc-400">{payment.review_note}</p>}
          </div>
        )}

        <div className="flex items-start gap-2 rounded-xl border border-sky-500/20 bg-sky-500/5 p-3 text-left text-xs text-sky-200">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <span>This page displays the database status only. FLT marks a payment paid after a signed PayMongo webhook and server-side checkout verification.</span>
        </div>

        {!isLoading && payment?.payment_status === 'pending' && (
          <button onClick={() => window.location.reload()} className="rounded-xl border border-zinc-700 px-5 py-2.5 text-sm font-bold text-zinc-200 hover:bg-zinc-800">Check Again</button>
        )}
        <div><a href="/" className="inline-flex rounded-xl bg-amber-500 px-6 py-3 text-xs font-black uppercase tracking-wider text-zinc-950 hover:bg-amber-400">Return to FLT</a></div>
      </section>
    </main>
  );
}
