'use client';
import {useEffect,useState} from 'react';
type Mode='default'|'custom'|'none';
export default function EmailSignatureSettings({profile,onSaved,disabled=false}:{profile:any;onSaved:(signature:{signatureMode:Mode;customSignature:string})=>void;disabled?:boolean}){
 const [open,setOpen]=useState(false),[mode,setMode]=useState<Mode>('default'),[custom,setCustom]=useState(''),[saving,setSaving]=useState(false),[feedback,setFeedback]=useState('');
 useEffect(()=>{const s=profile?.signature||{};setMode(['default','custom','none'].includes(s.signatureMode)?s.signatureMode:'default');setCustom(String(s.customSignature||''))},[profile?.signature?.signatureMode,profile?.signature?.customSignature]);
 async function save(){if(saving||disabled)return;setSaving(true);setFeedback('');
  try{const r=await fetch('/api/profile/email-signature',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({signatureMode:mode,customSignature:custom})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Unable to save signature.');
   onSaved({signatureMode:mode,customSignature:custom});setOpen(false);setFeedback('Signature saved. New emails will use it; this draft is unchanged.');
  }catch(e){setFeedback(e instanceof Error?e.message:'Unable to save signature.')}finally{setSaving(false)}
 }
 return <div className="mt-3 text-sm">
  <button type="button" className="text-xs font-semibold text-red-700 underline underline-offset-2 disabled:opacity-50" disabled={disabled||saving} aria-expanded={open} onClick={()=>{setOpen(v=>!v);setFeedback('')}}>{open?'Close Signature Settings':'Manage Signature'}</button>
  {open&&<div className="mt-3 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3"><label className="block text-xs font-semibold">Signature for future emails</label>
   <select aria-label="Email signature preference" className="input w-full" disabled={disabled||saving} value={mode} onChange={e=>setMode(e.target.value as Mode)}><option value="default">RLTNL signature (default)</option><option value="custom">My custom signature</option><option value="none">No signature</option></select>
   {mode==='custom'&&<textarea aria-label="Custom email signature" className="input min-h-32 w-full" maxLength={4000} value={custom} disabled={disabled||saving} onChange={e=>setCustom(e.target.value)} placeholder="Your name, graduation year, team, contact details…"/>}
   <button type="button" className="btn btn-red" disabled={saving||disabled||(mode==='custom'&&!custom.trim())} onClick={()=>void save()}>{saving?'Saving…':'Save signature'}</button>
   <p className="text-xs text-slate-500">Changes apply to future emails; existing drafts remain unchanged.</p>
  </div>}
  {feedback&&<p role="status" className="mt-2 text-xs text-slate-600">{feedback}</p>}
 </div>;
}
