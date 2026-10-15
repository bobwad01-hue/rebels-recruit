'use client';

import Link from 'next/link';
import {useEffect,useMemo,useState} from 'react';
import {Check,ChevronRight,Plus,Search,UserRound,X} from 'lucide-react';
import {createClient} from '@/lib/supabase-browser';
import {emitDataChanged} from '@/lib/data-events';

type CoachRow={
 id:string;college_id:string;first_name:string|null;last_name:string|null;
 title:string|null;verification_status:string|null;contact_verification_needed:boolean|null;
 colleges:{id:string;name:string;division:string|null;state:string|null}|{id:string;name:string;division:string|null;state:string|null}[]|null;
};
const one=(v:any)=>Array.isArray(v)?v[0]:v;
const SELECT='id,college_id,first_name,last_name,title,verification_status,contact_verification_needed,colleges!college_coaches_college_id_fkey(id,name,division,state)';
const nameOf=(r:CoachRow)=>[r.first_name,r.last_name].filter(Boolean).join(' ')||'Coach';
const schoolOf=(r:CoachRow)=>one(r.colleges);
function coachRank(row:CoachRow){
 const title=String(row.title||'').toLowerCase();
 if(title.includes('head')&&!title.includes('associate')&&!title.includes('assistant'))return 0;
 if(title.includes('associate head'))return 1;
 if(title.includes('assistant')||title.includes('asst'))return 2;
 return 3;
}

export default function FindCoaches({athleteId,initialSearch='',collegeId=''}:{athleteId:string;initialSearch?:string;collegeId?:string}){
 const c=useMemo(()=>createClient(),[]);
 const [query,setQuery]=useState(initialSearch);
 const [results,setResults]=useState<CoachRow[]>([]);
 const [savedIds,setSavedIds]=useState<Set<string>>(new Set());
 const [loading,setLoading]=useState(false);
 const [searched,setSearched]=useState(false);
 const [busy,setBusy]=useState('');
 const [error,setError]=useState('');
 const [success,setSuccess]=useState('');

 useEffect(()=>{
  const safe=query.trim().replace(/[%,().:"\\]/g,' ').replace(/\s+/g,' ').slice(0,80).trim();
  if(safe.length<2){setResults([]);setSavedIds(new Set());setLoading(false);setSearched(false);setError('');return;}
  let active=true;
  setLoading(true);setSearched(false);setError('');
  const timer=setTimeout(async()=>{
   try{
    const parts=safe.split(' ').filter(Boolean);
    let byCoach=c.from('college_coaches').select(SELECT).eq('lifecycle_status','active');
    if(parts.length>=2){
     const first=parts[0],last=parts.slice(1).join(' ');
     byCoach=byCoach.or('and(first_name.ilike.%'+first+'%,last_name.ilike.%'+last+'%),and(first_name.ilike.%'+last+'%,last_name.ilike.%'+first+'%)');
    }else{
     byCoach=byCoach.or('first_name.ilike.%'+safe+'%,last_name.ilike.%'+safe+'%,title.ilike.%'+safe+'%');
    }
    const [nameResult,schoolsResult]=await Promise.all([
     byCoach.limit(40),
     c.from('colleges').select('id,name').ilike('name','%'+safe+'%').order('name').limit(20)
    ]);
    if(nameResult.error)throw nameResult.error;
    if(schoolsResult.error)throw schoolsResult.error;
    const schoolIds=(schoolsResult.data||[]).map(s=>s.id);
    let schoolCoaches:CoachRow[]=[];
    if(schoolIds.length){
     const bySchool=await c.from('college_coaches').select(SELECT)
      .eq('lifecycle_status','active').in('college_id',schoolIds).limit(100);
     if(bySchool.error)throw bySchool.error;
     schoolCoaches=(bySchool.data||[]) as unknown as CoachRow[];
    }
    const all=new Map<string,CoachRow>();
    for(const row of [...(nameResult.data||[]) as unknown as CoachRow[],...schoolCoaches])all.set(row.id,row);
    const needle=safe.toLowerCase();
    const sorted=[...all.values()].sort((a,b)=>{
     const priority=(r:CoachRow)=>{
      const n=nameOf(r).toLowerCase(),school=String(schoolOf(r)?.name||'').toLowerCase();
      return n===needle?0:n.startsWith(needle)?1:n.includes(needle)?2:school.includes(needle)?3:4;
     };
     return priority(a)-priority(b)||
      String(schoolOf(a)?.name||'').localeCompare(String(schoolOf(b)?.name||''))||
      coachRank(a)-coachRank(b)||nameOf(a).localeCompare(nameOf(b));
    }).slice(0,30);
    const ids=sorted.map(r=>r.id);
    let saved=new Set<string>();
    if(ids.length){
     const linked=await c.from('athlete_coaches').select('coach_id')
      .eq('athlete_user_id',athleteId).in('coach_id',ids).is('archived_at',null);
     if(linked.error)throw linked.error;
     saved=new Set((linked.data||[]).map(r=>r.coach_id));
    }
    if(!active)return;
    setResults(sorted);setSavedIds(saved);setSearched(true);
   }catch(e:any){
    if(!active)return;
    setResults([]);setError(e?.message||'Could not search the coach directory. Please try again.');
    setSearched(true);
   }finally{if(active)setLoading(false);}
  },220);
  return()=>{active=false;clearTimeout(timer)};
 },[query,athleteId,c]);

 async function addConnection(coach:CoachRow){
  if(busy)return;
  setBusy(coach.id);setError('');setSuccess('');
  try{
   const {data:{user},error:authError}=await c.auth.getUser();
   if(authError||!user||user.id!==athleteId)throw new Error('Please sign in as the athlete to add this coach.');
   const existing=await c.from('athlete_coaches').select('id,archived_at')
    .eq('athlete_user_id',athleteId).eq('coach_id',coach.id).maybeSingle();
   if(existing.error)throw existing.error;
   if(existing.data?.archived_at){
    const restored=await c.from('athlete_coaches').update({archived_at:null,archived_reason:null,college_id:coach.college_id})
     .eq('id',existing.data.id).eq('athlete_user_id',athleteId);
    if(restored.error)throw restored.error;
   }else if(!existing.data){
    const inserted=await c.from('athlete_coaches').insert({
     athlete_user_id:athleteId,coach_id:coach.id,college_id:coach.college_id,
     archived_at:null,archived_reason:null
    });
    if(inserted.error&&inserted.error.code!=='23505')throw inserted.error;
   }
   setSavedIds(current=>new Set([...current,coach.id]));
   setSuccess(nameOf(coach)+' added to My Coach Connections as Not Contacted.');
   emitDataChanged('athlete_coaches',existing.data?'restore':'create',coach.id);
  }catch(e:any){setError(e?.message||'Could not add this connection. Please try again.');}
  finally{setBusy('');}
 }
 const canSearch=query.trim().length>=2;
 const addNewCoachHref=collegeId?`/coaches/new?college=${encodeURIComponent(collegeId)}&returnTo=%2Fconnections`:'/coaches/new?returnTo=%2Fconnections';
 return <div className="mt-6 space-y-5">
  <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
   <label htmlFor="find-coach-search" className="text-sm font-black text-slate-900">Search the coach directory</label>
   <div className="relative mt-2">
    <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"/>
    <input id="find-coach-search" autoComplete="off" className="input w-full pl-11 pr-10"
     placeholder="Coach name or school (e.g., Emma Ryan or William Jewell)"
     value={query} onChange={e=>{setQuery(e.target.value);setSuccess('');}}/>
    {query&&<button type="button" aria-label="Clear coach search" onClick={()=>setQuery('')}
     className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:bg-slate-100"><X size={17}/></button>}
   </div>
   <p className="mt-2 text-xs text-slate-500">Search the shared RLTNL softball directory. Adding a coach does not add their school to your recruiting targets.</p>
  </section>
  {success&&<div role="status" className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-900">{success}</div>}
  {error&&<div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{error}</div>}
  {loading&&<div role="status" className="rounded-xl border bg-white p-5 text-sm text-slate-600">Searching coaches…</div>}
  {!loading&&canSearch&&searched&&<section>
   <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
    <h2 className="text-lg font-black text-slate-900">Matching Coaches</h2>
    <span className="text-xs font-semibold text-slate-500">{results.length} shown</span>
   </div>
   {results.length>0?<div className="space-y-3">
    {results.map(coach=>{
     const school=schoolOf(coach),saved=savedIds.has(coach.id);
     return <article key={coach.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div className="flex min-w-0 items-start gap-3">
       <div aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><UserRound size={20}/></div>
       <div className="min-w-0">
        <Link href={'/coaches/'+coach.id} className="text-base font-black text-slate-900 hover:text-red-700 hover:underline">{nameOf(coach)}</Link>
        <p className="mt-0.5 text-sm text-slate-600">{coach.title||'Softball Coach'}</p>
        <p className="mt-1 text-xs font-semibold text-slate-700">{school?.name||'School not listed'}{school?.division?' · '+school.division:''}{school?.state?' · '+school.state:''}</p>
        {coach.verification_status==='unverified'&&<p className="mt-1 text-xs text-amber-700">Coaching identity pending RLTNL verification</p>}
        {coach.contact_verification_needed&&<p className="mt-1 text-xs text-amber-700">Contact details under review; email unavailable</p>}
       </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
       {saved?<Link href={'/coaches/'+coach.id} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-4 py-2.5 text-sm font-bold text-green-800"><Check size={16}/>View Connection<ChevronRight size={15}/></Link>
        :<button type="button" disabled={!!busy} onClick={()=>void addConnection(coach)}
         className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50"><Plus size={16}/>{busy===coach.id?'Adding…':'Add Connection'}</button>}
      </div>
     </article>;
    })}
   </div>:<div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5">
 <p className="text-sm font-semibold text-slate-900">No matching coaches were found.</p>
 <p className="mt-1 text-xs text-slate-600">Try a different name or school. If the coach isn't listed, you can add them.</p>
 <Link href={addNewCoachHref} className="mt-3 inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800"><Plus size={14}/>Add Coach Not Listed</Link>
</div>}
  </section>}
  {!canSearch&&<div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center">
   <Search size={23} className="mx-auto text-slate-500"/>
   <h2 className="mt-3 text-base font-black text-slate-900">Find the coaches you want to connect with</h2>
   <p className="mx-auto mt-1 max-w-lg text-sm text-slate-600">Search by name or college. Choose Add Connection to save a coach without marking them as contacted.</p>
  </div>}
  <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-5 text-sm">
   <Link href="/connections" className="font-bold text-slate-700 hover:underline">← Back to Connections</Link>
   <Link href={addNewCoachHref} className="font-bold text-red-700 hover:underline">Coach not listed? Add a coach →</Link>
  </div>
 </div>;
}
