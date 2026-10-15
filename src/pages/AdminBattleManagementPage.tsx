import React, { useState, useEffect } from 'react';
import { Battle } from '../types/database';
import { FLTService } from '../lib/flt-service';
import { formatPHP } from '../lib/pari-mutuel';
import {
  Swords,
  Plus,
  Lock,
  Clock,
  Trophy,
  AlertTriangle,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Info,
} from 'lucide-react';

export const AdminBattleManagementPage: React.FC = () => {
  const [battles, setBattles] = useState<Battle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create Battle Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [title, setTitle] = useState('');
  const [emceeA, setEmceeA] = useState('');
  const [emceeB, setEmceeB] = useState('');
  const [photoA, setPhotoA] = useState(
    'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=400&auto=format&fit=crop&q=80'
  );
  const [photoB, setPhotoB] = useState(
    'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&auto=format&fit=crop&q=80'
  );

  const defaultStart = new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 16);
  const [startsAt, setStartsAt] = useState(defaultStart);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Settlement inspect modal
  const [inspectingBattle, setInspectingBattle] = useState<Battle | null>(null);

  const loadBattles = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await FLTService.fetchBattles();
      setBattles(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load battles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBattles();
  }, []);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setIsSubmitting(true);
    try {
      const startsDate = new Date(startsAt);
      if (startsDate.getTime() <= Date.now()) {
        throw new Error('Battle start time must be in the future.');
      }

      await FLTService.createBattle(
        title,
        emceeA,
        emceeB,
        photoA,
        photoB,
        startsDate.toISOString()
      );

      setShowCreateModal(false);
      setTitle('');
      setEmceeA('');
      setEmceeB('');
      await loadBattles();
    } catch (err: any) {
      setCreateError(err?.message || 'FLT.create_battle failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLockBattle = async (battleId: string) => {
    if (confirm('Lock wagering immediately for this battle?')) {
      try {
        await FLTService.lockBattle(battleId);
        await FLTService.syncBattleLock(battleId);
        await loadBattles();
      } catch (err: any) {
        alert(err?.message || 'FLT.lock_battle failed');
      }
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div>
          <h1 className="text-2xl font-black text-white">Battle Management & Lock Desk</h1>
          <p className="text-xs text-zinc-400 mt-1">
            Create battles via <code>FLT.create_battle</code>, lock betting, and inspect settlement pools
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Create New Battle
        </button>
      </div>

      {/* Backend Limitation Notice Card */}
      <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-xs text-amber-300 space-y-1.5">
        <div className="flex items-center gap-2 font-bold text-white">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          Important Backend Settlement Limitation
        </div>
        <p className="text-zinc-300 leading-relaxed">
          The existing <code>settle_battle</code> and <code>cancel_battle</code> functions in the
          database still rely on the legacy simulated-wallet balance ledger. In this real manual-payment
          prototype, <strong>automated payouts remain disabled in the UI</strong> and are marked as{' '}
          <span className="font-mono bg-zinc-900 px-1 py-0.5 rounded text-amber-300">
            Pending Backend Implementation
          </span>{' '}
          until safe manual payout processing is deployed server-side.
        </p>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="py-20 text-center space-y-3">
          <Loader2 className="w-8 h-8 text-amber-400 animate-spin mx-auto" />
          <p className="text-xs text-zinc-400">Loading FLT.battles...</p>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-400 text-xs flex items-center justify-between">
          <span>{error}</span>
          <button onClick={loadBattles} className="underline font-bold">
            Retry
          </button>
        </div>
      )}

      {/* Battles Table */}
      {!loading && !error && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-950/60 text-zinc-400 uppercase font-mono text-[10px] tracking-wider border-b border-zinc-800">
                <tr>
                  <th className="px-6 py-3.5">Battle Title</th>
                  <th className="px-6 py-3.5">Emcees</th>
                  <th className="px-6 py-3.5">Lockout Time (1h)</th>
                  <th className="px-6 py-3.5">Accepted Pool</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {battles.map((b) => {
                  const pool = b.total_pool || 0;
                  return (
                    <tr key={b.id} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="px-6 py-4 font-bold text-white max-w-[200px] truncate">
                        {b.title}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-rose-400 font-bold">{b.emcee_a}</span>
                        <span className="text-zinc-500 mx-1">vs</span>
                        <span className="text-sky-400 font-bold">{b.emcee_b}</span>
                      </td>
                      <td className="px-6 py-4 font-mono text-zinc-300 text-[11px]">
                        {new Date(b.betting_closes_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-6 py-4 font-mono font-bold text-amber-400">
                        {formatPHP(pool)} ({b.accepted_bets_count || 0} bets)
                      </td>
                      <td className="px-6 py-4">
                        {b.status === 'open' && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold uppercase">
                            Open
                          </span>
                        )}
                        {b.status === 'locked' && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold uppercase">
                            Locked
                          </span>
                        )}
                        {b.status === 'settled' && (
                          <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-bold uppercase">
                            Settled
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {b.status === 'open' && (
                            <button
                              onClick={() => handleLockBattle(b.id)}
                              className="px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold flex items-center gap-1"
                            >
                              <Lock className="w-3 h-3" />
                              Lock
                            </button>
                          )}

                          <button
                            onClick={() => setInspectingBattle(b)}
                            className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-bold"
                          >
                            Inspect Settlement
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: Create Battle Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-black text-white">Create Battle (FLT.create_battle)</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-zinc-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
                  Match Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ahon 15 Finals - Battle of the Year"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-rose-400 mb-1">
                    Side A Emcee
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Abra"
                    value={emceeA}
                    onChange={(e) => setEmceeA(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-sky-400 mb-1">
                    Side B Emcee
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sak Maestro"
                    value={emceeB}
                    onChange={(e) => setEmceeB(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-400 mb-1">
                    Side A Photo URL
                  </label>
                  <input
                    type="url"
                    value={photoA}
                    onChange={(e) => setPhotoA(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-zinc-400 mb-1">
                    Side B Photo URL
                  </label>
                  <input
                    type="url"
                    value={photoB}
                    onChange={(e) => setPhotoB(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
                  Start Date & Time
                </label>
                <input
                  type="datetime-local"
                  required
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm font-mono text-white"
                />
                <span className="text-[11px] text-amber-400/80 mt-1 block">
                  Betting automatically closes 1 hour prior to start time.
                </span>
              </div>

              {createError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                  {createError}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-black uppercase tracking-wider"
                >
                  {isSubmitting ? 'Calling RPC...' : 'Publish Battle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Settlement Information Inspector */}
      {inspectingBattle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-lg shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-400" />
                Settlement & Pool Audit
              </h3>
              <button
                onClick={() => setInspectingBattle(null)}
                className="text-zinc-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-zinc-400">
              Audit metrics for <strong>{inspectingBattle.title}</strong>
            </p>

            <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-400">Side A Pool ({inspectingBattle.emcee_a}):</span>
                <span className="font-mono font-bold text-rose-400">
                  {formatPHP(inspectingBattle.pool_a || 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Side B Pool ({inspectingBattle.emcee_b}):</span>
                <span className="font-mono font-bold text-sky-400">
                  {formatPHP(inspectingBattle.pool_b || 0)}
                </span>
              </div>
              <div className="flex justify-between border-t border-zinc-800 pt-2">
                <span className="text-zinc-300 font-bold">Total Verified Pool:</span>
                <span className="font-mono font-black text-white">
                  {formatPHP(inspectingBattle.total_pool || 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">10% Platform Cut:</span>
                <span className="font-mono font-bold text-amber-400">
                  {formatPHP(inspectingBattle.platform_fee || 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Distributable Pool (90%):</span>
                <span className="font-mono font-bold text-emerald-400">
                  {formatPHP(inspectingBattle.distributable_pool || 0)}
                </span>
              </div>
            </div>

            {/* PENDING IMPLEMENTATION BADGE */}
            <div className="p-3.5 bg-zinc-950 rounded-2xl border border-amber-500/30 text-xs text-amber-300 space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                Manual Payout Processing: Pending Backend Implementation
              </p>
              <p className="text-[11px] text-zinc-400">
                Automated wallet payout trigger remains disabled because the backend settlement
                function operates on legacy simulated wallets. Once backend manual-payout disbursement
                is deployed, payouts will be triggered here safely.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setInspectingBattle(null)}
                className="px-5 py-2.5 rounded-xl bg-zinc-800 text-zinc-200 text-xs font-bold"
              >
                Close Audit View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
