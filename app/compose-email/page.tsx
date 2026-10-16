'use client';
import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import ManualCollegeEmail from '@/components/ManualCollegeEmail';
import {createClient} from '@/lib/supabase-browser';
import {Mail,Search} from 'lucide-react';

type College={id:string;name:string;city:string|null;state:string|null};
export default function ComposeEmailPage(){
 const [schools,setSchools]=useState<College[]>([]),[query,setQuery]=useState(''),[selected,setSelected]=useState<College|null>(null);
 const [loading,setLoading]=useState(true),[error,setError]=useState('');
 useEffect(()=>{let alive=true;const c=createClient();(async()=>{
  const {data:{user}}=await c.auth.getUser();
  if(!user){if(alive){setError('Please sign in to compose an email.');setLoading(false)}return}
  const {data:roles}=await c.from('user_roles').select('role').eq('user_id',user.id);
  if(!(roles||[]).some((r:any)=>r.role==='athlete')){if(alive){setError('Compose Email is available to athletes.');setLoading(false)}return}
  const results:College[]=[];
  for(let start=0;start<20000;start+=1000){
   const {data,error:lookupError}=await c.from('colleges').select('id,name,city,state').order('name').range(start,start+999);
   if(lookupError){if(alive)setError('Could not load schools. Please try again.');break}
   results.push(...(data||[]));
   if(!data||data.length<1000)break;
  }
  if(alive){setSchools(results);setLoading(false)}
 })();return()=>{alive=false}},[]);
 const filtered=useMemo(()=>{const q=query.trim().toLowerCase();if(q.length<2)return [];const rank=(s:College)=>{const name=s.name.toLowerCase(),city=(s.city||'').toLowerCase(),state=(s.state||'').toLowerCase();if(name===q)return 0;if(name.startsWith(q))return 1;if(name.includes(q))return 2;if(city.startsWith(q))return 3;if(city.includes(q))return 4;if(state===q||state.startsWith(q))return 5;if(state.includes(q))return 6;return 99};return schools.map(s=>({school:s,score:rank(s)})).filter(x=>x.score<99).sort((a,b)=>a.score-b.score||a.school.name.localeCompare(b.school.name)).slice(0,30).map(x=>x.school)},[query,schools]);
 return <AppShell><div className="mx-auto max-w-3xl px-4 py-7 sm:px-8">
  <div className="flex items-center gap-3"><Mail size={25} className="text-red-700"/><div><h1 className="text-2xl font-black">Compose Email</h1><p className="text-sm text-slate-600">Choose a school, then email a coach—even if RLTNL doesn't have the coach's details.</p></div></div>
  {error&&<p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
  {!error&&<div className="card mt-6 p-5">
   <label htmlFor="school-search" className="text-sm font-black">School</label>
   <p className="mt-1 text-xs text-slate-600">Selecting a school does not add it to your Connections. RLTNL associates it with your recruiting activity after you send.</p>
   <div className="relative mt-3"><Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"/>
    <input id="school-search" className="input w-full !pl-11 !pr-4" value={query} onChange={e=>{setQuery(e.target.value);setSelected(null)}} placeholder={loading?'Loading schools…':'Search by school name, city or state'} disabled={loading} autoComplete="off"/>
   </div>
   {!selected&&filtered.length>0&&<div className="mt-2 max-h-64 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100" role="listbox" aria-label="School results">{filtered.map(s=><button type="button" key={s.id} role="option" aria-selected={false} className="block w-full px-4 py-3 text-left hover:bg-slate-50 focus:bg-slate-50" onClick={()=>{setSelected(s);setQuery(s.name)}}><span className="block text-sm font-bold">{s.name}</span><span className="text-xs text-slate-600">{[s.city,s.state].filter(Boolean).join(', ')}</span></button>)}</div>}
   {!selected&&query.trim().length>=2&&!loading&&filtered.length===0&&<p className="mt-3 text-sm text-slate-600">No schools found. Try a different name.</p>}
   {selected&&<div className="mt-5"><div className="mb-3 rounded-lg bg-slate-50 p-3 text-sm"><b>Selected:</b> {selected.name} <button type="button" className="ml-2 font-semibold text-red-700 underline" onClick={()=>{setSelected(null);setQuery('')}}>Change</button></div>
    <ManualCollegeEmail key={selected.id} collegeId={selected.id} collegeName={selected.name} initialOpen standalone/>
   </div>}
  </div>}
  <p className="mt-5 text-xs text-slate-500">Already know a coach in RLTNL? You can also open the coach's profile and use Email Coach.</p>
  <Link href="/discover" className="mt-2 inline-block text-sm font-semibold text-red-700 hover:underline">Find Schools →</Link>
 </div></AppShell>
}
