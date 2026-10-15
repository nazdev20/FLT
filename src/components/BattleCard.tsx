import React, { useState, useEffect } from 'react';
import { Battle, BattleSide } from '../types/database';
import { engineInstance } from '../lib/engine';
import { calculatePoolSummary, formatPHP } from '../lib/pari-mutuel';
import {
  Clock,
  Lock,
  Trophy,
  AlertTriangle,
  ChevronRight,
  TrendingUp,
  Percent,
  CheckCircle,
} from 'lucide-react';

interface BattleCardProps {
  battle: Battle;
  onBet: (battle: Battle, side: BattleSide) => void;
  onSettle?: (battle: Battle) => void;
  onLock?: (battle: Battle) => void;
}

export const BattleCard: React.FC<BattleCardProps> = ({
  battle,
  onBet,
  onSettle,
  onLock,
}) => {
  const currentUser = engineInstance.getCurrentUser();
  const state = engineInstance.getState();
  const summary = calculatePoolSummary(state.bets, battle.id, battle.fee_rate);

  // Time remaining calculations
  const [timeLeftCloses, setTimeLeftCloses] = useState('');
  const [timeLeftStarts, setTimeLeftStarts] = useState('');
  const [isPastCloses, setIsPastCloses] = useState(false);

  useEffect(() => {
    const updateCountdown = () => {
      const now = Date.now();
      const closeTime = new Date(battle.betting_closes_at).getTime();
      const startTime = new Date(battle.starts_at).getTime();

      const diffCloses = closeTime - now;
      const diffStarts = startTime - now;

      if (diffCloses <= 0) {
        setIsPastCloses(true);
        setTimeLeftCloses('Closed');
      } else {
        setIsPastCloses(false);
        const hours = Math.floor(diffCloses / (1000 * 60 * 60));
        const minutes = Math.floor((diffCloses % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diffCloses % (1000 * 60)) / 1000);
        setTimeLeftCloses(
          hours > 0 ? `${hours}h ${minutes}m ${seconds}s` : `${minutes}m ${seconds}s`
        );
      }

      if (diffStarts <= 0) {
        setTimeLeftStarts('Started');
      } else {
        const hours = Math.floor(diffStarts / (1000 * 60 * 60));
        const minutes = Math.floor((diffStarts % (1000 * 60 * 60)) / (1000 * 60));
        setTimeLeftStarts(`${hours}h ${minutes}m`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [battle.betting_closes_at, battle.starts_at]);

  const canBet = battle.status === 'open' && !isPastCloses;

  return (
    <div className="bg-zinc-900/90 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl transition-all hover:border-zinc-700/80 flex flex-col">
      {/* Top Meta Bar */}
      <div className="px-5 py-3 bg-zinc-950/60 border-b border-zinc-800/80 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {battle.status === 'open' && !isPastCloses && (
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              Open for Bets
            </span>
          )}

          {(battle.status === 'locked' || (battle.status === 'open' && isPastCloses)) && (
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30">
              <Lock className="w-3 h-3" />
              Betting Locked (1h Rule)
            </span>
          )}

          {battle.status === 'settled' && (
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
              <Trophy className="w-3 h-3 text-amber-400" />
              Settled & Paid
            </span>
          )}

          {battle.status === 'cancelled' && (
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-rose-500/15 text-rose-400 border border-rose-500/30">
              <AlertTriangle className="w-3 h-3" />
              Cancelled • Refunded
            </span>
          )}

          <span className="text-xs text-zinc-400 font-mono">
            Fee: {(battle.fee_rate * 100).toFixed(0)}%
          </span>
        </div>

        {/* Timers */}
        <div className="flex items-center gap-3 text-xs">
          {battle.status === 'open' && !isPastCloses && (
            <div className="flex items-center gap-1 text-amber-400 font-mono bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
              <Clock className="w-3 h-3" />
              <span className="font-bold">{timeLeftCloses}</span>
              <span className="text-[10px] text-zinc-400 font-sans">left</span>
            </div>
          )}

          <div className="text-zinc-400 font-mono text-[11px]">
            Starts in: <span className="text-zinc-200">{timeLeftStarts}</span>
          </div>
        </div>
      </div>

      {/* Battle Title */}
      <div className="px-6 pt-4 pb-2">
        <h3 className="text-lg font-black text-white tracking-wide leading-tight">
          {battle.title}
        </h3>
      </div>

      {/* Emcees Head-to-Head Clash Layout */}
      <div className="px-6 py-4 grid grid-cols-2 gap-4 relative">
        {/* VS Badge in the center */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-zinc-950 border-2 border-zinc-700 flex items-center justify-center font-black text-xs text-amber-400 shadow-xl shadow-black">
          VS
        </div>

        {/* Side A */}
        <div
          className={`relative p-3.5 rounded-2xl border transition-all ${
            battle.winner_side === 'A'
              ? 'bg-amber-500/10 border-amber-500/50 shadow-lg shadow-amber-500/10'
              : 'bg-zinc-950/40 border-zinc-800/80 hover:border-rose-500/40'
          }`}
        >
          {battle.winner_side === 'A' && (
            <div className="absolute -top-3 left-3 bg-amber-500 text-zinc-950 px-2 py-0.5 rounded-full text-[10px] font-black uppercase flex items-center gap-1 shadow-md">
              <Trophy className="w-2.5 h-2.5" /> WINNER
            </div>
          )}
          <div className="flex items-center gap-3">
            <img
              src={battle.emcee_a_photo_url}
              alt={battle.emcee_a}
              className="w-14 h-14 rounded-xl object-cover border-2 border-rose-500/60 shadow-md"
            />
            <div className="flex-1 min-w-0">
              <span className="text-[10px] uppercase font-bold text-rose-400 tracking-wider">
                SIDE A
              </span>
              <h4 className="text-base font-black text-white truncate">
                {battle.emcee_a}
              </h4>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs font-mono font-black text-amber-400">
                  {summary.oddsA > 0 ? `${summary.oddsA.toFixed(2)}x` : '--'}
                </span>
                <span className="text-[10px] text-zinc-400 font-mono">
                  {summary.betsCountA} bets
                </span>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-zinc-800/60 flex items-center justify-between text-xs">
            <span className="text-zinc-400 text-[11px]">Pool A:</span>
            <span className="font-mono font-bold text-white">
              {formatPHP(summary.poolA)}
            </span>
          </div>

          {canBet && (
            <button
              onClick={() => onBet(battle, 'A')}
              className="mt-3 w-full py-2 px-3 rounded-xl bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 hover:border-rose-500 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
            >
              Bet Side A
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Side B */}
        <div
          className={`relative p-3.5 rounded-2xl border transition-all ${
            battle.winner_side === 'B'
              ? 'bg-amber-500/10 border-amber-500/50 shadow-lg shadow-amber-500/10'
              : 'bg-zinc-950/40 border-zinc-800/80 hover:border-sky-500/40'
          }`}
        >
          {battle.winner_side === 'B' && (
            <div className="absolute -top-3 right-3 bg-amber-500 text-zinc-950 px-2 py-0.5 rounded-full text-[10px] font-black uppercase flex items-center gap-1 shadow-md">
              <Trophy className="w-2.5 h-2.5" /> WINNER
            </div>
          )}
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0 text-right">
              <span className="text-[10px] uppercase font-bold text-sky-400 tracking-wider">
                SIDE B
              </span>
              <h4 className="text-base font-black text-white truncate">
                {battle.emcee_b}
              </h4>
              <div className="flex items-center justify-end gap-2 mt-0.5">
                <span className="text-[10px] text-zinc-400 font-mono">
                  {summary.betsCountB} bets
                </span>
                <span className="text-xs font-mono font-black text-amber-400">
                  {summary.oddsB > 0 ? `${summary.oddsB.toFixed(2)}x` : '--'}
                </span>
              </div>
            </div>
            <img
              src={battle.emcee_b_photo_url}
              alt={battle.emcee_b}
              className="w-14 h-14 rounded-xl object-cover border-2 border-sky-500/60 shadow-md"
            />
          </div>

          <div className="mt-3 pt-2.5 border-t border-zinc-800/60 flex items-center justify-between text-xs">
            <span className="text-zinc-400 text-[11px]">Pool B:</span>
            <span className="font-mono font-bold text-white">
              {formatPHP(summary.poolB)}
            </span>
          </div>

          {canBet && (
            <button
              onClick={() => onBet(battle, 'B')}
              className="mt-3 w-full py-2 px-3 rounded-xl bg-sky-600/20 hover:bg-sky-600 text-sky-300 hover:text-white border border-sky-500/30 hover:border-sky-500 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
            >
              Bet Side B
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Dynamic Tug-of-War Visual Pool Split */}
      <div className="px-6 py-3 bg-zinc-950/40 border-t border-zinc-800/60 mt-auto">
        <div className="flex items-center justify-between text-xs font-mono mb-1.5">
          <span className="text-rose-400 font-bold">{summary.percentageA}%</span>
          <span className="text-[11px] text-zinc-400 flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-amber-400" />
            Total Pool: <strong className="text-zinc-200">{formatPHP(summary.totalPool)}</strong>
          </span>
          <span className="text-sky-400 font-bold">{summary.percentageB}%</span>
        </div>

        {/* Bar */}
        <div className="w-full h-2.5 bg-zinc-800 rounded-full overflow-hidden flex shadow-inner">
          <div
            className="h-full bg-gradient-to-r from-rose-600 to-rose-400 transition-all duration-500"
            style={{ width: `${summary.percentageA}%` }}
          />
          <div
            className="h-full bg-gradient-to-r from-sky-400 to-sky-600 transition-all duration-500"
            style={{ width: `${summary.percentageB}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[11px] text-zinc-400 mt-1.5">
          <span>Distributable (90%): {formatPHP(summary.distributablePool)}</span>
          <span>House Cut (10%): {formatPHP(summary.platformFee)}</span>
        </div>
      </div>

      {/* Admin Quick Action Controls */}
      {currentUser.role === 'admin' && (
        <div className="px-6 py-2.5 bg-zinc-950 border-t border-zinc-800 flex items-center justify-between gap-2">
          <span className="text-[10px] text-rose-400 font-bold uppercase tracking-wider flex items-center gap-1">
            <Lock className="w-3 h-3" /> Admin Desk
          </span>
          <div className="flex items-center gap-2">
            {battle.status === 'open' && onLock && (
              <button
                onClick={() => onLock(battle)}
                className="px-2.5 py-1 text-[11px] rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold"
              >
                Lock Early
              </button>
            )}

            {(battle.status === 'open' || battle.status === 'locked') && onSettle && (
              <button
                onClick={() => onSettle(battle)}
                className="px-3 py-1 text-[11px] rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold flex items-center gap-1 shadow"
              >
                <CheckCircle className="w-3 h-3" />
                Settle & Distribute
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
