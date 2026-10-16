import React, { useState, useEffect, useCallback } from 'react';
import { Battle, BattleSide } from './types/database';
import { FLTService, getClient, localRepo } from './lib/flt-service';
import { Navbar, NavTab } from './components/Navbar';
import { BattleListPage } from './ui/pages/BattleListPage';
import { BattleDetailPage } from './ui/pages/BattleDetailPage';
import { MyBetsPage } from './ui/pages/MyBetsPage';
import { AdminDashboardPage } from './ui/pages/AdminDashboardPage';
import { AdminVerificationPage } from './ui/pages/AdminVerificationPage';
import { AdminBattleManagementPage } from './ui/pages/AdminBattleManagementPage';
import { UserProfilePage } from './ui/pages/UserProfilePage';
import { AuthPage } from './ui/pages/AuthPage';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('battles');
  const [selectedBattle, setSelectedBattle] = useState<Battle | null>(null);
  const [initialSide, setInitialSide] = useState<BattleSide>('A');
  const [pendingCount, setPendingCount] = useState(0);
  const [notice, setNotice] = useState('');

  const loadPendingCount = useCallback(async () => {
    try {
      if (!(await FLTService.checkIsAdmin())) {
        setPendingCount(0);
        return;
      }
      const subs = await FLTService.fetchPaymentSubmissions('pending');
      setPendingCount(subs.length);
    } catch {
      setPendingCount(0);
    }
  }, []);

  useEffect(() => {
    void loadPendingCount();
    const unsub = localRepo.subscribe(() => { void loadPendingCount(); });
    const client = getClient();
    const { data } = client?.auth?.onAuthStateChange(() => {
      window.setTimeout(() => { void loadPendingCount(); }, 0);
    }) || { data: { subscription: null } };
    return () => {
      unsub();
      data?.subscription?.unsubscribe();
    };
  }, [loadPendingCount]);

  const handleNavigation = async (tab: NavTab) => {
    setNotice('');
    if (tab === 'login' || tab === 'battles' || tab === 'battle_detail') {
      if (tab === 'battle_detail') {
        const { user } = await FLTService.getCurrentUser();
        if (!user) {
          setNotice('Sign in to continue to your private betting workflow.');
          setActiveTab('login');
          return;
        }
      }
      setActiveTab(tab);
      return;
    }

    const { user, profile } = await FLTService.getCurrentUser();
    if (!user || !profile) {
      setNotice('Please sign in to access your account.');
      setActiveTab('login');
      return;
    }
    if (tab.startsWith('admin') && !(await FLTService.checkIsAdmin())) {
      setNotice('Administrator access is required for that page.');
      setActiveTab('battles');
      return;
    }
    setActiveTab(tab);
  };

  const handleSelectBattle = async (battle: Battle, side: BattleSide = 'A') => {
    const { user } = await FLTService.getCurrentUser();
    if (!user) {
      setSelectedBattle(battle);
      setInitialSide(side);
      setNotice('Sign in to continue to your betting workflow.');
      setActiveTab('login');
      return;
    }
    setSelectedBattle(battle);
    setInitialSide(side);
    setActiveTab('battle_detail');
  };

  const handleSignedIn = async () => {
    setNotice('');
    await loadPendingCount();
    setActiveTab(selectedBattle ? 'battle_detail' : 'battles');
  };

  const handleSignOut = async () => {
    const client = getClient();
    if (client) await client.auth.signOut();
    setPendingCount(0);
    setSelectedBattle(null);
    setNotice('You have been signed out.');
    setActiveTab('battles');
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-amber-500 selection:text-zinc-950">
      <Navbar activeTab={activeTab} setActiveTab={(tab) => { void handleNavigation(tab); }} pendingCount={pendingCount} />

      {activeTab.startsWith('admin') && (
        <div className="border-b border-zinc-800 bg-zinc-900/60">
          <div className="mx-auto flex max-w-7xl items-center gap-2 overflow-x-auto px-4 py-2 text-xs sm:px-6 lg:px-8">
            <button onClick={() => { void handleNavigation('admin_dashboard'); }} className={`rounded-xl px-3 py-1.5 font-bold transition-all ${activeTab === 'admin_dashboard' ? 'bg-amber-500 text-zinc-950 shadow' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}>Overview</button>
            <button onClick={() => { void handleNavigation('admin_verification'); }} className={`rounded-xl px-3 py-1.5 font-bold transition-all ${activeTab === 'admin_verification' ? 'bg-amber-500 text-zinc-950 shadow' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}>Verification Queue ({pendingCount})</button>
            <button onClick={() => { void handleNavigation('admin_battles'); }} className={`rounded-xl px-3 py-1.5 font-bold transition-all ${activeTab === 'admin_battles' ? 'bg-amber-500 text-zinc-950 shadow' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}>Battle Management</button>
          </div>
        </div>
      )}

      {notice && <div role="status" className="mx-auto mt-4 w-full max-w-7xl px-4 sm:px-6 lg:px-8"><p className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">{notice}</p></div>}

      <main className="flex-1">
        {activeTab === 'battles' && <BattleListPage onSelectBattle={(battle, side) => { void handleSelectBattle(battle, side); }} />}
        {activeTab === 'battle_detail' && selectedBattle && <BattleDetailPage battle={selectedBattle} initialSide={initialSide} onBack={() => { void handleNavigation('battles'); }} onViewMyBets={() => { void handleNavigation('my_bets'); }} />}
        {activeTab === 'my_bets' && <MyBetsPage onBrowseBattles={() => { void handleNavigation('battles'); }} />}
        {activeTab === 'admin_dashboard' && <AdminDashboardPage onNavigateToVerification={() => { void handleNavigation('admin_verification'); }} onNavigateToBattles={() => { void handleNavigation('admin_battles'); }} />}
        {activeTab === 'admin_verification' && <AdminVerificationPage />}
        {activeTab === 'admin_battles' && <AdminBattleManagementPage />}
        {activeTab === 'profile' && <UserProfilePage onSignOut={() => { void handleSignOut(); }} />}
        {activeTab === 'login' && <AuthPage onSignedIn={() => { void handleSignedIn(); }} />}
      </main>

      <footer className="space-y-1 border-t border-zinc-800/80 bg-zinc-950 py-6 text-center text-xs text-zinc-400">
        <p className="font-semibold">FlipTop Battle Arena</p>
        <p className="text-[11px]">Payment submissions require administrator review. Use this prototype only in accordance with applicable rules and laws.</p>
      </footer>
    </div>
  );
}
