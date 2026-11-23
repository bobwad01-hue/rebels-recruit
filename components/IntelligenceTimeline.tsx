'use client';
import Link from 'next/link';
import {useEffect,useMemo,useState} from 'react';
type RecordRow=Record<string,any>;
const one=(v:any):RecordRow=>Array.isArray(v)?(v[0]||{}):(v||{});
const fmt=(d:any)=>d?new Date(String(d).length===10?d+'T12:00:00':d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):'Not recorded';
type Entry={id:string;at:string;type:string;title:string;detail:string;coachId?:string;schoolId?:string;status?:string};
export default function IntelligenceTimeline(){
 const [data,setData]=useState<Record<string,RecordRow[]>|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 const [athlete,setAthlete]=useState(''),[school,setSchool]=useState(''),[coach,setCoach]=useState(''),[kind,setKind]=useState('all');
 useEffect(()=>{let active=true;fetch('/api/advisors/intelligence',{cache:'no-store'}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error||'Could not load intelligence');if(active)setData(d)}).catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[]);
 const athletes=data?.athletes||[];
 const schools=useMemo(()=>{const m=new Map<string,string>();for(const r of data?.schools||[]){if(athlete&&r.athlete_user_id!==athlete)continue;const s=one(r.colleges);if(s.id)m.set(s.id,s.name)}for(const r of data?.coaches||[]){if(athlete&&r.athlete_user_id!==athlete)continue;const s=one(r.colleges);if(s.id)m.set(s.id,s.name)}return [...m].sort((a,b)=>a[1].localeCompare(b[1]))},[data,athlete]);
 const coaches=useMemo(()=>{const m=new Map<string,string>();for(const r of data?.coaches||[]){if(athlete&&r.athlete_user_id!==athlete)continue;if(school&&one(r.colleges).id!==school)continue;const c=one(r.college_coaches);if(c.id)m.set(c.id,[c.first_name,c.last_name].filter(Boolean).join(' '))}return [...m].sort((a,b)=>a[1].localeCompare(b[1]))},[data,athlete,school]);
 const timeline=useMemo(()=>{
 const entries:Entry[]=[];
 const eligible=(r:RecordRow,sid?:string,cid?:string)=> (!athlete||r.athlete_user_id===athlete)&&(!school||sid===school)&&(!coach||cid===coach);
 for(const r of data?.interactions||[])if(eligible(r,r.college_id,r.coach_id))entries.push({id:'i'+r.id,at:r.date||r.created_at,type:'Communication / interaction',title:r.type||'Recorded interaction',detail:[r.email_subject,r.note].filter(Boolean).join(' · '),schoolId:r.college_id,coachId:r.coach_id});
 for(const r of data?.events||[]){const e=one(r.events),s=one(e.colleges);if(eligible(r,s.id)&&!coach)entries.push({id:'e'+r.id,at:e.date,type:'Visit / event',title:e.name||e.type||'Event',detail:[e.type,e.location].filter(Boolean).join(' · '),schoolId:s.id,status:r.status})}
 for(const r of data?.reminders||[]){const s=one(r.colleges),c=one(r.college_coaches);if(eligible(r,s.id,c.id))entries.push({id:'r'+r.id,at:r.due_date,type:'Reminder',title:r.title||'Reminder',detail:'Due '+fmt(r.due_date),schoolId:s.id,coachId:c.id,status:r.status})}
 for(const r of data?.tasks||[])if(eligible(r)&&!school&&!coach)entries.push({id:'t'+r.id,at:r.due_date,type:'Advisor task',title:r.title||'Task',detail:r.description||'',status:r.status});
 for(const r of data?.schools||[]){const s=one(r.colleges);if(eligible(r,s.id)&&!coach)entries.push({id:'s'+r.id,at:'',type:'School relationship',title:s.name||'School',detail:'Recruiting stage: '+(r.status||'Not specified')+(r.archived_at?' · Archived':''),schoolId:s.id,status:r.status})}
 for(const r of data?.coaches||[]){const s=one(r.colleges),c=one(r.college_coaches);if(eligible(r,s.id,c.id))entries.push({id:'c'+r.id,at:r.last_contact_date||'',type:'Coach relationship',title:[c.first_name,c.last_name].filter(Boolean).join(' ')||'Coach',detail:r.next_step?'Next step: '+r.next_step:'No next step recorded',schoolId:s.id,coachId:c.id})}
 return entries.filter(e=>kind==='all'||e.type===kind).sort((a,b)=>(Date.parse(b.at||'')||0)-(Date.parse(a.at||'')||0));
 },[data,athlete,school,coach,kind]);
 if(loading)return <div className="card p-6 text-sm">Loading unified recruiting history…</div>;
 if(error)return <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</div>;
 return <section className="mt-6 rounded-2xl border bg-white p-4 sm:p-5">
 <h2 className="text-xl font-black">Complete recruiting history</h2><p className="mt-1 text-sm text-slate-600">Explore authorized athlete relationships, manually logged interactions, events, reminders, and advisor tasks. Offers appear when recorded as a school stage or interaction; this report does not infer an offer from an email.</p>
 <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
 <label className="text-xs font-bold">Athlete<select aria-label="Timeline athlete" className="input mt-1 w-full" value={athlete} onChange={e=>{setAthlete(e.target.value);setSchool('');setCoach('')}}><option value="">All assigned athletes</option>{athletes.map(r=><option key={r.id} value={r.id}>{r.full_name||'Athlete'}</option>)}</select></label>
 <label className="text-xs font-bold">School<select aria-label="Timeline school" className="input mt-1 w-full" value={school} onChange={e=>{setSchool(e.target.value);setCoach('')}}><option value="">All schools</option>{schools.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
 <label className="text-xs font-bold">Coach<select aria-label="Timeline coach" className="input mt-1 w-full" value={coach} onChange={e=>setCoach(e.target.value)}><option value="">All coaches</option>{coaches.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
 <label className="text-xs font-bold">Activity<select aria-label="Timeline activity type" className="input mt-1 w-full" value={kind} onChange={e=>setKind(e.target.value)}><option value="all">All activity</option>{['Communication / interaction','Visit / event','Reminder','Advisor task','School relationship','Coach relationship'].map(x=><option key={x} value={x}>{x}</option>)}</select></label>
 </div>
 {Boolean((data as any)?.truncated)&&<p className="mt-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">Some history was truncated. This report may not include every record.</p>}
 <div className="mt-4 flex items-center justify-between"><h3 className="font-bold">Timeline</h3><span className="text-xs text-slate-500">{timeline.length} recorded items</span></div>
 <ol className="mt-3 space-y-3">{timeline.map(e=><li key={e.id} className="rounded-xl border p-4"><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-bold uppercase tracking-wide text-slate-500">{e.type}</span><time className="text-xs text-slate-600">{fmt(e.at)}</time></div><p className="mt-1 font-bold">{e.title}</p>{e.detail&&<p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{e.detail}</p>}{e.status&&<p className="mt-1 text-xs text-slate-500">Status: {e.status}</p>}<div className="mt-2 flex flex-wrap gap-3 text-xs font-bold">{athlete&&e.schoolId&&<Link className="text-red-700 underline" href={`/colleges/${e.schoolId}?athlete=${athlete}`}>School details</Link>}{athlete&&e.coachId&&<Link className="text-red-700 underline" href={`/coaches/${e.coachId}?athlete=${athlete}`}>Coach details</Link>}</div></li>)}</ol>
 {!timeline.length&&<p className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">No recorded activity matches these filters. This does not mean no recruiting activity occurred.</p>}
 </section>
}
