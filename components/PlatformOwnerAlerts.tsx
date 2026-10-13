'use client';

import Link from 'next/link';
import {ArrowRight,Bell,CheckCircle2,ClipboardCheck,MessageSquareText} from 'lucide-react';
import {useCallback,useEffect,useRef,useState} from 'react';

type AttentionItem={kind:'coach_review'|'contact_conflict'|'feedback';id:string;title:string;detail:string;createdAt:string;url:string};
type Attention={counts:{coachReviews:number;feedback:number};total:number;items:AttentionItem[]};
const empty:Attention={counts:{coachReviews:0,feedback:0},total:0,items:[]};

export default function PlatformOwnerAlerts({variant='bell',compact=false}:{variant?:'bell'|'home';compact?:boolean}){
 const [data,setData]=useState<Attention>(empty);
 const [loaded,setLoaded]=useState(false);
 const [error,setError]=useState(false);
 const [open,setOpen]=useState(false);
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

 if(variant==='home'){
  if(!loaded||error||!data.total)return null;
  return <section aria-label="Super Owner items needing attention" className="card mt-5 border-red-200 p-5">
   <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
    <div className="flex min-w-0 items-start gap-3">
     <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-700"><Bell size={21}/></div>
     <div><div className="rr-eyebrow">SUPER OWNER ATTENTION</div>
      <h2 className="mt-1 text-lg font-black">{data.total} {data.total===1?'item needs':'items need'} your attention</h2>
      <p className="muted mt-1 text-sm">Open items stay here until you review and resolve them, even after you open the alert.</p>
     </div>
    </div>
    <span className="rounded-full bg-red-50 px-3 py-1 text-sm font-black text-red-700 self-start">{data.total} pending</span>
   </div>
   <div className="mt-4 grid gap-3 sm:grid-cols-2">
    <Link href="/platform-admin/coach-data-review" className="flex items-center justify-between gap-3 rounded-xl border bg-white p-4 hover:border-red-300 hover:bg-red-50">
     <div className="flex items-center gap-3"><ClipboardCheck size={20} className="text-red-700"/><div><div className="text-sm font-black">Coach Data Review</div><div className="text-xs text-slate-600">{data.counts.coachReviews} to verify</div></div></div><ArrowRight size={17}/>
    </Link>
    <Link href="/platform-admin/feedback" className="flex items-center justify-between gap-3 rounded-xl border bg-white p-4 hover:border-red-300 hover:bg-red-50">
     <div className="flex items-center gap-3"><MessageSquareText size={20} className="text-red-700"/><div><div className="text-sm font-black">User Feedback</div><div className="text-xs text-slate-600">{data.counts.feedback} awaiting follow-up</div></div></div><ArrowRight size={17}/>
    </Link>
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
  {open&&<div className="absolute right-0 top-full z-[85] mt-2 max-h-[70vh] w-[min(88vw,365px)] overflow-y-auto rounded-2xl border bg-white p-3 shadow-xl lg:left-0 lg:right-auto">
   <div className="flex items-center justify-between gap-2 px-1 pb-3"><div className="font-black">Platform alerts</div>
    {data.total>0&&<span className="rounded-full bg-red-50 px-2 py-1 text-xs font-bold text-red-700">{data.total} pending</span>}
   </div>
   {error?<div role="alert" className="p-2 text-sm text-red-700">Could not load platform alerts. <button type="button" onClick={()=>void load()} className="font-bold underline">Retry</button></div>
    :!loaded?<p className="p-2 text-sm text-slate-600">Loading alerts…</p>
    :data.total===0?<div className="flex items-center gap-2 rounded-xl bg-slate-50 p-4 text-sm text-slate-600"><CheckCircle2 size={19}/>All caught up. No reviews or feedback pending.</div>
    :<div className="space-y-2">{data.items.map(item=><Link key={item.kind+item.id} href={item.url} onClick={()=>setOpen(false)} className="block rounded-xl border p-3 hover:border-red-200 hover:bg-red-50">
      <div className="text-sm font-black">{item.title}</div>
      <div className="mt-1 line-clamp-2 text-xs text-slate-600">{item.detail}</div>
      <div className="mt-2 text-xs font-bold text-red-700">{item.kind==='feedback'?'Open feedback':'Review coach data'} →</div>
     </Link>)}
     {data.total>data.items.length&&<div className="px-2 py-1 text-xs text-slate-500">And {data.total-data.items.length} more pending items.</div>}
    </div>}
   <div className="mt-3 grid grid-cols-2 gap-2">
    <Link href="/platform-admin/coach-data-review" onClick={()=>setOpen(false)} className="btn justify-center text-xs">Coach reviews</Link>
    <Link href="/platform-admin/feedback" onClick={()=>setOpen(false)} className="btn btn-red justify-center text-xs">Feedback</Link>
   </div>
   <p className="mt-3 px-1 text-xs text-slate-500">Alerts clear when the underlying item is resolved, not when opened.</p>
  </div>}
 </div>;
}
