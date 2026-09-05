'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-browser';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const c = createClient();
    const { data: { user }, error } = await c.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    else if (!user) {
      setError('Unable to sign in. Please try again.');
    } else {
      const { data: profile } = await c.from('profiles').select('app_role').eq('id', user.id).single();
      location.href = profile?.app_role === 'athlete' ? '/dashboard' : '/advisors';
    }
    setBusy(false);
  }

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <form onSubmit={submit} className="card p-8 w-full max-w-md">
        <div className="font-black text-2xl"><span className="text-red-600">REBELS</span> RECRUIT</div>
        <h1 className="text-2xl font-black mt-8">Welcome back</h1>
        <p className="muted mt-1">Sign in to your recruiting dashboard.</p>
        <div className="space-y-4 mt-6">
          <input className="input" type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
          <input className="input" type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
          <div className="text-right -mt-1">
            <button
              type="button"
              onClick={() => { window.location.href = '/forgot-password'; }}
              className="text-sm font-bold text-red-600 hover:underline"
            >
              Forgot password?
            </button>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button disabled={busy} className="btn btn-primary w-full">{busy ? 'Signing in...' : 'Sign in'}</button>
          <button type="button" onClick={() => createClient().auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + '/dashboard' } })} className="btn w-full">Continue with Google</button>
        </div>
        <p className="text-sm muted mt-6 text-center">Don't have an account? <Link className="font-bold text-slate-900" href="/signup">Create one</Link></p>
      </form>
    </div>
  );
}
