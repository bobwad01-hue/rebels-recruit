'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-browser';

const APP_URL = 'https://rebelsrecruit.com';

export default function Signup() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('athlete');
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const canContinue=legalAccepted&&(role!=='athlete'||ageConfirmed);

  function validate(){if(role==='athlete'&&!ageConfirmed){setError('Athlete accounts are available only to players age 13 or older.');return false}if(!legalAccepted){setError('Please agree to the Terms of Service and Privacy Policy to create an account.');return false}return true}
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!validate()) return;
    const { error } = await createClient().auth.signUp({
      email,
      password,
      options: { data: { full_name: name, app_role: role, age_13_plus: role==='athlete'?true:undefined }, emailRedirectTo: `${APP_URL}/auth/callback?legal_signup=1` },
    });
    if (error) setError(error.message);
    else setSent(true);
  }

  async function continueWithGoogle() {
    setError('');
    if (!validate()) return;
    setGoogleBusy(true);
    const { error } = await createClient().auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?signup_role=${encodeURIComponent(role)}&legal_signup=1&age_13_plus=${role==='athlete'?'1':'0'}`,
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) { setError(error.message); setGoogleBusy(false); }
  }

  const Brand=()=> <div className="text-2xl tracking-tight text-center"><span className="font-black text-red-600">REBELS</span><span className="font-normal text-slate-900"> RECRUIT</span></div>;

  if (sent) return <div className="min-h-screen grid place-items-center p-6 bg-slate-50"><div className="card p-8 max-w-md text-center bg-white"><Brand/><h1 className="text-2xl font-black mt-8">Check your email</h1><p className="muted mt-2">We sent a verification link to {email}. After you verify your account, you'll complete your profile before entering Rebels Recruit.</p></div></div>;

  return (
    <div className="min-h-screen grid place-items-center p-6 bg-slate-50">
      <form onSubmit={submit} className="card p-8 w-full max-w-md bg-white">
        <Brand/>
        <h1 className="text-2xl font-black mt-8">Create your account</h1>
        <div className="space-y-4 mt-6">
          <input className="input" placeholder="Full name" value={name} onChange={e => setName(e.target.value)} required />
          <input className="input" type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
          <label className="block"><span className="text-sm font-bold">I am signing up as</span><select className="input mt-1" value={role} onChange={e => {setRole(e.target.value);setAgeConfirmed(false)}}><option value="athlete">Player / Athlete</option><option value="parent">Parent / Guardian</option><option value="advisor">Advisor / Coach</option></select></label>
          <input className="input" type="password" placeholder="Password (8+ characters)" minLength={8} value={password} onChange={e => setPassword(e.target.value)} required />
          {role==='athlete'&&<label className="flex items-start gap-3 rounded-xl border p-3 cursor-pointer"><input type="checkbox" className="mt-1 h-4 w-4" checked={ageConfirmed} onChange={e=>setAgeConfirmed(e.target.checked)}/><span className="text-sm leading-5">I confirm that I am age 13 or older.</span></label>}
          <label className="flex items-start gap-3 rounded-xl border p-3 cursor-pointer"><input type="checkbox" className="mt-1 h-4 w-4" checked={legalAccepted} onChange={e=>setLegalAccepted(e.target.checked)}/><span className="text-sm leading-5">I agree to the <Link href="/terms" target="_blank" className="font-bold text-red-700 hover:underline">Terms of Service</Link> and <Link href="/privacy" target="_blank" className="font-bold text-red-700 hover:underline">Privacy Policy</Link>.</span></label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button disabled={!canContinue} className="btn btn-red w-full">Create Account</button>
          <div className="flex items-center gap-3"><div className="h-px flex-1 bg-slate-200"/><span className="text-xs font-bold text-slate-400">OR</span><div className="h-px flex-1 bg-slate-200"/></div>
          <button type="button" disabled={googleBusy||!canContinue} onClick={continueWithGoogle} className="btn w-full">{googleBusy ? 'Connecting to Google...' : 'Continue with Google'}</button>
        </div>
        <p className="text-sm muted mt-6 text-center">Already have an account? <Link className="font-bold" href="/login">Sign In</Link></p>
      </form>
    </div>
  );
}
