import React, { useState, useEffect } from 'react';
import { Battle, BattleSide, BattlePoolSummary } from '../types/database';
import { FLTService } from '../lib/flt-service';
import { QRCodeDisplay } from '../components/QRCodeDisplay';
import { formatPHP } from '../lib/pari-mutuel';
import {
  ArrowLeft,
  Clock,
  Lock,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  QrCode,
  FileText,
  Loader2,
  TrendingUp,
} from 'lucide-react';

interface BattleDetailPageProps {
  battle: Battle;
  initialSide?: BattleSide;
  onBack: () => void;
  onViewMyBets: () => void;
}

export const BattleDetailPage: React.FC<BattleDetailPageProps> = ({
  battle,
  initialSide = 'A',
  onBack,
  onViewMyBets,
}) => {
  const [side, setSide] = useState<BattleSide>(initialSide);
  const [amountInput, setAmountInput] = useState<string>('500');
  const [provider, setProvider] = useState<'GCash' | 'Maya'>('GCash');

  // Multi-step flow: 'configure' -> 'pay_and_submit' -> 'submitted_success'
  const [step, setStep] = useState<'configure' | 'pay_and_submit' | 'submitted_success'>('configure');

  // Payment form state
  const [paymentRef, setPaymentRef] = useState<string>('');
  const [receiptUrl, setReceiptUrl] = useState<string>('');
  const [confirmPaid, setConfirmPaid] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Pool summary from FLT.get_battle_pool_summary
  const [poolSummary, setPoolSummary] = useState<BattlePoolSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState<boolean>(true);

  // Result info
  const [submittedBetId, setSubmittedBetId] = useState<string | null>(null);

  useEffect(() => {
    loadPoolSummary();
  }, [battle.id]);

  const loadPoolSummary = async () => {
    setLoadingSummary(true);
    try {
      const summary = await FLTService.getBattlePoolSummary(battle.id);
      setPoolSummary(summary);
    } catch (e) {
      console.warn('Could not load pool summary:', e);
    } finally {
      setLoadingSummary(false);
    }
  };

  const stakeAmount = Math.max(0, parseFloat(amountInput) || 0);
  const isClosed =
    battle.status !== 'open' || Date.now() >= new Date(battle.betting_closes_at).getTime();

  const presets = [100, 200, 500, 1000, 2500, 5000];

  const handleProceedToQR = () => {
    setErrorMsg(null);
    if (stakeAmount <= 0) {
      setErrorMsg('Please enter a valid stake amount (minimum ₱10.00).');
      return;
    }
    setStep('pay_and_submit');
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!paymentRef.trim()) {
      setErrorMsg('Transaction reference code is required.');
      return;
    }

    if (!confirmPaid) {
      setErrorMsg('Please confirm that you completed the transfer in your payment app.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Generate client idempotency key
      const idempotencyKey = `flt_bet_${battle.id}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      const result = await FLTService.submitBetPayment(
        battle.id,
        side,
        stakeAmount,
        idempotencyKey,
        paymentRef.trim(),
        receiptUrl.trim() || null
      );

      setSubmittedBetId(result.bet_id);
      setStep('submitted_success');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to submit bet payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-xs font-bold text-zinc-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Battles
      </button>

      {/* Match Header Hero */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-black uppercase bg-zinc-800 text-amber-400 border border-amber-500/30">
              FlipTop Battle Matchup
            </span>
            {isClosed ? (
              <span className="flex items-center gap-1 text-xs text-rose-400 font-bold">
                <Lock className="w-3.5 h-3.5" /> Betting Locked
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-emerald-400 font-bold">
                <Clock className="w-3.5 h-3.5" /> Closes:{' '}
                {new Date(battle.betting_closes_at).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            )}
          </div>

          <span className="text-xs text-zinc-400 font-mono">
            Event Starts:{' '}
            {new Date(battle.starts_at).toLocaleDateString()} at{' '}
            {new Date(battle.starts_at).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>

        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">{battle.title}</h1>
          <p className="text-xs text-zinc-400 mt-1">
            Official FLT Schema Match • 10% Platform Cut • Manual QR Verification Flow
          </p>
        </div>

        {/* Emcees Duel Presentation */}
        <div className="grid grid-cols-2 gap-4 pt-2">
          {/* Emcee A */}
          <div
            onClick={() => !isClosed && setSide('A')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              side === 'A'
                ? 'bg-rose-500/15 border-rose-500 shadow-lg shadow-rose-500/10'
                : 'bg-zinc-950/60 border-zinc-800 hover:border-zinc-700'
            }`}
          >
            <div className="flex items-center gap-3">
              <img
                src={battle.emcee_a_photo_url}
                alt={battle.emcee_a}
                className="w-14 h-14 rounded-xl object-cover border-2 border-rose-500/60 shadow"
              />
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-bold text-rose-400">SIDE A</span>
                <h3 className="text-base font-black text-white truncate">{battle.emcee_a}</h3>
                <span className="text-xs font-mono font-black text-amber-400">
                  {poolSummary?.odds_a ? `${poolSummary.odds_a.toFixed(2)}x` : '--'}
                </span>
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-zinc-800/80 flex justify-between text-xs font-mono">
              <span className="text-zinc-400">Accepted Pool:</span>
              <span className="text-white font-bold">
                {formatPHP(poolSummary?.pool_a || battle.pool_a || 0)}
              </span>
            </div>
          </div>

          {/* Emcee B */}
          <div
            onClick={() => !isClosed && setSide('B')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              side === 'B'
                ? 'bg-sky-500/15 border-sky-500 shadow-lg shadow-sky-500/10'
                : 'bg-zinc-950/60 border-zinc-800 hover:border-zinc-700'
            }`}
          >
            <div className="flex items-center justify-end gap-3 text-right">
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-bold text-sky-400">SIDE B</span>
                <h3 className="text-base font-black text-white truncate">{battle.emcee_b}</h3>
                <span className="text-xs font-mono font-black text-amber-400">
                  {poolSummary?.odds_b ? `${poolSummary.odds_b.toFixed(2)}x` : '--'}
                </span>
              </div>
              <img
                src={battle.emcee_b_photo_url}
                alt={battle.emcee_b}
                className="w-14 h-14 rounded-xl object-cover border-2 border-sky-500/60 shadow"
              />
            </div>
            <div className="mt-3 pt-2 border-t border-zinc-800/80 flex justify-between text-xs font-mono">
              <span className="text-zinc-400">Accepted Pool:</span>
              <span className="text-white font-bold">
                {formatPHP(poolSummary?.pool_b || battle.pool_b || 0)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* STEP 1: CONFIGURE WAGER FORM */}
      {step === 'configure' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
          <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
            <span className="w-6 h-6 rounded-full bg-amber-500 text-zinc-950 font-black text-xs flex items-center justify-center">
              1
            </span>
            <h2 className="text-base font-black text-white">Choose Winner & Individual Stake</h2>
          </div>

          {isClosed ? (
            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-300 text-xs flex items-center gap-2">
              <Lock className="w-4 h-4 shrink-0" />
              <span>
                Betting is strictly locked for this match (1-hour before start). New wagers can no
                longer be submitted.
              </span>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Selected Side Indicator */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                  Winning Selection
                </label>
                <div className="p-3 bg-zinc-950 rounded-2xl border border-zinc-800 flex items-center justify-between">
                  <span className="text-xs text-zinc-400">Selected Emcee:</span>
                  <span
                    className={`font-black text-sm ${
                      side === 'A' ? 'text-rose-400' : 'text-sky-400'
                    }`}
                  >
                    Side {side}: {side === 'A' ? battle.emcee_a : battle.emcee_b}
                  </span>
                </div>
              </div>

              {/* Stake Amount Input */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
                  Individual Bet Amount (PHP)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono font-bold text-zinc-400 text-lg">
                    ₱
                  </span>
                  <input
                    type="number"
                    min="10"
                    step="50"
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                    className="w-full pl-9 pr-4 py-3 bg-zinc-950 border border-zinc-800 rounded-2xl font-mono text-lg font-black text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Quick Presets */}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {presets.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setAmountInput(amt.toString())}
                      className="px-3 py-1 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-mono font-bold text-zinc-200"
                    >
                      ₱{amt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment Method Option */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                  Payment Application
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setProvider('GCash')}
                    className={`p-3 rounded-2xl border font-bold text-xs transition-all ${
                      provider === 'GCash'
                        ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                    }`}
                  >
                    🔵 GCash QR Payment
                  </button>
                  <button
                    type="button"
                    onClick={() => setProvider('Maya')}
                    className={`p-3 rounded-2xl border font-bold text-xs transition-all ${
                      provider === 'Maya'
                        ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                    }`}
                  >
                    🟢 Maya QR Payment
                  </button>
                </div>
              </div>

              {/* Notice */}
              <div className="p-3.5 bg-zinc-950 rounded-2xl border border-zinc-800 text-xs text-zinc-400 space-y-1">
                <p className="font-bold text-white flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  Each bet is paid individually
                </p>
                <p className="text-[11px]">
                  There is no deposit wallet requirement. You will scan the official payment QR code
                  for <strong>{formatPHP(stakeAmount)}</strong> and submit your reference code.
                </p>
              </div>

              {errorMsg && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleProceedToQR}
                className="w-full py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-amber-500/20"
              >
                Proceed to QR Payment Instructions
              </button>
            </div>
          )}
        </div>
      )}

      {/* STEP 2: QR PAYMENT INSTRUCTIONS & REFERENCE FORM */}
      {step === 'pay_and_submit' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-amber-500 text-zinc-950 font-black text-xs flex items-center justify-center">
                2
              </span>
              <h2 className="text-base font-black text-white">Scan QR & Enter Payment Reference</h2>
            </div>
            <button
              onClick={() => setStep('configure')}
              className="text-xs text-zinc-400 hover:text-white"
            >
              Modify Stake
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            {/* Left Column: Official QR Code Display */}
            <div>
              <QRCodeDisplay
                amount={stakeAmount}
                provider={provider}
                referenceHint="GCASH-123456"
              />
            </div>

            {/* Right Column: Reference code submission */}
            <form onSubmit={handleSubmitPayment} className="space-y-4">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white">Submit Payment Reference</h3>
                <p className="text-xs text-zinc-400">
                  After completing the transfer in your {provider} app, enter the reference code
                  below.
                </p>
              </div>

              {/* Payment Reference Input */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
                  Payment Reference Number <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder={provider === 'GCash' ? 'e.g. 1009848124810' : 'e.g. MY-882941049'}
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl font-mono text-sm text-white focus:outline-none focus:border-amber-500"
                />
                <span className="text-[10px] text-zinc-400 mt-1 block">
                  Must match the exact reference from your confirmation SMS/receipt.
                </span>
              </div>

              {/* Optional Receipt Screenshot URL */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
                  Receipt URL / Image Link (Optional)
                </label>
                <input
                  type="url"
                  placeholder="https://imgur.com/... or receipt link"
                  value={receiptUrl}
                  onChange={(e) => setReceiptUrl(e.target.value)}
                  className="w-full px-3.5 py-2 bg-zinc-950 border border-zinc-800 rounded-xl font-mono text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Strict Confirmation Checkbox */}
              <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800">
                <label className="flex items-start gap-2.5 cursor-pointer text-xs text-zinc-300">
                  <input
                    type="checkbox"
                    checked={confirmPaid}
                    onChange={(e) => setConfirmPaid(e.target.checked)}
                    className="mt-0.5 rounded border-zinc-700 text-amber-500 focus:ring-amber-500"
                  />
                  <span>
                    I confirm that I transferred <strong>{formatPHP(stakeAmount)}</strong> via{' '}
                    {provider} to the receiving account.
                  </span>
                </label>
              </div>

              {/* Security Rule Callout */}
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-[11px] text-rose-300 space-y-1">
                <p className="font-bold flex items-center gap-1 text-rose-400">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Zero Client Trust Notice
                </p>
                <p className="text-zinc-400">
                  Submitting a reference marks your bet as <code>pending_verification</code>. It
                  will <strong>NOT</strong> enter the pool until an administrator verifies the
                  funds in the receiving bank account.
                </p>
              </div>

              {errorMsg && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || !confirmPaid}
                className="w-full py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Calling FLT.submit_bet_payment...
                  </>
                ) : (
                  `Submit Bet Reference (${formatPHP(stakeAmount)})`
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* STEP 3: SUBMITTED SUCCESS (PENDING VERIFICATION) */}
      {step === 'submitted_success' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 text-center space-y-5 shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto border border-amber-500/30">
            <Clock className="w-9 h-9" />
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
              Status: pending_verification
            </span>
            <h2 className="text-xl font-black text-white">Payment Submitted for Verification</h2>
            <p className="text-xs text-zinc-400 max-w-md mx-auto">
              Your payment reference <strong>{paymentRef}</strong> has been logged into{' '}
              <code>FLT.bet_payment_submissions</code>.
            </p>
          </div>

          {/* Audit Isolation Explanation */}
          <div className="p-4 bg-zinc-950 rounded-2xl border border-zinc-800 text-left text-xs space-y-2 max-w-lg mx-auto">
            <div className="flex justify-between">
              <span className="text-zinc-400">Battle:</span>
              <span className="font-bold text-white">{battle.title}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Chosen Emcee:</span>
              <span className="font-bold text-amber-400">
                {side === 'A' ? battle.emcee_a : battle.emcee_b} (Side {side})
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Wager Stake:</span>
              <span className="font-mono font-bold text-white">{formatPHP(stakeAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Pool Status:</span>
              <span className="font-bold text-rose-400">
                NOT in pool yet (Pending Admin Bank Review)
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Bet ID:</span>
              <span className="font-mono text-[10px] text-zinc-400">{submittedBetId}</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
            <button
              onClick={onViewMyBets}
              className="px-6 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-amber-500/20"
            >
              View in My Bets & Payment Status
            </button>
            <button
              onClick={onBack}
              className="px-6 py-3 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs transition-all"
            >
              Browse More Battles
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
