'use client';

import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {createClient} from '@/lib/supabase-browser';

export default function SupportCaseActions({caseId,status,resolutionNote}:{caseId:string;status:string;resolutionNote?:string|null}){
  const c=createClient();
  const router=useRouter();
  const [note,setNote]=useState(resolutionNote||'');
  const [busy,setBusy]=useState('');
  const [error,setError]=useState('');
  const save=async(nextStatus:string)=>{
    setBusy(nextStatus);setError('');
    const {error:e}=await c.rpc('update_support_case',{target_case_id:caseId,new_status:nextStatus,resolution_text:note.trim()||null});
    if(e){setError('The case could not be updated. Nothing else was changed.');setBusy('');return}
    setBusy('');router.refresh();
  };
  return <div className="mt-4 border-t pt-4">
    <label className="text-sm font-bold block">Internal investigation note
      <textarea className="input mt-1 min-h-24" value={note} maxLength={2000} onChange={e=>setNote(e.target.value)} placeholder="Record what you checked, what changed, or what the user should do next."/>
    </label>
    <div className="flex flex-wrap gap-2 mt-3">
      {status!=='investigating'&&status!=='resolved'&&<button className="btn" disabled={!!busy} onClick={()=>save('investigating')}>{busy==='investigating'?'Saving...':'Start Investigation'}</button>}
      {status!=='resolved'&&<button className="btn btn-red" disabled={!!busy} onClick={()=>save('resolved')}>{busy==='resolved'?'Saving...':'Mark Resolved'}</button>}
      {status==='resolved'&&<button className="btn" disabled={!!busy} onClick={()=>save('open')}>{busy==='open'?'Saving...':'Reopen Case'}</button>}
      {status==='investigating'&&<button className="btn" disabled={!!busy} onClick={()=>save('investigating')}>{busy==='investigating'?'Saving...':'Save Investigation Note'}</button>}
    </div>
    {error&&<div role="alert" className="text-sm font-semibold text-red-700 mt-2">{error}</div>}
  </div>;
}
