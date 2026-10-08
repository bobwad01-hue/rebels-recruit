'use client';

import {useEffect,useState} from 'react';
import {createClient} from '@/lib/supabase-browser';

const clarityOptions=[['not_really','Not really'],['somewhat','Somewhat'],['very_clearly','Very clearly']];
const recommendOptions=[['yes','Yes'],['maybe','Maybe'],['no','No']];

type Props={collegeId:string;coachId:string;coachName:string;athleteId:string;preview?:boolean};

function StarQuestion({label,value,onChange}:{label:string;value:number|null;onChange:(n:number)=>void}){
 return <div><div className="font-bold text-sm">{label}</div><div className="flex gap-1 mt-1" aria-label={label}>{[1,2,3,4,5].map(n=><button key={n} type="button" onClick={()=>onChange(n)} aria-label={n+' out of 5'} aria-pressed={value===n} className={'text-3xl '+(value!==null&&n<=value?'text-amber-500':'text-slate-300')}>★</button>)}</div></div>;
}
function ChoiceQuestion({label,options,value,onChange}:{label:string;options:string[][];value:string;onChange:(s:string)=>void}){
 return <div><div className="font-bold text-sm">{label}</div><div className="flex flex-wrap gap-2 mt-2">{options.map(([v,l])=><button key={v} type="button" onClick={()=>onChange(v)} aria-pressed={value===v} className={'rounded-lg border px-3 py-2 text-sm font-bold '+(value===v?'bg-slate-950 text-white':'bg-white')}>{l}</button>)}</div></div>;
}

export default function CoachParentPerspective({collegeId,coachId,coachName,athleteId,preview=false}:Props){
 const c=createClient();
 const [loading,setLoading]=useState(true),[done,setDone]=useState(false),[editing,setEditing]=useState(false);
 const [overall,setOverall]=useState<number|null>(null),[communication,setCommunication]=useState<number|null>(null),[responsiveness,setResponsiveness]=useState<number|null>(null),[followThrough,setFollowThrough]=useState<number|null>(null);
 const [standing,setStanding]=useState(''),[recommend,setRecommend]=useState(''),[saving,setSaving]=useState(false),[message,setMessage]=useState('');
 useEffect(()=>{let active=true;(async()=>{
  if(preview){if(active)setLoading(false);return}
  const {data:{user}}=await c.auth.getUser();
  if(!user){if(active)setLoading(false);return}
  const {data,error}=await c.from('parent_coach_perspectives').select('overall_experience,communication,responsiveness,follow_through,standing_clarity,recommend_engaging,core_completed_at').eq('parent_user_id',user.id).eq('coach_id',coachId).maybeSingle();
  if(!active)return;
  if(error)setMessage('Could not load your saved parent perspective. Please refresh before submitting.');
  if(data){setOverall(data.overall_experience);setCommunication(data.communication);setResponsiveness(data.responsiveness);setFollowThrough(data.follow_through);setStanding(data.standing_clarity||'');setRecommend(data.recommend_engaging||'');setDone(!!data.core_completed_at)}
  setLoading(false);
 })();return()=>{active=false}},[coachId,preview]);
 async function save(){
  if(preview||saving)return;
  if(overall===null&&communication===null&&responsiveness===null&&followThrough===null&&!standing&&!recommend){setMessage('Answer at least one question to share your perspective.');return}
  setSaving(true);setMessage('');
  const {data:{user}}=await c.auth.getUser();
  if(!user){setMessage('Sign in to share your perspective.');setSaving(false);return}
  const payload={parent_user_id:user.id,athlete_user_id:athleteId,college_id:collegeId,coach_id:coachId,overall_experience:overall,communication,responsiveness,follow_through:followThrough,standing_clarity:standing||null,recommend_engaging:recommend||null,core_completed_at:new Date().toISOString(),updated_at:new Date().toISOString()};
  const {error}=await c.from('parent_coach_perspectives').upsert(payload,{onConflict:'parent_user_id,coach_id'});
  setSaving(false);
  if(error){setMessage('Could not save your perspective. Check that you still have active access to your athlete’s Connections, then try again.');return}
  setDone(true);setEditing(false);
 }
 if(loading)return <section className="card p-4 sm:p-5"><div className="muted text-sm">Loading parent perspective…</div></section>;
 if(done&&!editing)return <section className="card p-4 sm:p-5"><div className="rr-eyebrow">PARENT PERSPECTIVE</div><h2 className="font-black text-lg mt-1">Thanks for sharing your perspective.</h2><p className="muted text-sm mt-1">Your name is not shown with the feedback. Parent ratings appear in combined summaries when at least three parents have shared their experiences with {coachName}.</p><button type="button" className="btn mt-4" onClick={()=>setEditing(true)}>Edit My Perspective</button></section>;
 return <section id="share-parent-perspective" className="card p-4 sm:p-5 scroll-mt-24">
  <div className="rr-eyebrow">PARENT PERSPECTIVE</div>
  <h2 className="font-black text-lg mt-1">Help other parents know what to expect when their athlete communicates with {coachName}</h2>
  <p className="muted text-sm mt-1">Share only what you personally observed while supporting your athlete. You don't need to have communicated with the coach yourself. Leave any question unanswered if you don't know.</p>
  <div className="grid sm:grid-cols-2 gap-5 mt-5">
   <StarQuestion label="Overall experience from your perspective" value={overall} onChange={setOverall}/>
   <StarQuestion label="Communication, as you observed it" value={communication} onChange={setCommunication}/>
   <StarQuestion label="Responsiveness, as you observed it" value={responsiveness} onChange={setResponsiveness}/>
   <StarQuestion label="Follow-through, as you observed it" value={followThrough} onChange={setFollowThrough}/>
   <ChoiceQuestion label="From what you observed, did your athlete understand where they stood with this coach?" options={clarityOptions} value={standing} onChange={setStanding}/>
   <ChoiceQuestion label="Would you recommend another parent encourage their athlete to engage with this coach?" options={recommendOptions} value={recommend} onChange={setRecommend}/>
  </div>
  <p className="muted text-xs mt-5">Your name is not shown. Responses are combined with other parent perspectives and ratings appear after at least three parents contribute.</p>
  {message&&<p role="alert" className="text-sm font-bold text-red-700 mt-4">{message}</p>}
  {preview?<p className="text-sm font-semibold mt-4">Preview mode: Feedback cannot be submitted.</p>:<div className="flex flex-wrap gap-2 mt-5"><button type="button" onClick={save} disabled={saving} className="btn btn-red">{saving?'Sharing…':done?'Update Parent Perspective':'Share Parent Perspective'}</button>{done&&<button type="button" className="btn" onClick={()=>setEditing(false)}>Cancel</button>}</div>}
 </section>;
}
