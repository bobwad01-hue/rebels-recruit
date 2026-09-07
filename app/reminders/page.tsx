'use client';

import {useEffect,useState} from 'react';
import AppShell from '@/components/AppShell';
import PageHeader from '@/components/PageHeader';
import CoachActionBar from '@/components/CoachActionBar';
import {Trash2,CheckCircle2,RotateCcw,Clock3,CalendarDays} from 'lucide-react';
import {createClient} from '@/lib/supabase-browser';

type ReminderRow={
  id:string;
  title:string;
  due_date:string;
  status:string;
  completed_at?:string|null;
  athlete_user_id?:string|null;
  colleges?:{id:string;name:string}|Array<{id:string;name:string}>|null;
  college_coaches?:{id:string;first_name?:string|null;last_name?:string|null;email?:string|null;phone?:string|null}|Array<{id:string;first_name?:string|null;last_name?:string|null;email?:string|null;phone?:string|null}>|null;
};

export default function Reminders(){
  const c=createClient();
  const [rows,setRows]=useState<ReminderRow[]>([]);
  const [snoozeId,setSnoozeId]=useState('');
  const [customDate,setCustomDate]=useState('');
  const [calendarConnected,setCalendarConnected]=useState(false);
  const [message,setMessage]=useState('');

  async function load(){
    const {data:{user}}=await c.auth.getUser();
    if(!user){setRows([]);setCalendarConnected(false);return;}
    const {data}=await c.from('reminders')
      .select('*,colleges(id,name),college_coaches(id,first_name,last_name,email,phone)')
      .eq('owner_user_id',user.id)
      .order('due_date');
    setRows((data||[]) as ReminderRow[]);
    const {data:conn}=await c.from('google_workspace_connections')
      .select('calendar_connected')
      .eq('user_id',user.id)
      .maybeSingle();
    setCalendarConnected(Boolean(conn?.calendar_connected));
  }

  useEffect(()=>{void load();},[]);

  async function syncReminder(id:string){
    if(!calendarConnected)return false;
    try{
      const res=await fetch('/api/google/calendar/sync',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({entityType:'reminder',entityId:id})
      });
      return res.ok;
    }catch{return false;}
  }

  async function removeFromCalendar(id:string){
    if(!calendarConnected)return;
    try{
      await fetch('/api/google/calendar/sync',{
        method:'DELETE',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({entityType:'reminder',entityId:id})
      });
    }catch{}
  }

  async function complete(id:string){
    const {error}=await c.from('reminders').update({status:'completed',completed_at:new Date().toISOString()}).eq('id',id);
    if(error)return;
    await removeFromCalendar(id);
    setMessage('Reminder completed. Its Rebels Recruit-managed Google Calendar item was removed.');
    await load();
  }

  async function reopen(id:string){
    const {error}=await c.from('reminders').update({status:'open',completed_at:null}).eq('id',id);
    if(error)return;
    const ok=await syncReminder(id);
    setMessage(ok?'Reminder reopened and synced to Google Calendar.':'Reminder reopened.');
    await load();
  }

  async function remove(id:string){
    if(!window.confirm('Delete this reminder? This cannot be undone.'))return;
    await removeFromCalendar(id);
    const {error}=await c.from('reminders').delete().eq('id',id);
    if(error)return;
    setMessage('Reminder deleted.');
    await load();
  }

  async function snooze(id:string,days?:number){
    const d=customDate?new Date(`${customDate}T12:00:00`):new Date();
    if(days)d.setDate(d.getDate()+days);
    const {error}=await c.from('reminders').update({due_date:d.toISOString().slice(0,10),status:'open',completed_at:null}).eq('id',id);
    if(error)return;
    setSnoozeId('');setCustomDate('');
    const ok=await syncReminder(id);
    setMessage(ok?'Reminder date updated in Rebels Recruit and Google Calendar.':'Reminder date updated.');
    await load();
  }

  const open=rows.filter(r=>r.status!=='completed');
  const completed=rows.filter(r=>r.status==='completed');

  function renderReminder(r:ReminderRow){
    const coach=Array.isArray(r.college_coaches)?r.college_coaches[0]:r.college_coaches;
    const college=Array.isArray(r.colleges)?r.colleges[0]:r.colleges;
    const coachName=[coach?.first_name,coach?.last_name].filter(Boolean).join(' ')||'Coach';
    const isCompleted=r.status==='completed';

    return <div className="card p-5" key={r.id}>
      <div className="flex items-start gap-4">
        <input type="checkbox" className="mt-1" checked={isCompleted} onChange={()=>{void (isCompleted?reopen(r.id):complete(r.id));}} aria-label={isCompleted?'Reopen reminder':'Complete reminder'}/>
        <div className="flex-1">
          <div className={`font-bold ${isCompleted?'line-through opacity-60':''}`}>{r.title}</div>
          <div className="muted text-sm mt-1">{college?.name||'Recruiting'} · Due {r.due_date}{r.completed_at?` · Completed ${new Date(r.completed_at).toLocaleDateString()}`:''}</div>
        </div>
        <span className="pill">{r.status}</span>
      </div>

      {!isCompleted&&coach?.id&&college?.id&&<div className="mt-4 pt-4 border-t">
        <CoachActionBar hideReminder compact coachId={coach.id} collegeId={college.id} coachName={coachName} collegeName={college.name} email={coach.email} phone={coach.phone} athleteUserId={r.athlete_user_id||undefined}/>
      </div>}

      <div className="mt-4 flex flex-wrap gap-2">
        {isCompleted?<button type="button" onClick={()=>{void reopen(r.id);}} className="btn text-sm px-3 py-2"><RotateCcw size={16}/> Reopen</button>:<>
          <button type="button" onClick={()=>{void complete(r.id);}} className="btn text-sm px-3 py-2"><CheckCircle2 size={16}/> Complete</button>
          <button type="button" onClick={()=>setSnoozeId(snoozeId===r.id?'':r.id)} className="btn text-sm px-3 py-2"><Clock3 size={16}/> Snooze</button>
          {calendarConnected&&<button type="button" onClick={()=>{void (async()=>{const ok=await syncReminder(r.id);setMessage(ok?'Reminder synced to Google Calendar.':'Google Calendar sync failed.');})();}} className="btn text-sm px-3 py-2"><CalendarDays size={16}/> Sync Calendar</button>}
        </>}
        <button type="button" onClick={()=>{void remove(r.id);}} className="btn text-sm px-3 py-2"><Trash2 size={16}/> Delete</button>
      </div>

      {snoozeId===r.id&&<div className="mt-3 rounded-xl border bg-slate-50 p-3">
        <div className="text-sm font-bold">Snooze this reminder</div>
        <div className="flex flex-wrap gap-2 mt-2">
          <button className="btn py-1.5 px-2.5 text-xs" onClick={()=>{void snooze(r.id,1);}}>Tomorrow</button>
          <button className="btn py-1.5 px-2.5 text-xs" onClick={()=>{void snooze(r.id,3);}}>3 days</button>
          <button className="btn py-1.5 px-2.5 text-xs" onClick={()=>{void snooze(r.id,7);}}>1 week</button>
          <input className="input py-1.5 text-xs max-w-[155px]" type="date" value={customDate} onChange={e=>setCustomDate(e.target.value)}/>
          <button className="btn btn-red py-1.5 px-2.5 text-xs" disabled={!customDate} onClick={()=>{void snooze(r.id);}}>Set date</button>
        </div>
      </div>}
    </div>;
  }

  return <AppShell><div className="max-w-5xl mx-auto px-5 md:px-8 py-6">
    <PageHeader title="Reminders" subtitle="Take the next action right from the reminder: contact the coach, log what happened, snooze it, or mark it complete."/>
    {calendarConnected&&<div className="mb-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 flex gap-2"><CalendarDays size={17}/><span><b>Google Calendar connected.</b> Open follow-up reminders sync to your calendar; snoozing updates them and completing or deleting removes the Rebels Recruit-managed copy.</span></div>}
    {message&&<div className="mb-5 text-sm font-semibold">{message}</div>}

    <section>
      <div className="flex items-center gap-2 mb-3"><h2 className="font-black text-lg">Open reminders</h2><span className="pill">{open.length}</span></div>
      <div className="space-y-3">{open.map(renderReminder)}</div>
      {!open.length&&<div className="card p-10 text-center muted">No open reminders. You’re caught up.</div>}
    </section>

    <section className="mt-8">
      <div className="flex items-center gap-2 mb-3"><h2 className="font-black text-lg">Completed reminders</h2><span className="pill">{completed.length}</span></div>
      <p className="muted text-sm mb-3">Completed follow-ups remain available here until you delete them. If you made a mistake, use Reopen to move the reminder back to Open.</p>
      <div className="space-y-3">{completed.map(renderReminder)}</div>
      {!completed.length&&<div className="card p-8 text-center muted">No completed reminders.</div>}
    </section>
  </div></AppShell>;
}
