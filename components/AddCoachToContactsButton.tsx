'use client';

import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {Plus} from 'lucide-react';
import {createClient} from '@/lib/supabase-browser';
import {emitDataChanged} from '@/lib/data-events';

type Props={athleteId:string;coachId:string;collegeId:string;coachName:string};

export default function AddCoachToContactsButton({athleteId,coachId,collegeId,coachName}:Props){
 const router=useRouter();
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 async function add(){
  if(busy)return;
  setBusy(true);setError('');
  const c=createClient();
  try{
   const {data:existing,error:lookupError}=await c.from('athlete_coaches')
    .select('id,archived_at').eq('athlete_user_id',athleteId).eq('coach_id',coachId).maybeSingle();
   if(lookupError)throw lookupError;
   if(existing?.archived_at){
    const r=await c.from('athlete_coaches').update({college_id:collegeId,archived_at:null,archived_reason:null})
     .eq('id',existing.id).eq('athlete_user_id',athleteId);
    if(r.error)throw r.error;
   }else if(!existing){
    const r=await c.from('athlete_coaches').insert({
     athlete_user_id:athleteId,coach_id:coachId,college_id:collegeId,archived_at:null,archived_reason:null
    });
    if(r.error&&r.error.code!=='23505')throw r.error;
   }
   emitDataChanged('athlete_coaches',existing?'restore':'create',coachId);
   router.refresh();
  }catch(e:any){
   setError(e?.message||'Could not add this coach. Please try again.');
  }finally{setBusy(false)}
 }
 return <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
  <div className="text-sm font-black text-slate-900">Add {coachName} to My Contacts</div>
  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
   Save this coach to your recruiting contacts before emailing them. Adding a contact does not mean you have contacted them.
  </p>
  <button type="button" disabled={busy} onClick={()=>void add()}
   className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-slate-800 disabled:opacity-50">
   <Plus size={16}/>{busy?'Adding…':'Add to My Contacts'}
  </button>
  {error&&<p role="alert" className="mt-3 text-xs font-semibold text-red-700">{error}</p>}
 </div>;
}
