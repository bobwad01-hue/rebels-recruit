'use client';
import Link from 'next/link';
import {useState} from 'react';
import {Mail,MessageCircle,Pencil,Trash2,X} from 'lucide-react';
import {createClient} from '@/lib/supabase-browser';

type Reminder={id:string;title:string;due_date:string|null;coach?:{id:string;first_name?:string|null;last_name?:string|null;email?:string|null;phone?:string|null}|null;college?:{id:string;name?:string|null}|null};

export default function ReminderOptions({reminder}:{reminder:Reminder}){
 const c=createClient();
 const [editing,setEditing]=useState(false),[title,setTitle]=useState(reminder.title),[due,setDue]=useState(reminder.due_date||''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function save(){if(!title.trim()||!due)return;setBusy(true);setError('');const {data:{user}}=await c.auth.getUser();if(!user){setError('Your session has expired.');setBusy(false);return}const {error:e}=await c.from('reminders').update({title:title.trim(),due_date:due}).eq('id',reminder.id).eq('owner_user_id',user.id);if(e){setError(e.message);setBusy(false);return}try{await fetch('/api/google/calendar/sync',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({entityType:'reminder',entityId:reminder.id})})}catch{}location.reload()}
 async function remove(){if(!confirm('Delete this reminder? This cannot be undone.'))return;setBusy(true);setError('');const {data:{user}}=await c.auth.getUser();if(!user){setError('Your session has expired.');setBusy(false);return}try{await fetch('/api/google/calendar/sync',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({entityType:'reminder',entityId:reminder.id})})}catch{}const {error:e}=await c.from('reminders').delete().eq('id',reminder.id).eq('owner_user_id',user.id);if(e){setError(e.message);setBusy(false);return}location.reload()}
 const coach=reminder.coach,coachName=coach?[coach.first_name,coach.last_name].filter(Boolean).join(' ')||'coach':'';
 return <>
  {coach&&<div className="mt-3 flex flex-wrap gap-2" aria-label={`Contact ${coachName}`}>
   {coach.email?<Link href={`/coaches/${coach.id}?emailStarter=custom`} className="btn btn-red py-1.5 px-3 text-xs"><Mail size={13}/>Email {coachName}</Link>:<button type="button" disabled className="btn py-1.5 px-3 text-xs opacity-50"><Mail size={13}/>Email unavailable</button>}
   {coach.phone?<a href={`sms:${coach.phone}`} className="btn py-1.5 px-3 text-xs"><MessageCircle size={13}/>Text {coachName}</a>:<button type="button" disabled className="btn py-1.5 px-3 text-xs opacity-50"><MessageCircle size={13}/>Text unavailable</button>}
  </div>}
  <div className="mt-2 flex items-center gap-3 text-xs">
   <button type="button" onClick={()=>setEditing(true)} className="inline-flex items-center gap-1 font-semibold text-slate-500 hover:text-slate-900"><Pencil size={12}/>Edit</button>
   <button type="button" disabled={busy} onClick={remove} className="inline-flex items-center gap-1 font-semibold text-slate-400 hover:text-red-600"><Trash2 size={12}/>Delete</button>
  </div>
  {editing&&<div className="fixed inset-0 z-[80] bg-slate-950/40 flex items-center justify-center p-4" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)setEditing(false)}}><div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5"><div className="flex items-start justify-between gap-3"><div><h3 className="font-black text-lg">Edit reminder</h3><p className="muted text-sm mt-1">Update the reminder text or due date. Any linked school or coach stays connected.</p></div><button type="button" aria-label="Close" onClick={()=>setEditing(false)} className="h-10 w-10 rounded-xl border flex items-center justify-center"><X size={17}/></button></div><div className="space-y-3 mt-5"><label className="block"><span className="text-sm font-bold">Reminder</span><input className="input mt-1 w-full" value={title} onChange={e=>setTitle(e.target.value)}/></label><label className="block"><span className="text-sm font-bold">Due date</span><input className="input mt-1 w-full" type="date" value={due} onChange={e=>setDue(e.target.value)}/></label>{error&&<div className="text-sm text-red-600">{error}</div>}<div className="flex justify-end gap-2 pt-2"><button type="button" className="btn" disabled={busy} onClick={()=>setEditing(false)}>Cancel</button><button type="button" className="btn btn-red" disabled={busy||!title.trim()||!due} onClick={save}>{busy?'Saving...':'Save changes'}</button></div></div></div></div>}
 </>
}
