'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {createClient} from '@/lib/supabase-browser';

export default function TeamAdminAccessActions({adminId,revoked}:{adminId:string;revoked:boolean}){
 const router=useRouter(),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function change(){
  if(busy)return;
  if(!revoked&&!window.confirm('Revoke this Team Admin’s access to your recruiting information? Their Team Admin role and access to other athletes will not change.'))return;
  setBusy(true);setError('');
  try{
   const c=createClient();
   const{data:{user},error:authError}=await c.auth.getUser();
   if(authError||!user)throw new Error('Sign in again to update access.');
   const query=c.from('athlete_team_admin_revocations');
   const result=revoked
    ?await query.delete().eq('athlete_user_id',user.id).eq('admin_user_id',adminId)
    :await query.insert({athlete_user_id:user.id,admin_user_id:adminId});
   if(result.error)throw new Error(result.error.message);
   router.refresh();
  }catch(e){setError(e instanceof Error?e.message:'Could not update Team Admin access.');}
  finally{setBusy(false)}
 }
 return <div className="flex flex-col items-start sm:items-end gap-1">
  <button type="button" className="btn" disabled={busy} onClick={change}>{busy?'Saving…':revoked?'Restore Access':'Revoke Access'}</button>
  {error&&<p role="alert" className="text-xs text-red-700 max-w-xs">{error}</p>}
 </div>;
}
