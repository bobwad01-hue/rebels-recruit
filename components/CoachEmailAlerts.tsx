'use client';
import Link from 'next/link';
import {Bell,Mail,ArrowRight} from 'lucide-react';
import {useEffect,useState} from 'react';
import {createClient} from '@/lib/supabase-browser';
type Email={id:string;coach_id:string;subject:string|null;received_at:string;college_coaches?:{first_name?:string;last_name?:string}|null;colleges?:{name?:string}|null};
export default function CoachEmailAlerts({variant='bell',compact=false}:{variant?:'bell'|'home'|'inbox';compact?:boolean}){
 const [items,setItems]=useState<Email[]>([]),[count,setCount]=useState(0),[loaded,setLoaded]=useState(false),[open,setOpen]=useState(false),[error,setError]=useState(false);
 useEffect(()=>{let active=true;const c=createClient();
 async function load(){
  const {data:{user}}=await c.auth.getUser();if(!user||!active)return;
  const [a,b]=await Promise.all([
   c.from('gmail_recruiting_messages').select('id',{count:'exact',head:true}).eq('athlete_user_id',user.id).is('reviewed_at',null),
   c.from('gmail_recruiting_messages').select('id,coach_id,subject,received_at,college_coaches(first_name,last_name),colleges(name)').eq('athlete_user_id',user.id).is('reviewed_at',null).order('received_at',{ascending:false}).limit(variant==='inbox'?100:6)
  ]);
  if(!active)return;
  if(a.error||b.error)setError(true);else{setItems((b.data||[]) as unknown as Email[]);setCount(a.count||0);setError(false)}setLoaded(true);
 }
 void load();const refresh=()=>void load();const timer=setInterval(()=>{if(document.visibilityState==='visible')void load()},60000);
 window.addEventListener('focus',refresh);window.addEventListener('rltnl:coach-emails-updated',refresh);window.addEventListener('rebels:data-changed',refresh);
 return()=>{active=false;clearInterval(timer);window.removeEventListener('focus',refresh);window.removeEventListener('rltnl:coach-emails-updated',refresh);window.removeEventListener('rebels:data-changed',refresh)};
 },[variant]);
 const list=(limit:number)=><div className="grid gap-2">{items.slice(0,limit).map(e=><Link key={e.id} href={'/coaches/'+e.coach_id+'?email='+e.id} onClick={()=>setOpen(false)} className="block rounded-xl border p-3 hover:bg-red-50">
  <div className="font-black text-sm">{[e.college_coaches?.first_name,e.college_coaches?.last_name].filter(Boolean).join(' ')||'College coach'}</div>
  <div className="text-xs text-slate-600">{e.colleges?.name||'College program'} · {new Date(e.received_at).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}</div>
  <div className="text-xs mt-1">{e.subject||'New recruiting email'}</div>
  <div className="text-xs font-bold text-red-700 mt-2">Review email →</div>
 </Link>)}</div>;
 if(variant==='home')return !loaded||error||!count?null:<section className="card p-4 sm:p-5 mb-5 border-red-200"><div className="flex gap-2 items-center text-red-700 text-xs font-black uppercase tracking-wider"><Mail size={16}/> Your recruiting inbox</div><h2 className="font-black text-xl mt-1">{count} coach email{count===1?'':'s'} to review</h2><p className="text-sm text-slate-600 mt-1 mb-4">A coach has reached out. Review the message and decide what comes next.</p>{list(3)}<Link href="/coach-emails" className="inline-flex items-center gap-1 text-sm font-black text-red-700 mt-4">View all coach emails <ArrowRight size={15}/></Link></section>;
 if(variant==='inbox')return <div>{!loaded?'Loading coach emails…':error?'Could not load coach emails. Refresh to try again.':count===0?<div className="card p-6"><h2 className="font-black">All caught up</h2><p className="text-sm text-slate-600 mt-2">No coach emails are waiting for review.</p></div>:<><p className="text-sm text-slate-600 mb-4">{count} {count===1?'email':'emails'} awaiting review. Gmail read status is separate.</p>{list(100)}</>}</div>;
 return <div className="relative"><button type="button" aria-label={'Coach email alerts, '+count+' to review'} aria-expanded={open} onClick={()=>setOpen(!open)} className={'relative flex items-center gap-2 rounded-xl border bg-white p-3 font-bold text-sm '+(compact?'h-11 w-11 justify-center':'w-full')}><Bell size={19}/>{!compact&&'Coach Emails'}{count>0&&<span className={'bg-red-600 text-white text-[10px] font-black rounded-full px-1.5 py-0.5 '+(compact?'absolute -top-1 -right-1':'ml-auto')}>{count>99?'99+':count}</span>}</button>{open&&<div className="absolute top-full mt-2 right-0 lg:left-0 lg:right-auto z-[85] w-[min(88vw,340px)] max-h-[65vh] overflow-y-auto rounded-2xl border bg-white shadow-xl p-3"><div className="font-black mb-3">Coach Email Alerts</div>{error?<p>Could not load alerts.</p>:count?list(5):<p className="text-sm text-slate-600">No emails need review.</p>}<Link href="/coach-emails" onClick={()=>setOpen(false)} className="btn btn-red text-sm mt-3 w-full justify-center">View all coach emails</Link></div>}</div>;
}
