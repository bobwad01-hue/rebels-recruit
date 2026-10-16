'use client';
import {useState} from 'react';
import {Mail, X} from 'lucide-react';

export default function ManualCollegeEmail({collegeId,collegeName}:{collegeId:string;collegeName:string}){
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false);
 const [email,setEmail]=useState(''),[name,setName]=useState(''),[subject,setSubject]=useState(''),[body,setBody]=useState('');
 const [error,setError]=useState(''),[success,setSuccess]=useState('');
 async function send(e:React.FormEvent){
  e.preventDefault();if(busy)return;setBusy(true);setError('');setSuccess('');
  try{
   const r=await fetch('/api/google/gmail/manual-send',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({collegeId,recipientEmail:email,recipientName:name,subject,body})});
   const result=await r.json();
   if(!r.ok)throw new Error(result.error||'Could not send email.');
   setSuccess(result.warning||'Email sent through Gmail and recorded in your recruiting activity.');
   setSubject('');setBody('');
  }catch(e){setError(e instanceof Error?e.message:'Could not send email.')}
  finally{setBusy(false)}
 }
 return <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
  <div className="font-bold text-sm">Coach missing from the directory?</div>
  <p className="mt-1 text-xs text-slate-600">Email an address you already know. RLTNL will not publish it to the shared coach directory.</p>
  <button type="button" onClick={()=>{setOpen(true);setError('');setSuccess('')}} className="btn mt-3 inline-flex items-center gap-2"><Mail size={15}/>Compose Email — Enter Address</button>
  {open&&<div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-3" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)setOpen(false)}}>
   <div role="dialog" aria-modal="true" aria-label="Compose email to a college coach" className="w-full max-w-2xl max-h-[94dvh] overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
    <div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-black">Compose Email</h2><p className="text-sm text-slate-600 mt-1">{collegeName} · Enter the recipient's email address</p></div><button type="button" aria-label="Close" disabled={busy} onClick={()=>setOpen(false)}><X size={20}/></button></div>
    {success?<div role="status" className="mt-5 space-y-3"><p className="text-sm font-semibold text-emerald-700">{success}</p><button type="button" className="btn btn-red" onClick={()=>{setOpen(false);location.reload()}}>Done</button></div>:
    <form onSubmit={send} className="mt-5 space-y-4">
     <label className="block text-sm font-bold">To (email address)<input required type="email" maxLength={254} className="input mt-1 w-full" placeholder="coach@university.edu" value={email} onChange={e=>setEmail(e.target.value)}/></label>
     <label className="block text-sm font-bold">Coach / recipient name (optional)<input maxLength={120} className="input mt-1 w-full" value={name} onChange={e=>setName(e.target.value)}/></label>
     <label className="block text-sm font-bold">Subject<input required maxLength={200} className="input mt-1 w-full" value={subject} onChange={e=>setSubject(e.target.value)}/></label>
     <label className="block text-sm font-bold">Message<textarea required maxLength={20000} rows={9} className="input mt-1 w-full" value={body} onChange={e=>setBody(e.target.value)}/></label>
     <p className="text-xs text-slate-600">Sent through your connected Gmail account. The school and email will be tracked after a successful send; no shared coach record will be created.</p>
     {error&&<p role="alert" className="text-sm font-semibold text-red-700">{error}{/Gmail is not connected/i.test(error)&&<> <a className="underline" href="/api/google/connect?service=gmail">Connect Gmail</a></>}</p>}
     <div className="flex justify-end gap-2"><button type="button" className="btn" disabled={busy} onClick={()=>setOpen(false)}>Cancel</button><button type="submit" className="btn btn-red" disabled={busy}>{busy?'Sending…':'Send Email'}</button></div>
    </form>}
   </div>
  </div>}
 </div>
}
