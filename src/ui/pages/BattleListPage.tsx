import React, { useState, useEffect } from 'react';
import { Battle, BattleSide } from '../../types/database';
import { FLTService } from '../../lib/flt-service';
import { formatPHP } from '../../lib/pari-mutuel';
import {
  Swords,
  Flame,
  Clock,
  Lock,
  Trophy,
  AlertCircle,
  TrendingUp,
  ChevronRight,
  ShieldAlert,
  Loader2,
  RefreshCw,
} from 'lucide-react';

interface BattleListPageProps {
  onSelectBattle: (battle: Battle, side?: BattleSide) => void;
}

export const BattleListPage: React.FC<BattleListPageProps> = ({ onSelectBattle }) => {
  const [battles, setBattles] = useState<Battle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'open' | 'locked' | 'settled'>('all');

  const loadBattles = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await FLTService.fetchBattles();
      setBattles(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load battles from FLT.battles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBattles();
  }, []);

  const filtered = battles.filter((b) => {
    if (filter === 'all') return true;
    return b.status === filter;
  });

  const openCount = battles.filter((b) => b.status === 'open').length;
  const totalVolume = battles.reduce((sum, b) => sum + (b.total_pool || 0), 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Hero Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-zinc-900 via-zinc-900 to-amber-950/20 border border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
        <div className="max-w-3xl space-y-3 relative z-10">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-rose-500/15 text-rose-400 border border-rose-500/30">
              <Flame className="w-3.5 h-3.5" />
              FlipTop Battle Arena
            </span>
            <span className="text-xs text-zinc-400 font-mono">
              Schema: FLT • Manual QR Payment
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight uppercase">
            FlipTop Pari-Mutuel Battles
          </h1>

          <p className="text-sm text-zinc-400 leading-relaxed">
            Browse upcoming rap matches, pick your emcee, pay via GCash or Maya QR, and submit
            your payment reference. Each bet is verified by administrators before entering the pool.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2 text-xs font-mono">
            <div className="bg-zinc-800/80 px-3 py-1.5 rounded-xl border border-zinc-700/60 text-zinc-300">
              Active Matches: <strong className="text-white">{openCount}</strong>
            </div>
            <div className="bg-zinc-800/80 px-3 py-1.5 rounded-xl border border-zinc-700/60 text-zinc-300">
              Accepted Pool Total: <strong className="text-amber-400">{formatPHP(totalVolume)}</strong>
            </div>
            <div className="bg-zinc-800/80 px-3 py-1.5 rounded-xl border border-zinc-700/60 text-zinc-300">
              Cut: <strong className="text-white">10.0% House</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div className="flex items-center gap-1.5 text-xs">
          <button
            onClick={() => setFilter('all')}
            className={`px-3.5 py-1.5 rounded-xl font-bold transition-all ${
              filter === 'all'
                ? 'bg-amber-500 text-zinc-950 shadow'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
            }`}
          >
            All Matches ({battles.length})
          </button>
          <button
            onClick={() => setFilter('open')}
            className={`px-3.5 py-1.5 rounded-xl font-bold transition-all ${
              filter === 'open'
                ? 'bg-amber-500 text-zinc-950 shadow'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
            }`}
          >
            Open for Betting ({openCount})
          </button>
          <button
            onClick={() => setFilter('locked')}
            className={`px-3.5 py-1.5 rounded-xl font-bold transition-all ${
              filter === 'locked'
                ? 'bg-amber-500 text-zinc-950 shadow'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
            }`}
          >
            Locked Matches
          </button>
          <button
            onClick={() => setFilter('settled')}
            className={`px-3.5 py-1.5 rounded-xl font-bold transition-all ${
              filter === 'settled'
                ? 'bg-amber-500 text-zinc-950 shadow'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
            }`}
          >
            Settled
          </button>
        </div>

        <button
          onClick={loadBattles}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="py-20 text-center space-y-3">
          <Loader2 className="w-8 h-8 text-amber-400 animate-spin mx-auto" />
          <p className="text-xs text-zinc-400">Loading matches from FLT.battles...</p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-400 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={loadBattles}
            className="px-3 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-xs font-bold"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && filtered.length === 0 && (
        <div className="py-16 text-center bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8 space-y-3">
          <Swords className="w-10 h-10 text-zinc-600 mx-auto" />
          <h3 className="text-base font-bold text-white">No Battles Found</h3>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto">
            There are currently no battles matching the selected filter in FLT.battles.
          </p>
        </div>
      )}

      {/* Battles Grid */}
      {!loading && !error && filtered.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filtered.map((battle) => {
            const isClosed =
              battle.status !== 'open' ||
              Date.now() >= new Date(battle.betting_closes_at).getTime();

            const poolA = battle.pool_a || 0;
            const poolB = battle.pool_b || 0;
            const total = poolA + poolB;
            const pctA = total > 0 ? Math.round((poolA / total) * 100) : 50;
            const pctB = total > 0 ? 100 - pctA : 50;

            return (
              <div
                key={battle.id}
                className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-xl hover:border-zinc-700 transition-all flex flex-col"
              >
                {/* Card Top Header */}
                <div className="px-5 py-3 bg-zinc-950/70 border-b border-zinc-800/80 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    {battle.status === 'open' && !isClosed && (
                      <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                        Open for Bets
                      </span>
                    )}
                    {isClosed && battle.status !== 'settled' && (
                      <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-500/15 text-amber-400 border border-amber-500/30">
                        <Lock className="w-3 h-3" />
                        Betting Closed (1h lockout)
                      </span>
                    )}
                    {battle.status === 'settled' && (
                      <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                        <Trophy className="w-3 h-3 text-amber-400" />
                        Settled
                      </span>
                    )}
                  </div>

                  <span className="text-[11px] font-mono text-zinc-400">
                    Starts: {new Date(battle.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {/* Match Title */}
                <div className="px-6 pt-4 pb-2">
                  <h3 className="text-lg font-black text-white">{battle.title}</h3>
                </div>

                {/* Emcees Head to Head */}
                <div className="px-6 py-4 grid grid-cols-2 gap-4 relative">
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-zinc-950 border border-zinc-700 flex items-center justify-center font-black text-xs text-amber-400">
                    VS
                  </div>

                  {/* Side A */}
                  <div className="bg-zinc-950/40 border border-zinc-800 rounded-2xl p-3.5 text-left space-y-2">
                    <div className="flex items-center gap-2.5">
                      <img
                        src={battle.emcee_a_photo_url}
                        alt={battle.emcee_a}
                        className="w-12 h-12 rounded-xl object-cover border border-rose-500/50"
                      />
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold uppercase text-rose-400">
                          Side A
                        </span>
                        <h4 className="font-black text-sm text-white truncate">
                          {battle.emcee_a}
                        </h4>
                        <span className="font-mono text-xs font-bold text-amber-400">
                          {battle.odds_a ? `${battle.odds_a.toFixed(2)}x` : '--'}
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-between text-[11px] pt-1 border-t border-zinc-800/60">
                      <span className="text-zinc-400">Pool A:</span>
                      <span className="font-mono font-bold text-white">
                        {formatPHP(poolA)}
                      </span>
                    </div>

                    {!isClosed && (
                      <button
                        onClick={() => onSelectBattle(battle, 'A')}
                        className="w-full py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 text-xs font-bold transition-all"
                      >
                        Bet {battle.emcee_a}
                      </button>
                    )}
                  </div>

                  {/* Side B */}
                  <div className="bg-zinc-950/40 border border-zinc-800 rounded-2xl p-3.5 text-right space-y-2">
                    <div className="flex items-center justify-end gap-2.5">
                      <div className="min-w-0 text-right">
                        <span className="text-[10px] font-bold uppercase text-sky-400">
                          Side B
                        </span>
                        <h4 className="font-black text-sm text-white truncate">
                          {battle.emcee_b}
                        </h4>
                        <span className="font-mono text-xs font-bold text-amber-400">
                          {battle.odds_b ? `${battle.odds_b.toFixed(2)}x` : '--'}
                        </span>
                      </div>
                      <img
                        src={battle.emcee_b_photo_url}
                        alt={battle.emcee_b}
                        className="w-12 h-12 rounded-xl object-cover border border-sky-500/50"
                      />
                    </div>

                    <div className="flex justify-between text-[11px] pt-1 border-t border-zinc-800/60">
                      <span className="text-zinc-400">Pool B:</span>
                      <span className="font-mono font-bold text-white">
                        {formatPHP(poolB)}
                      </span>
                    </div>

                    {!isClosed && (
                      <button
                        onClick={() => onSelectBattle(battle, 'B')}
                        className="w-full py-1.5 rounded-xl bg-sky-600/20 hover:bg-sky-600 text-sky-300 hover:text-white border border-sky-500/30 text-xs font-bold transition-all"
                      >
                        Bet {battle.emcee_b}
                      </button>
                    )}
                  </div>
                </div>

                {/* Pool Tug of War Bar */}
                <div className="px-6 py-3 bg-zinc-950/50 border-t border-zinc-800/60 mt-auto">
                  <div className="flex justify-between text-[11px] font-mono mb-1 text-zinc-400">
                    <span className="text-rose-400 font-bold">{pctA}%</span>
                    <span>Total Pool: <strong className="text-white">{formatPHP(total)}</strong></span>
                    <span className="text-sky-400 font-bold">{pctB}%</span>
                  </div>

                  <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden flex">
                    <div
                      className="h-full bg-rose-500 transition-all duration-300"
                      style={{ width: `${pctA}%` }}
                    />
                    <div
                      className="h-full bg-sky-500 transition-all duration-300"
                      style={{ width: `${pctB}%` }}
                    />
                  </div>
                </div>

                {/* Card Action */}
                <div className="px-6 py-3 bg-zinc-950 border-t border-zinc-800 flex items-center justify-between">
                  <span className="text-[11px] text-zinc-400">
                    {battle.accepted_bets_count || 0} accepted wagers
                  </span>
                  <button
                    onClick={() => onSelectBattle(battle)}
                    className="flex items-center gap-1 text-xs font-bold text-amber-400 hover:text-amber-300"
                  >
                    View Match & Wager
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
