'use client';
import {useState} from 'react';
import Link from 'next/link';

const one=(v:any)=>Array.isArray(v)?v[0]:v;
const labels:Record<string,string>={email:'Email address',phone:'Phone number',x_url:'X / Twitter URL',instagram_url:'Instagram URL'};

export default function CoachContactConflictReview({review,onResolved}:{review:any,onResolved:()=>void|Promise<void>}){
 const [choice,setChoice]=useState(''),[custom,setCustom]=useState(''),[evidence,setEvidence]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const coach=one(review.college_coaches),school=one(coach?.colleges);
 const values=[...new Set((review.observed_values||[]).filter(Boolean))] as string[];
 const selected=choice==='other'?custom.trim():choice;
 const name=[coach?.first_name,coach?.last_name].filter(Boolean).join(' ')||'Coach';
 async function resolve(e:React.FormEvent){
  e.preventDefault();setError('');
  if(!selected||evidence.trim().length<10)return;
  setBusy(true);
  try{
   const response=await fetch('/api/platform/coach-data-review',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({type:'resolve_contact',id:review.id,verifiedValue:selected,evidence:evidence.trim()})
   });
   const result=await response.json();
   if(!response.ok)throw {message:result.error||'Could not save verification.'};
   await onResolved();
  }catch(e:any){setError(e.message||'Could not save verification.')}finally{setBusy(false)}
 }
 return <form onSubmit={resolve} className="p-5 border-b last:border-b-0">
  <div className="flex flex-col md:flex-row md:justify-between gap-3">
   <div>
    <div className="font-black text-lg">{name}</div>
    <div className="muted text-sm">{school?.name||'School'} · Conflicting {labels[review.field_name]||review.field_name}</div>
   </div>
   <Link className="btn self-start" href={`/coaches/${review.coach_id}?staff=1`}>Open Coach Profile →</Link>
  </div>
  <p className="text-sm mt-3">Two source records had different contact information. Verify against an independent source before approving a value. Neither option has been automatically certified as correct.</p>
  <div className="grid md:grid-cols-2 gap-3 mt-4">
   <label className="text-sm font-bold">Verified {labels[review.field_name]||'contact'}
    <select className="input w-full mt-1" value={choice} onChange={e=>setChoice(e.target.value)} required>
     <option value="">Choose after verification</option>
     {values.map(v=><option value={v} key={v}>{v}</option>)}
     <option value="other">Another verified value…</option>
    </select>
   </label>
   {choice==='other'&&<label className="text-sm font-bold">Correct value
    <input className="input w-full mt-1" value={custom} onChange={e=>setCustom(e.target.value)} placeholder="Enter verified contact information" required/>
   </label>}
   <label className={`text-sm font-bold ${choice==='other'?'md:col-span-2':''}`}>Verification evidence
    <input className="input w-full mt-1" value={evidence} onChange={e=>setEvidence(e.target.value)} placeholder="Official staff URL or source and date checked" minLength={10} required/>
   </label>
  </div>
  {error&&<div role="alert" className="text-sm text-red-700 mt-3">{error}</div>}
  <div className="flex justify-end mt-4"><button className="btn btn-red" type="submit" disabled={busy||!selected||evidence.trim().length<10}>{busy?'Saving verification…':'Verify & Apply Contact'}</button></div>
 </form>;
}
