'use client';
import Link from 'next/link';
import {useState} from 'react';
import {Mail,MessageCircle,Phone,Activity,Clock3,CheckCircle2} from 'lucide-react';
import {createClient} from '@/lib/supabase-browser';

type Props={
  coachId:string;
  collegeId:string;
  coachName:string;
  collegeName?:string;
  email?:string|null;
  phone?:string|null;
  athleteUserId?:string;
  compact?:boolean;
};

export default function CoachActionBar({coachId,collegeId,coachName,collegeName,email,phone,athleteUserId,compact=false}:Props){
  const c=createClient();
  const [pendingEmail,setPendingEmail]=useState(false);
  const [message,setMessage]=useState('');
  const [reminderOpen,setReminderOpen]=useState(false);
  const [reminderDate,setReminderDate]=useState('');
  const [busy,setBusy]=useState(false);

  async function context(){
    const {data:{user}}=await c.auth.getUser();
    if(!user)return null;
    const athlete=athleteUserId||user.id;
    return {user,athlete,initiatedBy:athlete===user.id?'Athlete':'Advisor'};
  }

  function openEmail(){
    if(!email)return;
    const subject=`${collegeName||'Softball recruiting'} follow-up`;
    const url=`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}&su=${encodeURIComponent(subject)}`;
    window.open(url,'_blank','noopener,noreferrer');
    setPendingEmail(true);
    setMessage('');
  }

  async function logEmailSent(){
    const ctx=await context();if(!ctx)return;
    setBusy(true);setMessage('');
    const {error}=await c.from('interactions').insert({athlete_user_id:ctx.athlete,actor_user_id:ctx.user.id,college_id:collegeId,coach_id:coachId,type:'Email Sent',initiated_by:ctx.initiatedBy,date:new Date().toISOString().slice(0,10),note:`Email sent to ${coachName}`});
    setBusy(false);
    if(error)setMessage(error.message);else{setPendingEmail(false);setMessage('Email logged in Activity.');}
  }

  async function createReminder(days?:number){
    const ctx=await context();if(!ctx)return;
    const d=reminderDate?new Date(`${reminderDate}T12:00:00`):new Date();
    if(days)d.setDate(d.getDate()+days);
    setBusy(true);setMessage('');
    const {error}=await c.from('reminders').insert({owner_user_id:ctx.user.id,athlete_user_id:ctx.athlete,college_id:collegeId,coach_id:coachId,title:`Follow up with ${coachName}`,due_date:d.toISOString().slice(0,10),status:'open'});
    setBusy(false);
    if(error)setMessage(error.message);else{setReminderOpen(false);setReminderDate('');setMessage('Reminder created.');}
  }

  const base=compact?'btn py-1.5 px-2.5 text-xs':'btn';
  const logHref=`/activity/new?college=${collegeId}&coach=${coachId}${athleteUserId?`&athlete=${athleteUserId}`:''}`;
  return <div className="w-full">
    <div className="flex flex-wrap gap-2">
      <button type="button" className={`${base} ${email?'':'opacity-50 cursor-not-allowed'}`} disabled={!email} onClick={openEmail}><Mail size={compact?13:15}/> Email</button>
      <a className={`${base} ${phone?'':'opacity-50 pointer-events-none'}`} href={phone?`sms:${phone}`:undefined}><MessageCircle size={compact?13:15}/> Text</a>
      <a className={`${base} ${phone?'':'opacity-50 pointer-events-none'}`} href={phone?`tel:${phone}`:undefined}><Phone size={compact?13:15}/> Call</a>
      <Link className={`${base} btn-red`} href={logHref}><Activity size={compact?13:15}/> Log</Link>
      <button type="button" className={base} onClick={()=>setReminderOpen(v=>!v)}><Clock3 size={compact?13:15}/> Reminder</button>
    </div>
    {pendingEmail&&<div className="mt-3 rounded-xl border bg-slate-50 p-3 text-sm flex flex-col sm:flex-row sm:items-center gap-2"><div className="flex-1"><b>Did you send the email to {coachName}?</b><div className="muted text-xs mt-1">One tap will add “Email Sent” to the recruiting timeline.</div></div><button type="button" disabled={busy} onClick={logEmailSent} className="btn btn-red"><CheckCircle2 size={15}/> {busy?'Logging...':'Yes, log it'}</button><button type="button" onClick={()=>setPendingEmail(false)} className="btn">Not yet</button></div>}
    {reminderOpen&&<div className="mt-3 rounded-xl border bg-white p-3"><div className="text-sm font-bold">Remind me to follow up</div><div className="flex flex-wrap gap-2 mt-2"><button className="btn py-1.5 px-2.5 text-xs" disabled={busy} onClick={()=>createReminder(1)}>Tomorrow</button><button className="btn py-1.5 px-2.5 text-xs" disabled={busy} onClick={()=>createReminder(3)}>3 days</button><button className="btn py-1.5 px-2.5 text-xs" disabled={busy} onClick={()=>createReminder(7)}>1 week</button><input className="input py-1.5 text-xs max-w-[155px]" type="date" value={reminderDate} onChange={e=>setReminderDate(e.target.value)}/><button className="btn btn-red py-1.5 px-2.5 text-xs" disabled={!reminderDate||busy} onClick={()=>createReminder()}>Set date</button></div></div>}
    {message&&<div className="text-xs mt-2 font-semibold">{message}</div>}
  </div>;
}
