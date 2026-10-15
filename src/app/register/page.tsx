'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';

export default function RegisterPage() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setMessage(''); setError('');
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch('/api/registration', { method: 'POST', body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to submit application.');
      setMessage(result.message);
      event.currentTarget.reset();
      setPassword('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to submit application.');
    } finally {
      setBusy(false);
    }
  }

  return <main className="min-h-screen bg-zinc-950 text-zinc-100 px-4 py-12">
    <section className="mx-auto max-w-lg rounded-3xl border border-zinc-800 bg-zinc-900 p-6 sm:p-8">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-400">FLT • Account review</p>
      <h1 className="mt-2 text-3xl font-black">Apply for an account</h1>
      <p className="mt-2 text-sm text-zinc-400">Your registration and image will be reviewed by an administrator. An Auth account is created only after approval.</p>
      <form className="mt-6 space-y-4" onSubmit={submit}>
        <label className="block text-sm">Username<input name="username" required minLength={2} maxLength={60} className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3" /></label>
        <label className="block text-sm">Email<input name="email" type="email" required autoComplete="email" className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3" /></label>
        <label className="block text-sm">Password (minimum 8 characters)<input name="password" type="password" required minLength={8} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3" /></label>
        <p className="text-xs text-zinc-500">For your security, this password is not saved with the application. If approved, you'll receive a secure link to set your account password.</p>
        <label className="block text-sm">Registration image / proof<input name="image" type="file" required accept="image/jpeg,image/png,image/webp" className="mt-1 block w-full text-sm text-zinc-300 file:mr-3 file:rounded-lg file:border-0 file:bg-amber-500 file:px-3 file:py-2 file:font-bold file:text-zinc-950" /></label>
        {error && <p role="alert" className="rounded-xl bg-rose-950 p-3 text-sm text-rose-300">{error}</p>}
        {message && <p role="status" className="rounded-xl bg-emerald-950 p-3 text-sm text-emerald-300">{message}</p>}
        <button disabled={busy} className="w-full rounded-xl bg-amber-500 p-3 font-black text-zinc-950 disabled:opacity-50">{busy ? 'Submitting…' : 'Submit for review'}</button>
      </form>
      <Link href="/" className="mt-5 block text-center text-sm text-zinc-400 hover:text-white">Back to FLT</Link>
    </section>
  </main>;
}