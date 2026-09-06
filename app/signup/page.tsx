'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-browser';

const APP_URL = 'https://rebels-recruit.vercel.app';

export default function Signup() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('athlete');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const { error } = await createClient().auth.signUp({
      email,
      password,
      options: { data: { full_name: name, app_role: role }, emailRedirectTo: `${APP_URL}/auth/callback` },
    });
    if (error) setError(error.message);
    else setSent(true);
  }

  async function continueWithGoogle() {
    setError('');
    setGoogleBusy(true);
    const { error } = await createClient().auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) {
      setError(error.message);
      setGoogleBusy(false);
    }
  }

  if (sent) return <div className="min-h-screen grid place-items-center p-6"><div className="card p-8 max-w-md text-center"><h1 className="text-2xl font-black">Check your email</h1><p className="muted mt-2">We sent a verification link to {email}. After you verify your account, you'll complete your profile before entering Rebels Recruit.</p></div></div>;

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <form onSubmit={submit} className="card p-8 w-full max-w-md">
        <div className="font-black text-2xl"><span className="text-red-600">REBELS</span> RECRUIT</div>
        <h1 className="text-2xl font-black mt-8">Create your account</h1>
        <div className="space-y-4 mt-6">
          <input className="input" placeholder="Full name" value={name} onChange={e => setName(e.target.value)} required />
          <input className="input" type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
          <label className="block"><span className="text-sm font-bold">I am signing up as</span><select className="input mt-1" value={role} onChange={e => setRole(e.target.value)}><option value="athlete">Player / Athlete</option><option value="advisor">Advisor / Coach</option></select></label>
          <input className="input" type="password" placeholder="Password (8+ characters)" minLength={8} value={password} onChange={e => setPassword(e.target.value)} required />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button className="btn btn-red w-full">Create account</button>
          <div className="flex items-center gap-3"><div className="h-px flex-1 bg-slate-200"/><span className="text-xs font-bold text-slate-400">OR</span><div className="h-px flex-1 bg-slate-200"/></div>
          <button type="button" disabled={googleBusy} onClick={continueWithGoogle} className="btn w-full">{googleBusy ? 'Connecting to Google...' : 'Continue with Google'}</button>
        </div>
        <p className="text-sm muted mt-6 text-center">Already have an account? <Link className="font-bold" href="/login">Sign in</Link></p>
      </form>
    </div>
  );
}
