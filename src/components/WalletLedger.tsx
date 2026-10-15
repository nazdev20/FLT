import React, { useState } from 'react';
import { engineInstance } from '../lib/engine';
import { formatPHP } from '../lib/pari-mutuel';
import { Bet, LedgerEntry } from '../types/database';
import {
  Wallet as WalletIcon,
  PlusCircle,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Download,
  ArrowUpRight,
  ArrowDownLeft,
  Filter,
  FileSpreadsheet,
} from 'lucide-react';

interface WalletLedgerProps {
  onOpenTopUp: () => void;
  onRefresh?: () => void;
}

export const WalletLedger: React.FC<WalletLedgerProps> = ({
  onOpenTopUp,
  onRefresh,
}) => {
  const currentUser = engineInstance.getCurrentUser();
  const wallet = engineInstance.getWallet(currentUser.id);
  const state = engineInstance.getState();

  const [activeSubTab, setActiveSubTab] = useState<'bets' | 'ledger'>('bets');
  const [betFilter, setBetFilter] = useState<string>('all');
  const [ledgerFilter, setLedgerFilter] = useState<string>('all');

  // Filter bets for current user (or all if admin)
  const myBets = state.bets.filter(
    (b) => currentUser.role === 'admin' || b.user_id === currentUser.id
  );

  const filteredBets = myBets.filter((b) => {
    if (betFilter === 'all') return true;
    if (betFilter === 'active') return b.status === 'accepted';
    if (betFilter === 'won') return b.status === 'settled_won';
    if (betFilter === 'lost') return b.status === 'settled_lost';
    if (betFilter === 'refunded') return b.status === 'refunded';
    return true;
  });

  // Filter ledger entries
  const myLedger = state.ledger_entries.filter(
    (l) => currentUser.role === 'admin' || l.user_id === currentUser.id
  );

  const filteredLedger = myLedger.filter((l) => {
    if (ledgerFilter === 'all') return true;
    return l.entry_type === ledgerFilter;
  });

  // CSV Export
  const handleExportCSV = () => {
    const headers = [
      'Timestamp',
      'Entry ID',
      'User ID',
      'Entry Type',
      'Amount',
      'Balance After',
      'Idempotency Key',
    ];
    const rows = filteredLedger.map((l) => [
      l.created_at,
      l.id,
      l.user_id || 'SYSTEM_PLATFORM',
      l.entry_type,
      l.amount,
      l.balance_after ?? 'N/A',
      l.idempotency_key,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ledger_audit_${currentUser.username}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Lifetime Stats
  const wonBets = myBets.filter((b) => b.status === 'settled_won');
  const totalNetProfit = wonBets.reduce((sum, b) => sum + (b.net_profit || 0), 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Wallet Balance Hero Card */}
      <div className="relative overflow-hidden bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 border border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
        <div className="absolute right-0 top-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 text-zinc-400 text-xs font-bold uppercase tracking-wider">
              <WalletIcon className="w-4 h-4 text-amber-400" />
              <span>Simulated Bettor Balance</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono">
                {currentUser.username} ({currentUser.role})
              </span>
            </div>

            <div className="mt-2 flex items-baseline gap-3">
              <span className="text-4xl sm:text-5xl font-black text-white font-mono tracking-tight">
                {formatPHP(wallet.simulated_balance)}
              </span>
              <span className="text-xs font-mono text-zinc-400">PHP (SIMULATED)</span>
            </div>

            <p className="text-xs text-zinc-400 mt-2 max-w-xl">
              Strict Test-Mode isolation. Top-up requests require Admin review via PostgreSQL RPC
              before simulated funds are credited.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onOpenTopUp}
              className="px-5 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-amber-500/20 flex items-center gap-2"
            >
              <PlusCircle className="w-4 h-4" />
              Request Mock GCash / Maya
            </button>
          </div>
        </div>

        {/* Quick Highlights */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-6 border-t border-zinc-800/80">
          <div>
            <span className="text-[11px] text-zinc-400 uppercase font-semibold">Total Bets</span>
            <p className="text-lg font-black text-white font-mono mt-0.5">{myBets.length}</p>
          </div>
          <div>
            <span className="text-[11px] text-zinc-400 uppercase font-semibold">Accepted Active</span>
            <p className="text-lg font-black text-amber-400 font-mono mt-0.5">
              {myBets.filter((b) => b.status === 'accepted').length}
            </p>
          </div>
          <div>
            <span className="text-[11px] text-zinc-400 uppercase font-semibold">Settled Won</span>
            <p className="text-lg font-black text-emerald-400 font-mono mt-0.5">
              {wonBets.length}
            </p>
          </div>
          <div>
            <span className="text-[11px] text-zinc-400 uppercase font-semibold">Net Winnings</span>
            <p
              className={`text-lg font-black font-mono mt-0.5 ${
                totalNetProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {totalNetProfit >= 0 ? '+' : ''}
              {formatPHP(totalNetProfit)}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs: My Bets vs Double-Entry Ledger */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveSubTab('bets')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeSubTab === 'bets'
                  ? 'bg-amber-500 text-zinc-950 shadow'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
              }`}
            >
              Wager History ({myBets.length})
            </button>
            <button
              onClick={() => setActiveSubTab('ledger')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeSubTab === 'ledger'
                  ? 'bg-amber-500 text-zinc-950 shadow'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
              }`}
            >
              Audit Ledger ({myLedger.length})
            </button>
          </div>

          {activeSubTab === 'bets' ? (
            <div className="flex items-center gap-1 text-xs">
              {['all', 'active', 'won', 'lost', 'refunded'].map((f) => (
                <button
                  key={f}
                  onClick={() => setBetFilter(f)}
                  className={`px-2.5 py-1 rounded-lg capitalize font-semibold transition-all ${
                    betFilter === f
                      ? 'bg-zinc-800 text-amber-400'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <select
                value={ledgerFilter}
                onChange={(e) => setLedgerFilter(e.target.value)}
                className="bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 rounded-lg px-2.5 py-1"
              >
                <option value="all">All Transactions</option>
                <option value="mock_credit_approved">Mock Credits</option>
                <option value="bet_stake_reserve">Stake Reserves</option>
                <option value="bet_payout">Payouts</option>
                <option value="bet_refund">Refunds</option>
                <option value="platform_fee">Platform Fees</option>
              </select>

              <button
                onClick={handleExportCSV}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold"
              >
                <Download className="w-3.5 h-3.5" />
                Export CSV
              </button>
            </div>
          )}
        </div>

        {/* TAB 1: Bets Table */}
        {activeSubTab === 'bets' && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              {filteredBets.length === 0 ? (
                <div className="py-12 text-center text-xs text-zinc-400">
                  No wagers matching the current filter.
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-950/60 text-zinc-400 uppercase font-mono text-[10px] tracking-wider border-b border-zinc-800">
                    <tr>
                      <th className="px-6 py-3.5">Battle Match</th>
                      <th className="px-6 py-3.5">Side Chosen</th>
                      <th className="px-6 py-3.5">Stake</th>
                      <th className="px-6 py-3.5">Snapshot Odds</th>
                      <th className="px-6 py-3.5">Gross Payout</th>
                      <th className="px-6 py-3.5">Status</th>
                      <th className="px-6 py-3.5 text-right">Placed At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {filteredBets.map((bet) => {
                      const battle = state.battles.find((b) => b.id === bet.battle_id);
                      const emceeName =
                        bet.side === 'A' ? battle?.emcee_a : battle?.emcee_b;

                      return (
                        <tr key={bet.id} className="hover:bg-zinc-800/30 transition-colors">
                          <td className="px-6 py-4 font-bold text-white max-w-[200px] truncate">
                            {battle?.title || bet.battle_id.slice(0, 8)}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                bet.side === 'A'
                                  ? 'bg-rose-500/20 text-rose-300'
                                  : 'bg-sky-500/20 text-sky-300'
                              }`}
                            >
                              Side {bet.side}: {emceeName}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-mono font-bold text-amber-400">
                            {formatPHP(bet.stake)}
                          </td>
                          <td className="px-6 py-4 font-mono text-zinc-300">
                            {bet.snapshot_indicative_odds
                              ? `${bet.snapshot_indicative_odds.toFixed(2)}x`
                              : '--'}
                          </td>
                          <td className="px-6 py-4 font-mono font-bold">
                            {bet.status === 'settled_won' ? (
                              <span className="text-emerald-400">
                                {formatPHP(bet.gross_payout)}{' '}
                                <small className="text-[10px] text-emerald-500">
                                  (+{formatPHP(bet.net_profit)})
                                </small>
                              </span>
                            ) : bet.status === 'refunded' ? (
                              <span className="text-zinc-400 font-normal">
                                {formatPHP(bet.stake)} (Refund)
                              </span>
                            ) : bet.status === 'settled_lost' ? (
                              <span className="text-zinc-500">₱0.00</span>
                            ) : (
                              <span className="text-zinc-400 italic">Pending match</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {bet.status === 'accepted' && (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold uppercase">
                                Accepted
                              </span>
                            )}
                            {bet.status === 'settled_won' && (
                              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold uppercase">
                                Won
                              </span>
                            )}
                            {bet.status === 'settled_lost' && (
                              <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 text-[10px] font-bold uppercase">
                                Lost
                              </span>
                            )}
                            {bet.status === 'refunded' && (
                              <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[10px] font-bold uppercase">
                                Refunded
                              </span>
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
              )}
            </div>
          </div>
        )}

        {/* TAB 2: Double-Entry Financial Ledger */}
        {activeSubTab === 'ledger' && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-xl">
            <div className="px-6 py-3 bg-zinc-950/70 border-b border-zinc-800 flex items-center justify-between text-xs text-zinc-400">
              <span>Financial Audit Trail • Immutable Double-Entry Ledger</span>
              <span className="font-mono text-[11px]">
                Showing {filteredLedger.length} entries
              </span>
            </div>

            <div className="overflow-x-auto">
              {filteredLedger.length === 0 ? (
                <div className="py-12 text-center text-xs text-zinc-400">
                  No ledger entries recorded yet.
                </div>
              ) : (
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-zinc-950/60 text-zinc-400 uppercase text-[10px] tracking-wider border-b border-zinc-800">
                    <tr>
                      <th className="px-6 py-3.5">Timestamp</th>
                      <th className="px-6 py-3.5">Entry Type</th>
                      <th className="px-6 py-3.5">Transaction Amount</th>
                      <th className="px-6 py-3.5">Balance After</th>
                      <th className="px-6 py-3.5">Idempotency Key</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {filteredLedger.map((item) => {
                      const isCredit = item.amount > 0;
                      return (
                        <tr key={item.id} className="hover:bg-zinc-800/30 transition-colors">
                          <td className="px-6 py-3.5 text-zinc-400 text-[11px]">
                            {new Date(item.created_at).toLocaleString()}
                          </td>
                          <td className="px-6 py-3.5">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold font-sans uppercase ${
                                item.entry_type === 'mock_credit_approved'
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : item.entry_type === 'bet_payout'
                                  ? 'bg-amber-500/20 text-amber-300'
                                  : item.entry_type === 'bet_stake_reserve'
                                  ? 'bg-rose-500/20 text-rose-300'
                                  : item.entry_type === 'bet_refund'
                                  ? 'bg-indigo-500/20 text-indigo-300'
                                  : 'bg-zinc-800 text-zinc-300'
                              }`}
                            >
                              {item.entry_type.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="px-6 py-3.5 font-bold">
                            <span
                              className={`flex items-center gap-1 ${
                                isCredit ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {isCredit ? (
                                <ArrowUpRight className="w-3.5 h-3.5" />
                              ) : (
                                <ArrowDownLeft className="w-3.5 h-3.5" />
                              )}
                              {formatPHP(Math.abs(item.amount))}
                            </span>
                          </td>
                          <td className="px-6 py-3.5 text-zinc-300 font-bold">
                            {item.balance_after !== null ? formatPHP(item.balance_after) : '--'}
                          </td>
                          <td className="px-6 py-3.5 text-zinc-400 text-[10px] truncate max-w-[200px]">
                            {item.idempotency_key}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
