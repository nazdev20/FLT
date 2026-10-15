import React, { useState, useMemo } from 'react';
import { Battle, BattleSide, Bet } from '../types/database';
import { engineInstance } from '../lib/engine';
import {
  calculatePoolSummary,
  simulateBetImpact,
  formatPHP,
} from '../lib/pari-mutuel';
import {
  X,
  AlertCircle,
  TrendingUp,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Clock,
} from 'lucide-react';

interface WageringModalProps {
  battle: Battle;
  initialSide: BattleSide;
  onClose: () => void;
  onBetPlaced?: (bet: Bet) => void;
}

export const WageringModal: React.FC<WageringModalProps> = ({
  battle,
  initialSide,
  onClose,
  onBetPlaced,
}) => {
  const [side, setSide] = useState<BattleSide>(initialSide);
  const [stakeInput, setStakeInput] = useState<string>('500');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successBet, setSuccessBet] = useState<Bet | null>(null);

  const currentUser = engineInstance.getCurrentUser();
  const wallet = engineInstance.getWallet(currentUser.id);
  const state = engineInstance.getState();

  const currentSummary = useMemo(
    () => calculatePoolSummary(state.bets, battle.id, battle.fee_rate),
    [state.bets, battle.id, battle.fee_rate]
  );

  const stakeNum = Math.max(0, parseFloat(stakeInput) || 0);

  const impact = useMemo(() => {
    return simulateBetImpact(currentSummary, side, stakeNum);
  }, [currentSummary, side, stakeNum]);

  const emceeName = side === 'A' ? battle.emcee_a : battle.emcee_b;
  const emceePhoto = side === 'A' ? battle.emcee_a_photo_url : battle.emcee_b_photo_url;
  const currentOdds = side === 'A' ? currentSummary.oddsA : currentSummary.oddsB;

  const presets = [50, 100, 500, 1000, 5000];

  const handlePlaceBet = async () => {
    setErrorMsg(null);
    if (stakeNum <= 0) {
      setErrorMsg('Please enter a valid stake amount greater than ₱0.00');
      return;
    }
    if (stakeNum > wallet.simulated_balance) {
      setErrorMsg('Insufficient simulated balance in your wallet.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Generate client-side idempotency key to prevent double bet clicks
      const idempotencyKey = `bet_${battle.id}_${currentUser.id}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      const bet = engineInstance.placeBet(battle.id, side, stakeNum, idempotencyKey);
      setSuccessBet(bet);
      if (onBetPlaced) {
        onBetPlaced(bet);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to place wager');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-zinc-950/80 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-black">
              ₱
            </div>
            <div>
              <h3 className="text-base font-black text-white">Pari-Mutuel Wagering Slip</h3>
              <p className="text-xs text-zinc-400 truncate max-w-[280px]">
                {battle.title}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {successBet ? (
            <div className="py-6 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <div>
                <h4 className="text-xl font-black text-white">Wager Accepted!</h4>
                <p className="text-xs text-zinc-400 mt-1">
                  Your stake has been locked in the atomic pool.
                </p>
              </div>

              <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 text-left text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Emcee Selected:</span>
                  <span className="font-bold text-white">
                    {successBet.side === 'A' ? battle.emcee_a : battle.emcee_b} (Side {successBet.side})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Stake Placed:</span>
                  <span className="font-bold text-amber-400 font-mono">
                    {formatPHP(successBet.stake)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Snapshot Odds:</span>
                  <span className="font-bold text-white font-mono">
                    {successBet.snapshot_indicative_odds
                      ? `${successBet.snapshot_indicative_odds.toFixed(2)}x`
                      : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Idempotency Key:</span>
                  <span className="font-mono text-[10px] text-zinc-400 truncate max-w-[200px]">
                    {successBet.idempotency_key}
                  </span>
                </div>
              </div>

              <button
                onClick={onClose}
                className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-sm transition-all"
              >
                Return to Arena
              </button>
            </div>
          ) : (
            <>
              {/* Emcee Selector Toggle */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                  Select Winner Side
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSide('A')}
                    className={`flex items-center gap-3 p-3 rounded-2xl border transition-all text-left ${
                      side === 'A'
                        ? 'bg-rose-500/15 border-rose-500 text-white shadow-lg shadow-rose-500/10'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <img
                      src={battle.emcee_a_photo_url}
                      alt={battle.emcee_a}
                      className="w-10 h-10 rounded-xl object-cover"
                    />
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold text-rose-400 uppercase">
                        Side A
                      </span>
                      <p className="font-black text-sm truncate text-white">
                        {battle.emcee_a}
                      </p>
                      <p className="text-xs font-mono font-bold text-amber-400">
                        {currentSummary.oddsA > 0 ? `${currentSummary.oddsA.toFixed(2)}x` : '--'}
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSide('B')}
                    className={`flex items-center gap-3 p-3 rounded-2xl border transition-all text-left ${
                      side === 'B'
                        ? 'bg-sky-500/15 border-sky-500 text-white shadow-lg shadow-sky-500/10'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <img
                      src={battle.emcee_b_photo_url}
                      alt={battle.emcee_b}
                      className="w-10 h-10 rounded-xl object-cover"
                    />
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold text-sky-400 uppercase">
                        Side B
                      </span>
                      <p className="font-black text-sm truncate text-white">
                        {battle.emcee_b}
                      </p>
                      <p className="text-xs font-mono font-bold text-amber-400">
                        {currentSummary.oddsB > 0 ? `${currentSummary.oddsB.toFixed(2)}x` : '--'}
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Stake Input */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                    Stake Amount (PHP)
                  </label>
                  <span className="text-xs text-zinc-400">
                    Wallet:{' '}
                    <strong className="text-amber-400 font-mono">
                      {formatPHP(wallet.simulated_balance)}
                    </strong>
                  </span>
                </div>

                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-mono font-bold text-zinc-400">
                    ₱
                  </span>
                  <input
                    type="number"
                    step="10"
                    min="1"
                    value={stakeInput}
                    onChange={(e) => setStakeInput(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-9 pr-4 py-3 bg-zinc-950 border border-zinc-800 rounded-2xl font-mono text-lg font-black text-white focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
                  />
                </div>

                {/* Quick Presets */}
                <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                  {presets.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setStakeInput(amt.toString())}
                      className="px-2.5 py-1 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-xs font-mono font-bold text-zinc-300 hover:text-white transition-colors"
                    >
                      +₱{amt}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setStakeInput(Math.floor(wallet.simulated_balance).toString())}
                    className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-xs font-mono font-bold text-amber-400 transition-colors"
                  >
                    MAX
                  </button>
                </div>
              </div>

              {/* Dynamic Pool Impact Box */}
              <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400 flex items-center gap-1.5 font-bold uppercase tracking-wider text-[11px]">
                    <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                    Dynamic Pari-Mutuel Impact
                  </span>
                  <span className="text-[10px] text-zinc-400">Live Simulation</span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1 text-xs">
                  <div className="bg-zinc-900/80 p-2.5 rounded-xl border border-zinc-800">
                    <span className="text-[11px] text-zinc-400 block">Indicative Odds:</span>
                    <div className="flex items-baseline gap-1.5 mt-0.5">
                      <span className="font-mono font-bold text-zinc-400 line-through text-[11px]">
                        {currentOdds > 0 ? `${currentOdds.toFixed(2)}x` : '--'}
                      </span>
                      <span className="font-mono font-black text-amber-400 text-sm">
                        {impact.newOdds > 0 ? `${impact.newOdds.toFixed(2)}x` : '--'}
                      </span>
                    </div>
                  </div>

                  <div className="bg-zinc-900/80 p-2.5 rounded-xl border border-zinc-800">
                    <span className="text-[11px] text-zinc-400 block">Est. Gross Payout:</span>
                    <span className="font-mono font-black text-emerald-400 text-sm block mt-0.5">
                      {formatPHP(impact.estimatedGrossReturn)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-1 border-t border-zinc-800/60">
                  <span className="text-zinc-400">Est. Net Profit:</span>
                  <span
                    className={`font-mono font-bold ${
                      impact.estimatedNetProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {impact.estimatedNetProfit >= 0 ? '+' : ''}
                    {formatPHP(impact.estimatedNetProfit)}
                  </span>
                </div>
              </div>

              {/* Legal / Mathematical Notice */}
              <div className="p-3 bg-zinc-950/40 rounded-xl border border-zinc-800/50 flex items-start gap-2.5 text-[11px] text-zinc-400">
                <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p>
                  Pari-Mutuel rules: The 10% platform take is deducted from total pool.
                  Odds shown are <strong>indicative</strong> and finalize when betting locks 1
                  hour before battle start.
                </p>
              </div>

              {errorMsg && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Submit CTA */}
              <button
                type="button"
                disabled={isSubmitting || stakeNum <= 0 || stakeNum > wallet.simulated_balance}
                onClick={handlePlaceBet}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-black text-sm uppercase tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-amber-500/20"
              >
                {isSubmitting ? 'Securing Transaction...' : `Confirm Wager of ${formatPHP(stakeNum)}`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
