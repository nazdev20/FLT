import React, { useState, useEffect } from 'react';
import { Profile } from '../types/database';
import {
  FLTService,
  getSavedConfig,
  saveSupabaseConfig,
  localRepo,
} from '../lib/flt-service';
import {
  User as UserIcon,
  Shield,
  Key,
  Database,
  CheckCircle2,
  AlertCircle,
  LogOut,
  RefreshCw,
  Server,
  Sparkles,
} from 'lucide-react';

interface UserProfilePageProps {
  onProfileUpdated?: () => void;
}

export const UserProfilePage: React.FC<UserProfilePageProps> = ({ onProfileUpdated }) => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userEmail, setUserEmail] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Supabase Configuration
  const [config, setConfig] = useState(getSavedConfig());
  const [urlInput, setUrlInput] = useState(config.url);
  const [keyInput, setKeyInput] = useState(config.anonKey);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const loadUserData = async () => {
    setLoading(true);
    try {
      const { user, profile } = await FLTService.getCurrentUser();
      setProfile(profile);
      setUserEmail(user?.email || 'user@fliptop.test');
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUserData();
  }, []);

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    saveSupabaseConfig(urlInput, keyInput);
    setConfig(getSavedConfig());
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
    if (onProfileUpdated) onProfileUpdated();
  };

  const handleSwitchPersona = (role: 'user' | 'admin') => {
    const local = localRepo.getState();
    const target = local.profiles.find((p) => p.role === role);
    if (target) {
      localRepo.setCurrentUser(target.id);
      loadUserData();
      if (onProfileUpdated) onProfileUpdated();
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Profile Card */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-black text-xl border border-amber-500/30">
              {profile?.username?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-white">{profile?.username || 'User Profile'}</h1>
                <span
                  className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                    profile?.role === 'admin'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : 'bg-zinc-800 text-zinc-300'
                  }`}
                >
                  {profile?.role === 'admin' ? '👑 Admin' : 'Bettor'}
                </span>
              </div>
              <p className="text-xs text-zinc-400 font-mono mt-0.5">{userEmail}</p>
            </div>
          </div>

          {/* Quick Persona Switcher for Evaluation */}
          <div className="flex items-center gap-2 bg-zinc-950 p-1.5 rounded-2xl border border-zinc-800 self-start sm:self-auto">
            <button
              onClick={() => handleSwitchPersona('user')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                profile?.role === 'user'
                  ? 'bg-amber-500 text-zinc-950 shadow'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Bettor Persona
            </button>
            <button
              onClick={() => handleSwitchPersona('admin')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                profile?.role === 'admin'
                  ? 'bg-amber-500 text-zinc-950 shadow'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              👑 Admin Persona
            </button>
          </div>
        </div>

        {/* User Metadata Attributes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
          <div className="bg-zinc-950 p-3.5 rounded-2xl border border-zinc-800 space-y-1">
            <span className="text-zinc-400 text-[10px] uppercase font-bold">User UUID:</span>
            <p className="text-white truncate">{profile?.id || 'a1111111-1111-1111-1111-111111111111'}</p>
          </div>

          <div className="bg-zinc-950 p-3.5 rounded-2xl border border-zinc-800 space-y-1">
            <span className="text-zinc-400 text-[10px] uppercase font-bold">Schema Table:</span>
            <p className="text-amber-400 font-bold">FLT.profiles</p>
          </div>
        </div>
      </div>

      {/* Supabase FLT Database Connection Panel */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-2.5">
            <Database className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="text-base font-black text-white">
                Supabase PostgreSQL Configuration (Schema: "FLT")
              </h2>
              <p className="text-xs text-zinc-400">
                Connected to tables and RPCs in custom schema <code>FLT</code>
              </p>
            </div>
          </div>

          <span
            className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
              config.isConfigured
                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                : 'bg-zinc-800 text-zinc-400'
            }`}
          >
            {config.isConfigured ? '🟢 Live Supabase Connected' : '⚪ Sandbox Mode'}
          </span>
        </div>

        <form onSubmit={handleSaveConfig} className="space-y-4 text-xs">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
              NEXT_PUBLIC_SUPABASE_URL
            </label>
            <input
              type="url"
              placeholder="https://xyzcompany.supabase.co"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
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
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl font-mono text-zinc-200 focus:outline-none focus:border-amber-500"
            />
          </div>

          {savedSuccess && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Credentials saved. Supabase client initialized with schema "FLT".</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <span className="text-[11px] text-zinc-400">
              Database schema is configured strictly to <strong>"FLT"</strong>.
            </span>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold uppercase tracking-wider text-xs shadow"
            >
              Save Configuration
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
