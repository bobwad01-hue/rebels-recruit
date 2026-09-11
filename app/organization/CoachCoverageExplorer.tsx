'use client';
import Link from 'next/link';
import {useMemo,useState} from 'react';
import {ArrowRight,Download,Search} from 'lucide-react';

const one=(v:any)=>Array.isArray(v)?v[0]:v;
const exactDate=(a:any)=>a?.date_precision==='exact'&&a?.date?String(a.date):'';

type Props={rows:any[];activity:any[];pm:Map<any,any>;csv:(name:string,rows:any[])=>void};
export default function CoachCoverageExplorer({rows,activity,pm,csv}:Props){
 const [q,setQ]=useState(''),[school,setSchool]=useState(''),[player,setPlayer]=useState(''),[sort,setSort]=useState<'az'|'players'|'interactions'|'recent'>('az');
 const groups=useMemo(()=>{
  const by=new Map<string,any>();
  for(const r of rows){
   const coach=one(r.college_coaches),college=one(r.colleges);if(!r.coach_id||!coach)continue;
   const name=[coach.first_name,coach.last_name].filter(Boolean).join(' ')||'Unknown coach';
   const g=by.get(r.coach_id)||{id:r.coach_id,name,coach,rows:[],schools:new Map<string,string>(),players:new Set<string>(),interactions:0,recent:''};
   g.rows.push(r);g.players.add(r.athlete_user_id);if(r.college_id&&college?.name)g.schools.set(String(r.college_id),String(college.name));if(r.last_contact_date&&r.last_contact_date>g.recent)g.recent=r.last_contact_date;by.set(r.coach_id,g);
  }
  for(const a of activity){const g=by.get(a.coach_id);if(!g)continue;g.interactions++;const d=exactDate(a);if(d&&d>g.recent)g.recent=d}
  return [...by.values()];
 },[rows,activity]);
 const schools=useMemo(()=>{const bySchool=new Map<string,string>();for(const r of rows){const name=one(r.colleges)?.name;if(r.college_id&&name)bySchool.set(String(r.college_id),String(name))}return [...bySchool.entries()].sort((a,b)=>a[1].localeCompare(b[1]))},[rows]);
 const players=useMemo(()=>{const ids=new Set<string>();for(const r of rows){if(r.athlete_user_id)ids.add(String(r.athlete_user_id))}return [...ids].map((id):[string,string]=>[id,String(pm.get(id)?.full_name||pm.get(id)?.email||'Player')]).sort((a,b)=>a[1].localeCompare(b[1]))},[rows,pm]);
 const filtered=useMemo(()=>{const needle=q.trim().toLowerCase();return groups.filter(g=>{const schoolNames=[...g.schools.values()] as string[];const playerNames=[...g.players].map((id:any)=>pm.get(id)?.full_name||pm.get(id)?.email||'');const hay=[g.name,g.coach?.title,g.coach?.email,...schoolNames,...playerNames].filter(Boolean).join(' ').toLowerCase();return(!needle||hay.includes(needle))&&(!school||g.schools.has(school))&&(!player||g.players.has(player))}).sort((a,b)=>sort==='players'?b.players.size-a.players.size||a.name.localeCompare(b.name):sort==='interactions'?b.interactions-a.interactions||a.name.localeCompare(b.name):sort==='recent'?String(b.recent||'').localeCompare(String(a.recent||''))||a.name.localeCompare(b.name):a.name.localeCompare(b.name))},[groups,q,school,player,sort,pm]);
 const clear=()=>{setQ('');setSchool('');setPlayer('');setSort('az')};
 return <section className="card p-4 sm:p-5"><div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3"><div><div className="rr-eyebrow">RELATIONSHIP COVERAGE</div><h2 className="rr-section-title">Coach Coverage</h2><p className="rr-section-subtitle">Search, filter and sort coaches across the organization.</p></div><button className="btn self-start sm:self-auto" onClick={()=>csv('organization-coaches.csv',filtered.map(g=>({coach:g.name,schools:[...g.schools.values()].join('; '),players:g.players.size,interactions:g.interactions,last_exact_contact:g.recent||''})))}><Download size={16}/>Export CSV</button></div>
 <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-2 mt-4">
  <label className="relative rr-search-shell"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 muted"/><span className="sr-only">Search coaches</span><input className="input rr-search-input pl-9" placeholder="Search Coaches" value={q} onChange={e=>setQ(e.target.value)}/></label>
  <select aria-label="Filter coach coverage by school" className="input" value={school} onChange={e=>setSchool(e.target.value)}><option value="">All Schools</option>{schools.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select>
  <select aria-label="Filter coach coverage by player" className="input" value={player} onChange={e=>setPlayer(e.target.value)}><option value="">All Players</option>{players.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select>
  <select aria-label="Sort coach coverage" className="input" value={sort} onChange={e=>setSort(e.target.value as any)}><option value="az">A–Z</option><option value="players">Most Players</option><option value="interactions">Most Interactions</option><option value="recent">Most Recent Contact</option></select>
 </div>
 {(q||school||player||sort!=='az')&&<button className="text-sm font-bold mt-3 min-h-11" onClick={clear}>Clear Filters</button>}
 <div className="mt-3 text-xs muted">Showing {filtered.length} of {groups.length} coaches</div>
 <div className="mt-2 divide-y">{filtered.map(g=>{const athleteIds=[...g.players] as string[],firstAthlete=athleteIds[0],href=`/coaches/${g.id}${firstAthlete?`?athlete=${firstAthlete}`:''}`;return <div className="py-4" key={g.id}><div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2"><div className="min-w-0"><Link href={href} className="font-black hover:text-red-700 hover:underline inline-flex items-center gap-1">{g.name} <ArrowRight size={14}/></Link><div className="muted text-xs mt-1">{g.coach?.title||'Coach'}{g.schools.size?` · ${[...g.schools.values()].join(', ')}`:''}</div></div><div className="text-xs font-semibold text-slate-600 sm:text-right">{g.players.size} player{g.players.size===1?'':'s'} · {g.interactions} interaction{g.interactions===1?'':'s'}{g.recent?<><br/>Last exact contact {g.recent}</>:null}</div></div><div className="text-sm mt-2 flex flex-wrap gap-x-2 gap-y-1">{athleteIds.map((id:any)=><Link key={id} href={`/players/${id}`} className="hover:text-red-700 hover:underline">{pm.get(id)?.full_name||'Player'}</Link>)}</div></div>})}</div>
 {!filtered.length&&<div className="rr-empty-state mt-4"><div className="font-black">No coaches match these filters.</div><p>Change the search, school, player or sort options to explore other coach relationships.</p></div>}
 </section>;
}
