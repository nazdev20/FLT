import React, { useEffect, useState } from 'react';
import { FLTService, getClient } from '../lib/flt-service';
import { Profile } from '../types/database';
import { Swords, Shield, Receipt, User as UserIcon, LogIn } from 'lucide-react';

export type NavTab = 'battles' | 'battle_detail' | 'my_bets' | 'admin_dashboard' | 'admin_verification' | 'admin_battles' | 'profile' | 'login';

interface NavbarProps { activeTab: NavTab; setActiveTab: (tab: NavTab) => void; pendingCount: number; }

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab }) => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState('');
  const loadProfile = async () => {
    const { user, profile: currentProfile } = await FLTService.getCurrentUser();
    setProfile(currentProfile);
    setEmail(user?.email || '');
  };

  useEffect(() => {
    void loadProfile();
    const client = getClient();
    const { data } = client?.auth?.onAuthStateChange(() => {
      window.setTimeout(() => { void loadProfile(); }, 0);
    }) || { data: { subscription: null } };
    return () => { data?.subscription?.unsubscribe(); };
  }, []);

  const isAdmin = profile?.role === 'admin';
  const isSignedIn = Boolean(profile && email);
  const navButton = (tab: NavTab, label: string, icon: React.ReactNode) => (
    <button key={tab} onClick={() => setActiveTab(tab)} className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${activeTab === tab ? 'bg-amber-500 text-zinc-950 shadow' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-white'}`}>{icon}{label}</button>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-3">
          <button onClick={() => setActiveTab('battles')} className="group flex min-w-0 items-center gap-3 text-left">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-rose-600 text-zinc-950 shadow-lg shadow-amber-500/20"><Swords className="h-5 w-5" /></span>
            <span className="min-w-0"><span className="block truncate font-mono text-base font-black uppercase tracking-wider text-white sm:text-lg">FlipTop<span className="text-amber-400">Betting</span></span><span className="hidden text-[11px] text-zinc-400 sm:block">Battle Arena · Manual Payment Review</span></span>
          </button>
          <nav className="hidden items-center gap-1 rounded-2xl border border-zinc-800 bg-zinc-900/80 p-1 md:flex">
            {navButton('battles', 'Battles', <Swords className="h-3.5 w-3.5" />)}
            {isSignedIn && navButton('my_bets', 'My Bets', <Receipt className="h-3.5 w-3.5" />)}
            {isAdmin && navButton('admin_verification', 'Admin Desk', <Shield className="h-3.5 w-3.5" />)}
            {isSignedIn && navButton('profile', 'Profile', <UserIcon className="h-3.5 w-3.5" />)}
          </nav>
          <div className="flex items-center gap-2">
            {isSignedIn ? <button onClick={() => setActiveTab('profile')} className="flex max-w-48 items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs hover:border-zinc-700"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 font-black text-amber-400">{profile?.username?.charAt(0).toUpperCase() || 'U'}</span><span className="truncate font-bold text-white">{profile?.username || email}</span></button> : <button onClick={() => setActiveTab('login')} className="flex items-center gap-2 rounded-xl bg-amber-500 px-3 py-2 text-xs font-black text-zinc-950 transition hover:bg-amber-400"><LogIn className="h-4 w-4" />Sign in</button>}
          </div>
        </div>
        <div className="flex items-center justify-around border-t border-zinc-800/60 py-2 text-xs md:hidden">
          {navButton('battles', 'Battles', <Swords className="h-3.5 w-3.5" />)}
          {isSignedIn && navButton('my_bets', 'My Bets', <Receipt className="h-3.5 w-3.5" />)}
          {isAdmin && navButton('admin_verification', 'Admin', <Shield className="h-3.5 w-3.5" />)}
          {isSignedIn && navButton('profile', 'Profile', <UserIcon className="h-3.5 w-3.5" />)}
        </div>
      </div>
    </header>
  );
};
