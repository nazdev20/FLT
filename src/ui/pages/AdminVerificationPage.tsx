import React, { useState, useEffect, useCallback } from 'react';
import { BetPaymentSubmission } from '../../types/database';
import { FLTService } from '../../lib/flt-service';
import { formatPHP } from '../../lib/pari-mutuel';
import { AlertCircle, CheckCircle2, Clock, Loader2, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';

type PaymentFilter = 'pending' | 'paid' | 'failed' | 'rejected';

const FILTERS: { value: PaymentFilter; label: string }[] = [
  { value: 'pending', label: 'Awaiting Payment' },
  { value: 'paid', label: 'Paid' },
  { value: 'failed', label: 'Failed' },
  { value: 'rejected', label: 'Rejected' },
];

export const AdminVerificationPage: React.FC = () => {
  const [submissions, setSubmissions] = useState<BetPaymentSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<PaymentFilter>('pending');

  const loadSubmissions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await FLTService.fetchPaymentSubmissions(statusFilter);
      setSubmissions(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load payments from the FLT schema.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void loadSubmissions();
  }, [loadSubmissions]);

  const statusLabel = (submission: BetPaymentSubmission) => {
    if (submission.payment_status) return submission.payment_status;
    return submission.status;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div>
          <h1 className="text-2xl font-black text-white">PayMongo Payment Monitor</h1>
          <p className="text-xs text-zinc-400 mt-1">
            Payment status is updated by the server only after verifying PayMongo's signed webhook and checkout record.
          </p>
        </div>
        <button
          onClick={() => { void loadSubmissions(); }}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 hover:text-white transition-all self-start sm:self-auto disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Payments
        </button>
      </div>

      <div className="p-4 bg-sky-500/10 border border-sky-500/25 rounded-2xl text-xs text-sky-200 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-white">Automatic payment verification</p>
          <p className="text-zinc-300 leading-relaxed">
            Do not manually approve payments. A payment becomes paid only when FLT validates the webhook signature,
            retrieves the Checkout Session from PayMongo, and matches the amount, currency, reference, and test/live mode.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        {FILTERS.map((filter) => (
          <button
            key={filter.value}
            onClick={() => setStatusFilter(filter.value)}
            className={`px-3.5 py-1.5 rounded-xl font-bold transition-all ${
              statusFilter === filter.value
                ? 'bg-amber-500 text-zinc-950 shadow'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="py-20 text-center space-y-3">
          <Loader2 className="w-8 h-8 text-amber-400 animate-spin mx-auto" />
          <p className="text-xs text-zinc-400">Loading PayMongo payment records...</p>
        </div>
      )}

      {error && !loading && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-400 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2"><AlertCircle className="w-4 h-4 shrink-0" /><span>{error}</span></div>
          <button onClick={() => { void loadSubmissions(); }} className="px-3 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 font-bold">Retry</button>
        </div>
      )}

      {!loading && !error && submissions.length === 0 && (
        <div className="py-16 text-center bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8 space-y-3">
          {statusFilter === 'paid' ? <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
            : statusFilter === 'failed' || statusFilter === 'rejected' ? <XCircle className="w-10 h-10 text-zinc-500 mx-auto" />
            : <Clock className="w-10 h-10 text-amber-400 mx-auto" />}
          <h3 className="text-base font-bold text-white">No matching payments</h3>
          <p className="text-xs text-zinc-400">There are no records with the <strong>{statusFilter}</strong> payment status.</p>
        </div>
      )}

      {!loading && !error && submissions.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-950/60 text-zinc-400 uppercase font-mono text-[10px] tracking-wider border-b border-zinc-800">
                <tr>
                  <th className="px-5 py-3.5">Bettor</th>
                  <th className="px-5 py-3.5">Battle</th>
                  <th className="px-5 py-3.5">Side</th>
                  <th className="px-5 py-3.5">Amount</th>
                  <th className="px-5 py-3.5">FLT Reference</th>
                  <th className="px-5 py-3.5">Payment Status</th>
                  <th className="px-5 py-3.5">Bet Status</th>
                  <th className="px-5 py-3.5">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {submissions.map((sub) => {
                  const label = statusLabel(sub);
                  const paid = label === 'paid';
                  const failed = label === 'failed' || label === 'rejected';
                  return (
                    <tr key={sub.id} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="px-5 py-4 font-bold text-white">{sub.bettor_username || sub.user_id.slice(0, 8)}</td>
                      <td className="px-5 py-4 max-w-[220px] truncate text-zinc-300">{sub.battle_title || 'Battle'}</td>
                      <td className="px-5 py-4"><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${sub.side === 'A' ? 'bg-rose-500/20 text-rose-300' : 'bg-sky-500/20 text-sky-300'}`}>Side {sub.side}</span></td>
                      <td className="px-5 py-4 font-mono font-black text-amber-400 text-sm">{formatPHP(sub.amount)}</td>
                      <td className="px-5 py-4 font-mono text-white font-bold">{sub.payment_reference}</td>
                      <td className="px-5 py-4"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${paid ? 'bg-emerald-500/20 text-emerald-300' : failed ? 'bg-rose-500/20 text-rose-300' : 'bg-amber-500/20 text-amber-300'}`}>{label}</span></td>
                      <td className="px-5 py-4 font-bold text-zinc-300">{sub.bet_status?.replaceAll('_', ' ') || 'pending verification'}</td>
                      <td className="px-5 py-4 max-w-[260px] text-zinc-400">{sub.review_note || 'Waiting for PayMongo confirmation.'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
