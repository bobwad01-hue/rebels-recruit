'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, Loader2 } from 'lucide-react';

type DemoForm = {
  fullName: string; email: string; phone: string; preferredContact: string; organizationName: string;
  organizationType: string; roleTitle: string; teamCount: string;
  message: string; website: string; privacyAccepted: boolean;
};
const initial: DemoForm = {
  fullName: '', email: '', phone: '', preferredContact: 'either', organizationName: '', organizationType: 'travel_club',
  roleTitle: '', teamCount: '', message: '', website: '', privacyAccepted: false,
};
const inputClass = 'mt-1.5 block w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-950 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100';
const labelClass = 'block text-sm font-bold text-slate-800';

export default function DemoRequestForm() {
  const [form, setForm] = useState<DemoForm>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [complete, setComplete] = useState(false);
  const change = (key: keyof DemoForm, value: string | boolean) =>
    setForm(current => ({ ...current, [key]: value }));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/demo-request', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'We could not submit your request.');
      setComplete(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'We could not submit your request.');
    } finally {
      setSaving(false);
    }
  }

  if (complete) return <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-7 sm:p-9" role="status">
    <CheckCircle2 size={36} className="text-emerald-700"/>
    <h2 className="mt-4 text-2xl font-black text-slate-950">Your request is in.</h2>
    <p className="mt-3 text-sm leading-7 text-slate-700">Thanks for your interest in RLTNL Recruiting. We've received your information and will use your preferred contact method to follow up about your organization.</p>
    <Link href="/" className="btn mt-6 bg-white">Return to homepage <ArrowRight size={16}/></Link>
  </div>;

  return <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_16px_50px_-30px_rgba(15,23,42,.2)] sm:p-8">
    <div className="mb-6">
      <p className="text-[11px] font-black uppercase tracking-[.16em] text-red-700">Organization inquiry</p>
      <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">Request a demo</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">Tell us a little about your recruiting program. We'll follow up directly.</p>
    </div>
    <div className="grid gap-5 sm:grid-cols-2">
      <label className={labelClass}>Your name <span className="text-red-700">*</span>
        <input className={inputClass} name="fullName" autoComplete="name" required minLength={2} maxLength={100}
          value={form.fullName} onChange={e => change('fullName', e.target.value)} placeholder="Full name"/>
      </label>
      <label className={labelClass}>Email address <span className="text-red-700">*</span>
        <input className={inputClass} name="email" type="email" autoComplete="email" required maxLength={254}
          value={form.email} onChange={e => change('email', e.target.value)} placeholder="you@organization.com"/>
      </label>
      <label className={labelClass}>Phone number <span className="font-normal text-slate-500">(optional)</span>
        <input className={inputClass} name="phone" type="tel" autoComplete="tel" maxLength={30}
          value={form.phone} onChange={e => change('phone', e.target.value)} placeholder="(555) 555-0123"/>
      </label>
      <label className={labelClass}>Preferred contact method <span className="font-normal text-slate-500">(optional)</span>
        <select className={inputClass} name="preferredContact" value={form.preferredContact}
          onChange={e => change('preferredContact', e.target.value)}>
          <option value="either">No preference</option><option value="email">Email</option><option value="phone">Phone</option>
        </select>
      </label>
      <label className={labelClass}>Organization name <span className="text-red-700">*</span>
        <input className={inputClass} name="organizationName" required minLength={2} maxLength={150}
          value={form.organizationName} onChange={e => change('organizationName', e.target.value)} placeholder="Organization or school"/>
      </label>
      <label className={labelClass}>Organization type <span className="text-red-700">*</span>
        <select className={inputClass} name="organizationType" required value={form.organizationType}
          onChange={e => change('organizationType', e.target.value)}>
          <option value="travel_club">Travel / club softball</option>
          <option value="high_school">High school team</option>
          <option value="other">Other</option>
        </select>
      </label>
      <label className={labelClass}>Your role <span className="font-normal text-slate-500">(optional)</span>
        <input className={inputClass} name="roleTitle" maxLength={100} value={form.roleTitle}
          onChange={e => change('roleTitle', e.target.value)} placeholder="Director, coach, board member…"/>
      </label>
      <label className={labelClass}>Number of teams <span className="font-normal text-slate-500">(optional)</span>
        <select className={inputClass} name="teamCount" value={form.teamCount}
          onChange={e => change('teamCount', e.target.value)}>
          <option value="">Select an option</option><option value="1">1 team</option>
          <option value="2-5">2–5 teams</option><option value="6-10">6–10 teams</option>
          <option value="11+">11+ teams</option>
        </select>
      </label>
    </div>
    <label className={labelClass + ' mt-5'}>What would you like to accomplish? <span className="font-normal text-slate-500">(optional)</span>
      <textarea className={inputClass + ' min-h-[110px] resize-y'} name="message" maxLength={2000}
        value={form.message} onChange={e => change('message', e.target.value)}
        placeholder="Tell us about your recruiting program, challenges or questions."/>
    </label>
    <div className="absolute -left-[10000px] h-px w-px overflow-hidden" aria-hidden="true">
      <label>Website <input name="website" tabIndex={-1} autoComplete="off" value={form.website}
        onChange={e => change('website', e.target.value)}/></label>
    </div>
    <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-6 text-slate-600">
      <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-red-700" required
        checked={form.privacyAccepted} onChange={e => change('privacyAccepted', e.target.checked)}/>
      <span>I understand RLTNL Recruiting will use my information to respond to this inquiry, as described in the <Link href="/privacy" target="_blank" className="font-bold text-red-700 underline underline-offset-2">Privacy Policy</Link>.</span>
    </label>
    {error && <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">{error} You can also email <a href="mailto:bobwad01@gmail.com" className="underline">bobwad01@gmail.com</a>.</div>}
    <button type="submit" disabled={saving} className="btn btn-red mt-6 w-full px-6 py-3 text-sm font-black disabled:cursor-wait disabled:opacity-70">
      {saving ? <><Loader2 size={17} className="animate-spin"/> Sending request…</> : <>Request a demo <ArrowRight size={17}/></>}
    </button>
    <p className="mt-3 text-center text-xs text-slate-500">No payment or signup code required to request a demo.</p>
  </form>;
}
