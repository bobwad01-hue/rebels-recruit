'use client';

import Link from 'next/link';
import {useEffect,useMemo,useState} from 'react';
import {ArrowRight,CheckSquare,Search,TrendingDown,TrendingUp,Users} from 'lucide-react';
import AppShell from '@/components/AppShell';
import PageHeader from '@/components/PageHeader';
import {EmptyState,LoadingPanel,PageFrame,PriorityCard} from '@/components/ProductUI';
import {createClient} from '@/lib/supabase-browser';
import {athleteEngagementScore,buildRelationshipInsights,daysSince} from '@/lib/communication-intelligence';
import {exactInteractionDate} from '@/lib/interaction-dates';
import {JOURNEY_ORDER,normalizeJourneyStage} from '@/lib/recruiting-journey';

const one=(v:any)=>Array.isArray(v)?v[0]:v;
const text=(v:any)=>String(v||'').toLowerCase();
const fmt=(d:any)=>d?new Date(`${String(d).slice(0,10)}T12:00:00`).toLocaleDateString('en-US',{month:'short',day:'numeric'}):'—';

export default function AdvisorHome(){
 const c=createClient();
 const [loading,setLoading]=useState(true),[error,setError]=useState(''),[warning,setWarning]=useState('');
 const [role,setRole]=useState('advisor'),[orgAccess,setOrgAccess]=useState(false),[scope,setScope]=useState<'mine'|'org'>('mine');
 const [profiles,setProfiles]=useState<any[]>([]),[relationships,setRelationships]=useState<any[]>([]),[interactions,setInteractions]=useState<any[]>([]),[reminders,setReminders]=useState<any[]>([]),[colleges,setColleges]=useState<any[]>([]),[assignments,setAssignments]=useState<any[]>([]),[milestones,setMilestones]=useState<any[]>([]),[search,setSearch]=useState('');

 useEffect(()=>{(async()=>{
  setLoading(true);setError('');setWarning('');
  const {data:{user},error:authError}=await c.auth.getUser();
  if(authError||!user){setError('We could not verify your account. Refresh the page and try again.');setLoading(false);return}
  const membership=await c.from('organization_members').select('organization_id,role,organization_view_access').eq('user_id',user.id).eq('status','active').limit(10);
  if(membership.error){setError('Your organization access could not be loaded.');setLoading(false);return}
  const me=(membership.data||[]).find((m:any)=>['owner','admin','advisor'].includes(m.role));
  if(!me){setError('You do not currently have Advisor access.');setLoading(false);return}
  setRole(me.role);const global=me.role==='owner'||me.role==='admin'||!!me.organization_view_access;setOrgAccess(global);if(me.role==='owner'||me.role==='admin')setScope('org');
  const [membersResult,assignmentResult]=await Promise.all([
   c.from('organization_members').select('user_id,role').eq('organization_id',me.organization_id).eq('status','active'),
   c.from('athlete_advisor_assignments').select('athlete_user_id,advisor_user_id').eq('organization_id',me.organization_id).eq('status','active')
  ]);
  if(membersResult.error){setError('The player roster could not be loaded.');setLoading(false);return}
  const assignmentsRows=assignmentResult.data||[];setAssignments(assignmentsRows);
  const allIds=(membersResult.data||[]).filter((m:any)=>m.role==='athlete').map((m:any)=>m.user_id);
  const myIds=assignmentsRows.filter((a:any)=>a.advisor_user_id===user.id).map((a:any)=>a.athlete_user_id);
  const accessible=global?allIds:myIds;
  if(!accessible.length){setLoading(false);return}
  const [ps,rs,ints,rems,acs,journey]=await Promise.all([
   c.from('profiles').select('id,full_name,email').in('id',accessible),
   c.from('athlete_coaches').select('id,athlete_user_id,coach_id,college_id,last_contact_date,next_step,archived_at,colleges(id,name),college_coaches(id,first_name,last_name,title)').in('athlete_user_id',accessible),
   c.rpc('get_staff_recruiting_activity',{target_organization_id:me.organization_id,max_rows:2500}),
   c.from('reminders').select('id,athlete_user_id,coach_id,college_id,title,due_date,status').in('athlete_user_id',accessible),
   c.from('athlete_colleges').select('id,athlete_user_id,college_id,status,archived_at,colleges(id,name)').in('athlete_user_id',accessible),
   fetch('/api/recruiting-journey/batch',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({athleteIds:accessible})}).then(async r=>r.ok?await r.json():Promise.reject(new Error('Journey unavailable'))).catch(()=>null)
  ] as any);
  if(ps.error){setError('Player profiles could not be loaded.');setLoading(false);return}
  const unavailable:string[]=[];const take=(r:any,label:string)=>{if(r?.error){unavailable.push(label);return []}return r?.data||[]};
  setProfiles(ps.data||[]);setRelationships(take(rs,'coach relationships').filter((r:any)=>!r.archived_at));setInteractions(take(ints,'recruiting activity'));setReminders(take(rems,'Next Steps'));setColleges(take(acs,'school relationships').filter((r:any)=>!r.archived_at));
  if(journey)setMilestones(journey.milestones||[]);else unavailable.push('Journey milestones');
  if((ints.data||[]).length===2500)unavailable.push('older recruiting activity');
  if(assignmentResult.error)unavailable.push('advisor assignments');
  if(unavailable.length)setWarning(`Some information is temporarily unavailable: ${unavailable.join(', ')}.`);
  setLoading(false);
 })()},[]);

 const mySet=useMemo(()=>new Set(assignments.map((a:any)=>a.athlete_user_id)),[assignments]);
 const visibleIds=useMemo(()=>new Set(profiles.filter((p:any)=>scope==='org'||mySet.has(p.id)).map((p:any)=>p.id)),[profiles,scope,mySet]);
 const ps=useMemo(()=>profiles.filter((p:any)=>visibleIds.has(p.id)),[profiles,visibleIds]);
 const rs=useMemo(()=>relationships.filter((r:any)=>visibleIds.has(r.athlete_user_id)),[relationships,visibleIds]);
 const ints=useMemo(()=>interactions.filter((i:any)=>visibleIds.has(i.athlete_user_id)),[interactions,visibleIds]);
 const rems=useMemo(()=>reminders.filter((r:any)=>visibleIds.has(r.athlete_user_id)),[reminders,visibleIds]);
 const acs=useMemo(()=>colleges.filter((r:any)=>visibleIds.has(r.athlete_user_id)),[colleges,visibleIds]);
 const insights=useMemo(()=>buildRelationshipInsights(rs,ints),[rs,ints]);
 const today=new Date().toISOString().slice(0,10);
 const rows=useMemo(()=>ps.map((p:any)=>{
  const pi=ints.filter((i:any)=>i.athlete_user_id===p.id),pr=rems.filter((r:any)=>r.athlete_user_id===p.id),pc=acs.filter((r:any)=>r.athlete_user_id===p.id),pco=rs.filter((r:any)=>r.athlete_user_id===p.id),pins=insights.filter((r:any)=>r.athleteUserId===p.id);
  const overdue=pr.filter((r:any)=>['open','overdue','snoozed'].includes(text(r.status))&&r.due_date&&r.due_date<today).length;
  const dates=pi.map(exactInteractionDate).filter(Boolean).sort().reverse() as string[];const last=dates[0]||null;const stages=pc.map((x:any)=>normalizeJourneyStage(x.status));const topJourney=stages.sort((a:any,b:any)=>(JOURNEY_ORDER[b]??0)-(JOURNEY_ORDER[a]??0))[0]||'Researching';
  return{id:p.id,name:p.full_name||p.email||'Athlete',schools:pc.length,coaches:pco.length,overdue,last,stale:Boolean(last)&&daysSince(last)>=14,score:athleteEngagementScore(p.id,insights,ints,rems),cooling:pins.filter((x:any)=>x.momentum==='Cooling').length,rising:pins.filter((x:any)=>x.momentum==='Rising').length,topJourney,hasActivity:pi.length>0};
 }).sort((a:any,b:any)=>a.score-b.score),[ps,ints,rems,acs,rs,insights,today]);
 const actionQueue=useMemo(()=>rows.map((p:any)=>{let priority=0,reason='';if(p.overdue){priority=100+p.overdue;reason=`${p.overdue} overdue Next Step${p.overdue===1?'':'s'}`}else if(p.cooling){priority=80+p.cooling;reason=`${p.cooling} coach relationship${p.cooling===1?'':'s'} cooling`}else if(p.stale){priority=60+daysSince(p.last);reason=`No dated recruiting activity in ${daysSince(p.last)} days`}else if(!p.hasActivity&&p.schools){priority=30;reason='Schools tracked, but no recruiting activity yet'}return{...p,priority,reason}}).filter((x:any)=>x.priority>0).sort((a:any,b:any)=>b.priority-a.priority),[rows]);
 const filtered=rows.filter((r:any)=>!search||r.name.toLowerCase().includes(search.toLowerCase()));
 const rising=insights.filter((r:any)=>r.momentum==='Rising').length,cooling=insights.filter((r:any)=>r.momentum==='Cooling').length,overdue=rows.reduce((n:number,p:any)=>n+p.overdue,0);
 const recentMilestones=milestones.filter((m:any)=>visibleIds.has(m.athleteUserId)).sort((a:any,b:any)=>String(b.milestoneDate).localeCompare(String(a.milestoneDate))).slice(0,4);
 const profileMap=new Map(profiles.map((p:any)=>[p.id,p]));const collegeMap=new Map(acs.map((r:any)=>[r.id,one(r.colleges)?.name||'School']));

 if(loading)return <AppShell><PageFrame><LoadingPanel rows={5}/></PageFrame></AppShell>;
 if(error)return <AppShell><PageFrame><div role="alert" className="card p-6"><h1 className="font-black text-xl">Advisor dashboard unavailable</h1><p className="muted mt-2">{error}</p><Link href="/dashboard" className="btn mt-4">Return Home</Link></div></PageFrame></AppShell>;

 return <AppShell><PageFrame>
  <PageHeader eyebrow="ADVISOR HOME" title="Who needs you today?" subtitle="Start with the athletes and relationships that need attention. Everything else is one level deeper." action={<Link href="/advisors/tasks" className="btn btn-red"><CheckSquare size={17}/>Advisor Tasks</Link>}/>
  {warning&&<div className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">{warning}</div>}
  {orgAccess&&<div className="mt-5 inline-flex rounded-xl bg-slate-100 p-1"><button className={`px-4 py-2 rounded-lg text-sm font-bold ${scope==='mine'?'bg-white shadow-sm':''}`} onClick={()=>setScope('mine')}>My Athletes</button><button className={`px-4 py-2 rounded-lg text-sm font-bold ${scope==='org'?'bg-white shadow-sm':''}`} onClick={()=>setScope('org')}>Organization</button></div>}

  {!rows.length?<div className="mt-6"><EmptyState title="No athletes in this view" description={scope==='mine'?'Athletes assigned to you will appear here with their recruiting priorities.':'Active organization athletes will appear here.'}>{(role==='owner'||role==='admin')&&<Link href="/advisors/access" className="btn btn-red mt-4">Manage Advisor Access</Link>}</EmptyState></div>:<>
   <section className="mt-6">
    <div className="flex items-end justify-between gap-4"><div><div className="text-xs font-black uppercase tracking-widest text-red-600">Priority Queue</div><h2 className="text-2xl font-black mt-1">Start here</h2></div><div className="muted text-sm">{actionQueue.length} need attention</div></div>
    {actionQueue.length?<div className="mt-4 grid gap-3">{actionQueue.slice(0,5).map((p:any,i:number)=><PriorityCard key={p.id} eyebrow={i===0?'Highest Priority':'Needs Attention'} title={p.name} description={p.reason} href={`/advisors/player/${p.id}`} actionLabel="Review Athlete"/>)}</div>:<div className="mt-4 rounded-xl bg-emerald-50 px-4 py-4 text-sm text-emerald-900"><b>No urgent recruiting gaps.</b> Your current athletes are caught up based on their dated activity, relationships and Next Steps.</div>}
   </section>

   <section className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-3">
    <Metric label="Athletes" value={rows.length} icon={<Users size={17}/>}/><Metric label="Overdue Next Steps" value={overdue}/><Metric label="Rising Relationships" value={rising} icon={<TrendingUp size={17}/>}/><Metric label="Cooling Relationships" value={cooling} icon={<TrendingDown size={17}/>}/>
   </section>

   <section className="mt-8 border-t pt-7">
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3"><div><h2 className="text-xl font-black">Athletes</h2><p className="muted text-sm mt-1">A compact view of recruiting health. Drill in only when you need context.</p></div><div className="input flex items-center gap-2 sm:w-72"><Search size={16} className="muted"/><input className="bg-transparent outline-none min-w-0 flex-1" placeholder="Search athletes" value={search} onChange={e=>setSearch(e.target.value)}/></div></div>
    <div className="rr-divider-list mt-4">{filtered.map((p:any)=><div key={p.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div className="min-w-0"><Link href={`/advisors/player/${p.id}`} className="font-black hover:text-red-600">{p.name}</Link><div className="muted text-sm mt-1">{p.schools} schools · {p.coaches} coaches · {p.topJourney} · Last activity {fmt(p.last)}</div></div><div className="flex items-center gap-2"><span className={`text-xs font-black px-2.5 py-1 rounded-full ${p.cooling?'bg-amber-50 text-amber-800':p.rising?'bg-emerald-50 text-emerald-800':'bg-slate-100 text-slate-600'}`}>{p.cooling?`${p.cooling} cooling`:p.rising?`${p.rising} rising`:'Steady'}</span><Link href={`/advisors/player/${p.id}`} className="btn">View</Link></div></div>)}</div>
   </section>

   {recentMilestones.length>0&&<section className="mt-8 border-t pt-7"><h2 className="text-xl font-black">Recent Journey Progress</h2><div className="rr-divider-list mt-3">{recentMilestones.map((m:any)=><Link key={m.id} href={`/advisors/player/${m.athleteUserId}?relationship=${m.relationshipId}`} className="py-3 flex items-center justify-between gap-4 hover:text-red-600"><div><div className="font-bold">{(profileMap.get(m.athleteUserId) as any)?.full_name||'Athlete'} moved to {m.stage}</div><div className="muted text-sm">{collegeMap.get(m.relationshipId)||'School'} · {fmt(m.milestoneDate)}</div></div><ArrowRight size={16}/></Link>)}</div></section>}
  </>}

  <details className="mt-9 border-t pt-5"><summary className="cursor-pointer font-black text-sm">Advisor tools</summary><p className="muted text-sm mt-2">Use these when you need deeper analysis or administration. They stay out of the way of daily recruiting work.</p><div className="rr-action-cluster mt-4"><Link href="/advisors/activity" className="btn">Recruiting Activity</Link><Link href="/advisors/connections" className="btn">Connections</Link><Link href="/advisors/colleges" className="btn">School Insights</Link><Link href="/advisors/fit-insights" className="btn">Fit Insights</Link>{(role==='owner'||role==='admin')&&<Link href="/advisors/access" className="btn">Advisor Access</Link>}</div></details>
 </PageFrame></AppShell>
}

function Metric({label,value,icon}:{label:string;value:number;icon?:React.ReactNode}){return <div className="rounded-xl bg-slate-50 px-4 py-4"><div className="flex items-center gap-2 text-slate-500">{icon}<span className="text-xs font-black uppercase tracking-wide">{label}</span></div><div className="text-2xl font-black mt-2">{value}</div></div>}
