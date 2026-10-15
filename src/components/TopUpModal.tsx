import React, { useState } from 'react';
import { engineInstance } from '../lib/engine';
import { formatPHP } from '../lib/pari-mutuel';
import {
  X,
  CreditCard,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';

interface TopUpModalProps {
  onClose: () => void;
  onSuccess?: () => void;
}

export const TopUpModal: React.FC<TopUpModalProps> = ({ onClose, onSuccess }) => {
  const [provider, setProvider] = useState<'GCash' | 'Maya'>('GCash');
  const [amountInput, setAmountInput] = useState<string>('1000');
  const [refCode, setRefCode] = useState<string>(
    () => `GC-${Math.floor(100000 + Math.random() * 900000)}`
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const presets = [500, 1000, 2500, 5000, 10000];

  const handleProviderChange = (newProvider: 'GCash' | 'Maya') => {
    setProvider(newProvider);
    const prefix = newProvider === 'GCash' ? 'GC' : 'MY';
    setRefCode(`${prefix}-${Math.floor(100000 + Math.random() * 900000)}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const amount = parseFloat(amountInput);
    if (isNaN(amount) || amount <= 0) {
      setErrorMsg('Please enter a valid amount.');
      return;
    }
    if (!refCode.trim()) {
      setErrorMsg('Please enter or generate a mock reference code.');
      return;
    }

    setIsSubmitting(true);
    try {
      engineInstance.requestMockCredit(amount, refCode.trim());
      setSubmitted(true);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to submit request');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">Top Up Test Funds</h3>
              <p className="text-xs text-zinc-400">Mock GCash / Maya Simulation</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {submitted ? (
          <div className="p-6 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <h4 className="text-lg font-black text-white">Mock Top-Up Submitted!</h4>
              <p className="text-xs text-zinc-400 mt-1 max-w-xs mx-auto">
                Reference <strong>{refCode}</strong> for{' '}
                <strong>{formatPHP(parseFloat(amountInput))}</strong> is pending.
              </p>
            </div>

            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-left text-xs text-amber-300 space-y-1">
              <p className="font-bold flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5" />
                Zero Client Trust Rule Enforced
              </p>
              <p className="text-[11px] text-zinc-300">
                To prevent balance manipulation, switch to the <strong>Arbiter Admin</strong> persona
                or navigate to the <strong>Admin Desk</strong> to approve this request and credit
                your wallet.
              </p>
            </div>

            <div className="pt-2 flex gap-3">
              <button
                onClick={() => {
                  engineInstance.switchPersona('e1000000-0000-0000-0000-000000000001'); // Admin
                  onClose();
                }}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs uppercase tracking-wider"
              >
                Switch to Admin & Approve
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Payment Method Selector */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                Simulated Provider
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleProviderChange('GCash')}
                  className={`p-3 rounded-2xl border text-center font-bold text-xs transition-all ${
                    provider === 'GCash'
                      ? 'bg-blue-600/20 border-blue-500 text-blue-300 shadow'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                  }`}
                >
                  🔵 GCash Simulation
                </button>
                <button
                  type="button"
                  onClick={() => handleProviderChange('Maya')}
                  className={`p-3 rounded-2xl border text-center font-bold text-xs transition-all ${
                    provider === 'Maya'
                      ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300 shadow'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                  }`}
                >
                  🟢 Maya Simulation
                </button>
              </div>
            </div>

            {/* Amount */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
                Amount to Request (PHP)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono font-bold text-zinc-400">
                  ₱
                </span>
                <input
                  type="number"
                  min="50"
                  step="50"
                  required
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  className="w-full pl-8 pr-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl font-mono text-base font-black text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Quick Presets */}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {presets.map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setAmountInput(amt.toString())}
                    className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-mono font-bold text-zinc-300"
                  >
                    ₱{amt.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            {/* Reference Code */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Mock Reference Code
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const prefix = provider === 'GCash' ? 'GC' : 'MY';
                    setRefCode(`${prefix}-${Math.floor(100000 + Math.random() * 900000)}`);
                  }}
                  className="text-[11px] text-amber-400 hover:underline"
                >
                  Regenerate
                </button>
              </div>
              <input
                type="text"
                required
                value={refCode}
                onChange={(e) => setRefCode(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl font-mono text-sm text-zinc-300 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 flex items-start gap-2 text-[11px] text-zinc-400">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                Simulated balance does not update automatically upon submission. An admin must
                execute the <code>approve_mock_credit</code> RPC to release funds.
              </span>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-amber-500/20"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Mock Request'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
