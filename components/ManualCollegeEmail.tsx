'use client';
import {useState} from 'react';
import {Mail,X} from 'lucide-react';
import RecruitingQuickComposer from '@/components/RecruitingQuickComposer';
export default function ManualCollegeEmail({collegeId,collegeName,initialOpen=false,standalone=false}:{collegeId:string;collegeName:string;initialOpen?:boolean;standalone?:boolean}){
 const [open,setOpen]=useState(initialOpen),[busy,setBusy]=useState(false),[sent,setSent]=useState(false);
 function close(){if(busy)return;setOpen(false);if(sent)window.location.reload()}
 return <div className={standalone?'':'mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4'}>
  {!standalone&&<><div className="text-sm font-bold">Coach missing from the directory?</div><p className="mt-1 text-xs text-slate-600">Email an address you already know. RLTNL will not publish it to the shared coach directory.</p><button type="button" className="btn mt-3 inline-flex items-center gap-2" onClick={()=>{setOpen(true);setSent(false)}}><Mail size={15}/>Compose Email — Enter Address</button></>}
  {open&&<div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-3" onMouseDown={e=>{if(e.target===e.currentTarget)close()}}>
   <div role="dialog" aria-modal="true" aria-label="Compose email to a college coach" className="max-h-[94dvh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl sm:p-5">
    <div className="flex items-start justify-end"><button type="button" aria-label="Close" disabled={busy} className="rounded-lg p-1 hover:bg-slate-100 disabled:opacity-40" onClick={close}><X size={20}/></button></div>
    {sent?<div role="status" className="mt-5 space-y-3"><h2 className="text-lg font-black">Email Sent Successfully</h2><p className="text-sm font-semibold text-emerald-800">Gmail confirmed your email was sent. Recruiting activity was updated where available.</p><button type="button" className="btn btn-red" onClick={close}>Done</button></div>:<div className="mt-2"><RecruitingQuickComposer manualOnly initialSchool={{id:collegeId,name:collegeName}} onBusyChange={setBusy} onSent={()=>setSent(true)}/><div className="mt-3 flex justify-end"><button type="button" className="btn" disabled={busy} onClick={close}>Cancel</button></div></div>}
   </div>
  </div>}
 </div>;
}
