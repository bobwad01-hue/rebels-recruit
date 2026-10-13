'use client';

import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import {CheckCircle2,Inbox,MessageSquareText,RotateCcw,Clock3} from 'lucide-react';
import AppShell from '@/components/AppShell';
import PageHeader from '@/components/PageHeader';

type Participant={full_name:string|null;email:string|null};
type FeedbackEvent={
 id:string;case_id:string;actor_user_id:string|null;
 event_type:'submitted'|'status_changed'|'note_updated'|'resolution_imported';
 previous_status:string|null;new_status:string|null;note:string|null;
 occurred_at:string;actor:Participant|null;
};
type Feedback={
 id:string;reporter_user_id:string;feedback_type:string;description:string;
 diagnostic_snapshot:any;status:string;created_at:string;updated_at:string;
 resolved_at:string|null;resolution_note:string|null;resolved_by_user_id:string|null;
 reporter:Participant|null;resolved_by:Participant|null;history:FeedbackEvent[];
};
const categories:Record<string,string>={broken:'Something isn’t working',confusing:'Something is confusing',idea:'I have an idea',other:'Other'};
const active=(row:Feedback)=>['open','investigating','waiting_on_user'].includes(row.status);
const message=(row:Feedback)=>String(row.description||'').split(/\n\nPage: /)[0].replace(/^\[[^\]]+\]\s*/,'');
const when=(value:string)=>new Date(value).toLocaleString('en-US',{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'});
const personName=(person:Participant|null)=>person?.full_name||person?.email||'Unknown user';
const eventLabel=(event:FeedbackEvent)=>{
 if(event.event_type==='submitted')return 'Feedback submitted';
 if(event.event_type==='resolution_imported')return 'Earlier resolution recorded';
 if(event.event_type==='note_updated')return 'Internal note updated';
 if(event.new_status==='resolved')return 'Feedback resolved';
 if(event.new_status==='open'&&event.previous_status==='resolved')return 'Feedback reopened';
 if(event.new_status==='investigating')return 'Marked in progress';
 return 'Status changed to '+String(event.new_status||'unknown').replaceAll('_',' ');
};

export default function PlatformFeedback(){
 const [loading,setLoading]=useState(true),[denied,setDenied]=useState(false),[rows,setRows]=useState<Feedback[]>([]);
 const [tab,setTab]=useState<'pending'|'resolved'>('pending');
 const [drafts,setDrafts]=useState<Record<string,string>>({});
 const [busy,setBusy]=useState<string|null>(null),[error,setError]=useState('');
 const load=useCallback(async()=>{
  try{
   const response=await fetch('/api/platform/feedback',{cache:'no-store'});
   if(response.status===403){setDenied(true);setLoading(false);return}
   const data=await response.json();
   if(!response.ok)throw new Error(data.error||'Could not load feedback.');
   setRows(data.feedback||[]);setError('');
  }catch(e:any){setError(e?.message||'Could not load feedback.')}
  finally{setLoading(false)}
 },[]);
 useEffect(()=>{void load()},[load]);
 useEffect(()=>{
  if(loading||!rows.length)return;
  const focus=new URLSearchParams(window.location.search).get('case');
  if(!focus)return;
  const selected=rows.find(row=>row.id===focus);
  if(selected){
   setTab(active(selected)?'pending':'resolved');
   window.requestAnimationFrame(()=>document.getElementById('feedback-'+focus)?.scrollIntoView({block:'center',behavior:'smooth'}));
  }
 },[loading,rows]);
 async function update(row:Feedback,status:'open'|'investigating'|'resolved'){
  const note=status==='open'?'':String(drafts[row.id]??(active(row)?row.resolution_note:'')??'').trim();
  if(status==='resolved'&&note.length<5){setError('Add a resolution note of at least five characters before resolving.');return}
  setBusy(row.id);setError('');
  try{
   const response=await fetch('/api/platform/feedback',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({id:row.id,status,note})
   });
   const data=await response.json();
   if(!response.ok)throw new Error(data.error||'Could not update feedback.');
   setDrafts(prev=>{const next={...prev};delete next[row.id];return next});
   await load();
   window.dispatchEvent(new Event('rltnl:owner-attention-updated'));
  }catch(e:any){setError(e?.message||'Could not update feedback.')}
  finally{setBusy(null)}
 }
 const pending=rows.filter(active);
 const resolved=rows.filter(row=>!active(row));
 const visible=tab==='pending'?pending:resolved;
 return <AppShell><div className="mx-auto max-w-6xl px-5 py-6 md:px-8">
  <PageHeader eyebrow="PLATFORM ADMIN" title="Feedback Inbox" subtitle="Review every submission, track follow-through, and resolve feedback without losing its history."
   action={<Link href="/platform-admin" className="btn">Back to Platform Admin</Link>}/>
  {loading?<div className="card mt-6 p-8 text-sm text-slate-600">Loading feedback…</div>
  :denied?<div className="card mt-6 p-8 font-bold">Super Owner access required.</div>
  :<><section className="mt-6 grid grid-cols-2 gap-3">
    <div className="rounded-2xl bg-slate-950 p-5 text-white"><div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-400"><Inbox size={17}/> Awaiting follow-up</div><div className="mt-2 text-3xl font-black tabular-nums">{pending.length}</div></div>
    <div className="rounded-2xl bg-slate-950 p-5 text-white"><div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-400"><CheckCircle2 size={17}/> Resolved</div><div className="mt-2 text-3xl font-black tabular-nums">{resolved.length}</div></div>
   </section>
   <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
    <div role="tablist" aria-label="Feedback status" className="inline-flex rounded-xl border bg-white p-1">
     <button type="button" role="tab" aria-selected={tab==='pending'} onClick={()=>setTab('pending')} className={`rounded-lg px-4 py-2 text-sm font-bold ${tab==='pending'?'bg-slate-950 text-white':'text-slate-600 hover:bg-slate-50'}`}>Needs attention ({pending.length})</button>
     <button type="button" role="tab" aria-selected={tab==='resolved'} onClick={()=>setTab('resolved')} className={`rounded-lg px-4 py-2 text-sm font-bold ${tab==='resolved'?'bg-slate-950 text-white':'text-slate-600 hover:bg-slate-50'}`}>Resolved ({resolved.length})</button>
    </div>
    <button type="button" className="btn text-sm" onClick={()=>void load()}>Refresh</button>
   </div>
   {error&&<div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}
   <div className="mt-4 space-y-4" role="tabpanel">
    {visible.length===0&&<div className="card px-6 py-12 text-center"><CheckCircle2 size={28} className="mx-auto text-slate-500"/><h2 className="mt-3 text-lg font-black">{tab==='pending'?'All caught up':'No resolved feedback yet'}</h2><p className="muted mt-1 text-sm">{tab==='pending'?'New user feedback will appear here and in your Super Owner alerts.':'Feedback will move here after you resolve it.'}</p></div>}
    {visible.map(row=><article id={'feedback-'+row.id} key={row.id} className="card scroll-mt-24 p-5 sm:p-6">
     <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
       <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-700"><MessageSquareText size={20}/></div>
       <div><div className="text-xs font-black uppercase tracking-wider text-red-700">{categories[row.feedback_type]||'Feedback'}</div>
        <h2 className="mt-1 font-black">{row.reporter?.full_name||row.reporter?.email||'RLTNL user'}</h2>
        <div className="mt-1 text-xs text-slate-500">{when(row.created_at)} · {row.diagnostic_snapshot?.role||'User'}{row.diagnostic_snapshot?.account_role&&row.diagnostic_snapshot.account_role!==row.diagnostic_snapshot.role?' ('+row.diagnostic_snapshot.account_role+' account)':''} · {row.diagnostic_snapshot?.page||'Unknown page'}</div>
       </div>
      </div>
      <span className={`rounded-full px-3 py-1 text-xs font-black ${active(row)?'bg-red-50 text-red-700':'bg-emerald-50 text-emerald-700'}`}>{row.status.replaceAll('_',' ')}</span>
     </div>
     <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-6 text-slate-800">{message(row)}</p>
     {active(row)?<>
      <label className="mt-5 block text-sm font-bold">Internal resolution / follow-up note
       <textarea className="input mt-2 w-full resize-y" rows={3} value={drafts[row.id]??row.resolution_note??''}
        onChange={e=>setDrafts(prev=>({...prev,[row.id]:e.target.value}))}
        placeholder="What did you verify, fix, or decide?"/>
      </label>
      <p className="muted mt-1 text-xs">These are internal notes. Marking feedback resolved does not send a reply to the submitter.</p>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
       {row.status!=='investigating'&&<button type="button" className="btn text-sm" disabled={busy===row.id} onClick={()=>void update(row,'investigating')}><Clock3 size={16}/> Mark in progress</button>}
       <button type="button" className="btn btn-red text-sm" disabled={busy===row.id} onClick={()=>void update(row,'resolved')}><CheckCircle2 size={16}/> {busy===row.id?'Saving…':'Resolve Feedback'}</button>
      </div>
     </>:<div className="mt-5 rounded-xl border bg-slate-50 p-4">
       <div className="text-xs font-black uppercase tracking-wider text-slate-600">Resolution notes</div>
       <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{row.resolution_note||'No resolution note recorded.'}</p>
       <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-slate-600">
         <div className="font-bold">{row.resolved_at?'Resolved '+when(row.resolved_at):'Closed'}</div>
         <div className="mt-1">By {row.resolved_by?personName(row.resolved_by):'an unrecorded reviewer'}</div>
        </div>
        <button type="button" className="btn text-sm" disabled={busy===row.id} onClick={()=>void update(row,'open')}><RotateCcw size={15}/> Reopen</button>
       </div>
      </div>}
     {row.history?.length>0&&<details className="mt-5 border-t border-slate-200 pt-4">
      <summary className="cursor-pointer select-none text-sm font-bold text-slate-700 hover:text-slate-950">Activity history ({row.history.length})</summary>
      <ol className="mt-4 space-y-3 border-l-2 border-slate-200 pl-4">
       {row.history.map(event=><li key={event.id} className="relative">
        <span className="absolute -left-[22px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-slate-500"/>
        <div className="text-sm font-bold text-slate-800">{eventLabel(event)}</div>
        <div className="mt-0.5 text-xs text-slate-500">{when(event.occurred_at)} · {event.actor?personName(event.actor):'Reviewer not recorded'}</div>
        {event.note&&<p className="mt-1 whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-2 text-sm text-slate-700">{event.note}</p>}
       </li>)}
      </ol>
     </details>}
    </article>)}
   </div>
  </>}
 </div></AppShell>;
}
