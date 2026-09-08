'use client';
import Link from 'next/link';
import {useState} from 'react';
import {Plus,Activity,School,Users,Clock3,CalendarDays,X} from 'lucide-react';

const actions=[
 {href:'/activity/new',label:'Log Interaction',detail:'Email, call, text, visit or other coach contact',icon:Activity},
 {href:'/colleges/new',label:'Add College',detail:'Add a new school to your Current Pipeline',icon:School},
 {href:'/coaches/new',label:'Add Coach',detail:'Add a coach relationship to a school',icon:Users},
 {href:'/reminders',label:'Add Reminder',detail:'Create or manage your next recruiting follow-up',icon:Clock3},
 {href:'/events',label:'Add Event',detail:'Add or manage a camp, showcase, visit or event',icon:CalendarDays},
] as const;

export default function QuickAddMenu(){const [open,setOpen]=useState(false);return <><button type="button" className="btn btn-red" onClick={()=>setOpen(true)}><Plus size={18}/> Quick Add</button>{open&&<div className="fixed inset-0 z-[100] bg-slate-950/45 px-4 flex items-center justify-center" onMouseDown={()=>setOpen(false)}><div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border" onMouseDown={e=>e.stopPropagation()}><div className="p-5 border-b flex items-start justify-between gap-4"><div><h2 className="text-xl font-black">Quick Add</h2><p className="muted text-sm mt-1">What do you want to add?</p></div><button type="button" aria-label="Close Quick Add" onClick={()=>setOpen(false)} className="h-9 w-9 rounded-lg hover:bg-slate-100 flex items-center justify-center"><X size={18}/></button></div><div className="p-3">{actions.map(({href,label,detail,icon:Icon})=><Link key={href} href={href} onClick={()=>setOpen(false)} className="flex items-center gap-3 rounded-xl p-3 hover:bg-slate-50"><div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0"><Icon size={18}/></div><div className="min-w-0"><div className="font-black text-sm">{label}</div><div className="muted text-xs mt-0.5">{detail}</div></div></Link>)}</div></div></div>}</>}
