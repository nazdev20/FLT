import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { Battle, BattleSide, MockCreditRequest } from '../types/database';
import { engineInstance, PRESET_PERSONAS } from '../lib/engine';
import { calculatePoolSummary, formatPHP } from '../lib/pari-mutuel';
import {
  Shield,
  Plus,
  CheckCircle,
  XCircle,
  Lock,
  Trophy,
  AlertTriangle,
  Clock,
  ArrowRight,
  TrendingUp,
  FileText,
  UserCheck,
} from 'lucide-react';

interface AdminDeskProps {
  onRefresh?: () => void;
}

export const AdminDesk: React.FC<AdminDeskProps> = ({ onRefresh }) => {
  const currentUser = engineInstance.getCurrentUser();
  const state = engineInstance.getState();

  // Create Battle Form State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newEmceeA, setNewEmceeA] = useState('');
  const [newEmceeB, setNewEmceeB] = useState('');
  const [newPhotoA, setNewPhotoA] = useState(
    'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=400&auto=format&fit=crop&q=80'
  );
  const [newPhotoB, setNewPhotoB] = useState(
    'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&auto=format&fit=crop&q=80'
  );
  // Default start: 3 hours in the future
  const defaultFutureDate = new Date(Date.now() + 3 * 3600 * 1000)
    .toISOString()
    .slice(0, 16);
  const [newStartsAt, setNewStartsAt] = useState(defaultFutureDate);
  const [createError, setCreateError] = useState<string | null>(null);

  // Settle Battle Modal State
  const [settlingBattle, setSettlingBattle] = useState<Battle | null>(null);
  const [selectedWinner, setSelectedWinner] = useState<BattleSide>('A');
  const [settleError, setSettleError] = useState<string | null>(null);

  // Cancel Battle Modal State
  const [cancellingBattle, setCancellingBattle] = useState<Battle | null>(null);
  const [cancelReason, setCancelReason] = useState('Organizer Event Reschedule');
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Filter for Mock Credit Requests
  const [creditFilter, setCreditFilter] = useState<'pending' | 'all'>('pending');

  const isAdmin = currentUser.role === 'admin';

  // Overall platform statistics
  const totalPlatformFees = state.ledger_entries
    .filter((l) => l.entry_type === 'platform_fee')
    .reduce((sum, l) => sum + l.amount, 0);

  const totalAcceptedBets = state.bets.filter((b) =>
    ['accepted', 'settled_won', 'settled_lost'].includes(b.status)
  );
  const totalVolume = totalAcceptedBets.reduce((sum, b) => sum + Number(b.stake), 0);

  // If not admin, show persona switch banner
  if (!isAdmin) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4 text-center space-y-6">
        <div className="w-16 h-16 rounded-3xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/30">
          <Shield className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-2xl font-black text-white">Administrator Access Required</h2>
          <p className="text-sm text-zinc-400 mt-2 max-w-md mx-auto">
            You are currently browsing as <strong>{currentUser.username}</strong> ({currentUser.email}),
            which is an authenticated bettor role.
          </p>
        </div>
        <div className="pt-2">
          <button
            onClick={() => {
              engineInstance.switchPersona(PRESET_PERSONAS[0].id);
              if (onRefresh) onRefresh();
            }}
            className="px-6 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-sm uppercase tracking-wider transition-all shadow-lg shadow-amber-500/20"
          >
            Switch to Arbiter Admin Persona
          </button>
        </div>
      </div>
    );
  }

  // Handle Mock Credit Approval
  const handleApproveCredit = (req: MockCreditRequest) => {
    try {
      engineInstance.approveMockCredit(req.id);
      if (onRefresh) onRefresh();
    } catch (e: any) {
      alert(e?.message || 'Approval failed');
    }
  };

  // Handle Mock Credit Rejection
  const handleRejectCredit = (req: MockCreditRequest) => {
    try {
      engineInstance.rejectMockCredit(req.id, 'Admin manual rejection');
      if (onRefresh) onRefresh();
    } catch (e: any) {
      alert(e?.message || 'Rejection failed');
    }
  };

  // Handle Create Battle Submit
  const handleCreateBattle = (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    try {
      if (!newTitle.trim() || !newEmceeA.trim() || !newEmceeB.trim()) {
        setCreateError('Please complete all title and emcee name fields.');
        return;
      }
      const startsDate = new Date(newStartsAt);
      if (isNaN(startsDate.getTime()) || startsDate.getTime() <= Date.now()) {
        setCreateError('Battle start time must be in the future.');
        return;
      }

      engineInstance.createBattle(
        newTitle,
        newEmceeA,
        newEmceeB,
        newPhotoA,
        newPhotoB,
        startsDate.toISOString()
      );

      setShowCreateModal(false);
      setNewTitle('');
      setNewEmceeA('');
      setNewEmceeB('');
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setCreateError(err?.message || 'Failed to create battle');
    }
  };

  // Handle Lock Battle
  const handleLockBattle = (battle: Battle) => {
    if (confirm(`Lock betting immediately for "${battle.title}"?`)) {
      try {
        engineInstance.lockBattle(battle.id);
        if (onRefresh) onRefresh();
      } catch (e: any) {
        alert(e?.message);
      }
    }
  };

  // Handle Settle Battle Submit
  const handleExecuteSettlement = () => {
    if (!settlingBattle) return;
    setSettleError(null);
    try {
      const idempotencyKey = `settle_${settlingBattle.id}_${Date.now()}`;
      engineInstance.settleBattle(settlingBattle.id, selectedWinner, idempotencyKey);

      // Trigger victory confetti!
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
      });

      setSettlingBattle(null);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setSettleError(err?.message || 'Settlement failed');
    }
  };

  // Handle Cancel Battle Submit
  const handleExecuteCancel = () => {
    if (!cancellingBattle) return;
    setCancelError(null);
    try {
      const idempotencyKey = `cancel_${cancellingBattle.id}_${Date.now()}`;
      engineInstance.cancelBattle(cancellingBattle.id, cancelReason, idempotencyKey);
      setCancellingBattle(null);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setCancelError(err?.message || 'Cancellation failed');
    }
  };

  const filteredCreditRequests =
    creditFilter === 'pending'
      ? state.mock_credit_requests.filter((r) => r.status === 'pending')
      : state.mock_credit_requests;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Admin Header & Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1 rounded bg-rose-500/20 text-rose-400">
              <Shield className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-black text-white">Battle Operator & Auditor Desk</h1>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Authoritative Settlement Desk • Simulated Credit Approval • 1-Hour Lockout Control
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-amber-500/20 self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          Create New Battle
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl">
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
            Total Pool Volume
          </span>
          <p className="text-xl font-black text-white font-mono mt-1">
            {formatPHP(totalVolume)}
          </p>
          <span className="text-[10px] text-zinc-400 mt-0.5 block">
            {totalAcceptedBets.length} accepted bets
          </span>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
            Platform Take (10%)
          </span>
          <p className="text-xl font-black text-amber-400 font-mono mt-1">
            {formatPHP(totalPlatformFees)}
          </p>
          <span className="text-[10px] text-zinc-400 mt-0.5 block">
            From settled matches
          </span>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl">
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
            Pending Top-Ups
          </span>
          <p className="text-xl font-black text-rose-400 font-mono mt-1">
            {state.mock_credit_requests.filter((r) => r.status === 'pending').length}
          </p>
          <span className="text-[10px] text-zinc-400 mt-0.5 block">
            Awaiting verification
          </span>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl">
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
            Active Battles
          </span>
          <p className="text-xl font-black text-indigo-400 font-mono mt-1">
            {state.battles.filter((b) => b.status === 'open' || b.status === 'locked').length}
          </p>
          <span className="text-[10px] text-zinc-400 mt-0.5 block">
            In Wagering / Locked
          </span>
        </div>
      </div>

      {/* SECTION 1: Mock Credit Approval Desk */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-xl">
        <div className="px-6 py-4 bg-zinc-950/80 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-black text-white">Mock Credit Verification Queue</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 font-mono">
              Test GCash / Maya
            </span>
          </div>

          <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-xl border border-zinc-800 text-xs">
            <button
              onClick={() => setCreditFilter('pending')}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                creditFilter === 'pending'
                  ? 'bg-amber-500 text-zinc-950'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Pending ({state.mock_credit_requests.filter((r) => r.status === 'pending').length})
            </button>
            <button
              onClick={() => setCreditFilter('all')}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                creditFilter === 'all'
                  ? 'bg-amber-500 text-zinc-950'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              All Requests
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          {filteredCreditRequests.length === 0 ? (
            <div className="py-8 text-center text-xs text-zinc-400">
              No mock credit requests found.
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-950/60 text-zinc-400 uppercase font-mono text-[10px] tracking-wider border-b border-zinc-800">
                <tr>
                  <th className="px-6 py-3">Bettor</th>
                  <th className="px-6 py-3">Reference Code</th>
                  <th className="px-6 py-3">Requested Amount</th>
                  <th className="px-6 py-3">Date Submitted</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {filteredCreditRequests.map((req) => {
                  const bettor = PRESET_PERSONAS.find((p) => p.id === req.user_id);
                  return (
                    <tr key={req.id} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-2">
                          <img
                            src={
                              bettor?.avatar ||
                              'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'
                            }
                            alt=""
                            className="w-6 h-6 rounded-md object-cover"
                          />
                          <span className="font-bold text-white">
                            {bettor?.username || req.user_id.slice(0, 8)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-3.5 font-mono text-zinc-300">
                        {req.mock_reference_code}
                      </td>
                      <td className="px-6 py-3.5 font-mono font-black text-amber-400 text-sm">
                        {formatPHP(req.amount)}
                      </td>
                      <td className="px-6 py-3.5 text-zinc-400">
                        {new Date(req.created_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-3.5">
                        {req.status === 'pending' && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold uppercase">
                            Pending
                          </span>
                        )}
                        {req.status === 'approved' && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold uppercase">
                            Approved
                          </span>
                        )}
                        {req.status === 'rejected' && (
                          <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[10px] font-bold uppercase">
                            Rejected
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        {req.status === 'pending' ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleApproveCredit(req)}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 shadow"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              Approve
                            </button>
                            <button
                              onClick={() => handleRejectCredit(req)}
                              className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-rose-900/40 text-zinc-400 hover:text-rose-300 text-xs font-semibold"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-zinc-400 text-[11px] font-mono">
                            {req.reviewed_at
                              ? new Date(req.reviewed_at).toLocaleTimeString()
                              : 'Done'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* SECTION 2: Active Battles Control Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-xl">
        <div className="px-6 py-4 bg-zinc-950/80 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-black text-white">Battle Settlement & Status Desk</h2>
          </div>
          <span className="text-xs text-zinc-400 font-mono">
            {state.battles.length} Total Matches
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-950/60 text-zinc-400 uppercase font-mono text-[10px] tracking-wider border-b border-zinc-800">
              <tr>
                <th className="px-6 py-3">Match Title</th>
                <th className="px-6 py-3">Matchup</th>
                <th className="px-6 py-3">Closes At (1h Rule)</th>
                <th className="px-6 py-3">Total Pool</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Admin Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {state.battles.map((b) => {
                const summary = calculatePoolSummary(state.bets, b.id, b.fee_rate);
                return (
                  <tr key={b.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="px-6 py-3.5 font-bold text-white max-w-[220px] truncate">
                      {b.title}
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-2 text-zinc-300">
                        <span className="font-bold text-rose-400">{b.emcee_a}</span>
                        <span className="text-zinc-400 text-[10px]">vs</span>
                        <span className="font-bold text-sky-400">{b.emcee_b}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3.5 font-mono text-zinc-400 text-[11px]">
                      {new Date(b.betting_closes_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-6 py-3.5 font-mono font-bold text-amber-400">
                      {formatPHP(summary.totalPool)}
                    </td>
                    <td className="px-6 py-3.5">
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
                          Settled ({b.winner_side})
                        </span>
                      )}
                      {b.status === 'cancelled' && (
                        <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[10px] font-bold uppercase">
                          Cancelled
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {b.status === 'open' && (
                          <button
                            onClick={() => handleLockBattle(b)}
                            className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold flex items-center gap-1"
                          >
                            <Lock className="w-3 h-3" />
                            Lock
                          </button>
                        )}

                        {(b.status === 'open' || b.status === 'locked') && (
                          <>
                            <button
                              onClick={() => {
                                setSettlingBattle(b);
                                setSelectedWinner('A');
                              }}
                              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs flex items-center gap-1 shadow"
                            >
                              <Trophy className="w-3.5 h-3.5" />
                              Settle
                            </button>
                            <button
                              onClick={() => setCancellingBattle(b)}
                              className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold"
                            >
                              Cancel & Refund
                            </button>
                          </>
                        )}

                        {b.status === 'settled' && (
                          <span className="text-[11px] text-zinc-400 font-mono">
                            Paid {formatPHP(summary.distributablePool)}
                          </span>
                        )}
                        {b.status === 'cancelled' && (
                          <span className="text-[11px] text-rose-400 font-mono">
                            Refunded
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: Create New Battle */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="px-6 py-4 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="text-base font-black text-white">Create New Rap Battle</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-zinc-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateBattle} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
                  Event / Match Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ahon 15 Finals - Battle of the Year"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-rose-400 mb-1">
                    Side A Emcee Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Abra"
                    value={newEmceeA}
                    onChange={(e) => setNewEmceeA(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-white focus:outline-none focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-sky-400 mb-1">
                    Side B Emcee Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sak Maestro"
                    value={newEmceeB}
                    onChange={(e) => setNewEmceeB(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-white focus:outline-none focus:border-sky-500"
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
                    value={newPhotoA}
                    onChange={(e) => setNewPhotoA(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-zinc-400 mb-1">
                    Side B Photo URL
                  </label>
                  <input
                    type="url"
                    value={newPhotoB}
                    onChange={(e) => setNewPhotoB(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
                  Battle Starts At (Local Time)
                </label>
                <input
                  type="datetime-local"
                  required
                  value={newStartsAt}
                  onChange={(e) => setNewStartsAt(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-white font-mono"
                />
                <p className="text-[11px] text-amber-400/80 mt-1 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Betting will strictly close 1 hour before this start time.
                </p>
              </div>

              {createError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                  {createError}
                </div>
              )}

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-black uppercase tracking-wider shadow"
                >
                  Publish Battle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Settle Battle Breakdown */}
      {settlingBattle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="px-6 py-4 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-400" />
                Audited Settlement Breakdown
              </h3>
              <button
                onClick={() => setSettlingBattle(null)}
                className="text-zinc-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-zinc-400">
                Official outcome calculation for <strong>{settlingBattle.title}</strong>
              </p>

              {/* Select Winner Side */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                  Select Official Winner
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedWinner('A')}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      selectedWinner === 'A'
                        ? 'bg-rose-500/20 border-rose-500 text-white'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                    }`}
                  >
                    <span className="text-[10px] uppercase font-bold text-rose-400">Side A</span>
                    <p className="font-black text-sm text-white">{settlingBattle.emcee_a}</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedWinner('B')}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      selectedWinner === 'B'
                        ? 'bg-sky-500/20 border-sky-500 text-white'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                    }`}
                  >
                    <span className="text-[10px] uppercase font-bold text-sky-400">Side B</span>
                    <p className="font-black text-sm text-white">{settlingBattle.emcee_b}</p>
                  </button>
                </div>
              </div>

              {/* Settlement Math Audit */}
              {(() => {
                const summary = calculatePoolSummary(
                  state.bets,
                  settlingBattle.id,
                  settlingBattle.fee_rate
                );
                const winPool = selectedWinner === 'A' ? summary.poolA : summary.poolB;
                const winCount =
                  selectedWinner === 'A' ? summary.betsCountA : summary.betsCountB;

                return (
                  <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Total Accepted Pool:</span>
                      <span className="font-mono font-bold text-white">
                        {formatPHP(summary.totalPool)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">House Take (10.0%):</span>
                      <span className="font-mono font-bold text-amber-400">
                        {formatPHP(summary.platformFee)}
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-zinc-800/80 pt-1">
                      <span className="text-zinc-400 font-bold">Distributable Pool (90%):</span>
                      <span className="font-mono font-black text-emerald-400">
                        {formatPHP(summary.distributablePool)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Winning Pool ({selectedWinner}):</span>
                      <span className="font-mono font-bold text-white">
                        {formatPHP(winPool)} ({winCount} winning bets)
                      </span>
                    </div>

                    {winPool === 0 && (
                      <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] mt-2">
                        Notice: Winning pool is ₱0.00. Executing settlement will automatically refund
                        100% of all accepted bets to bettors' wallets without deducting fees.
                      </div>
                    )}
                  </div>
                );
              })()}

              {settleError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                  {settleError}
                </div>
              )}

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setSettlingBattle(null)}
                  className="px-4 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteSettlement}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-black uppercase tracking-wider shadow flex items-center gap-1.5"
                >
                  <Trophy className="w-4 h-4" />
                  Execute Atomic Payouts
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Cancel & 100% Refund Battle */}
      {cancellingBattle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              Cancel & 100% Refund Battle
            </h3>
            <p className="text-xs text-zinc-400">
              Are you sure you want to cancel <strong>{cancellingBattle.title}</strong>? All
              accepted stakes will be credited back immediately to user wallets with double-entry
              ledger audit records.
            </p>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
                Cancellation Reason
              </label>
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white"
              />
            </div>

            {cancelError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                {cancelError}
              </div>
            )}

            <div className="pt-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setCancellingBattle(null)}
                className="px-4 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleExecuteCancel}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black uppercase tracking-wider shadow"
              >
                Confirm 100% Refund
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
