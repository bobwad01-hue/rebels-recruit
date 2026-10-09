'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-browser';
import { PrimaryBrand } from '@/components/BrandLogo';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [emailMode, setEmailMode] = useState(false);
  const params=typeof window!=='undefined'?new URLSearchParams(window.location.search):null;
  const joinToken=params?.get('join_token')||'';
  const staffToken=params?.get('staff_token')||'';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if(!emailMode)return;
    setBusy(true);
    setError('');
    setResetMessage('');
    const c = createClient();
    const { data: { user }, error } = await c.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    else if (!user) setError('Unable to sign in. Please try again.');
    else {
      const [{data:accepted,error:acceptError},{ data: profile },{data:platformRole}] = await Promise.all([
        c.rpc('has_current_legal_acceptance'),
        c.from('profiles').select('app_role,profile_completed_at').eq('id', user.id).single(),
        c.from('platform_roles').select('role').eq('user_id',user.id).eq('role','super_owner').maybeSingle()
      ]);
      if(acceptError){setError('We could not verify your Terms and Privacy acceptance. Please try again.');setBusy(false);return}
      if(!accepted){location.href='/legal/accept?context=existing_account'+(joinToken?'&join_token='+encodeURIComponent(joinToken):'');return}
      if(joinToken){location.href='/join/'+encodeURIComponent(joinToken);return}
      if(platformRole?.role==='super_owner'){location.href='/platform-admin';return}
      const{data:roleRows}=await c.from('user_roles').select('role').eq('user_id',user.id);const savedView=window.localStorage.getItem('rr-active-view');const role=savedView&&(roleRows||[]).some((x:any)=>x.role===savedView)?savedView:(profile?.app_role||'athlete');
      if (!profile?.profile_completed_at) location.href = role === 'athlete' ? '/profile' : role === 'parent' ? '/parent/profile' : '/advisors/profile';
      else location.href = role === 'athlete' ? '/dashboard' : role === 'parent' ? '/parent' : '/advisors';
    }
    setBusy(false);
  }

  async function forgotPassword() {
    setError('');
    setResetMessage('');
    const cleanEmail = email.trim();
    if (!cleanEmail) { setError('Enter your email address first, then tap Forgot password?'); return; }
    setResetBusy(true);
    const { error } = await createClient().auth.resetPasswordForEmail(cleanEmail, { redirectTo: `${window.location.origin}/auth/callback?next=/reset-password` });
    if (error) setError(error.message);
    else setResetMessage(`Password reset email sent to ${cleanEmail}. Check your inbox and spam folder for a link to create a new password.`);
    setResetBusy(false);
  }

  async function continueWithGoogle() {
    setError('');
    setGoogleBusy(true);
    const { error } = await createClient().auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/auth/callback${joinToken?'?join_token='+encodeURIComponent(joinToken):''}` } });
    if (error) { setError(error.message); setGoogleBusy(false); }
  }

  return (
    <div className="min-h-screen grid place-items-center p-6 bg-slate-50">
      <form onSubmit={submit} className="card p-8 w-full max-w-md bg-white">
        <PrimaryBrand className="text-xl justify-center"/>
        <h1 className="text-2xl font-black mt-8">Welcome back</h1>
        <p className="muted mt-1">Sign in to your recruiting dashboard.</p>
        {joinToken&&<div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">Already have an RLTNL account? Sign in to join your team. Your invitation will be saved.</div>}
        <div className="space-y-4 mt-6">
          {error&&<p role="alert" className="text-sm text-red-600">{error}</p>}
          <button type="button" disabled={googleBusy} onClick={continueWithGoogle} className="btn btn-red w-full min-h-11 disabled:opacity-40 disabled:cursor-not-allowed">{googleBusy?'Connecting to Google…':'Sign in with Google'}</button>
          <p className="text-xs text-center text-slate-500">Sign in quickly without entering a password.</p>
          <div className="flex items-center gap-3"><div className="h-px flex-1 bg-slate-200"/><span className="text-xs font-bold text-slate-400">OR</span><div className="h-px flex-1 bg-slate-200"/></div>
          <button type="button" aria-expanded={emailMode} onClick={()=>setEmailMode(v=>!v)} className="btn w-full">{emailMode?'Hide email sign in':'Sign in with email instead'}</button>
          {emailMode&&<div className="space-y-4 rounded-xl border border-slate-200 p-4">
            <input className="input" type="email" autoComplete="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} required/>
            <input className="input" type="password" autoComplete="current-password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} required/>
            <div className="text-right"><button type="button" onClick={forgotPassword} disabled={resetBusy} className="text-sm font-bold text-red-600 hover:underline disabled:opacity-60">{resetBusy?'Sending reset email…':'Forgot password?'}</button></div>
            {resetMessage&&<div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm font-semibold text-green-800">{resetMessage}</div>}
            <button type="submit" disabled={busy} className="btn btn-red w-full disabled:opacity-40">{busy?'Signing in…':'Sign in'}</button>
          </div>}
        </div>
        <p className="text-sm muted mt-6 text-center">Don't have an account? <Link className="font-bold text-slate-900 hover:underline" href={joinToken?`/signup?join_token=${encodeURIComponent(joinToken)}`:staffToken?`/signup?staff_token=${encodeURIComponent(staffToken)}`:'/signup'}>Create one</Link></p>
      </form>
    </div>
  );
}
