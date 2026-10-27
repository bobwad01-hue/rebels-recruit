'use client';

import {useEffect,useState} from 'react';
import {CheckCircle2,MessageSquareText,Send,X} from 'lucide-react';

type Decision='accept'|'verify_only'|'reject';
type Suggestion={
 id:string;submitted_by_user_id?:string;submitter?:{full_name?:string|null;email?:string|null}|null;
 suggestion_type?:string;proposed_first_name?:string|null;proposed_last_name?:string|null;
 proposed_title?:string|null;proposed_email?:string|null;proposed_phone?:string|null;proposed_x_url?:string|null;
 proposed_college_id?:string|null;proposed_college_name?:string|null;
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
 const verifying=decision==='verify_only';
 const approved=accepting||verifying;
 const school=Array.isArray(coach?.colleges)?coach.colleges[0]?.name:coach?.colleges?.name;
 const kind=({contact_update:'contact information',incorrect_info:'information correction',title_update:'coaching title',left_program:'coaching staff status',moved_school:'school affiliation',retired:'retirement status'} as Record<string,string>)[suggestion.suggestion_type||'']||'coach information';
 const automaticMessage="Thank you for helping keep RLTNL Recruiting's coach information accurate.\n\nYour submission regarding "+
  coachName+(school?' at '+school:'')+' ('+kind+') has been reviewed and verified. '+
  (accepting?'The verified changes have been applied to our shared coach directory.':'No changes were made to our shared coach directory.')+
  '\n\nWe appreciate your contribution!\n\nRLTNL Support';
 const [notify,setNotify]=useState(approved);
 const [personalize,setPersonalize]=useState(false);
 const [body,setBody]=useState('');
 const [sourceUrl,setSourceUrl]=useState('');
 const [messageSourceUrl,setMessageSourceUrl]=useState('');
 const [reviewNote,setReviewNote]=useState('');
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
 const schoolChange=Boolean(suggestion.proposed_college_id&&suggestion.proposed_college_id!==coach?.college_id);
 const statusChange=(suggestion.suggestion_type==='left_program'&&coach?.lifecycle_status!=='departed')||
  (suggestion.suggestion_type==='retired'&&coach?.lifecycle_status!=='retired')||
  (suggestion.suggestion_type==='moved_school'&&Boolean(suggestion.proposed_college_id)&&coach?.lifecycle_status!=='active');
 const canApply=fields.length>0||schoolChange||statusChange;

 async function confirm(){
  if(busy)return;
  if(accepting&&!canApply)return setError('No changes need applying. Choose Verify Only to close this report without changing the directory.');
  if(notify&&!approved&&body.trim().length<20)return setError('Write at least 20 characters explaining the rejection, or turn off notifications.');
  if(notify&&personalize&&body.trim().length>4000)return setError('The message must be 4,000 characters or fewer.');
  if(sourceUrl.trim()&&!/^https:\/\/[^\s]+$/i.test(sourceUrl.trim()))return setError('Use a valid HTTPS URL for the verification source.');
  if(notify&&(!approved||personalize)&&messageSourceUrl.trim()&&!body.trim())return setError('Write a personal message to share a source link.');
  if(messageSourceUrl.trim()&&!/^https:\/\/[^\s]+$/i.test(messageSourceUrl.trim()))return setError('Use a valid HTTPS URL for the message source.');
  if(reviewNote.trim().length>2000)return setError('Verification notes must be 2,000 characters or fewer.');
  setBusy(true);setError('');
  try{
   const response=await fetch('/api/platform/coach-data-review',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({id:suggestion.id,decision,notify,
     message:notify&&(!approved||personalize)?body.trim()||null:null,
     source_url:sourceUrl.trim()||null,review_note:reviewNote.trim()||null,
     message_source_url:notify&&(!approved||personalize)?messageSourceUrl.trim()||null:null})
   });
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(data.error||'The review decision could not be saved.');
   onReviewed();
   if(data.message_sent)window.dispatchEvent(new Event('rltnl:platform-messages-updated'));
   const outcome=data.status==='resolved'?'Coach report verified; the shared directory was not changed.':
    data.status==='accepted'?'Coach update verified and applied to the shared directory.':'Coach update rejected.';
   const confirmation=data.message_sent?
    (data.automatic_message?' Automatic RLTNL Support confirmation sent to '+recipient+'.':' Your personal message was sent to '+recipient+'.'):
    ' No notification was sent.';
   onFinished(outcome+confirmation);
  }catch(e){setError(e instanceof Error?e.message:'Something went wrong.')}
  finally{setBusy(false);}
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
      {accepting?'Verify & Apply Update':verifying?'Verify Without Changes':'Reject Coach Update'}
     </h2>
     <p id="coach-decision-description" className="mt-1 text-sm text-slate-600">
      {coachName} · Submitted by <b>{recipient}</b>
     </p></div>
    <button type="button" aria-label="Close review" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
     disabled={busy} onClick={close}><X size={20}/></button>
   </div>
   <div className="overflow-y-auto px-5 py-4 sm:px-6">
    <div className={'rounded-xl border p-4 '+(approved?'border-green-200 bg-green-50':'border-slate-200 bg-slate-50')}>
     <p className="text-sm font-black">
      {accepting?'Apply verified changes to the shared coach directory':
       verifying?'Mark this report verified without changing the shared directory':
       'Leave the shared coach record unchanged'}
     </p>
     <p className="mt-1 text-sm text-slate-600">
      {accepting?'The changed fields below will update the canonical coach information for everyone using RLTNL.':
       verifying?'The report will be marked verified and closed. Existing coach information will remain unchanged.':
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
     {schoolChange&&<p className="mt-3 border-t pt-3 text-sm text-slate-700">
      <b>School:</b> {school||'Current school'} → {suggestion.proposed_college_name||'Proposed school'}
     </p>}
     {statusChange&&<p className="mt-2 text-sm text-slate-700">
      <b>Status:</b> {coach?.lifecycle_status||'active'} → {suggestion.suggestion_type==='retired'?'retired':suggestion.suggestion_type==='left_program'?'departed':'active'}
     </p>}
     {accepting&&!canApply&&<p role="alert" className="mt-3 text-sm font-semibold text-amber-800">
      No changed values to apply. Choose Verify Only instead.
     </p>}
    </div>

    <details className="mt-4 rounded-xl border border-slate-200 p-3">
     <summary className="cursor-pointer text-sm font-bold text-slate-700">Verification notes and source (optional)</summary>
     <div className="mt-3 space-y-3">
      <label className="block text-xs font-bold text-slate-700">Private review notes
       <textarea rows={2} maxLength={2000} className="input mt-1 w-full bg-white"
        value={reviewNote} disabled={busy} onChange={e=>setReviewNote(e.target.value)}
        placeholder="How did you verify this report?"/>
      </label>
      <label className="block text-xs font-bold text-slate-700">Official source URL
       <input type="url" className="input mt-1 w-full bg-white" value={sourceUrl} disabled={busy}
        onChange={e=>setSourceUrl(e.target.value)} placeholder="https://school.edu/athletics/staff"/>
      </label>
      <p className="text-xs text-slate-500">These details are saved with the review for RLTNL administrators. They are not sent to the submitter.</p>
     </div>
    </details>

    <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4">
     <input type="checkbox" checked={notify} disabled={busy} onChange={e=>{setNotify(e.target.checked);setError('')}}
      className="mt-1 h-4 w-4 accent-red-600"/>
     <span><span className="flex items-center gap-2 text-sm font-black"><MessageSquareText size={17}/>Notify {recipient} in RLTNL Messages</span>
      <span className="mt-1 block text-xs text-slate-600">
       {approved?'Optional. When enabled, RLTNL sends a standard confirmation unless you write a personal message.':
        'Optional. If enabled, write an explanation for the submitter.'}
      </span>
     </span>
    </label>
    {notify&&approved&&<label className="mt-3 flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700">
     <input type="checkbox" checked={personalize} disabled={busy} onChange={e=>setPersonalize(e.target.checked)}
      className="h-4 w-4 accent-red-600"/>
     Write a personal message instead of the standard confirmation
    </label>}
    {notify&&approved&&(!personalize||!body.trim())&&<div className="mt-3 rounded-xl border border-green-200 bg-green-50 p-4">
     <div className="flex items-center gap-2 text-sm font-black text-green-800"><CheckCircle2 size={17}/>Automatic RLTNL Support confirmation</div>
     <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{automaticMessage}</p>
     <p className="mt-2 text-xs text-slate-600">This message is sent only when notifications are enabled and no personal message is provided.</p>
    </div>}
    {notify&&(!approved||personalize)&&<div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
     <label className="block text-xs font-bold text-slate-700">Personal message to {recipient}
      <textarea rows={4} maxLength={4000} className="input mt-1 w-full bg-white" value={body}
       disabled={busy} onChange={e=>setBody(e.target.value)}
       placeholder={approved?'Thank you for helping us keep our coach information accurate.':
        'Thank you for your report. We did not make the change because…'}/>
     </label>
     <label className="mt-3 block text-xs font-bold text-slate-700">Source link to share (optional)
      <input type="url" className="input mt-1 w-full bg-white" value={messageSourceUrl}
       disabled={busy} onChange={e=>setMessageSourceUrl(e.target.value)}
       placeholder="https://school.edu/athletics/staff"/>
     </label>
     <p className="mt-2 text-xs text-slate-600">
      {approved?'Leave blank to use the standard confirmation.':
       'Include at least 20 characters explaining why the report was not applied.'}
     </p>
    </div>}
    {error&&<p role="alert" className="mt-3 text-sm font-semibold text-red-700">{error}</p>}
   </div>
   <div className="flex flex-wrap items-center justify-end gap-2 border-t px-5 py-4 sm:px-6">
    <button type="button" className="btn" disabled={busy} onClick={close}>Cancel</button>
    <button type="button" className={'btn '+(approved?'btn-red':'bg-slate-900 text-white hover:bg-slate-800')}
     disabled={busy||(accepting&&!canApply)} onClick={()=>void confirm()}>
     {busy?'Saving decision…':<><Send size={16}/>{accepting?'Verify & Apply':verifying?'Verify Only':'Confirm Reject'}</>}
    </button>
   </div>
  </div>
 </div>;
}
