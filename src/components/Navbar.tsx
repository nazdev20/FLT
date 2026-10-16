import React, { useState, useEffect } from 'react';
import { FLTService, localRepo } from '../lib/flt-service';
import { Profile } from '../types/database';
import {
  Swords,
  Shield,
  Receipt,
  User as UserIcon,
  CheckCircle2,
  Clock,
  Layers,
  ChevronDown,
} from 'lucide-react';

export type NavTab =
  | 'battles'
  | 'battle_detail'
  | 'my_bets'
  | 'admin_dashboard'
  | 'admin_verification'
  | 'admin_battles'
  | 'profile';

interface NavbarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  pendingCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  pendingCount,
}) => {
  const [profile, setProfile] = useState<Profile | null>(null);

  const loadProfile = async () => {
    const { profile } = await FLTService.getCurrentUser();
    setProfile(profile);
  };

  useEffect(() => {
    loadProfile();
    const unsub = localRepo.subscribe(loadProfile);
    return () => {
      unsub();
    };
  }, []);

  const isAdmin = profile?.role === 'admin';

  return (
    <header className="sticky top-0 z-40 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Schema Badge */}
          <div
            onClick={() => setActiveTab('battles')}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-rose-600 flex items-center justify-center shadow-lg shadow-amber-500/20 text-zinc-950 font-black">
              <Swords className="w-5 h-5 text-zinc-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black tracking-wider text-base sm:text-lg text-white font-mono uppercase">
                  FlipTop<span className="text-amber-400">Betting</span>
                </span>
                <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded bg-zinc-800 text-amber-300 border border-amber-500/30">
                  Schema: "FLT"
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 hidden sm:block">
                Manual QR Payments • Admin Bank Audit • Pari-Mutuel
              </p>
            </div>
          </div>

          {/* Center Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 bg-zinc-900/80 p-1 rounded-2xl border border-zinc-800">
            <button
              onClick={() => setActiveTab('battles')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'battles' || activeTab === 'battle_detail'
                  ? 'bg-amber-500 text-zinc-950 shadow'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
              }`}
            >
              <Swords className="w-3.5 h-3.5" />
              Battles
            </button>

            <button
              onClick={() => setActiveTab('my_bets')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'my_bets'
                  ? 'bg-amber-500 text-zinc-950 shadow'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              My Bets & Submissions
            </button>

            {/* Admin Menu / Link */}
            <button
              onClick={() => setActiveTab('admin_verification')}
              className={`relative flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'admin_dashboard' ||
                activeTab === 'admin_verification' ||
                activeTab === 'admin_battles'
                  ? 'bg-amber-500 text-zinc-950 shadow'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              Admin Desk
              {pendingCount > 0 && (
                <span className="w-4 h-4 text-[10px] bg-rose-500 text-white rounded-full flex items-center justify-center font-bold">
                  {pendingCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('profile')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'profile'
                  ? 'bg-amber-500 text-zinc-950 shadow'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
              }`}
            >
              <UserIcon className="w-3.5 h-3.5" />
              Profile
            </button>
          </nav>

          {/* Right Action: Persona & Role indicator */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveTab('profile')}
              className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 px-3 py-1.5 rounded-xl text-xs"
            >
              <div className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-black text-xs">
                {profile?.username?.charAt(0).toUpperCase() || 'U'}
              </div>
              <span className="font-bold text-white hidden sm:inline">
                {profile?.username || 'Bettor'}
              </span>
              <span
                className={`text-[10px] font-bold uppercase px-1.5 py-0.2 rounded ${
                  isAdmin
                    ? 'bg-rose-500/20 text-rose-300'
                    : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                {isAdmin ? '👑 Admin' : 'Bettor'}
              </span>
            </button>
          </div>
        </div>

        {/* Mobile Navigation bar */}
        <div className="flex md:hidden items-center justify-around py-2 border-t border-zinc-800/60 text-xs">
          <button
            onClick={() => setActiveTab('battles')}
            className={`flex items-center gap-1 py-1 px-2 rounded-lg font-bold ${
              activeTab === 'battles' ? 'text-amber-400 bg-zinc-900' : 'text-zinc-400'
            }`}
          >
            <Swords className="w-3.5 h-3.5" />
            Battles
          </button>
          <button
            onClick={() => setActiveTab('my_bets')}
            className={`flex items-center gap-1 py-1 px-2 rounded-lg font-bold ${
              activeTab === 'my_bets' ? 'text-amber-400 bg-zinc-900' : 'text-zinc-400'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            My Bets
          </button>
          <button
            onClick={() => setActiveTab('admin_verification')}
            className={`flex items-center gap-1 py-1 px-2 rounded-lg font-bold ${
              activeTab.startsWith('admin') ? 'text-amber-400 bg-zinc-900' : 'text-zinc-400'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            Admin ({pendingCount})
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-1 py-1 px-2 rounded-lg font-bold ${
              activeTab === 'profile' ? 'text-amber-400 bg-zinc-900' : 'text-zinc-400'
            }`}
          >
            <UserIcon className="w-3.5 h-3.5" />
            Profile
          </button>
        </div>
      </div>
    </header>
  );
};
