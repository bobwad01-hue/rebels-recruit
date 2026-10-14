'use client';
import {useState} from 'react';
import Link from 'next/link';
import {Send,MessageSquareText,ExternalLink} from 'lucide-react';

export default function PlatformReplyComposer({sourceType,sourceId,recipientName,context,onSent}:{
 sourceType:'coach_suggestion'|'feedback';sourceId:string;recipientName:string;
 context?:string;onSent?:()=>void
}){
 const [open,setOpen]=useState(false),[body,setBody]=useState(''),[source,setSource]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[sent,setSent]=useState<string|null>(null);
 async function send(){
  if(!body.trim()||busy)return;
  setBusy(true);setError('');
  try{
   const response=await fetch('/api/platform/messages',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({source_type:sourceType,source_id:sourceId,body:body.trim(),source_url:source.trim()})});
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(data.error||'Could not send response.');
   setSent(data.thread_id);setBody('');setSource('');setOpen(false);
   window.dispatchEvent(new Event('rltnl:platform-messages-updated'));
   onSent?.();
  }catch(e){setError(e instanceof Error?e.message:'Could not send response.')}
  finally{setBusy(false)}
 }
 return <div className="mt-3">
  {sent?<div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-green-700">
   <MessageSquareText size={16}/>Message delivered to the RLTNL Messages inbox.
   <Link className="text-blue-700 underline" href={`/messages?platformThread=${sent}`}>View conversation <ExternalLink size={12} className="inline"/></Link>
   <button type="button" className="ml-2 text-slate-600 underline" onClick={()=>{setSent(null);setOpen(true)}}>Send another</button>
  </div>:<button type="button" className="btn text-sm" onClick={()=>setOpen(!open)}><MessageSquareText size={16}/>{open?'Close reply':'Message submitter'}</button>}
  {open&&<div className="mt-3 rounded-xl border border-slate-200 bg-white p-4">
   <p className="text-sm font-black">Reply to {recipientName}</p>
   <p className="mt-1 text-xs text-slate-500">This sends an in-app message to the submitter, not an email. It does not change the review decision or internal notes.</p>
   {context&&<p className="mt-2 text-xs text-slate-600">{context}</p>}
   <label className="mt-3 block text-xs font-bold">Message<textarea rows={4} maxLength={4000}
    className="input mt-1 w-full" value={body} onChange={e=>setBody(e.target.value)}
    placeholder="Thank you for helping us improve our coach information. We verified…"/></label>
   <label className="mt-3 block text-xs font-bold">Official source link (optional)<input type="url"
    className="input mt-1 w-full" placeholder="https://school.edu/athletics/staff"
    value={source} onChange={e=>setSource(e.target.value)}/></label>
   {error&&<p role="alert" className="mt-2 text-sm font-semibold text-red-700">{error}</p>}
   <div className="mt-3 flex justify-end gap-2">
    <button type="button" className="btn text-sm" disabled={busy} onClick={()=>setOpen(false)}>Cancel</button>
    <button type="button" className="btn btn-red text-sm" disabled={busy||!body.trim()}
     onClick={()=>void send()}><Send size={15}/>{busy?'Sending…':'Send to Messages'}</button>
   </div>
  </div>}
 </div>;
}
