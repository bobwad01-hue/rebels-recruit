'use client';

import {useEffect,useState} from 'react';
import {CheckCircle2,ExternalLink,MessageSquareText,Send,X} from 'lucide-react';

type Decision='accept'|'reject';
type Suggestion={
 id:string;submitted_by_user_id?:string;submitter?:{full_name?:string|null;email?:string|null}|null;
 suggestion_type?:string;proposed_first_name?:string|null;proposed_last_name?:string|null;
 proposed_title?:string|null;proposed_email?:string|null;proposed_phone?:string|null;proposed_x_url?:string|null;
 college_coaches?:any;
};

export default function CoachSuggestionDecisionModal({suggestion,decision,onClose,onReviewed,onFinished}:{
 suggestion:Suggestion;decision:Decision;onClose:()=>void;onReviewed:()=>void;
 onFinished:(message:string)=>void;
}){
 const coach=Array.isArray(suggestion.college_coaches)?suggestion.college_coaches[0]:suggestion.college_coaches;
 const coachName=[coach?.first_name,coach?.last_name].filter(Boolean).join(' ')||'this coach';
 const recipient=suggestion.submitter?.full_name||suggestion.submitter?.email||'the submitter';
 const accepting=decision==='accept';
 const [notify,setNotify]=useState(false);
 const [body,setBody]=useState('');
 const [sourceUrl,setSourceUrl]=useState('');
 const [busy,setBusy]=useState(false);
 const [reviewSaved,setReviewSaved]=useState(false);
 const [error,setError]=useState('');
 const [threadId,setThreadId]=useState<string|null>(null);

 useEffect(()=>{
  const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!busy)onClose()};
  window.addEventListener('keydown',onKey);
  return()=>window.removeEventListener('keydown',onKey);
 },[busy,onClose]);

 const fields=[
  ['Name',[coach?.first_name,coach?.last_name].filter(Boolean).join(' '),[suggestion.proposed_first_name||coach?.first_name,suggestion.proposed_last_name||coach?.last_name].filter(Boolean).join(' ')],
  ['Title',coach?.title,suggestion.proposed_title],
  ['Email',coach?.email,suggestion.proposed_email],
  ['Phone',coach?.phone,suggestion.proposed_phone],
  ['X / Twitter',coach?.x_url,suggestion.proposed_x_url],
 ].filter(([,oldValue,newValue])=>newValue&&String(oldValue||'').trim()!==String(newValue).trim());

 function toggleMessage(value:boolean){
  setNotify(value);setError('');
  if(value&&!body&&accepting){
   setBody(`Thank you for helping keep the RLTNL Recruiting coach directory accurate. We reviewed your report for ${coachName} and applied the verified update.`);
  }
 }

 async function confirm(){
  if(busy)return;
  if(notify){
   if(!body.trim())return setError('Write a message to the submitter or turn off messaging.');
   if(body.trim().length>4000)return setError('The message must be 4,000 characters or fewer.');
   if(!accepting&&body.trim().length<20)return setError('Please explain the reason for not applying the update.');
   if(sourceUrl.trim()&&!/^https:\/\/[^\s]+$/i.test(sourceUrl.trim()))return setError('Use a valid HTTPS URL for the official source.');
  }
  setBusy(true);setError('');
  let decisionWasSaved=reviewSaved;
  try{
   if(!reviewSaved){
    const response=await fetch('/api/platform/coach-data-review',{
     method:'POST',headers:{'Content-Type':'application/json'},
     body:JSON.stringify({id:suggestion.id,decision})
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||'The review decision could not be saved.');
    setReviewSaved(true);
    decisionWasSaved=true;
    onReviewed();
   }
   if(notify){
    const response=await fetch('/api/platform/messages',{
     method:'POST',headers:{'Content-Type':'application/json'},
     body:JSON.stringify({source_type:'coach_suggestion',source_id:suggestion.id,
      body:body.trim(),source_url:sourceUrl.trim()})
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||'The message could not be delivered.');
    setThreadId(data.thread_id||null);
    window.dispatchEvent(new Event('rltnl:platform-messages-updated'));
   }
   onFinished(`${accepting?'Coach update verified and applied':'Coach update rejected'}.${notify?' Message sent to '+recipient+'.':''}`);
  }catch(e){
   const reason=e instanceof Error?e.message:'Something went wrong.';
   setError(decisionWasSaved?`Decision saved, but the message was not sent: ${reason}`:
    reason);
  }finally{setBusy(false)}
 }

 // A review can be saved before the separate message request fails.
 // Keep the dialog open and retry only the message; never reapply the coach change.
 const close=()=>{if(!busy){if(reviewSaved)onFinished(`${accepting?'Coach update verified and applied':'Coach update rejected'}. Message was not sent.`);else onClose()}};

 return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 p-3 sm:p-6"
  onMouseDown={e=>{if(e.target===e.currentTarget)close()}}>
  <div role="dialog" aria-modal="true" aria-labelledby="coach-decision-title"
   aria-describedby="coach-decision-description"
   className="flex max-h-[min(92vh,900px)] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
   <div className="flex items-start justify-between gap-3 border-b px-5 py-4 sm:px-6">
    <div><div className="rr-eyebrow">COMMUNITY INTELLIGENCE</div>
     <h2 id="coach-decision-title" className="mt-1 text-xl font-black">
      {accepting?'Verify & Apply Update':'Reject Coach Update'}
     </h2>
     <p id="coach-decision-description" className="mt-1 text-sm text-slate-600">
      {coachName} · Submitted by <b>{recipient}</b>
     </p></div>
    <button type="button" aria-label="Close review" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
     disabled={busy} onClick={close}><X size={20}/></button>
   </div>
   <div className="overflow-y-auto px-5 py-4 sm:px-6">
    <div className={`rounded-xl border p-4 ${accepting?'border-green-200 bg-green-50':'border-slate-200 bg-slate-50'}`}>
     <p className="text-sm font-black">{accepting?'Apply the verified changes to the shared coach directory':'Leave the shared coach record unchanged'}</p>
     <p className="mt-1 text-sm text-slate-600">
      {accepting?'This updates the canonical coach information for everyone using RLTNL.':
       'The submitted changes will not be applied. The report will be marked rejected.'}
     </p>
     {fields.length>0&&<div className="mt-3 space-y-2 border-t pt-3 text-sm">
      {fields.map(([name,oldValue,newValue])=><div key={name} className="grid grid-cols-[85px_1fr] gap-2">
       <b className="text-slate-700">{name}</b>
       <span className="break-words text-slate-700">
        {oldValue&&<><span className="text-slate-500">{oldValue}</span><span className="px-1.5">→</span></>}
        <span className="font-semibold">{newValue}</span>
       </span>
      </div>)}
     </div>}
    </div>
    <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4">
     <input type="checkbox" checked={notify} disabled={busy} onChange={e=>toggleMessage(e.target.checked)}
      className="mt-1 h-4 w-4 accent-red-600"/>
     <span><span className="flex items-center gap-2 text-sm font-black"><MessageSquareText size={17}/>Message the submitter</span>
      <span className="mt-1 block text-xs text-slate-600">Optional. Send {recipient} a response in their RLTNL Messages inbox, with an unread notification.</span>
     </span>
    </label>
    {notify&&<div className="mt-3 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
     <label className="block text-xs font-bold">Message to {recipient}
      <textarea rows={4} maxLength={4000} className="input mt-1 w-full bg-white" value={body}
       disabled={busy} onChange={e=>setBody(e.target.value)}
       placeholder={accepting?'Thank you for helping us keep our coach information accurate.':
        `Thank you for your report about ${coachName}. We did not make the change because… We verified that…`}/>
     </label>
     <label className="block text-xs font-bold">Official source link (optional)
      <input type="url" className="input mt-1 w-full bg-white" value={sourceUrl} disabled={busy}
       onChange={e=>setSourceUrl(e.target.value)}
       placeholder="https://school.edu/athletics/staff"/>
     </label>
     <p className="text-xs text-slate-600">Your message and source link are visible to the submitter. The decision is saved separately, so you can message them later too.</p>
    </div>}
    {reviewSaved&&<div className="mt-4 flex items-start gap-2 rounded-lg bg-green-50 p-3 text-sm font-semibold text-green-800">
     <CheckCircle2 size={18} className="mt-0.5 shrink-0"/>The review decision has been saved. You can retry the message without repeating the decision.
    </div>}
    {error&&<p role="alert" className="mt-3 text-sm font-semibold text-red-700">{error}</p>}
    {threadId&&<a href={`/messages?platformThread=${threadId}`} className="mt-2 inline-flex items-center gap-1 text-sm text-blue-700 underline">
     View message <ExternalLink size={13}/></a>}
   </div>
   <div className="flex flex-wrap items-center justify-end gap-2 border-t px-5 py-4 sm:px-6">
    <button type="button" className="btn" disabled={busy} onClick={close}>
     {reviewSaved?'Close without messaging':'Cancel'}
    </button>
    <button type="button" className={`btn ${accepting?'btn-red':'bg-slate-900 text-white hover:bg-slate-800'}`}
     disabled={busy} onClick={()=>void confirm()}>
     {busy?(reviewSaved?'Sending…':'Saving decision…'):
      reviewSaved?(notify?'Retry Sending Message':'Close Review'):notify?
       <><Send size={16}/>{accepting?'Verify, Apply & Message':'Reject & Message'}</>:
       accepting?'Confirm Verify & Apply':'Confirm Reject'}
    </button>
   </div>
  </div>
 </div>;
}
