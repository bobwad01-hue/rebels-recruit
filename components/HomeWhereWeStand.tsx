'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {ChevronDown,ChevronUp,Target} from 'lucide-react';

type Target={relationshipId:string;collegeId:string|null;name:string;rank:number;status?:string;division?:string|null};
type Summary={collegeId:string;lastContact?:string|null;coachReplies:number;contactCount:number;upcoming?:string|null;offerStatus?:string|null;deadline?:string|null};
const fmt=(date?:string|null)=>date?new Date(String(date).slice(0,10)+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'}):'';
export default function HomeWhereWeStand({athleteId,preview=false,summaries=[]}:{athleteId:string;preview?:boolean;summaries?:Summary[]}){
 const [targets,setTargets]=useState<Target[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [expanded,setExpanded]=useState<string|null>(null);
 useEffect(()=>{let live=true;async function load(){setLoading(true);setError('');try{
 const res=await fetch(preview?'/api/targets?scope=organization':'/api/targets',{cache:'no-store'});
 if(!res.ok)throw Error('Could not load target rankings');
 const data=await res.json();
 const list=preview?(data.players||[]).find((p:any)=>p.athleteUserId===athleteId)?.targets||[]:data.targets||[];
 if(live)setTargets(list);
 }catch{if(live)setError('Target rankings are unavailable. Refresh to try again.')}finally{if(live)setLoading(false)}}
 void load();return()=>{live=false}},[athleteId,preview]);
 const byCollege=new Map(summaries.map(s=>[s.collegeId,s]));
 return <section className="card mb-6 p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="flex items-center gap-2 text-lg font-black"><Target size={18}/>Where We Stand</h2><p className="mt-1 text-xs text-slate-600">Every school in your Target Rankings, in your chosen order. Select a school to see its progress.</p></div><Link href="/connections" className="text-xs font-bold text-red-700 hover:underline">Manage Target Rankings</Link></div>
 {error&&<p role="alert" className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{error}</p>}
 {loading?<p className="mt-4 text-sm text-slate-500">Loading your ranked schools…</p>:targets.length===0?<div className="mt-4 rounded-xl border bg-slate-50 p-4 text-sm">No ranked schools yet. <Link href="/connections" className="font-bold text-red-700 underline">Build your Target Rankings</Link> to see your recruiting progress here.</div>:<div className="mt-4 space-y-1.5">{targets.map(row=>{const s=byCollege.get(row.collegeId||'');const open=expanded===row.relationshipId;const status=s?.offerStatus?'Offer '+s.offerStatus.replace(/_/g,' '):row.status||'Researching';const next=s?.deadline?'Review offer deadline: '+fmt(s.deadline):s?.upcoming?'Prepare for '+s.upcoming:s?.coachReplies?'Review coach response and plan your next follow-up':s?.contactCount?'Review recent contact and plan your next step':'Find the right coach and start a conversation';return <div key={row.relationshipId} className="overflow-hidden rounded-lg border border-slate-200 bg-white"><button type="button" aria-expanded={open} onClick={()=>setExpanded(open?null:row.relationshipId)} className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-slate-50"><span className="w-6 shrink-0 text-xs font-black text-slate-500">#{row.rank}</span><div className="min-w-0 flex-1"><div className="truncate text-sm font-black">{row.name}</div><div className="text-[11px] text-slate-500">{row.division||'School'}</div></div><span className="max-w-[38%] rounded-full bg-slate-100 px-2 py-1 text-right text-[11px] font-semibold text-slate-700">{status}</span>{open?<ChevronUp size={15} className="shrink-0"/>:<ChevronDown size={15} className="shrink-0"/>}</button>{open&&<div className="border-t bg-slate-50/60 px-4 py-3 text-xs"><div className="grid gap-2 sm:grid-cols-3"><div><span className="text-slate-500">Last contact</span><p className="mt-1 font-bold">{fmt(s?.lastContact)||'Not recorded'}</p></div><div><span className="text-slate-500">Coach responses</span><p className="mt-1 font-bold">{s?.coachReplies||0} recorded</p></div><div><span className="text-slate-500">Upcoming</span><p className="mt-1 font-bold">{s?.upcoming||'None recorded'}</p></div></div><div className="mt-3 rounded-lg border bg-white p-3"><div className="font-black">Suggested next step</div><p className="mt-1 text-slate-600">{next}</p></div>{row.collegeId&&<div className="mt-3 flex flex-wrap gap-4"><Link href={`/colleges/${row.collegeId}`} className="font-bold text-red-700 hover:underline">View school relationship</Link>{s?.offerStatus&&<Link href="/offers" className="font-bold text-red-700 hover:underline">Compare Offers</Link>}</div>}<p className="mt-2 text-[11px] text-slate-500">Recorded activity does not establish confirmed recruiting interest.</p></div>}</div>})}</div>}</section>;
}
