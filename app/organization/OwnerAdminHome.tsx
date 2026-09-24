'use client';
import Link from 'next/link';
import {useEffect,useMemo,useState} from 'react';
import {AlertTriangle,ArrowRight,CalendarDays,CheckCircle2,MessageSquare,Network,Target,Users} from 'lucide-react';
import {createClient} from '@/lib/supabase-browser';

const today=()=>new Date().toISOString().slice(0,10);
export default function OwnerAdminHome(){
 const c=createClient();
 const[loading,setLoading]=useState(true),[error,setError]=useState(''),[players,setPlayers]=useState<string[]>([]),[states,setStates]=useState<any[]>([]),[tasks,setTasks]=useState<any[]>([]);
 useEffect(()=>{(async()=>{setLoading(true);setError('');const{data:{user}}=await c.auth.getUser();if(!user){setLoading(false);return}const{data:memberships,error:meErr}=await c.from('organization_members').select('organization_id,role').eq('user_id',user.id).eq('status','active').limit(20);const me=(memberships||[]).find((m:any)=>['owner','admin'].includes(m.role));if(meErr||!me){setError('Organization summary is temporarily unavailable.');setLoading(false);return}const{data:members,error:memberErr}=await c.from('organization_members').select('user_id').eq('organization_id',me.organization_id).eq('role','athlete').eq('status','active');if(memberErr){setError('Organization summary is temporarily unavailable.');setLoading(false);return}const ids=(members||[]).map((m:any)=>String(m.user_id));setPlayers(ids);if(ids.length){const[st,ts]=await Promise.all([c.from('organization_athlete_recruiting_state').select('athlete_user_id,pipeline_stage').eq('organization_id',me.organization_id).in('athlete_user_id',ids),c.from('advisor_tasks').select('athlete_user_id,status,due_date').in('athlete_user_id',ids)]);setStates(st.data||[]);setTasks(ts.data||[])}setLoading(false)})()},[]);
 const summary=useMemo(()=>{const stage=new Map(states.map((s:any)=>[String(s.athlete_user_id),String(s.pipeline_stage||'building_list')]));const overdue=new Set(tasks.filter((t:any)=>t.status!=='completed'&&t.due_date&&t.due_date<today()).map((t:any)=>String(t.athlete_user_id)));return{players:players.length,attention:overdue.size,offers:players.filter(id=>stage.get(id)==='offers').length,committed:players.filter(id=>stage.get(id)==='committed').length}},[players,states,tasks]);
 if(loading)return <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6">{[1,2,3,4].map(x=><div key={x} className="card p-5 animate-pulse h-24 bg-slate-50"/>)}</div>;
 return <>{error&&<div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold flex gap-2"><AlertTriangle size={17}/>{error}</div>}
 <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
  <Metric label="Players" value={summary.players} href="/organization/recruiting-board"/>
  <Metric label="Need Attention" value={summary.attention} href="/organization/recruiting-board"/>
  <Metric label="Active Offers" value={summary.offers} href="/organization/recruiting-board"/>
  <Metric label="Committed" value={summary.committed} href="/organization/recruiting-board"/>
 </div>
 <section className="mt-6"><div className="rr-eyebrow">RUN THE PROGRAM</div><div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 mt-2">
  <Quick icon={<Target size={19}/>} title="Recruiting HQ" text="See every athlete, priority and pipeline stage." href="/organization/recruiting-board"/>
  <Quick icon={<Network size={19}/>} title="Connections" text="Review school and coach relationships across players." href="/advisors/connections"/>
  <Quick icon={<CalendarDays size={19}/>} title="Events" text="See camps, visits and recruiting opportunities." href="/events"/>
  <Quick icon={<MessageSquare size={19}/>} title="Message Center" text="Reach players and keep recruiting work moving." href="/messages"/>
 </div></section></>
}
function Metric({label,value,href}:{label:string;value:number;href:string}){return <Link href={href} className="card p-4 hover:border-slate-400 transition-colors"><div className="text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</div><div className="text-2xl font-black mt-1">{value}</div><div className="text-[11px] font-bold mt-2 inline-flex items-center gap-1">Review <ArrowRight size={12}/></div></Link>}
function Quick({icon,title,text,href}:{icon:any;title:string;text:string;href:string}){return <Link href={href} className="card p-4 group hover:border-slate-400 transition-colors"><div className="flex items-center gap-2 font-black">{icon}{title}</div><p className="muted text-sm mt-2 leading-5">{text}</p><div className="text-xs font-black mt-4 inline-flex items-center gap-1 group-hover:text-red-700">Open <ArrowRight size={13}/></div></Link>}
