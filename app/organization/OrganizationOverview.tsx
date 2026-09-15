'use client';
import {useState} from 'react';
import dynamic from 'next/dynamic';
import {Activity,ChevronDown} from 'lucide-react';
const OrganizationCommandCenter=dynamic(()=>import('./OrganizationCommandCenter'),{ssr:false,loading:()=> <div className="rr-soft-surface p-6 text-sm text-slate-500">Loading organization analytics…</div>});
export default function OrganizationOverview(){const[open,setOpen]=useState(false);return <section className="mt-7 border-t pt-6"><button type="button" className="w-full flex items-center justify-between gap-4 text-left" onClick={()=>setOpen(v=>!v)} aria-expanded={open}><span><span className="flex items-center gap-2 font-black text-lg"><Activity size={18}/>Organization analytics</span><span className="block muted text-sm mt-1">Open deeper player, coach, activity and account analysis only when you need it.</span></span><ChevronDown size={18} className={`shrink-0 transition-transform ${open?'rotate-180':''}`}/></button>{open&&<div className="mt-5"><OrganizationCommandCenter/></div>}</section>}
