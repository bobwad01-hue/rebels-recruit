'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CalendarClock, Check, ChevronRight, Clipboard, EyeOff, Mail, Phone, RefreshCw, X } from 'lucide-react';
import AppShell from '@/components/AppShell';
import PageHeader from '@/components/PageHeader';

type Event = {id:string;event_type:string;summary:string;created_at:string};
type Inquiry = {
 id:string;full_name:string;email:string;phone:string|null;preferred_contact:string;
 organization_name:string;organization_type:string;role_title:string|null;team_count:string|null;
 message:string|null;status:string;internal_notes:string|null;follow_up_at:string|null;
 alert_acknowledged_at:string|null;alert_dismissed_at:string|null;created_at:string;updated_at:string;
 notification_sent_at:string|null;history:Event[];
};
const statuses = ['new','contacted','demo_scheduled','won','lost','closed'] as const;
const names:Record<string,string>={new:'New',contacted:'Contacted',demo_scheduled:'Demo Scheduled',won:'Won',lost:'Lost',closed:'Closed (legacy)'};
const date=(value:string)=>new Date(value).toLocaleString('en-US',{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'});
const orgType=(value:string)=>value==='travel_club'?'Travel / club':value==='high_school'?'High school':'Other';
const teamLabel=(value:string|null)=>value==='1'?'1 team':value?value+' teams':'Not provided';
const today=()=>{const now=new Date();return new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,10)};

export default function DemoInquiries(){
 const [items,setItems]=useState<Inquiry[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 const [filter,setFilter]=useState('all');
 const [selected,setSelected]=useState<string|null>(null);
 const [notes,setNotes]=useState('');
 const [followUp,setFollowUp]=useState('');
 const [copied,setCopied]=useState('');
 async function load(){
  setLoading(true);setError('');
  try{
   const response=await fetch('/api/platform/demo-inquiries',{cache:'no-store'});
   const body=await response.json();
   if(!response.ok)throw new Error(body.error||'Unable to load inquiries.');
   setItems(body.inquiries||[]);
  }catch(cause){setError(cause instanceof Error?cause.message:'Unable to load inquiries.')}
  finally{setLoading(false)}
 }
 useEffect(()=>{void load();const params=new URLSearchParams(window.location.search);const status=params.get('status');if(status==='new'||status==='due')setFilter(status);const id=params.get('inquiry');if(id)setSelected(id)},[]);
 const current=items.find(item=>item.id===selected)||null;
 useEffect(()=>{setNotes(current?.internal_notes||'');setFollowUp(current?.follow_up_at||'')},[current?.id,current?.updated_at]);
 useEffect(()=>{
  if(!selected)return;
  const close=(event:KeyboardEvent)=>{if(event.key==='Escape')setSelected(null)};
  document.addEventListener('keydown',close);
  return()=>document.removeEventListener('keydown',close);
 },[selected]);
 const due=(item:Inquiry)=>!!item.follow_up_at&&item.follow_up_at<=today()&&['contacted','demo_scheduled'].includes(item.status);
 const filtered=useMemo(()=>filter==='all'?items:filter==='due'?items.filter(due):items.filter(item=>item.status===filter),[items,filter]);
 const counts={all:items.length,new:items.filter(item=>item.status==='new').length,due:items.filter(due).length};
 async function update(id:string,changes:Record<string,unknown>){
  setBusy(true);setError('');
  try{
   const response=await fetch('/api/platform/demo-inquiries',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,...changes})});
   const body=await response.json();
   if(!response.ok)throw new Error(body.error||'Unable to update inquiry.');
   await load();
   window.dispatchEvent(new Event('rltnl:owner-attention-updated'));
  }catch(cause){setError(cause instanceof Error?cause.message:'Unable to update inquiry.')}
  finally{setBusy(false)}
 }
 async function copy(value:string,field:string){
  try{await navigator.clipboard.writeText(value);setCopied(field);window.setTimeout(()=>setCopied(''),2200)}
  catch{setError('Could not copy automatically. Select the contact information to copy it.')}
 }
 function open(item:Inquiry){
  setSelected(item.id);setNotes(item.internal_notes||'');setFollowUp(item.follow_up_at||'');
  const url=new URL(window.location.href);url.searchParams.set('inquiry',item.id);window.history.replaceState({},'',url.pathname+url.search);
 }
 function close(){
  setSelected(null);const url=new URL(window.location.href);url.searchParams.delete('inquiry');window.history.replaceState({},'',url.pathname+url.search);
 }
 return <AppShell><div className="mx-auto min-w-0 max-w-6xl px-4 py-7 sm:px-6 lg:px-8">
  <Link href="/platform-admin" className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-red-700"><ArrowLeft size={15}/> Platform Admin</Link>
  <div className="flex flex-wrap items-start justify-between gap-3">
   <PageHeader eyebrow="PLATFORM ADMIN · COMMERCIAL" title="Demo Inquiries" subtitle="Manage prospective organizations, follow-ups, notes and outcomes in RLTNL."/>
   <button type="button" className="btn" onClick={()=>void load()} disabled={loading}><RefreshCw size={16}/> Refresh</button>
  </div>
  <div className="mt-4 flex flex-wrap gap-2">
   {['all','new','due',...statuses.filter(status=>status!=='new')].map(status=><button key={status} type="button"
    className={filter===status?'btn btn-red text-xs':'btn text-xs'} onClick={()=>setFilter(status)}>
    {status==='all'?'All':status==='due'?'Follow-up Due':names[status]} ({status==='all'?counts.all:status==='due'?counts.due:items.filter(item=>item.status===status).length})
   </button>)}
  </div>
  {error&&<div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">{error}</div>}
  {loading?<div className="card mt-6 p-8 text-sm text-slate-600">Loading demo inquiries…</div>:
   filtered.length===0?<div className="card mt-6 p-8 text-sm text-slate-600">No inquiries in this view yet.</div>:
   <div className="mt-6 grid gap-3">{filtered.map(item=><button key={item.id} type="button" onClick={()=>open(item)}
    className="card flex w-full min-w-0 items-center justify-between gap-3 p-5 text-left transition hover:border-red-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500">
    <div className="min-w-0 flex-1">
     <div className="flex flex-wrap items-center gap-2"><h2 className="break-words text-lg font-black">{item.organization_name}</h2>
      <span className="pill">{names[item.status]||item.status}</span>
      {due(item)&&<span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-bold text-amber-800">Follow-up due</span>}
     </div>
     <p className="mt-1 text-sm text-slate-600">{orgType(item.organization_type)} · {teamLabel(item.team_count)} · {item.full_name}</p>
     <p className="mt-1 text-xs text-slate-500">Received {date(item.created_at)}{item.follow_up_at?' · Follow-up '+item.follow_up_at:''}</p>
    </div><ChevronRight size={20} className="shrink-0 text-slate-500"/>
   </button>)}</div>}
  {selected&&!loading&&!current&&<div role="alert" className="mt-4 text-sm text-red-700">This inquiry is unavailable or was not found in the current list.</div>}
  {current&&<div className="fixed inset-0 z-[100] flex items-stretch justify-end bg-slate-950/45" onMouseDown={event=>{if(event.target===event.currentTarget)close()}}>
   <section role="dialog" aria-modal="true" aria-labelledby="inquiry-title" className="flex h-full w-full max-w-xl flex-col overflow-hidden bg-white shadow-2xl">
    <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-5 sm:px-7">
     <div className="min-w-0"><p className="text-xs font-black uppercase tracking-widest text-red-700">Organization inquiry</p>
      <h2 id="inquiry-title" className="mt-2 break-words text-2xl font-black">{current.organization_name}</h2>
      <p className="mt-1 text-xs text-slate-500">Received {date(current.created_at)}</p></div>
     <button type="button" onClick={close} className="btn shrink-0" aria-label="Close inquiry details"><X size={18}/></button>
    </div>
    <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-7">
     <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm font-bold text-slate-800">Status
       <select className="input mt-2 block w-full" value={current.status} disabled={busy}
        onChange={event=>void update(current.id,{status:event.target.value})}>
        {statuses.map(status=><option key={status} value={status}>{names[status]}</option>)}
       </select>
      </label>
      <label className="text-sm font-bold text-slate-800">Next follow-up
       <input type="date" className="input mt-2 block w-full" value={followUp} onChange={event=>setFollowUp(event.target.value)}/>
      </label>
     </div>
     <button type="button" disabled={busy||followUp===(current.follow_up_at||'')} onClick={()=>void update(current.id,{followUpAt:followUp||null})} className="btn text-sm"><CalendarClock size={16}/> Save follow-up date</button>
     <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <h3 className="font-black">Contact details</h3>
      <dl className="mt-3 space-y-3 text-sm">
       <div><dt className="text-xs font-bold text-slate-500">Name and role</dt><dd className="mt-1 font-semibold">{current.full_name}{current.role_title?' · '+current.role_title:''}</dd></div>
       <div><dt className="text-xs font-bold text-slate-500">Email</dt><dd className="mt-1 flex flex-wrap items-center gap-2"><Mail size={15}/><span className="break-all">{current.email}</span>
        <button type="button" onClick={()=>void copy(current.email,'email')} className="inline-flex items-center gap-1 font-bold text-red-700"><Clipboard size={14}/>{copied==='email'?'Copied':'Copy'}</button></dd></div>
       <div><dt className="text-xs font-bold text-slate-500">Phone</dt><dd className="mt-1 flex flex-wrap items-center gap-2"><Phone size={15}/>{current.phone||'Not provided'}
        {current.phone&&<button type="button" onClick={()=>void copy(current.phone!,'phone')} className="inline-flex items-center gap-1 font-bold text-red-700"><Clipboard size={14}/>{copied==='phone'?'Copied':'Copy'}</button>}</dd></div>
       <div><dt className="text-xs font-bold text-slate-500">Preferred contact</dt><dd className="mt-1">{current.preferred_contact==='either'?'No preference':current.preferred_contact==='phone'?'Phone':'Email'}</dd></div>
       <div><dt className="text-xs font-bold text-slate-500">Program</dt><dd className="mt-1">{orgType(current.organization_type)} · {teamLabel(current.team_count)}</dd></div>
      </dl>
     </div>
     {current.message&&<div><h3 className="text-sm font-black">What they want to accomplish</h3><p className="mt-2 whitespace-pre-wrap break-words rounded-xl bg-slate-50 p-4 text-sm leading-6">{current.message}</p></div>}
     <div><label htmlFor="inquiry-notes" className="text-sm font-black">Internal notes</label>
      <textarea id="inquiry-notes" className="input mt-2 min-h-[130px] w-full resize-y" maxLength={6000} value={notes}
       onChange={event=>setNotes(event.target.value)} placeholder="Record calls, decisions, next steps and context…"/>
      <div className="mt-2 flex items-center justify-between gap-2"><p className="text-xs text-slate-500">Private to Super Owners; not sent to the prospect.</p>
       <button type="button" className="btn btn-red text-sm" disabled={busy||notes.trim()===(current.internal_notes||'')} onClick={()=>void update(current.id,{internalNotes:notes})}>{busy?'Saving…':'Save notes'}</button></div>
     </div>
     <div><h3 className="text-sm font-black">Alert management</h3>
      <p className="mt-1 text-xs leading-5 text-slate-600">Acknowledging marks an alert seen. Dismissing removes it from the alert list, not from your inbox or outstanding-work totals.</p>
      <div className="mt-3 flex flex-wrap gap-2">
       <button type="button" disabled={busy||!!current.alert_acknowledged_at} onClick={()=>void update(current.id,{action:'acknowledge'})} className="btn text-xs"><Check size={15}/>{current.alert_acknowledged_at?'Acknowledged':'Acknowledge alert'}</button>
       <button type="button" disabled={busy||!!current.alert_dismissed_at} onClick={()=>void update(current.id,{action:'dismiss'})} className="btn text-xs"><EyeOff size={15}/>{current.alert_dismissed_at?'Alert dismissed':'Dismiss alert'}</button>
      </div>
     </div>
     {!current.notification_sent_at&&<p className="text-xs text-amber-800">Email notification not confirmed. The inquiry is saved securely here.</p>}
     <div><h3 className="text-sm font-black">Activity history</h3>
      {current.history?.length?<ol className="mt-3 space-y-3 border-l-2 border-slate-200 pl-4">{current.history.map(event=><li key={event.id}>
       <p className="text-sm font-semibold">{event.summary}</p><p className="mt-1 text-xs text-slate-500">{date(event.created_at)}</p>
      </li>)}</ol>:<p className="mt-2 text-xs text-slate-500">No internal activity recorded yet.</p>}
     </div>
    </div>
   </section>
  </div>}
 </div></AppShell>;
}
