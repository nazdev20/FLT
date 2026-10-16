import React, { useState } from 'react';
import { getClient } from '../../lib/flt-service';
import { LogIn, AlertCircle } from 'lucide-react';

interface AuthPageProps {
  onSignedIn: () => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onSignedIn }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const client = getClient();
    if (!client) {
      setError('Sign-in is unavailable because the app is not connected to its authentication service.');
      return;
    }

    setLoading(true);
    try {
      const { error: signInError } = await client.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) throw signInError;
      onSignedIn();
    } catch (err: any) {
      setError(err?.message || 'Unable to sign in. Check your credentials and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="max-w-md mx-auto px-4 py-16">
      <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-7 sm:p-9 shadow-2xl">
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-400">
          <LogIn className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-black text-white">Sign in</h1>
        <p className="mt-2 text-sm text-zinc-400">Sign in to access your profile and private account activity.</p>
        <form onSubmit={handleSubmit} className="mt-7 space-y-4">
          <div>
            <label htmlFor="signin-email" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-zinc-400">Email</label>
            <input id="signin-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-amber-500" />
          </div>
          <div>
            <label htmlFor="signin-password" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-zinc-400">Password</label>
            <input id="signin-password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white outline-none focus:border-amber-500" />
          </div>
          {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span></div>}
          <button type="submit" disabled={loading} className="w-full rounded-xl bg-amber-500 px-4 py-3 text-sm font-black text-zinc-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60">{loading ? 'Signing in…' : 'Sign in'}</button>
        </form>
      </div>
    </section>
  );
};
