'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {ArrowRight,CheckCircle2,ChevronDown,ChevronUp,Compass,School,UserRound} from 'lucide-react';

export default function AthleteFirstRun({athleteId,fitComplete,hasSchools}:{
 athleteId:string;fitComplete:boolean;hasSchools:boolean;
}){
 const [dismissed,setDismissed]=useState(true);
 const [expanded,setExpanded]=useState(false);
 const [ready,setReady]=useState(false);
 const key='rltnl:first-run-skipped:'+athleteId;
 useEffect(()=>{
  let skipped=false,force=false;
  try{skipped=localStorage.getItem(key)==='1';force=new URLSearchParams(window.location.search).get('setup')==='1'}catch{}
  setDismissed(skipped&&!force);
  setExpanded(force);
  setReady(true);
 },[key]);
 const completed=1+Number(fitComplete)+Number(hasSchools);
 const nextHref=!fitComplete?'/fit-profile':!hasSchools?'/discover':'/game-plan';
 const nextLabel=!fitComplete?'Set my college preferences':!hasSchools?'Find my first schools':'Open Game Plan';
 if(!ready||dismissed||(fitComplete&&hasSchools))return null;
 return <section aria-label="Optional getting started checklist" className="mb-6 rounded-2xl border border-red-200 bg-white p-4 shadow-sm sm:p-5">
  <div className="flex flex-wrap items-start justify-between gap-3">
   <div className="min-w-0">
    <div className="rr-eyebrow">WELCOME TO RLTNL RECRUITING</div>
    <h2 className="mt-1 text-lg font-black">Let's get your recruiting journey started.</h2>
    <p className="mt-1 text-sm text-slate-600">Three quick starting points. You can do these in any order or come back later.</p>
   </div>
   <button type="button" className="text-xs font-bold text-slate-500 underline hover:text-slate-900"
    onClick={()=>{try{localStorage.setItem(key,'1')}catch{}setDismissed(true)}}>Skip for Now</button>
  </div>
  <div className="mt-4 flex items-center gap-3">
   <div className="flex-1 overflow-hidden rounded-full bg-slate-100 h-2"><div className="h-full rounded-full bg-red-600" style={{width:(completed/3*100)+'%'}}/></div>
   <span className="text-xs font-bold text-slate-600">{completed} of 3</span>
  </div>
  <div className="mt-4 flex flex-wrap items-center gap-3">
   <Link href={nextHref} className="btn btn-red">{nextLabel}<ArrowRight size={15}/></Link>
   <button type="button" onClick={()=>setExpanded(v=>!v)} className="inline-flex items-center gap-1 text-sm font-bold text-slate-700">
    {expanded?'Hide steps':'View steps'} {expanded?<ChevronUp size={15}/>:<ChevronDown size={15}/>}
   </button>
  </div>
  {expanded&&<div className="mt-4 space-y-2 border-t pt-4">
   <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
    <CheckCircle2 size={19} className="text-green-600"/><UserRound size={17} className="text-slate-500"/>
    <span className="text-sm font-bold">Your basic profile is ready</span>
   </div>
   <Link href="/fit-profile" className="flex items-center gap-3 rounded-xl border p-3 hover:bg-slate-50">
    {fitComplete?<CheckCircle2 size={19} className="text-green-600"/>:<span className="h-5 w-5 rounded-full border-2 border-slate-300"/>}
    <Compass size={17} className="text-slate-500"/>
    <span className="text-sm font-bold">Tell us what matters in a college</span>
    <ArrowRight size={15} className="ml-auto text-slate-400"/>
   </Link>
   <Link href="/discover" className="flex items-center gap-3 rounded-xl border p-3 hover:bg-slate-50">
    {hasSchools?<CheckCircle2 size={19} className="text-green-600"/>:<span className="h-5 w-5 rounded-full border-2 border-slate-300"/>}
    <School size={17} className="text-slate-500"/>
    <span className="text-sm font-bold">Find your first schools</span>
    <ArrowRight size={15} className="ml-auto text-slate-400"/>
   </Link>
   <p className="pt-1 text-xs text-slate-600">Already recruiting? <Link href="/import" className="font-bold text-red-700 underline">Import your recruiting history</Link> instead of starting from scratch.</p>
  </div>}
 </section>;
}
