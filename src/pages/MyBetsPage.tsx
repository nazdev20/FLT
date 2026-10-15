import React, { useState, useEffect } from 'react';
import { Bet } from '../types/database';
import { FLTService } from '../lib/flt-service';
import { formatPHP } from '../lib/pari-mutuel';
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ShieldCheck,
  TrendingUp,
  Receipt,
  Loader2,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';

interface MyBetsPageProps {
  onBrowseBattles: () => void;
}

export const MyBetsPage: React.FC<MyBetsPageProps> = ({ onBrowseBattles }) => {
  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'accepted' | 'rejected'>('all');

  const loadBets = async () => {
    setLoading(true);
    setError(null);
    try {
      const { user } = await FLTService.getCurrentUser();
      if (!user) {
        setBets([]);
        return;
      }
      const data = await FLTService.fetchMyBets(user.id);
      setBets(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch bets from FLT.bets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBets();
  }, []);

  const filtered = bets.filter((b) => {
    if (filter === 'all') return true;
    if (filter === 'pending') return b.status === 'pending_verification' || b.status === 'pending';
    if (filter === 'accepted') return b.status === 'accepted' || b.status === 'settled_won' || b.status === 'settled_lost';
    if (filter === 'rejected') return b.status === 'rejected';
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div>
          <h1 className="text-2xl font-black text-white">My Wagers & Payment Submissions</h1>
          <p className="text-xs text-zinc-400 mt-1">
            Track your individual bet payments, verification statuses, and active pool odds
          </p>
        </div>

        <button
          onClick={loadBets}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 hover:text-white transition-all self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Statuses
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 text-xs">
        <button
          onClick={() => setFilter('all')}
          className={`px-3.5 py-1.5 rounded-xl font-bold transition-all ${
            filter === 'all'
              ? 'bg-amber-500 text-zinc-950 shadow'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
          }`}
        >
          All Wagers ({bets.length})
        </button>
        <button
          onClick={() => setFilter('pending')}
          className={`px-3.5 py-1.5 rounded-xl font-bold transition-all ${
            filter === 'pending'
              ? 'bg-amber-500 text-zinc-950 shadow'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
          }`}
        >
          Pending Bank Verification ({bets.filter((b) => b.status === 'pending_verification').length})
        </button>
        <button
          onClick={() => setFilter('accepted')}
          className={`px-3.5 py-1.5 rounded-xl font-bold transition-all ${
            filter === 'accepted'
              ? 'bg-amber-500 text-zinc-950 shadow'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
          }`}
        >
          Accepted in Pool ({bets.filter((b) => b.status === 'accepted').length})
        </button>
        <button
          onClick={() => setFilter('rejected')}
          className={`px-3.5 py-1.5 rounded-xl font-bold transition-all ${
            filter === 'rejected'
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
          <p className="text-xs text-zinc-400">Loading records from FLT schema...</p>
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
            onClick={loadBets}
            className="px-3 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 font-bold"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && filtered.length === 0 && (
        <div className="py-16 text-center bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8 space-y-4">
          <Receipt className="w-10 h-10 text-zinc-600 mx-auto" />
          <div>
            <h3 className="text-base font-bold text-white">No Wagers Found</h3>
            <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
              You haven't placed any bets matching this filter yet.
            </p>
          </div>
          <button
            onClick={onBrowseBattles}
            className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs uppercase tracking-wider"
          >
            Browse Battles Arena
          </button>
        </div>
      )}

      {/* Bets Table */}
      {!loading && !error && filtered.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-950/60 text-zinc-400 uppercase font-mono text-[10px] tracking-wider border-b border-zinc-800">
                <tr>
                  <th className="px-6 py-3.5">Battle Match</th>
                  <th className="px-6 py-3.5">Selected Emcee</th>
                  <th className="px-6 py-3.5">Stake</th>
                  <th className="px-6 py-3.5">Payment Reference</th>
                  <th className="px-6 py-3.5">Verification Status</th>
                  <th className="px-6 py-3.5">Pool Status</th>
                  <th className="px-6 py-3.5 text-right">Submitted At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {filtered.map((bet) => {
                  const sub = bet.payment_submission;
                  const battle = bet.battle;
                  const emceeName =
                    bet.side === 'A' ? battle?.emcee_a : battle?.emcee_b;

                  return (
                    <tr key={bet.id} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="px-6 py-4 font-bold text-white max-w-[200px] truncate">
                        {battle?.title || 'Battle Match'}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            bet.side === 'A'
                              ? 'bg-rose-500/20 text-rose-300'
                              : 'bg-sky-500/20 text-sky-300'
                          }`}
                        >
                          Side {bet.side}: {emceeName || bet.side}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono font-bold text-amber-400">
                        {formatPHP(bet.stake)}
                      </td>
                      <td className="px-6 py-4 font-mono text-zinc-300">
                        {sub?.payment_reference || bet.idempotency_key.slice(0, 14)}
                        {sub?.receipt_url && (
                          <a
                            href={sub.receipt_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] text-amber-400 hover:underline ml-1.5"
                          >
                            <ExternalLink className="w-2.5 h-2.5" />
                            receipt
                          </a>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {bet.status === 'pending_verification' && (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 text-[10px] font-bold uppercase">
                              <Clock className="w-3 h-3" />
                              pending_verification
                            </span>
                            <span className="block text-[10px] text-zinc-400">
                              Awaiting bank check
                            </span>
                          </div>
                        )}

                        {bet.status === 'accepted' && (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 text-[10px] font-bold uppercase">
                              <CheckCircle2 className="w-3 h-3" />
                              Accepted
                            </span>
                            {bet.snapshot_indicative_odds && (
                              <span className="block text-[10px] text-zinc-400 font-mono">
                                Snapshot: {bet.snapshot_indicative_odds.toFixed(2)}x
                              </span>
                            )}
                          </div>
                        )}

                        {bet.status === 'rejected' && (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300 text-[10px] font-bold uppercase">
                              <XCircle className="w-3 h-3" />
                              Rejected
                            </span>
                            {sub?.review_note && (
                              <span className="block text-[10px] text-rose-400 italic truncate max-w-[150px]">
                                "{sub.review_note}"
                              </span>
                            )}
                          </div>
                        )}

                        {bet.status === 'settled_won' && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold uppercase">
                            Won (+{formatPHP(bet.net_profit)})
                          </span>
                        )}
                        {bet.status === 'settled_lost' && (
                          <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 text-[10px] font-bold uppercase">
                            Lost
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {bet.status === 'pending_verification' ? (
                          <span className="text-[11px] text-rose-400/90 font-medium flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            NOT in pool yet
                          </span>
                        ) : bet.status === 'accepted' || bet.status === 'settled_won' || bet.status === 'settled_lost' ? (
                          <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3" />
                            Included in pool
                          </span>
                        ) : (
                          <span className="text-[11px] text-zinc-400">Excluded</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right text-zinc-400 font-mono text-[11px]">
                        {new Date(bet.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
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
