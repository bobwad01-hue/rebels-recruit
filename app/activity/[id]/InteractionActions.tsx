'use client';
import Link from 'next/link';
import {useState} from 'react';
import {Pencil,Trash2} from 'lucide-react';
import {createClient} from '@/lib/supabase-browser';

export default function InteractionActions({id}:{id:string}){
 const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 async function remove(){
  if(!confirm('Delete this interaction? This will also remove any follow-up reminder tied to it.'))return;
  setBusy(true);setError('');const c=createClient();const {data:{user}}=await c.auth.getUser();
  if(!user){setError('Your session has expired.');setBusy(false);return}
  const {error:reminderError}=await c.from('reminders').delete().eq('interaction_id',id).eq('athlete_user_id',user.id);
  if(reminderError){setError(reminderError.message);setBusy(false);return}
  const {error:deleteError}=await c.from('interactions').delete().eq('id',id).eq('athlete_user_id',user.id);
  if(deleteError){setError(deleteError.message);setBusy(false);return}
  location.href='/activity';
 }
 return <div className="flex flex-wrap gap-2 items-center"><Link href={`/activity/${id}/edit`} className="btn"><Pencil size={16}/> Edit</Link><button className="btn text-red-600" onClick={remove} disabled={busy}><Trash2 size={16}/>{busy?'Deleting...':'Delete'}</button>{error&&<span className="text-sm text-red-600">{error}</span>}</div>
}
