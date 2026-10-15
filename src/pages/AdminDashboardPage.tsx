import React, { useState, useEffect } from 'react';
import { FLTService } from '../lib/flt-service';
import { formatPHP } from '../lib/pari-mutuel';
import {
  Shield,
  Clock,
  Swords,
  TrendingUp,
  UserCheck,
  PlusCircle,
  AlertTriangle,
  ArrowRight,
  Loader2,
  RefreshCw,
} from 'lucide-react';

interface AdminDashboardPageProps {
  onNavigateToVerification: () => void;
  onNavigateToBattles: () => void;
}

export const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({
  onNavigateToVerification,
  onNavigateToBattles,
}) => {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [stats, setStats] = useState({
    pendingPaymentsCount: 0,
    totalBattlesCount: 0,
    activeBattlesCount: 0,
    totalAcceptedPool: 0,
    totalPlatformFees: 0,
  });

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const admin = await FLTService.checkIsAdmin();
      setIsAdmin(admin);

      if (admin) {
        const [battles, pendingSubs] = await Promise.all([
          FLTService.fetchBattles(),
          FLTService.fetchPaymentSubmissions('pending'),
        ]);

        const active = battles.filter((b) => b.status === 'open' || b.status === 'locked').length;
        const totalPool = battles.reduce((sum, b) => sum + (b.total_pool || 0), 0);
        const fees = battles.reduce((sum, b) => sum + (b.platform_fee || 0), 0);

        setStats({
          pendingPaymentsCount: pendingSubs.length,
          totalBattlesCount: battles.length,
          activeBattlesCount: active,
          totalAcceptedPool: totalPool,
          totalPlatformFees: fees,
        });
      }
    } catch (e) {
      console.warn('Dashboard load error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="py-24 text-center space-y-3">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin mx-auto" />
        <p className="text-xs text-zinc-400">Verifying administrative credentials...</p>
      </div>
    );
  }

  if (isAdmin === false) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center space-y-5">
        <div className="w-16 h-16 rounded-3xl bg-rose-500/15 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/30">
          <Shield className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-black text-white">Administrator Access Required</h2>
        <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
          The current authenticated session does not have administrative privileges in{' '}
          <code>FLT.profiles</code> or failed the <code>FLT.is_admin()</code> server check.
        </p>
        <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-2xl text-xs text-zinc-300 max-w-md mx-auto">
          Tip: You can switch to the <strong>FlipTopArbiter (Admin)</strong> test persona in the User
          Profile page to evaluate the administrator desk.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
              <Shield className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-black text-white">Battle Operations & Verification Desk</h1>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Authoritative manual payment review • Battle creation • Real-time pool auditing
          </p>
        </div>

        <button
          onClick={loadDashboardData}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 hover:text-white transition-all self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh Metrics
        </button>
      </div>

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Pending Payments Queue */}
        <div
          onClick={onNavigateToVerification}
          className="bg-zinc-900 border border-zinc-800 hover:border-amber-500/50 p-5 rounded-3xl cursor-pointer transition-all space-y-2 shadow-xl group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
              Pending Payments
            </span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-3xl font-black text-amber-400 font-mono">
            {stats.pendingPaymentsCount}
          </p>
          <div className="flex items-center gap-1 text-[11px] text-zinc-400 group-hover:text-amber-300 font-medium pt-1">
            <span>Review Queue</span>
            <ArrowRight className="w-3 h-3" />
          </div>
        </div>

        {/* Total Accepted Pool */}
        <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-3xl space-y-2 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
              Accepted Pool Volume
            </span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-black text-white font-mono truncate">
            {formatPHP(stats.totalAcceptedPool)}
          </p>
          <span className="text-[10px] text-zinc-400 block pt-1">
            From verified bets only
          </span>
        </div>

        {/* Active Matches */}
        <div
          onClick={onNavigateToBattles}
          className="bg-zinc-900 border border-zinc-800 hover:border-sky-500/50 p-5 rounded-3xl cursor-pointer transition-all space-y-2 shadow-xl group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
              Active Matches
            </span>
            <Swords className="w-4 h-4 text-sky-400" />
          </div>
          <p className="text-3xl font-black text-sky-400 font-mono">
            {stats.activeBattlesCount}
          </p>
          <div className="flex items-center gap-1 text-[11px] text-zinc-400 group-hover:text-sky-300 font-medium pt-1">
            <span>Manage Battles</span>
            <ArrowRight className="w-3 h-3" />
          </div>
        </div>

        {/* 10% House Cut */}
        <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-3xl space-y-2 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
              Platform Take (10%)
            </span>
            <Shield className="w-4 h-4 text-purple-400" />
          </div>
          <p className="text-2xl font-black text-purple-400 font-mono truncate">
            {formatPHP(stats.totalPlatformFees)}
          </p>
          <span className="text-[10px] text-zinc-400 block pt-1">
            Audited platform fee
          </span>
        </div>
      </div>

      {/* Quick Action Navigation Panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Verification Queue Panel */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-amber-400" />
              <h3 className="text-base font-black text-white">Payment Verification Desk</h3>
            </div>
            {stats.pendingPaymentsCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-500 text-white">
                {stats.pendingPaymentsCount} Action Needed
              </span>
            )}
          </div>

          <p className="text-xs text-zinc-400 leading-relaxed">
            Review user-submitted payment references and optional receipts. Verify each transaction
            against the receiving merchant account before accepting the bet into the live pool.
          </p>

          <button
            onClick={onNavigateToVerification}
            className="w-full py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
          >
            Open Verification Queue ({stats.pendingPaymentsCount})
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Battle Management Panel */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center gap-2">
            <Swords className="w-5 h-5 text-sky-400" />
            <h3 className="text-base font-black text-white">Battle Management & Lock Desk</h3>
          </div>

          <p className="text-xs text-zinc-400 leading-relaxed">
            Create new rap battle cards via <code>FLT.create_battle</code>, trigger early betting
            lockouts via <code>FLT.lock_battle</code>, and view settlement metrics.
          </p>

          <button
            onClick={onNavigateToBattles}
            className="w-full py-3 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2"
          >
            Open Battle Manager
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
