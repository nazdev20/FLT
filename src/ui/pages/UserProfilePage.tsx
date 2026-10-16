import React, { useEffect, useState } from 'react';
import { FLTService } from '../../lib/flt-service';
import { Profile } from '../../types/database';
import { User as UserIcon, ShieldCheck, LogOut, Loader2 } from 'lucide-react';

interface UserProfilePageProps {
  onSignOut?: () => void;
}

export const UserProfilePage: React.FC<UserProfilePageProps> = ({ onSignOut }) => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const { user, profile: currentProfile } = await FLTService.getCurrentUser();
        if (!active) return;
        setProfile(currentProfile);
        setEmail(user?.email || '');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, []);

  if (loading) {
    return <div className="mx-auto flex max-w-3xl items-center justify-center px-4 py-20 text-zinc-400"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading profile…</div>;
  }

  if (!profile || !email) {
    return <section className="mx-auto max-w-xl px-4 py-16 text-center"><div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-8"><UserIcon className="mx-auto h-10 w-10 text-zinc-500" /><h1 className="mt-4 text-xl font-black text-white">Sign in required</h1><p className="mt-2 text-sm text-zinc-400">Your profile is available only after you sign in.</p></div></section>;
  }

  return (
    <section className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-xl sm:p-8">
        <div className="flex items-center gap-4 border-b border-zinc-800 pb-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/15 text-amber-400"><UserIcon className="h-7 w-7" /></div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-black text-white">{profile.username || 'Your profile'}</h1>
            <p className="mt-1 truncate text-sm text-zinc-400">{email}</p>
          </div>
          {profile.role === 'admin' && <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-xs font-bold text-rose-300"><ShieldCheck className="h-3.5 w-3.5" />Admin</span>}
        </div>
        <p className="mt-6 text-sm text-zinc-400">Your account details are private. Database configuration and internal identifiers are not displayed here.</p>
        <button onClick={onSignOut} className="mt-6 inline-flex items-center gap-2 rounded-xl border border-zinc-700 px-4 py-2.5 text-sm font-bold text-zinc-200 transition hover:border-rose-500/50 hover:text-rose-300"><LogOut className="h-4 w-4" />Sign out</button>
      </div>
    </section>
  );
};
