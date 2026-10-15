'use client';

import {useEffect,useRef,useState} from 'react';
import {MessageSquareText,X} from 'lucide-react';
import AthleteReviews from '@/components/AthleteReviews';
import CoachAthleteReviews from '@/components/CoachAthleteReviews';

export type ConnectionReviewSummary={
  count:number;
  score:number|null;
  mine:boolean;
};

type Props={
  kind:'school'|'coach';
  targetId:string;
  name:string;
  collegeId?:string;
  summary?:ConnectionReviewSummary;
  canReview:boolean;
  onClose?:()=>void;
};

/**
 * One compact action for existing reviews and an athlete's own review.
 * The full review experience is mounted only after opening the dialog,
 * rather than issuing review queries for every coach in a 43-school list.
 */
export default function ConnectionsReviewAction({kind,targetId,name,collegeId='',summary,canReview,onClose}:Props){
 const [open,setOpen]=useState(false);
 const [intent,setIntent]=useState<'read'|'write'>('read');
 const closeButton=useRef<HTMLButtonElement>(null);
 const count=summary?.count||0;
 const score=summary?.score;
 const own=canReview&&!!summary?.mine;
 const label=!canReview?'View Reviews':own?'Edit My Review':kind==='school'?'Review School':'Review Coach';
 const entity=kind==='school'?'school':'coach';
 const close=()=>{setOpen(false);onClose?.()};
 const launch=(mode:'read'|'write')=>{setIntent(mode);setOpen(true)};

 useEffect(()=>{
  if(!open)return;
  closeButton.current?.focus();
  const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();setOpen(false);onClose?.()}};
  window.addEventListener('keydown',onKey);
  return()=>window.removeEventListener('keydown',onKey);
 },[open,onClose]);

 return <>
  <span className="inline-flex min-h-7 flex-wrap items-center gap-1.5 text-[11px] font-semibold">
   {count>0&&<button type="button" onClick={()=>launch('read')} title="View athlete reviews" aria-label={`View ${count} athlete ${count===1?'review':'reviews'} for ${name}`}
    className="rounded-md px-1 py-0.5 font-bold text-amber-700 hover:bg-amber-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500">
    {score!=null&&score>0?`★ ${score.toFixed(1)} (${count})`:`${count} ${count===1?'review':'reviews'}`}
   </button>}
   {count>0&&<span aria-hidden="true" className="text-slate-300">·</span>}
   <button type="button" onClick={()=>launch(canReview?'write':'read')}
    aria-label={`${label} for ${name}`}
    className="inline-flex min-h-7 items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-bold text-slate-700 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500">
    <MessageSquareText size={12} aria-hidden="true"/>{label}
   </button>
  </span>
  {open&&<div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-3 sm:p-5" onMouseDown={event=>{if(event.target===event.currentTarget)close()}}>
   <div role="dialog" aria-modal="true" aria-label={`Reviews for ${name}`} className="w-full max-w-xl max-h-[90dvh] overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl sm:p-6" onMouseDown={event=>event.stopPropagation()}>
    <div className="mb-4 flex items-start justify-between gap-3">
     <div className="min-w-0">
      <p className="text-[11px] font-black uppercase tracking-widest text-red-700">{kind==='school'?'School Reviews':'Coach Reviews'}</p>
      <h2 className="mt-1 text-xl font-black text-slate-900">{name}</h2>
      {canReview&&<p className="mt-1 text-xs leading-5 text-slate-600">Share only experiences you've actually had with this {entity}, including at camps, showcases or visits.</p>}
     </div>
     <button ref={closeButton} type="button" onClick={close} aria-label="Close reviews" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"><X size={17}/></button>
    </div>
    {kind==='school'
     ?<AthleteReviews collegeId={targetId} collegeName={name} mode="embedded" allowShare={canReview} startReviewing={intent==='write'}/>
     :<CoachAthleteReviews coachId={targetId} coachName={name} collegeId={collegeId} mode="embedded" allowShare={canReview} startReviewing={intent==='write'}/>}
   </div>
  </div>}
 </>;
}
