'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

type Application = { id: string; username: string; email: string; image_url: string | null; status: string; rejection_reason: string | null; created_at: string };

export default function AdminRegistrationsPage() {
  const [apps, setApps] = useState<Application[]>([]);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [ready, setReady] = useState(false);

  async function load() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) { setError('Supabase public environment variables are missing.'); setReady(true); return; }
    const client = createClient(url, key, { db: { schema: 'FLT' } });
    const { data: { session } } = await client.auth.getSession();
    if (!session) { setError('Sign in with an admin account before opening this page.'); setReady(true); return; }
    const response = await fetch('/api/admin/registrations', { headers: { Authorization: `Bearer ${session.access_token}` } });
    const result = await response.json();
    if (!response.ok) setError(result.error || 'Could not load applications.');
    else { setApps(result.applications || []); setError(''); }
    setReady(true);
  }

  async function decide(app: Application, decision: 'approve' | 'reject') {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) return;
    const client = createClient(url, key, { db: { schema: 'FLT' } });
    const { data: { session } } = await client.auth.getSession();
    if (!session) { setError('Admin session expired. Sign in again.'); return; }
    const reason = decision === 'reject' ? window.prompt('Reason for declining (optional):') || '' : '';
    setBusy(app.id); setError(''); setNotice('');
    try {
      const response = await fetch('/api/admin/registrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ id: app.id, decision, reason }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Review failed.');
      setNotice(result.message);
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Review failed.'); }
    finally { setBusy(''); }
  }

  useEffect(() => { void load(); }, []);

  return <main className="min-h-screen bg-zinc-950 px-4 py-10 text-zinc-100">
    <section className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-xs font-bold uppercase tracking-widest text-amber-400">FLT • Admin</p><h1 className="mt-2 text-3xl font-black">Registration review</h1><p className="mt-2 text-sm text-zinc-400">Approve or decline applications. Approved applicants can then create their own Auth account.</p></div>
        <Link href="/" className="text-sm text-zinc-400 hover:text-white">Back to FLT</Link>
      </div>
      {error && <p role="alert" className="mt-5 rounded-xl bg-rose-950 p-3 text-sm text-rose-300">{error}</p>}
      {notice && <p role="status" className="mt-5 rounded-xl bg-emerald-950 p-3 text-sm text-emerald-300">{notice}</p>}
      {!ready ? <p className="mt-8 text-sm text-zinc-400">Loading applications…</p> : <div className="mt-6 grid gap-4 md:grid-cols-2">
        {apps.map(app => <article key={app.id} className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
          {app.image_url ? <a href={app.image_url} target="_blank" rel="noreferrer"><img src={app.image_url} alt={`Registration proof for ${app.username}`} className="h-64 w-full object-contain bg-zinc-950" /></a> : <div className="flex h-40 items-center justify-center text-sm text-zinc-500">Image unavailable</div>}
          <div className="space-y-3 p-5"><div><h2 className="text-xl font-bold">{app.username}</h2><p className="text-sm text-zinc-400">{app.email}</p></div><p className="text-xs text-zinc-500">Submitted {new Date(app.created_at).toLocaleString()}</p><p className="text-xs uppercase tracking-widest text-amber-400">{app.status}</p>
            {app.status === 'pending' && <div className="flex gap-3"><button disabled={!!busy} onClick={() => void decide(app, 'approve')} className="flex-1 rounded-xl bg-emerald-500 p-3 font-bold text-zinc-950 disabled:opacity-50">{busy === app.id ? 'Working…' : 'Approve'}</button><button disabled={!!busy} onClick={() => void decide(app, 'reject')} className="flex-1 rounded-xl border border-rose-700 p-3 font-bold text-rose-300 disabled:opacity-50">Decline</button></div>}
            {app.rejection_reason && <p className="text-sm text-rose-300">Reason: {app.rejection_reason}</p>}
          </div>
        </article>)}
        {apps.length === 0 && <p className="text-sm text-zinc-400">No applications found.</p>}
      </div>}
    </section>
  </main>;
}