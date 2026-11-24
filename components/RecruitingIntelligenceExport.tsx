'use client';
import {useState} from 'react';

type Row=Record<string,any>;
const obj=(v:any):Row=>Array.isArray(v)?(v[0]||{}):(v||{});
const csv=(rows:unknown[][])=>rows.map(row=>row.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\r\n');
const download=(name:string,body:string,type:string)=>{const url=URL.createObjectURL(new Blob([body],{type}));const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)};
const stamp=()=>new Date().toISOString().slice(0,10);
const date=(v:any)=>v?String(v).slice(0,10):'';
const label=(v:any)=>String(v||'').replace(/[\r\n]+/g,' ').trim();
export default function RecruitingIntelligenceExport({selectedAthlete,allowedAthleteIds,endpoint='/api/advisors/intelligence'}:{selectedAthlete?:string;allowedAthleteIds:string[];endpoint?:string}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[format,setFormat]=useState('both');
 const [scope,setScope]=useState('all');
 async function run(){
  setBusy(true);setError('');
  try{
   const response=await fetch(endpoint,{cache:'no-store',credentials:'same-origin'});
   const d=await response.json();
   if(!response.ok)throw new Error(d.error||'Unable to load authorized recruiting data.');
   if(d.truncated)throw new Error('Some recruiting records exceed the current retrieval limit. Export stopped to avoid an incomplete report.');
   const allowed=new Set(allowedAthleteIds);
   const athletes=(d.athletes||[]).filter((a:Row)=>allowed.has(a.id)&& (scope!=='selected'||a.id===selectedAthlete));
   if(!athletes.length)throw new Error('No approved athletes match this export scope.');
   const ids=new Set(athletes.map((a:Row)=>a.id));
   const take=(key:string)=>(d[key]||[]).filter((r:Row)=>ids.has(r.athlete_user_id));
   const schools=take('schools'),coaches=take('coaches'),interactions=take('interactions'),reminders=take('reminders'),tasks=take('tasks'),events=take('events');
   const names=new Map(athletes.map((a:Row)=>[a.id,label(a.full_name)]));
   const rows:unknown[][]=[['Athlete','Record Type','Date','School','Coach','Activity / Status','Details','Source']];
   const push=(id:string,type:string,at:any,school:any,coach:any,status:any,details:any,source:string)=>rows.push([names.get(id)||'Athlete',type,date(at),label(school),label(coach),label(status),label(details),source]);
   for(const s of schools)push(s.athlete_user_id,'School relationship','',obj(s.colleges).name,'',s.status,'','RLTNL athlete_colleges');
   for(const c of coaches){const co=obj(c.college_coaches);push(c.athlete_user_id,'Coach relationship',c.last_contact_date,obj(c.colleges).name,[co.first_name,co.last_name].filter(Boolean).join(' '),c.archived_at?'Archived':'Active',c.next_step,'RLTNL athlete_coaches')}
   for(const i of interactions)push(i.athlete_user_id,'Interaction',i.date||i.created_at,'','',i.type,[i.email_subject,i.note].filter(Boolean).map(label).join(' — ').slice(0,350),'RLTNL interactions');
   for(const r of reminders)push(r.athlete_user_id,'Reminder',r.due_date,obj(r.colleges).name,[obj(r.college_coaches).first_name,obj(r.college_coaches).last_name].filter(Boolean).join(' '),r.status,r.title,'RLTNL reminders');
   for(const t of tasks)push(t.athlete_user_id,'Advisor task',t.due_date,'','',t.status,[t.title,t.description].filter(Boolean).map(label).join(' — ').slice(0,350),'RLTNL advisor_tasks');
   for(const e of events){const ev=obj(e.events);push(e.athlete_user_id,'Event',ev.date,obj(ev.colleges).name,'',e.status,[ev.name,ev.type,ev.location].filter(Boolean).join(' — '),'RLTNL athlete_events')}
   const summaries=athletes.map((a:Row)=>{const id=a.id;const mine=(items:Row[])=>items.filter(r=>r.athlete_user_id===id);const comm=mine(interactions);return {name:label(a.full_name),schools:mine(schools).filter(r=>!r.archived_at).length,coaches:mine(coaches).filter(r=>!r.archived_at).length,sent:comm.filter(r=>r.type==='Email Sent').length,received:comm.filter(r=>r.type==='Email Received').length,other:comm.filter(r=>!['Email Sent','Email Received'].includes(r.type)).length,events:mine(events).length,open:mine(reminders).filter(r=>!['done','completed','complete'].includes(String(r.status||'').toLowerCase())).length+mine(tasks).filter(r=>!['done','completed','complete'].includes(String(r.status||'').toLowerCase())).length}});
   const summaryCsv=csv([['Athlete','Schools','Coaches','Emails Sent','Emails Received','Other Interactions','Events','Open Tasks / Reminders'],...summaries.map(s=>[s.name,s.schools,s.coaches,s.sent,s.received,s.other,s.events,s.open])]);
   const md=['# RLTNL Recruiting Intelligence Export','',`Generated: ${stamp()}`,'','Source: RLTNL recruiting records, restricted to currently approved advisor assignments.','', '## Athlete activity overview','', '| Athlete | Schools | Coaches | Sent | Received | Other interactions | Events | Open tasks/reminders |','|---|---:|---:|---:|---:|---:|---:|---:|',...summaries.map(s=>`| ${s.name.replace(/\\|/g,'/')} | ${s.schools} | ${s.coaches} | ${s.sent} | ${s.received} | ${s.other} | ${s.events} | ${s.open} |`),'','## Interpretation guidance','','- Counts reflect recorded RLTNL data, not all recruiting activity across platforms.','- Emails received are recorded incoming messages; do not treat every message as a positive recruiting response.','- Open task counts depend on recorded status; confirm deadlines and completion in RLTNL.','- School relationship status is not proof of a scholarship offer.','- The detailed CSV contains record-level source labels for verification.','- This export intentionally excludes private email bodies, addresses, phone numbers, GPA, and other unnecessary personal details.','- Review permissions and obtain appropriate consent before uploading information about minors to third-party AI services.','','## Suggested ChatGPT prompt','','Compare this RLTNL report with the SportsRecruits and FieldLevel data I upload. Separate verified facts from inference, identify missing or conflicting records, quantify activity and responses, and recommend evidence-based advisor follow-ups for each athlete. Do not infer coach interest from outgoing emails alone.'].join('\n');
   const base='rltnl-recruiting-intelligence-'+stamp();
   if(format==='both'||format==='csv'){download(base+'-summary.csv',summaryCsv,'text/csv;charset=utf-8');download(base+'-records.csv',csv(rows),'text/csv;charset=utf-8')}
   if(format==='both'||format==='md')download(base+'-chatgpt.md',md,'text/markdown;charset=utf-8');
  }catch(e){setError(e instanceof Error?e.message:'Export failed.')}finally{setBusy(false)}
 }
 return <section className="card p-4 sm:p-5" aria-label="Recruiting intelligence export">
  <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-black">Export Recruiting Intelligence</h2><p className="mt-1 text-sm text-slate-600">Download RLTNL recruiting activity for analysis alongside SportsRecruits, FieldLevel, and other sources in your own ChatGPT.</p></div></div>
  <div className="mt-4 flex flex-wrap items-end gap-3"><label className="text-xs font-bold">Athletes<select className="mt-1 block rounded-lg border px-3 py-2 text-sm" value={scope} onChange={e=>setScope(e.target.value)}><option value="all">All approved athletes in current filters</option>{selectedAthlete&&<option value="selected">Selected athlete only</option>}</select></label><label className="text-xs font-bold">Format<select className="mt-1 block rounded-lg border px-3 py-2 text-sm" value={format} onChange={e=>setFormat(e.target.value)}><option value="both">CSV + ChatGPT-ready Markdown</option><option value="csv">CSV files</option><option value="md">ChatGPT-ready Markdown</option></select></label><button type="button" className="btn btn-red" disabled={busy||!allowedAthleteIds.length} onClick={run}>{busy?'Preparing export…':'Download Recruiting Intelligence'}</button></div>
  {error&&<p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
  <p className="mt-3 text-xs text-slate-500">Advisor-approved athletes only. No private email bodies. Multiple files may download. Reports reflect recorded RLTNL activity, not verified coach interest or complete recruiting history.</p>
 </section>;
}
