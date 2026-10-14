'use client';

import {useEffect,useState} from 'react';
import {CheckCircle2,MessageSquareText,Send,X} from 'lucide-react';

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
 const school=Array.isArray(coach?.colleges)?coach.colleges[0]?.name:coach?.colleges?.name;
 const kind=({contact_update:'contact information',incorrect_info:'information correction',title_update:'coaching title',left_program:'coaching staff status',moved_school:'school affiliation',retired:'retirement status'} as Record<string,string>)[suggestion.suggestion_type||'']||'coach information';
 const automaticMessage=`Thank you for helping keep RLTNL Recruiting's coach information accurate.\n\nYour submission regarding ${coachName}${school?' at '+school:''} (${kind}) has been reviewed, approved, and updated in our shared coach directory.\n\nWe appreciate your contribution!\n\nRLTNL Support`;
 const [notify,setNotify]=useState(false);
 const [body,setBody]=useState('');
 const [sourceUrl,setSourceUrl]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');

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

 function toggleMessage(value:boolean){setNotify(value);setError('');}

 async function confirm(){
  if(busy)return;
  if(notify){
   if(!accepting&&!body.trim())return setError('Write a message explaining the rejection or turn off messaging.');
   if(body.trim().length>4000)return setError('The message must be 4,000 characters or fewer.');
   if(!accepting&&body.trim().length<20)return setError('Please explain the reason for not applying the update.');
   if(sourceUrl.trim()&&!/^https:\/\/[^\s]+$/i.test(sourceUrl.trim()))return setError('Use a valid HTTPS URL for the official source.');
  }
  setBusy(true);setError('');
  try{
   const response=await fetch('/api/platform/coach-data-review',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({id:suggestion.id,decision,
     message:notify?body.trim():null,
     source_url:notify?sourceUrl.trim():null})
   });
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(data.error||'The review decision could not be saved.');
   onReviewed();
   if(data.message_sent)window.dispatchEvent(new Event('rltnl:platform-messages-updated'));
   const confirmation=data.automatic_message?' Automatic RLTNL Support confirmation sent to '+recipient+'.':
    data.message_sent?' Your message was sent to '+recipient+'.':'';
   onFinished(`${accepting?'Coach update verified and applied':'Coach update rejected'}.${confirmation}`);
  }catch(e){setError(e instanceof Error?e.message:'Something went wrong.')}
  finally{setBusy(false)}
 }
 const close=()=>{if(!busy)onClose()};

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
     <span><span className="flex items-center gap-2 text-sm font-black"><MessageSquareText size={17}/>{accepting?'Write a personal message (optional)':'Message the submitter (optional)'}</span>
      <span className="mt-1 block text-xs text-slate-600">{accepting?
       `RLTNL Support automatically sends ${recipient} an approval confirmation. Write your own message to replace it.`:
       `Send ${recipient} an explanation in their RLTNL Messages inbox. No message is sent automatically for rejections.`}</span>
     </span>
    </label>
    {accepting&&(!notify||!body.trim())&&<div className="mt-3 rounded-xl border border-green-200 bg-green-50 p-4">
     <div className="flex items-center gap-2 text-sm font-black text-green-800"><CheckCircle2 size={17}/>Automatic RLTNL Support confirmation</div>
     <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{automaticMessage}</p>
     <p className="mt-2 text-xs text-slate-600">Sent automatically after approval, unless you write a personal message above.</p>
    </div>}
    {notify&&<div className="mt-3 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
     <label className="block text-xs font-bold">{accepting?'Personal message (replaces the automatic confirmation)':'Message'} to {recipient}
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
     <p className="text-xs text-slate-600">Your message and source link are visible to the submitter. {accepting?'Leave the message blank to send the standard approval confirmation.':'Messaging is optional for rejections.'} The review decision and any message are saved together.</p>
    </div>}
    {error&&<p role="alert" className="mt-3 text-sm font-semibold text-red-700">{error}</p>}
   </div>
   <div className="flex flex-wrap items-center justify-end gap-2 border-t px-5 py-4 sm:px-6">
    <button type="button" className="btn" disabled={busy} onClick={close}>
     Cancel
    </button>
    <button type="button" className={`btn ${accepting?'btn-red':'bg-slate-900 text-white hover:bg-slate-800'}`}
     disabled={busy} onClick={()=>void confirm()}>
     {busy?'Saving decision…':accepting?
      <><Send size={16}/>{notify&&body.trim()?'Verify, Apply & Message':'Verify, Apply & Notify'}</>:
      notify?<><Send size={16}/>Reject & Message</>:'Confirm Reject'}
    </button>
   </div>
  </div>
 </div>;
}
