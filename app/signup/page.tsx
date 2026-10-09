'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-browser';
import { PrimaryBrand } from '@/components/BrandLogo';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || (typeof window!=='undefined'?window.location.origin:'https://rltnl.com');

export default function Signup() {
  const invite=typeof window!=='undefined'?new URLSearchParams(window.location.search):null;
  const staffToken=invite?.get('staff_token')||'';
  const joinToken=invite?.get('join_token')||'';
  const accessLinkSignup=Boolean(joinToken);
  const staffInvite=Boolean(staffToken);
  const [invitedEmail,setInvitedEmail]=useState('');
  const [invitedRole,setInvitedRole]=useState('advisor');
  const [inviteOrg,setInviteOrg]=useState('');
  const [inviteLoading,setInviteLoading]=useState(staffInvite);
  const [joinLoading,setJoinLoading]=useState(accessLinkSignup);
  const [joinError,setJoinError]=useState('');
  const [joinDetails,setJoinDetails]=useState<{organization?:{name:string};team?:{name:string};role?:string}|null>(null);
  const [emailMode,setEmailMode]=useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState(staffInvite?'advisor':'athlete');
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [joining, setJoining] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [orgIntent,setOrgIntent]=useState(false);
  const [advisorPath,setAdvisorPath]=useState<"independent"|"organization">(staffInvite?"organization":"independent");
  const canContinue=legalAccepted&&(role!=='athlete'||ageConfirmed)&&(!staffInvite||(!inviteLoading&&Boolean(invitedEmail)))&&(!accessLinkSignup||(!joinLoading&&!joinError));

  useEffect(()=>{if(!staffToken)return;let live=true;(async()=>{try{const r=await fetch(`/api/staff-invite?token=${encodeURIComponent(staffToken)}`,{cache:'no-store'});const d=await r.json();if(!r.ok)throw new Error(d.error||'Could not load invitation.');if(!live)return;setInvitedEmail(d.email||'');setEmail(d.email||'');setInvitedRole(d.role||'advisor');setInviteOrg(d.organization?.name||'');setRole('advisor');setAdvisorPath('organization')}catch(e){if(live)setError(e instanceof Error?e.message:'Could not load invitation.')}finally{if(live)setInviteLoading(false)}})();return()=>{live=false}},[staffToken]);

  useEffect(()=>{if(!joinToken)return;let active=true;(async()=>{try{const response=await fetch(`/api/join?token=${encodeURIComponent(joinToken)}`,{cache:'no-store'});const details=await response.json();if(!response.ok)throw new Error(details.error||'This team invitation is no longer available.');if(!active)return;setJoinDetails(details);const inviteRole=details.role==='parent'?'parent':details.role==='athlete'?'athlete':'advisor';setRole(inviteRole);setAgeConfirmed(false)}catch(e){if(active)setJoinError(e instanceof Error?e.message:'Could not load the team invitation.')}finally{if(active)setJoinLoading(false)}})();return()=>{active=false}},[joinToken]);

  function validate(){if(role==='athlete'&&!ageConfirmed){setError('Athlete accounts are available only to players age 13 or older.');return false}if(!legalAccepted){setError('Please agree to the Terms of Service and Privacy Policy to create an account.');return false}return true}
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!emailMode) return;
    if (!validate()) return;
    if (!name.trim()||!email.trim()||password.length<8){setError('Enter your name, email address and a password of at least 8 characters.');return}
    const client=createClient();
    const { data:signupData, error } = await client.auth.signUp({
      email,
      password,
      options: { data: { full_name: name, app_role: role, age_13_plus: role==='athlete'?true:undefined, organization_admin_interest:orgIntent||undefined, advisor_account_type:role==="advisor"?advisorPath:undefined }, emailRedirectTo: `${APP_URL}/auth/callback?legal_signup=1&join_token=${encodeURIComponent(joinToken)}` },
    });
    if (error) { setError(error.message); return; }
    if(accessLinkSignup&&signupData.session){
      setJoining(true);
      const joined=await fetch('/api/join',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:joinToken})});
      const result=await joined.json();
      if(!joined.ok){setJoining(false);setError(result.error||'Your account was created, but we could not add team access. Please use the access link again.');return}
      window.location.assign(result.next||'/auth/callback?legal_signup=1');
      return;
    }
    setSent(true);
  }

  async function continueWithGoogle() {
    setError('');
    if (!validate()) return;
    setGoogleBusy(true);
    const { error } = await createClient().auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?signup_role=${encodeURIComponent(role)}&legal_signup=1&age_13_plus=${role==='athlete'?'1':'0'}&organization_admin_interest=${orgIntent?'1':'0'}&advisor_account_type=${role==='advisor'?advisorPath:''}&staff_token=${encodeURIComponent(staffToken)}&join_token=${encodeURIComponent(joinToken)}`,
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) { setError(error.message); setGoogleBusy(false); }
  }

  const Brand=()=> <PrimaryBrand className="text-xl justify-center"/>;

  if (joining) return <div className="min-h-screen grid place-items-center p-6 bg-slate-50"><div className="card p-8 max-w-md text-center bg-white"><Brand/><h1 className="text-2xl font-black mt-8">Adding your team access…</h1><p className="muted mt-2">Your RLTNL account is ready. We’re connecting it to the organization and team from your access link.</p></div></div>;

  if (sent) return <div className="min-h-screen grid place-items-center p-6 bg-slate-50"><div className="card p-8 max-w-md text-center bg-white"><Brand/><h1 className="text-2xl font-black mt-8">Check your email</h1><p className="muted mt-2">We sent a verification link to {email}. After you verify your account, you'll complete your profile before entering RLTNL Recruiting.</p></div></div>;

  return (
    <div className="min-h-screen grid place-items-center p-6 bg-slate-50">
      <form onSubmit={submit} className="card p-8 w-full max-w-md bg-white">
        <Brand/>
        <h1 className="text-2xl font-black mt-8">{staffInvite?"Activate your RLTNL access":"Create your account"}</h1>{staffInvite&&<p className="muted mt-2">{inviteLoading?"Loading your invitation…":<>You've been invited{inviteOrg?<> to <strong>{inviteOrg}</strong></>:null} as {invitedRole==="admin"?"an Admin":"an Advisor"}. Create or sign in with the invited email address below.</>}</p>}
        {accessLinkSignup&&<div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 mt-5 text-sm">
          {joinLoading?<span className="text-slate-600">Loading your team invitation…</span>:joinError?<span role="alert" className="font-semibold text-red-700">{joinError}</span>:<><span className="font-bold text-slate-900">Your team invitation</span><p className="text-slate-600 mt-1">Joining {joinDetails?.organization?.name||'your organization'}{joinDetails?.team?.name?` · ${joinDetails.team.name}`:''} as {role==='parent'?'Parent / Guardian':role==='athlete'?'Athlete':'Advisor / Coach'}.</p></>}
        </div>}
        <div className="space-y-4 mt-6">
          {!staffInvite&&(accessLinkSignup?
            <div><div className="text-sm font-bold text-slate-900">Account type</div><p className="mt-1 text-sm text-slate-600">{joinLoading?'Loading…':role==='parent'?'Parent / Guardian — support an athlete':role==='athlete'?'Athlete — manage my own recruiting':'Advisor / Coach — support recruiting clients'}</p></div>
            :<label className="block"><span className="text-sm font-bold">How will you use RLTNL Recruiting?</span><select className="input mt-1" value={role} onChange={e=>{setRole(e.target.value);setAgeConfirmed(false)}}><option value="athlete">Athlete — manage my own recruiting</option><option value="parent">Parent / Guardian — support an athlete</option><option value="advisor">Advisor / Coach — support recruiting clients</option></select></label>)}
          {!staffInvite&&role==='advisor'&&<div className="rounded-xl border p-3"><div className="text-sm font-bold">Advisor account type</div><label className="flex gap-2 mt-2 text-sm"><input type="radio" checked={advisorPath==="independent"} onChange={()=>{setAdvisorPath("independent");setOrgIntent(false)}}/> Independent Advisor / consultant</label><label className="flex gap-2 mt-2 text-sm"><input type="radio" checked={advisorPath==="organization"} onChange={()=>setAdvisorPath("organization")}/> I work with an organization/team</label><p className="text-xs text-slate-500 mt-2">{advisorPath==="independent"?"Independent Advisor accounts require RLTNL approval before live recruiting tools are activated.":"If an organization invited you, use the same email address as the invitation. Organization access comes from that organization."}</p>{advisorPath==="organization"&&<label className="flex items-start gap-2 mt-3 text-sm"><input type="checkbox" className="mt-1" checked={orgIntent} onChange={e=>setOrgIntent(e.target.checked)}/><span>I need to request a new organization. <span className="block text-xs text-slate-500">New organizations require RLTNL approval. Creating an account does not automatically give you Admin access.</span></span></label>}</div>}
          {!staffInvite&&!accessLinkSignup&&<p className="text-xs text-slate-500">You do not need to belong to an organization. You can connect with an organization or other people later.</p>}
          {role==='athlete'&&<label className="flex items-start gap-3 rounded-xl border p-3 cursor-pointer"><input type="checkbox" className="mt-1 h-4 w-4" checked={ageConfirmed} onChange={e=>setAgeConfirmed(e.target.checked)}/><span className="text-sm leading-5">I confirm that I am age 13 or older.</span></label>}
          <label className="flex items-start gap-3 rounded-xl border p-3 cursor-pointer"><input type="checkbox" className="mt-1 h-4 w-4" checked={legalAccepted} onChange={e=>setLegalAccepted(e.target.checked)}/><span className="text-sm leading-5">I agree to the <Link href="/terms" target="_blank" className="font-bold text-red-700 hover:underline">Terms of Service</Link> and <Link href="/privacy" target="_blank" className="font-bold text-red-700 hover:underline">Privacy Policy</Link>.</span></label>
          {error&&<p role="alert" className="text-sm text-red-600">{error}</p>}
          {!canContinue&&!joinLoading&&!joinError&&<p className="text-xs font-semibold text-slate-500 text-center">{role==='athlete'&&!ageConfirmed&&!legalAccepted?'Confirm your age and accept the Terms to continue.':role==='athlete'&&!ageConfirmed?'Confirm that you are age 13 or older to continue.':'Accept the Terms of Service and Privacy Policy to continue.'}</p>}
          <button type="button" disabled={googleBusy||!canContinue} onClick={continueWithGoogle} className="btn btn-red w-full min-h-11 disabled:opacity-40 disabled:cursor-not-allowed">{googleBusy?'Connecting to Google…':'Continue with Google'}</button>
          <p className="text-xs text-center text-slate-500">The easiest way to get started. No new password needed.</p>
          <div className="flex items-center gap-3"><div className="h-px flex-1 bg-slate-200"/><span className="text-xs font-bold text-slate-400">OR</span><div className="h-px flex-1 bg-slate-200"/></div>
          <button type="button" aria-expanded={emailMode} onClick={()=>setEmailMode(v=>!v)} className="btn w-full">{emailMode?'Hide email signup':'Sign up with email instead'}</button>
          {emailMode&&<div className="space-y-4 rounded-xl border border-slate-200 p-4">
            <p className="text-sm font-bold text-slate-900">Create an account with email</p>
            <input className="input" autoComplete="name" placeholder="Full name" value={name} onChange={e=>setName(e.target.value)} required/>
            <input className="input" autoComplete="email" type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} readOnly={staffInvite} required/>
            <input className="input" autoComplete="new-password" type="password" placeholder="Create password (8+ characters)" minLength={8} value={password} onChange={e=>setPassword(e.target.value)} required/>
            <button type="submit" disabled={!canContinue} className="btn btn-red w-full disabled:opacity-40 disabled:cursor-not-allowed">Create Account</button>
          </div>}
        </div>
        <p className="text-sm muted mt-6 text-center">Already have an account? <Link className="font-bold text-slate-900 hover:underline" href={joinToken?`/login?join_token=${encodeURIComponent(joinToken)}`:staffToken?`/login?staff_token=${encodeURIComponent(staffToken)}`:'/login'}>Sign in</Link></p>
      </form>
    </div>
  );
}
