import React, { useState, useEffect } from 'react';
import { BetPaymentSubmission } from '../types/database';
import { FLTService } from '../lib/flt-service';
import { formatPHP } from '../lib/pari-mutuel';
import {
  ShieldAlert,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Clock,
  Loader2,
  RefreshCw,
  AlertCircle,
  Eye,
  FileCheck2,
} from 'lucide-react';

export const AdminVerificationPage: React.FC = () => {
  const [submissions, setSubmissions] = useState<BetPaymentSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'rejected'>('pending');

  // Active item for modal review
  const [reviewingItem, setReviewingItem] = useState<BetPaymentSubmission | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [accountVerified, setAccountVerified] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadSubmissions = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await FLTService.fetchPaymentSubmissions(statusFilter);
      setSubmissions(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch payment submissions from FLT.bet_payment_submissions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubmissions();
  }, [statusFilter]);

  const handleReviewAction = async (approve: boolean) => {
    if (!reviewingItem) return;
    setActionError(null);

    if (approve && !accountVerified) {
      setActionError('You must confirm that you checked the receiving account before approving.');
      return;
    }

    if (!approve && !reviewNote.trim()) {
      setActionError('Please provide a reason or note when rejecting a payment.');
      return;
    }

    setIsProcessing(true);
    try {
      await FLTService.reviewBetPayment(reviewingItem.id, approve, reviewNote.trim());
      setReviewingItem(null);
      setReviewNote('');
      setAccountVerified(false);
      await loadSubmissions();
    } catch (err: any) {
      setActionError(err?.message || 'FLT.review_bet_payment failed');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div>
          <h1 className="text-2xl font-black text-white">Payment Verification Desk</h1>
          <p className="text-xs text-zinc-400 mt-1">
            Audit <code>FLT.bet_payment_submissions</code> against receiving accounts before
            admitting bets to the pool
          </p>
        </div>

        <button
          onClick={loadSubmissions}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 hover:text-white transition-all self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Submissions
        </button>
      </div>

      {/* Mandatory Admin Verification Notice */}
      <div className="p-4 bg-amber-500/10 border border-amber-500/25 rounded-2xl text-xs text-amber-300 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-white">Manual Receiving Account Check Required</p>
          <p className="text-zinc-300 leading-relaxed">
            Never approve a payment based solely on user screenshots. Log in to the merchant receiving
            e-wallet / bank account, verify the matching reference number, timestamp, and exact
            amount before executing <code>FLT.review_bet_payment</code>.
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 text-xs">
        <button
          onClick={() => setStatusFilter('pending')}
          className={`px-3.5 py-1.5 rounded-xl font-bold transition-all ${
            statusFilter === 'pending'
              ? 'bg-amber-500 text-zinc-950 shadow'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
          }`}
        >
          Pending Review
        </button>
        <button
          onClick={() => setStatusFilter('approved')}
          className={`px-3.5 py-1.5 rounded-xl font-bold transition-all ${
            statusFilter === 'approved'
              ? 'bg-amber-500 text-zinc-950 shadow'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
          }`}
        >
          Approved & In Pool
        </button>
        <button
          onClick={() => setStatusFilter('rejected')}
          className={`px-3.5 py-1.5 rounded-xl font-bold transition-all ${
            statusFilter === 'rejected'
              ? 'bg-amber-500 text-zinc-950 shadow'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
          }`}
        >
          Rejected
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="py-20 text-center space-y-3">
          <Loader2 className="w-8 h-8 text-amber-400 animate-spin mx-auto" />
          <p className="text-xs text-zinc-400">Loading payment submissions from FLT schema...</p>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-400 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={loadSubmissions}
            className="px-3 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 font-bold"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && submissions.length === 0 && (
        <div className="py-16 text-center bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8 space-y-3">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
          <h3 className="text-base font-bold text-white">Queue Clear</h3>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto">
            No submissions found for status <strong>"{statusFilter}"</strong>.
          </p>
        </div>
      )}

      {/* Table */}
      {!loading && !error && submissions.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-950/60 text-zinc-400 uppercase font-mono text-[10px] tracking-wider border-b border-zinc-800">
                <tr>
                  <th className="px-6 py-3.5">Bettor</th>
                  <th className="px-6 py-3.5">Battle Match</th>
                  <th className="px-6 py-3.5">Side</th>
                  <th className="px-6 py-3.5">Amount</th>
                  <th className="px-6 py-3.5">Payment Reference</th>
                  <th className="px-6 py-3.5">Receipt</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {submissions.map((sub) => {
                  return (
                    <tr key={sub.id} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="px-6 py-4 font-bold text-white">
                        {sub.bettor_username || sub.user_id.slice(0, 8)}
                      </td>
                      <td className="px-6 py-4 max-w-[200px] truncate text-zinc-300">
                        {sub.battle_title || 'Match'}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            sub.side === 'A'
                              ? 'bg-rose-500/20 text-rose-300'
                              : 'bg-sky-500/20 text-sky-300'
                          }`}
                        >
                          Side {sub.side}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono font-black text-amber-400 text-sm">
                        {formatPHP(sub.amount)}
                      </td>
                      <td className="px-6 py-4 font-mono text-white font-bold">
                        {sub.payment_reference}
                      </td>
                      <td className="px-6 py-4">
                        {sub.receipt_url ? (
                          <a
                            href={sub.receipt_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-amber-400 hover:underline"
                          >
                            <Eye className="w-3.5 h-3.5" /> View
                          </a>
                        ) : (
                          <span className="text-zinc-400 text-[11px]">None</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {sub.status === 'pending' && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold uppercase">
                            Pending Review
                          </span>
                        )}
                        {sub.status === 'approved' && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold uppercase">
                            Approved
                          </span>
                        )}
                        {sub.status === 'rejected' && (
                          <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[10px] font-bold uppercase">
                            Rejected
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {sub.status === 'pending' ? (
                          <button
                            onClick={() => {
                              setReviewingItem(sub);
                              setReviewNote('');
                              setAccountVerified(false);
                              setActionError(null);
                            }}
                            className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs shadow"
                          >
                            Verify & Decide
                          </button>
                        ) : (
                          <span className="text-zinc-400 text-[10px] font-mono">
                            {sub.reviewed_at
                              ? new Date(sub.reviewed_at).toLocaleTimeString()
                              : 'Reviewed'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Review Modal Dialog */}
      {reviewingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-lg shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-black text-white">Verify Payment Submission</h3>
              </div>
              <button
                onClick={() => setReviewingItem(null)}
                className="text-zinc-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Match & Payment Metadata */}
            <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-400">Bettor:</span>
                <span className="font-bold text-white">{reviewingItem.bettor_username || reviewingItem.user_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Match & Pick:</span>
                <span className="font-bold text-white">
                  Side {reviewingItem.side} ({reviewingItem.side === 'A' ? reviewingItem.emcee_a : reviewingItem.emcee_b})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Expected Amount:</span>
                <span className="font-mono font-black text-amber-400 text-sm">
                  {formatPHP(reviewingItem.amount)}
                </span>
              </div>
              <div className="flex justify-between border-t border-zinc-800 pt-2">
                <span className="text-zinc-400">Transaction Reference:</span>
                <span className="font-mono font-black text-white bg-zinc-900 px-2 py-0.5 rounded border border-zinc-700">
                  {reviewingItem.payment_reference}
                </span>
              </div>
              {reviewingItem.receipt_url && (
                <div className="flex justify-between pt-1">
                  <span className="text-zinc-400">Receipt Attached:</span>
                  <a
                    href={reviewingItem.receipt_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-amber-400 hover:underline flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" /> View Uploaded Image
                  </a>
                </div>
              )}
            </div>

            {/* Checkbox verification requirement */}
            <div className="p-3 bg-zinc-950 rounded-2xl border border-zinc-800">
              <label className="flex items-start gap-2.5 cursor-pointer text-xs text-zinc-300">
                <input
                  type="checkbox"
                  checked={accountVerified}
                  onChange={(e) => setAccountVerified(e.target.checked)}
                  className="mt-0.5 rounded border-zinc-700 text-amber-500 focus:ring-amber-500"
                />
                <span>
                  <strong>Account Check:</strong> I have checked the actual receiving GCash / Maya
                  account and verified receipt of <strong>{formatPHP(reviewingItem.amount)}</strong>{' '}
                  with reference code <strong>{reviewingItem.payment_reference}</strong>.
                </span>
              </label>
            </div>

            {/* Review Note */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
                Review Note (Optional for approval, required for rejection)
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Verified via GCash App transaction log #88210"
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            {actionError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                {actionError}
              </div>
            )}

            {/* Decision Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => handleReviewAction(false)}
                className="flex-1 py-3 rounded-2xl bg-zinc-800 hover:bg-rose-950/60 text-zinc-300 hover:text-rose-300 border border-zinc-700 hover:border-rose-500/50 font-bold text-xs uppercase tracking-wider transition-all"
              >
                Reject Bet
              </button>
              <button
                type="button"
                disabled={isProcessing || !accountVerified}
                onClick={() => handleReviewAction(true)}
                className="flex-1 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-40"
              >
                {isProcessing ? 'Calling RPC...' : 'Approve & Enter Pool'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
