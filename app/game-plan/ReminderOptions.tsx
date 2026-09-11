'use client';
import Link from 'next/link';
import {useState} from 'react';
import {Mail,MessageCircle,Pencil,Trash2,X} from 'lucide-react';
import {createClient} from '@/lib/supabase-browser';

type Reminder={id:string;title:string;due_date:string|null;coach?:{id:string;first_name?:string|null;last_name?:string|null;email?:string|null;phone?:string|null}|null;college?:{id:string;name?:string|null}|null};

function contactIntent(title:string){
 const t=title.toLowerCase();
 if(/\b(email|e-mail)\b/.test(t))return'email';
 if(/\b(text|sms)\b/.test(t))return'text';
 if(/\b(message|contact|reach out|follow up|follow-up|connect|check in)\b/.test(t))return'contact';
 return'contact';
}

export default function ReminderOptions({reminder}:{reminder:Reminder}){
 const c=createClient();
 const [editing,setEditing]=useState(false),[title,setTitle]=useState(reminder.title),[due,setDue]=useState(reminder.due_date||''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function save(){if(!title.trim()||!due)return;setBusy(true);setError('');const {data:{user}}=await c.auth.getUser();if(!user){setError('Your session has expired.');setBusy(false);return}const {error:e}=await c.from('reminders').update({title:title.trim(),due_date:due}).eq('id',reminder.id).eq('owner_user_id',user.id);if(e){setError(e.message);setBusy(false);return}try{await fetch('/api/google/calendar/sync',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({entityType:'reminder',entityId:reminder.id})})}catch{}location.reload()}
 async function remove(){if(!confirm('Delete this reminder? This cannot be undone.'))return;setBusy(true);setError('');const {data:{user}}=await c.auth.getUser();if(!user){setError('Your session has expired.');setBusy(false);return}try{await fetch('/api/google/calendar/sync',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({entityType:'reminder',entityId:reminder.id})})}catch{}const {error:e}=await c.from('reminders').delete().eq('id',reminder.id).eq('owner_user_id',user.id);if(e){setError(e.message);setBusy(false);return}location.reload()}
 const coach=reminder.coach,coachName=coach?[coach.first_name,coach.last_name].filter(Boolean).join(' ')||'Coach':'';
 const intent=contactIntent(reminder.title);
 const schoolName=reminder.college?.name;
 const why=coach&&(/camp|visit|showcase|clinic|prospect/i.test(reminder.title)
  ?`Let ${coachName} know you are coming so they know to look for you.`
  :/follow up|follow-up|check in|reconnect/i.test(reminder.title)
   ?`Staying in touch helps ${coachName} get to know you and keeps the relationship moving.`
   :null);
 const emailPrimary=intent==='email'||intent==='contact';
 const textPrimary=intent==='text';
 return <>
  {coach&&<div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3" aria-label={`Contact ${coachName}`}>
   <div className="text-xs font-black uppercase tracking-wide text-slate-500">Choose an Action</div>
   <div className="text-sm font-bold mt-1">Contact {coachName}{schoolName?` at ${schoolName}`:''}</div>
   {why&&<p className="text-xs text-slate-600 mt-1"><span className="font-bold">Why this matters:</span> {why}</p>}
   <div className="mt-3 flex flex-wrap gap-2">
    {coach.email?<Link href={`/coaches/${coach.id}?emailStarter=custom`} className={`${emailPrimary?'btn btn-red':'btn'} py-2 px-3 text-xs`}><Mail size={14}/>Email Coach</Link>:<button type="button" disabled className="btn py-2 px-3 text-xs opacity-50" title="No coach email on file"><Mail size={14}/>Email Unavailable</button>}
    {coach.phone?<a href={`sms:${coach.phone}`} className={`${textPrimary?'btn btn-red':'btn'} py-2 px-3 text-xs`}><MessageCircle size={14}/>Text Coach</a>:<button type="button" disabled className="btn py-2 px-3 text-xs opacity-50" title="No coach phone on file"><MessageCircle size={14}/>Text Unavailable</button>}
   </div>
  </div>}
  <div className="mt-2 flex items-center gap-3 text-xs">
   <button type="button" onClick={()=>setEditing(true)} className="inline-flex items-center gap-1 font-semibold text-slate-500 hover:text-slate-900"><Pencil size={12}/>Edit</button>
   <button type="button" disabled={busy} onClick={remove} className="inline-flex items-center gap-1 font-semibold text-slate-400 hover:text-red-600"><Trash2 size={12}/>Delete</button>
  </div>
  {editing&&<div className="fixed inset-0 z-[80] bg-slate-950/40 flex items-center justify-center p-4" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)setEditing(false)}}><div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5"><div className="flex items-start justify-between gap-3"><div><h3 className="font-black text-lg">Edit Reminder</h3><p className="muted text-sm mt-1">Update what you need to do or when it is due. The linked school and coach will stay connected.</p></div><button type="button" aria-label="Close" onClick={()=>setEditing(false)} className="h-10 w-10 rounded-xl border flex items-center justify-center"><X size={17}/></button></div><div className="space-y-3 mt-5"><label className="block"><span className="text-sm font-bold">What do you need to do?</span><input className="input mt-1 w-full" value={title} onChange={e=>setTitle(e.target.value)}/></label><label className="block"><span className="text-sm font-bold">Due Date</span><input className="input mt-1 w-full" type="date" value={due} onChange={e=>setDue(e.target.value)}/></label>{error&&<div className="text-sm text-red-600">{error}</div>}<div className="flex justify-end gap-2 pt-2"><button type="button" className="btn" disabled={busy} onClick={()=>setEditing(false)}>Cancel</button><button type="button" className="btn btn-red" disabled={busy||!title.trim()||!due} onClick={save}>{busy?'Saving...':'Save Changes'}</button></div></div></div></div>}
 </>
}
