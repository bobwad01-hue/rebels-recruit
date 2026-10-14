'use client';

import Link from 'next/link';
import {ArrowRight,Bell,Building2,CheckCircle2,ClipboardCheck,MessageSquareText,ShieldCheck,CalendarClock,Check,EyeOff} from 'lucide-react';
import {useCallback,useEffect,useRef,useState} from 'react';

type AttentionItem={
 kind:'coach_review'|'contact_conflict'|'feedback'|'demo_request'|'demo_follow_up'|'approval';
 id:string;title:string;detail:string;createdAt:string;url:string;acknowledged?:boolean;
};
type Counts={coachReviews:number;feedback:number;demoRequests:number;followUps:number;approvals:number};
type Attention={counts:Counts;total:number;items:AttentionItem[]};
const empty:Attention={counts:{coachReviews:0,feedback:0,demoRequests:0,followUps:0,approvals:0},total:0,items:[]};
const routes=[
 {key:'demoRequests',label:'New Demo Requests',description:'Organizations waiting for a response',url:'/platform-admin/inquiries?status=new',icon:Building2},
 {key:'followUps',label:'Demo Follow-ups',description:'Follow-up dates that are due',url:'/platform-admin/inquiries?status=due',icon:CalendarClock},
 {key:'feedback',label:'User Feedback',description:'Unresolved feedback submissions',url:'/platform-admin/feedback',icon:MessageSquareText},
 {key:'approvals',label:'Account Approvals',description:'New organizations and advisors',url:'/platform-admin#pending-approvals',icon:ShieldCheck},
 {key:'coachReviews',label:'Coach Data Review',description:'Contact and data changes to verify',url:'/platform-admin/coach-data-review',icon:ClipboardCheck}
] as const;

export default function PlatformOwnerAlerts({variant='bell',compact=false}:{variant?:'bell'|'home';compact?:boolean}){
 const [data,setData]=useState<Attention>(empty);
 const [loaded,setLoaded]=useState(false);
 const [error,setError]=useState(false);
 const [open,setOpen]=useState(false);
 const [busy,setBusy]=useState('');
 const root=useRef<HTMLDivElement>(null);
 const load=useCallback(async()=>{
  try{
   const response=await fetch('/api/platform/attention',{cache:'no-store'});
   if(!response.ok)throw new Error('Platform alerts unavailable');
   const result=await response.json();
   setData(result as Attention);setError(false);
  }catch{setError(true)}
  finally{setLoaded(true)}
 },[]);
 useEffect(()=>{
  void load();
  const focus=()=>{void load()};
  const visible=()=>{if(document.visibilityState==='visible')void load()};
  const interval=window.setInterval(visible,45000);
  window.addEventListener('focus',focus);
  window.addEventListener('rltnl:owner-attention-updated',focus);
  document.addEventListener('visibilitychange',visible);
  return()=>{
   window.clearInterval(interval);
   window.removeEventListener('focus',focus);
   window.removeEventListener('rltnl:owner-attention-updated',focus);
   document.removeEventListener('visibilitychange',visible);
  };
 },[load]);
 useEffect(()=>{
  if(!open)return;
  const outside=(event:PointerEvent)=>{if(root.current&&!root.current.contains(event.target as Node))setOpen(false)};
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')setOpen(false)};
  document.addEventListener('pointerdown',outside);
  document.addEventListener('keydown',escape);
  return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape)};
 },[open]);
 async function alertAction(item:AttentionItem,action:'acknowledge'|'dismiss'){
  setBusy(item.kind+item.id);
  try{
   const response=await fetch('/api/platform/demo-inquiries',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:item.id,action})});
   if(!response.ok)throw new Error('Unable to update alert');
   await load();
   window.dispatchEvent(new Event('rltnl:owner-attention-updated'));
  }catch{setError(true)}
  finally{setBusy('')}
 }
 if(variant==='home'){
  return <section aria-label="Super Owner items needing attention" className="card mt-5 min-w-0 p-5">
   <div className="flex flex-wrap items-center justify-between gap-3">
    <div className="flex min-w-0 items-center gap-3">
     <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-700"><Bell size={21}/></span>
     <div><div className="rr-eyebrow">SUPER OWNER COMMAND CENTER</div>
      <h2 className="mt-1 text-xl font-black">Needs Your Attention</h2>
      <p className="muted mt-1 text-sm">Outstanding requests and operational work, all in one place.</p>
     </div>
    </div>
    {loaded&&!error&&<span className="rounded-full bg-red-50 px-3 py-1 text-sm font-black text-red-700">{data.total} pending</span>}
   </div>
   {error&&<div role="alert" className="mt-4 text-sm text-red-700">Could not load platform alerts. <button type="button" onClick={()=>void load()} className="underline">Retry</button></div>}
   <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
    {routes.map(({key,label,description,url,icon:Icon})=><Link key={key} href={url} className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 transition hover:border-red-300 hover:bg-red-50">
     <div className="flex min-w-0 items-center gap-3"><Icon size={20} className="shrink-0 text-red-700"/><div className="min-w-0"><div className="text-sm font-black">{label}</div><div className="mt-1 text-xs text-slate-600">{description}</div></div></div>
     <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-sm font-black tabular-nums text-slate-900">{loaded&&!error?data.counts[key]:'–'}</span>
    </Link>)}
   </div>
  </section>;
 }
 return <div className="relative" ref={root}>
  <button type="button" aria-label={`Super Owner alerts: ${data.total} pending`} aria-expanded={open}
   onClick={()=>setOpen(v=>!v)}
   className={`relative flex items-center gap-2 rounded-xl border bg-white p-3 text-sm font-bold transition-colors hover:bg-slate-50 ${compact?'h-11 w-11 justify-center':'w-full'}`}>
   <Bell size={19}/>{!compact&&'Platform Alerts'}
   {loaded&&!error&&data.total>0&&<span className={`rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-black text-white ${compact?'absolute -right-1 -top-1':'ml-auto'}`}>{data.total>99?'99+':data.total}</span>}
  </button>
  {open&&<div className="absolute right-0 top-full z-[85] mt-2 max-h-[75vh] w-[min(88vw,385px)] overflow-y-auto rounded-2xl border bg-white p-3 shadow-xl lg:left-0 lg:right-auto">
   <div className="flex items-center justify-between gap-2 px-1 pb-3"><div className="font-black">Platform alerts</div>
    {data.total>0&&<span className="rounded-full bg-red-50 px-2 py-1 text-xs font-bold text-red-700">{data.total} pending</span>}
   </div>
   {error?<div role="alert" className="p-2 text-sm text-red-700">Could not load platform alerts. <button type="button" onClick={()=>void load()} className="font-bold underline">Retry</button></div>
    :!loaded?<p className="p-2 text-sm text-slate-600">Loading alerts…</p>
    :data.total===0?<div className="flex items-center gap-2 rounded-xl bg-slate-50 p-4 text-sm text-slate-600"><CheckCircle2 size={19}/>All caught up.</div>
    :<div className="space-y-2">{data.items.map(item=><div key={item.kind+item.id} className="rounded-xl border p-3">
      <Link href={item.url} onClick={()=>setOpen(false)} className="block hover:text-red-700">
       <div className="flex items-center gap-2 text-sm font-black">{item.title}{item.acknowledged&&<span className="text-[10px] font-medium text-slate-500">(seen)</span>}</div>
       <div className="mt-1 line-clamp-2 text-xs text-slate-600">{item.detail}</div>
       <div className="mt-2 text-xs font-bold text-red-700">Open request <ArrowRight size={12} className="inline"/></div>
      </Link>
      {(item.kind==='demo_request'||item.kind==='demo_follow_up')&&<div className="mt-2 flex gap-2 border-t pt-2">
       {!item.acknowledged&&<button type="button" disabled={busy===item.kind+item.id} onClick={()=>void alertAction(item,'acknowledge')} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900"><Check size={13}/> Acknowledge</button>}
       <button type="button" disabled={busy===item.kind+item.id} onClick={()=>void alertAction(item,'dismiss')} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900"><EyeOff size={13}/> Dismiss alert</button>
      </div>}
     </div>)}
     {data.total>data.items.length&&<div className="px-2 py-1 text-xs text-slate-500">And {data.total-data.items.length} more pending items.</div>}
    </div>}
   <Link href="/platform-admin" onClick={()=>setOpen(false)} className="btn mt-3 w-full justify-center text-xs">Open command center <ArrowRight size={14}/></Link>
   <p className="mt-3 px-1 text-xs text-slate-500">Acknowledging an alert marks it seen. Dismissing hides that alert, but the inquiry remains in the inbox until handled.</p>
  </div>}
 </div>;
}
