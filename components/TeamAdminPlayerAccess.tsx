'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {Search,ShieldCheck,Users} from 'lucide-react';
import {createClient} from '@/lib/supabase-browser';
import PageHeader from '@/components/PageHeader';

export default function TeamAdminPlayerAccess(){
 const [loading,setLoading]=useState(true),[error,setError]=useState(''),[players,setPlayers]=useState<any[]>([]),[query,setQuery]=useState('');
 useEffect(()=>{let active=true;(async()=>{
  const c=createClient();
  const {data:{user}}=await c.auth.getUser();
  if(!user){if(active){setError('Sign in required.');setLoading(false)}return}
  const {data:covered,error:coverageError}=await c.rpc('my_team_admin_athlete_ids');
  if(coverageError){if(active){setError('Team Admin coverage could not be verified.');setLoading(false)}return}
  const ids=[...new Set((covered||[]).map((x:any)=>String(x.athlete_user_id)))];
  const {data:profiles,error:profileError}=ids.length?await c.from('profiles').select('id,full_name,email').in('id',ids):{data:[],error:null};
  if(active){if(profileError)setError('Athlete profiles could not be loaded.');else setPlayers((profiles||[]).sort((a:any,b:any)=>String(a.full_name||a.email).localeCompare(String(b.full_name||b.email))));setLoading(false)}
 })();return()=>{active=false}},[]);
 const visible=players.filter(p=>[p.full_name,p.email].filter(Boolean).join(' ').toLowerCase().includes(query.toLowerCase()));
 if(loading)return <div className="card p-10 text-center muted">Loading team athletes…</div>;
 if(error)return <div role="alert" className="card border-red-200 bg-red-50 p-5 text-sm">{error}</div>;
 return <>
  <PageHeader eyebrow="TEAM ADMIN ACCESS" title="My Team Athletes" subtitle="You automatically have recruiting access to athletes on teams you administer, unless an athlete has revoked it."/>
  <div className="card mt-5 p-5">
   <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
    <div><h2 className="font-black flex items-center gap-2"><Users size={18}/>{players.length} athletes with active access</h2>
     <p className="muted text-sm mt-1">Team assignments update coverage automatically. Athlete revocations are respected immediately.</p></div>
    <label className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input aria-label="Search team athletes" className="input !pl-10 w-full sm:w-64" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search athletes"/></label>
   </div>
   <div className="mt-4 divide-y">{visible.map(p=><div key={p.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-4">
    <div><div className="font-bold">{p.full_name||p.email||'Athlete'}</div><div className="muted text-xs mt-1">{p.email}</div></div>
    <Link href={`/players/${p.id}`} className="btn"><ShieldCheck size={15}/>View Player 360°</Link>
   </div>)}</div>
   {!visible.length&&<div className="rr-empty-state mt-4">{players.length?'No athletes match this search.':'No team athletes currently grant you access.'}</div>}
  </div>
 </>;
}
