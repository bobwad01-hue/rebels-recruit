'use client';
import Link from 'next/link';
import {useState} from 'react';
type Email={id:string;subject:string|null;received_at:string;summary:string|null;reviewed_at:string|null;interaction_id:string|null;recruiting_intent:string|null};
export default function CoachEmailReview({email,coachId,coachName,collegeName}:{email:Email;coachId:string;coachName:string;collegeName:string}){
 const [reviewed,setReviewed]=useState(!!email.reviewed_at),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function markReviewed(){
  setBusy(true);setError('');
  try{
   const r=await fetch('/api/coach-emails/review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({emailId:email.id})});
   if(!r.ok)throw new Error('Could not save review status.');
   setReviewed(true);window.dispatchEvent(new Event('rltnl:coach-emails-updated'));
  }catch(e){setError(e instanceof Error?e.message:'Unable to save.')}finally{setBusy(false)}
 }
 return <section id="coach-email-review" className="card mt-5 p-4 sm:p-5 border-red-200 scroll-mt-24">
  <div className="flex justify-between items-start gap-2"><div><div className="text-xs font-black text-red-700 uppercase">Incoming Coach Email</div><h2 className="font-black text-lg mt-1">{email.subject||'New recruiting email'}</h2><p className="text-sm text-slate-600">{coachName} · {collegeName}</p></div><span className="text-xs font-bold">{reviewed?'Reviewed':'Needs Review'}</span></div>
  {email.summary&&<p className="text-sm mt-3">{email.summary}</p>}
  <p className="text-xs text-slate-500 mt-2">RLTNL review status is separate from Gmail read status.</p>
  <div className="flex flex-wrap gap-2 mt-4">
   {email.interaction_id&&<Link href={'/activity/'+email.interaction_id} className="btn text-sm">View Email Details</Link>}
   <Link href={'/coaches/'+coachId+'?action=recruiting-reply&replyEmail='+encodeURIComponent(email.id)+(email.interaction_id?'&interaction='+encodeURIComponent(email.interaction_id):'')+'&intent='+encodeURIComponent(email.recruiting_intent||'coach_response')} className="btn text-sm">Reply in Thread</Link>
   {!reviewed&&<button type="button" className="btn btn-red text-sm" onClick={markReviewed} disabled={busy}>{busy?'Saving…':'Mark Reviewed'}</button>}
  </div>{error&&<p role="alert" className="text-sm text-red-700 mt-2">{error}</p>}
 </section>;
}
