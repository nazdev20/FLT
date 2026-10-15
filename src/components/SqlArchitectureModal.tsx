import React, { useState } from 'react';
import { SUPABASE_MIGRATION_SQL } from '../lib/supabase-migration';
import {
  getSupabaseConfig,
  initSupabase,
  testSupabaseConnection,
} from '../lib/supabase-client';
import {
  Database,
  Copy,
  Check,
  Shield,
  Layers,
  Terminal,
  Activity,
  Server,
  X,
  ExternalLink,
} from 'lucide-react';

interface SqlArchitectureModalProps {
  onClose: () => void;
}

export const SqlArchitectureModal: React.FC<SqlArchitectureModalProps> = ({ onClose }) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'sql' | 'architecture' | 'connect'>('sql');

  const config = getSupabaseConfig();
  const [supabaseUrl, setSupabaseUrl] = useState(config.url);
  const [anonKey, setAnonKey] = useState(config.key);
  const [testingConn, setTestingConn] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleCopy = () => {
    navigator.clipboard.writeText(SUPABASE_MIGRATION_SQL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTestConnection = async () => {
    if (!supabaseUrl || !anonKey) {
      setTestResult({ success: false, message: 'Please enter both URL and Anon Key' });
      return;
    }
    setTestingConn(true);
    setTestResult(null);
    try {
      const res = await testSupabaseConnection(supabaseUrl, anonKey);
      setTestResult(res);
      if (res.success) {
        initSupabase(supabaseUrl, anonKey);
      }
    } catch (e: any) {
      setTestResult({ success: false, message: e?.message || 'Connection test failed' });
    } finally {
      setTestingConn(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">
                Supabase SQL Migration & Architecture
              </h3>
              <p className="text-xs text-zinc-400">
                PostgreSQL 15+ Schema • Security Definer RPCs • RLS Lockdown
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30 text-xs font-bold transition-all"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied to Clipboard!' : 'Copy Entire Migration SQL'}
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Sub-navigation tabs */}
        <div className="flex items-center gap-2 px-6 py-2 bg-zinc-950/40 border-b border-zinc-800 text-xs">
          <button
            onClick={() => setActiveTab('sql')}
            className={`px-3 py-1 rounded-lg font-bold transition-all ${
              activeTab === 'sql'
                ? 'bg-amber-500 text-zinc-950'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Full Migration Script (SQL)
          </button>
          <button
            onClick={() => setActiveTab('architecture')}
            className={`px-3 py-1 rounded-lg font-bold transition-all ${
              activeTab === 'architecture'
                ? 'bg-amber-500 text-zinc-950'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Pari-Mutuel & Security Specs
          </button>
          <button
            onClick={() => setActiveTab('connect')}
            className={`px-3 py-1 rounded-lg font-bold transition-all ${
              activeTab === 'connect'
                ? 'bg-amber-500 text-zinc-950'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Live Supabase Connection
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'sql' && (
            <div className="relative">
              <pre className="p-4 bg-zinc-950 border border-zinc-800 rounded-2xl font-mono text-[11px] leading-relaxed text-zinc-300 overflow-x-auto selection:bg-amber-500 selection:text-zinc-950">
                <code>{SUPABASE_MIGRATION_SQL}</code>
              </pre>
            </div>
          )}

          {activeTab === 'architecture' && (
            <div className="space-y-6 text-xs text-zinc-300">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 space-y-2">
                  <div className="flex items-center gap-2 text-amber-400 font-bold uppercase text-[11px]">
                    <Shield className="w-4 h-4" />
                    Zero Client Trust & RLS Lockdown
                  </div>
                  <p className="text-zinc-400 leading-normal">
                    Row Level Security (RLS) is enabled on all tables. There are ZERO{' '}
                    <code>INSERT</code>, <code>UPDATE</code>, or <code>DELETE</code> policies
                    granted to <code>anon</code> or <code>authenticated</code> roles. All mutations
                    must execute inside PostgreSQL <code>SECURITY DEFINER</code> functions with{' '}
                    <code>SET search_path = public</code> and <code>auth.uid()</code> validation.
                  </p>
                </div>

                <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 space-y-2">
                  <div className="flex items-center gap-2 text-sky-400 font-bold uppercase text-[11px]">
                    <Layers className="w-4 h-4" />
                    Eligible Pool Isolation
                  </div>
                  <p className="text-zinc-400 leading-normal">
                    Only bets with <code>status = 'accepted'</code> (or settled won/lost) count
                    toward active pools. Pending, rejected, cancelled, and refunded bets never
                    inflate pool totals, bet counts, or indicative odds.
                  </p>
                </div>

                <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 space-y-2">
                  <div className="flex items-center gap-2 text-rose-400 font-bold uppercase text-[11px]">
                    <Activity className="w-4 h-4" />
                    1-Hour Lockout Enforcement
                  </div>
                  <p className="text-zinc-400 leading-normal">
                    Database constraint <code>chk_betting_closes_one_hour_before</code> mandates{' '}
                    <code>betting_closes_at = starts_at - INTERVAL '1 hour'</code>. The{' '}
                    <code>place_bet</code> RPC verifies that <code>NOW() &lt; betting_closes_at</code>{' '}
                    at server execution time.
                  </p>
                </div>

                <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold uppercase text-[11px]">
                    <Terminal className="w-4 h-4" />
                    Cent-Floor Rounding & Remainder
                  </div>
                  <p className="text-zinc-400 leading-normal">
                    During <code>settle_battle</code>, payouts are computed with{' '}
                    <code>TRUNC(raw_payout, 2)</code> to avoid creating fractional cents.
                    Any rounding remainder is explicitly accounted for in{' '}
                    <code>battle_settlements.rounding_remainder_allocated</code>.
                  </p>
                </div>
              </div>

              {/* RPC Summary Table */}
              <div className="bg-zinc-950 rounded-2xl border border-zinc-800 overflow-hidden">
                <div className="px-4 py-2.5 bg-zinc-900 border-b border-zinc-800 font-bold text-white text-xs">
                  RPC Function Reference
                </div>
                <div className="divide-y divide-zinc-800/60 font-mono text-[11px]">
                  <div className="p-3 flex justify-between">
                    <span className="text-amber-400 font-bold">request_mock_credit(p_amount, p_reference_code)</span>
                    <span className="text-zinc-400">User submits mock top-up</span>
                  </div>
                  <div className="p-3 flex justify-between">
                    <span className="text-amber-400 font-bold">approve_mock_credit(p_request_id)</span>
                    <span className="text-zinc-400">Admin-only: row locks wallet, adds funds, logs ledger</span>
                  </div>
                  <div className="p-3 flex justify-between">
                    <span className="text-amber-400 font-bold">place_bet(p_battle_id, p_side, p_stake, p_idempotency_key)</span>
                    <span className="text-zinc-400">Validates status & window, deducts stake, snapshots pool</span>
                  </div>
                  <div className="p-3 flex justify-between">
                    <span className="text-amber-400 font-bold">settle_battle(p_battle_id, p_winner_side, p_idempotency_key)</span>
                    <span className="text-zinc-400">Admin-only: distributes 90% pool to winners, logs fee</span>
                  </div>
                  <div className="p-3 flex justify-between">
                    <span className="text-amber-400 font-bold">cancel_battle(p_battle_id, p_reason, p_idempotency_key)</span>
                    <span className="text-zinc-400">Admin-only: refunds 100% of stakes to all bettors</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'connect' && (
            <div className="max-w-xl mx-auto space-y-4 py-4 text-xs">
              <div>
                <h4 className="text-sm font-bold text-white">Connect to External Supabase Project</h4>
                <p className="text-zinc-400 mt-1">
                  You can connect your live Supabase project by providing your URL and Anon Key.
                  (You can also run the app completely without external credentials using the built-in
                  transactional engine).
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                    NEXT_PUBLIC_SUPABASE_URL
                  </label>
                  <input
                    type="url"
                    placeholder="https://xyzcompany.supabase.co"
                    value={supabaseUrl}
                    onChange={(e) => setSupabaseUrl(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl font-mono text-zinc-200 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                    NEXT_PUBLIC_SUPABASE_ANON_KEY
                  </label>
                  <input
                    type="text"
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    value={anonKey}
                    onChange={(e) => setAnonKey(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl font-mono text-zinc-200 focus:outline-none focus:border-amber-500"
                  />
                </div>

                {testResult && (
                  <div
                    className={`p-3 rounded-xl border text-xs ${
                      testResult.success
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                    }`}
                  >
                    {testResult.message}
                  </div>
                )}

                <div className="pt-2 flex gap-3">
                  <button
                    onClick={handleTestConnection}
                    disabled={testingConn}
                    className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold uppercase tracking-wider text-xs shadow disabled:opacity-50"
                  >
                    {testingConn ? 'Testing Connection...' : 'Test & Save Connection'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
