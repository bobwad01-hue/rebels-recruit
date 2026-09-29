'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {supabase} from '@/lib/supabase';
export default function AdvisorAccessActions({id}:{id:string}){
 const router=useRouter();const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 async function revoke(){setBusy(true);setError('');const c=supabase();const {data:{user}}=await c.auth.getUser();if(!user){setError('Your session has expired. Please sign in again.');setBusy(false);return}const {error:e}=await c.from('athlete_advisor_assignments').update({status:'revoked',responded_at:new Date().toISOString()}).eq('id',id).eq('athlete_user_id',user.id).eq('status','active');if(e){setError(e.message||'Unable to revoke advisor access.');setBusy(false);return}router.refresh()}
 return <div className="flex flex-col items-end gap-1"><button type="button" className="btn" onClick={revoke} disabled={busy}>{busy?'Revoking...':'Revoke Access'}</button>{error&&<div className="text-xs text-red-600 max-w-xs">{error}</div>}</div>
}