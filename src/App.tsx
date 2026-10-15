import React, { useState, useEffect } from 'react';
import { Battle, BattleSide } from './types/database';
import { FLTService, localRepo } from './lib/flt-service';
import { Navbar, NavTab } from './components/Navbar';
import { BattleListPage } from './pages/BattleListPage';
import { BattleDetailPage } from './pages/BattleDetailPage';
import { MyBetsPage } from './pages/MyBetsPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { AdminVerificationPage } from './pages/AdminVerificationPage';
import { AdminBattleManagementPage } from './pages/AdminBattleManagementPage';
import { UserProfilePage } from './pages/UserProfilePage';
import {
  Shield,
  Clock,
  Swords,
  Layers,
  Database,
  AlertTriangle,
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('battles');
  const [selectedBattle, setSelectedBattle] = useState<Battle | null>(null);
  const [initialSide, setInitialSide] = useState<BattleSide>('A');
  const [pendingCount, setPendingCount] = useState<number>(0);

  const loadPendingCount = async () => {
    try {
      const subs = await FLTService.fetchPaymentSubmissions('pending');
      setPendingCount(subs.length);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadPendingCount();
    const unsub = localRepo.subscribe(loadPendingCount);
    return () => {
      unsub();
    };
  }, []);

  const handleSelectBattle = (battle: Battle, side: BattleSide = 'A') => {
    setSelectedBattle(battle);
    setInitialSide(side);
    setActiveTab('battle_detail');
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-amber-500 selection:text-zinc-950">
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        pendingCount={pendingCount}
      />

      {/* Sub-Header for Admin Sections */}
      {activeTab.startsWith('admin') && (
        <div className="bg-zinc-900/60 border-b border-zinc-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-2 py-2 text-xs">
            <button
              onClick={() => setActiveTab('admin_dashboard')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                activeTab === 'admin_dashboard'
                  ? 'bg-amber-500 text-zinc-950 shadow'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
            >
              Overview Dashboard
            </button>
            <button
              onClick={() => setActiveTab('admin_verification')}
              className={`relative px-3 py-1.5 rounded-xl font-bold transition-all ${
                activeTab === 'admin_verification'
                  ? 'bg-amber-500 text-zinc-950 shadow'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
            >
              Verification Queue ({pendingCount})
            </button>
            <button
              onClick={() => setActiveTab('admin_battles')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                activeTab === 'admin_battles'
                  ? 'bg-amber-500 text-zinc-950 shadow'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
            >
              Battle Creation & Lock Desk
            </button>
          </div>
        </div>
      )}

      {/* Main Pages Router */}
      <main className="flex-1">
        {/* Page 1: Battle List */}
        {activeTab === 'battles' && (
          <BattleListPage onSelectBattle={handleSelectBattle} />
        )}

        {/* Page 2 & 3: Battle Detail & QR Payment Instructions */}
        {activeTab === 'battle_detail' && selectedBattle && (
          <BattleDetailPage
            battle={selectedBattle}
            initialSide={initialSide}
            onBack={() => setActiveTab('battles')}
            onViewMyBets={() => setActiveTab('my_bets')}
          />
        )}

        {/* Page 4: My Bets & Payment Submissions */}
        {activeTab === 'my_bets' && (
          <MyBetsPage onBrowseBattles={() => setActiveTab('battles')} />
        )}

        {/* Page 5: Admin Dashboard */}
        {activeTab === 'admin_dashboard' && (
          <AdminDashboardPage
            onNavigateToVerification={() => setActiveTab('admin_verification')}
            onNavigateToBattles={() => setActiveTab('admin_battles')}
          />
        )}

        {/* Page 6: Admin Payment Verification Queue */}
        {activeTab === 'admin_verification' && <AdminVerificationPage />}

        {/* Page 7: Admin Battle Management & Lock Desk */}
        {activeTab === 'admin_battles' && <AdminBattleManagementPage />}

        {/* Page 8: User Profile & Supabase FLT Config */}
        {activeTab === 'profile' && (
          <UserProfilePage onProfileUpdated={() => loadPendingCount()} />
        )}
      </main>

      {/* Footer with Guardrail & Schema Notice */}
      <footer className="border-t border-zinc-800/80 py-6 text-center text-xs text-zinc-400 space-y-1 bg-zinc-950">
        <p className="font-semibold text-zinc-400">
          FlipTop Battle Wagering UI • Schema: <code className="text-amber-400">"FLT"</code>
        </p>
        <p className="text-[11px] text-zinc-400">
          Each bet paid individually via QR • Pending verification bets are excluded from pool •
          Admin bank check required
        </p>
      </footer>
    </div>
  );
}
