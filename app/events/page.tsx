'use client';
import {useEffect,useState} from 'react';
import AppShell from '@/components/AppShell';
import PageHeader from '@/components/PageHeader';
import {createClient} from '@/lib/supabase-browser';
import {CalendarDays,CheckCircle2,Edit3,Trash2,X} from 'lucide-react';

const EVENT_TYPES=['Tournament','College Camp','Campus Visit','Showcase','Coach Call','Follow-up','Recruiting Deadline','Other'];

type FormState={name:string;type:string;date:string;location:string;college:string;url:string};
const EMPTY:FormState={name:'',type:'Tournament',date:'',location:'',college:'',url:''};

export default function Events(){
  const c=createClient();
  const [rows,setRows]=useState<any[]>([]);
  const [colleges,setColleges]=useState<any[]>([]);
  const [form,setForm]=useState<FormState>(EMPTY);
  const [editingId,setEditingId]=useState<string|null>(null);
  const [calendarConnected,setCalendarConnected]=useState(false);
  const [msg,setMsg]=useState('');
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);

  async function load(){
    const {data}=await c.from('events').select('*,colleges(name)').order('date');
    setRows(data||[]);
  }

  useEffect(()=>{(async()=>{
    const {data:{user}}=await c.auth.getUser();
    await load();
    const {data:collegeRows}=await c.from('colleges').select('id,name').order('name');
    setColleges(collegeRows||[]);
    if(user){const {data}=await c.from('google_workspace_connections').select('calendar_connected').eq('user_id',user.id).maybeSingle();setCalendarConnected(Boolean(data?.calendar_connected))}
  })()},[]);

  async function syncCalendar(entityId:string){
    if(!calendarConnected)return {ok:false,skipped:true,error:''};
    try{
      const res=await fetch('/api/google/calendar/sync',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({entityType:'event',entityId})});
      let data:any={};try{data=await res.json()}catch{}
      return {ok:res.ok,skipped:false,error:data.error||''};
    }catch{return {ok:false,skipped:false,error:'Google Calendar could not be reached.'}}
  }

  async function save(e:React.FormEvent){
    e.preventDefault();setMsg('');setError('');setBusy(true);
    const payload={name:form.name.trim(),type:form.type,date:form.date,location:form.location.trim()||null,college_id:form.college||null,registration_url:form.url.trim()||null};
    let id=editingId;
    if(editingId){
      const {error}=await c.from('events').update(payload).eq('id',editingId);
      if(error){setError(error.message);setBusy(false);return}
    }else{
      const {data,error}=await c.from('events').insert(payload).select('id').single();
      if(error||!data){setError(error?.message||'Could not add event.');setBusy(false);return}
      id=data.id;
    }
    const sync=id?await syncCalendar(id):null;
    setForm(EMPTY);setEditingId(null);await load();setBusy(false);
    if(sync?.ok)setMsg(editingId?'Event updated in Rebels Recruit and Google Calendar.':'Event added to Rebels Recruit and Google Calendar.');
    else if(sync&&!sync.skipped)setMsg(`${editingId?'Event updated':'Event added'} in Rebels Recruit. Google Calendar: ${sync.error||'sync failed.'}`);
    else setMsg(editingId?'Event updated.':'Event added.');
  }

  function edit(r:any){
    setEditingId(r.id);setMsg('');setError('');
    setForm({name:r.name||'',type:r.type||'Other',date:r.date||'',location:r.location||'',college:r.college_id||'',url:r.registration_url||''});
    window.scrollTo({top:0,behavior:'smooth'});
  }

  function cancelEdit(){setEditingId(null);setForm(EMPTY);setError('');setMsg('')}

  async function remove(r:any){
    if(!window.confirm(`Delete “${r.name}”? This will also remove the Google Calendar copy created by Rebels Recruit.`))return;
    setBusy(true);setError('');setMsg('');
    if(calendarConnected){
      try{await fetch('/api/google/calendar/sync',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({entityType:'event',entityId:r.id})})}catch{}
    }
    const {error}=await c.from('events').delete().eq('id',r.id);
    setBusy(false);
    if(error){setError(error.message);return}
    if(editingId===r.id)cancelEdit();
    setMsg('Event deleted. Any Rebels Recruit-managed Google Calendar copy was removed.');
    await load();
  }

  return <AppShell><div className="max-w-6xl mx-auto px-5 md:px-8 py-6">
    <PageHeader title="Recruiting Events" subtitle="Track camps, visits, calls, showcases, deadlines and other recruiting opportunities."/>
    {calendarConnected&&<div className="mb-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 flex items-center gap-2"><CalendarDays size={17}/><span><b>Google Calendar connected.</b> New and edited recruiting events sync automatically. Rebels Recruit only updates calendar items it created.</span></div>}
    <div className="grid lg:grid-cols-3 gap-6">
      <form onSubmit={save} className="card p-5 lg:col-span-1 space-y-4">
        <div className="flex items-center justify-between gap-3"><h2 className="font-black text-lg">{editingId?'Edit Event':'Add Event'}</h2>{editingId&&<button type="button" className="btn py-1.5 px-2.5 text-xs" onClick={cancelEdit}><X size={13}/> Cancel</button>}</div>
        <input className="input" placeholder="Event name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required/>
        <select className="input" value={form.type} onChange={e=>setForm({...form,type:e.target.value})}>{EVENT_TYPES.map(t=><option key={t}>{t}</option>)}</select>
        <input className="input" type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})} required/>
        <input className="input" placeholder="Location" value={form.location} onChange={e=>setForm({...form,location:e.target.value})}/>
        <select className="input" value={form.college} onChange={e=>setForm({...form,college:e.target.value})}><option value="">No college</option>{colleges.map(col=><option key={col.id} value={col.id}>{col.name}</option>)}</select>
        <input className="input" placeholder="Registration / info URL" value={form.url} onChange={e=>setForm({...form,url:e.target.value})}/>
        {error&&<p className="text-sm text-red-700 font-semibold">{error}</p>}
        {msg&&<p className="text-sm text-green-700 font-semibold flex gap-2 items-start"><CheckCircle2 size={16} className="mt-0.5 shrink-0"/>{msg}</p>}
        <button className="btn btn-red w-full" disabled={busy}>{busy?'Saving...':editingId?'Save Changes':'Add Event'}</button>
      </form>
      <div className="lg:col-span-2 space-y-3">
        {rows.map(r=><div className="card p-5" key={r.id}><div className="flex justify-between gap-4"><div><div className="font-black text-lg">{r.name}</div><div className="muted text-sm mt-1">{r.type}{r.colleges?.name?` · ${r.colleges.name}`:''}{r.location?` · ${r.location}`:''}</div></div><div className="font-bold shrink-0">{r.date}</div></div>{r.registration_url&&<a className="text-sm font-bold inline-block mt-3" href={r.registration_url} target="_blank" rel="noreferrer">Registration / Info</a>}<div className="mt-4 pt-4 border-t flex flex-wrap gap-2"><button type="button" className="btn text-sm px-3 py-2" onClick={()=>edit(r)} disabled={busy}><Edit3 size={15}/> Edit</button><button type="button" className="btn text-sm px-3 py-2" onClick={()=>remove(r)} disabled={busy}><Trash2 size={15}/> Delete</button>{calendarConnected&&<button type="button" className="btn text-sm px-3 py-2" disabled={busy} onClick={async()=>{setBusy(true);setError('');setMsg('');const result=await syncCalendar(r.id);setBusy(false);if(result.ok)setMsg(`“${r.name}” synced to Google Calendar.`);else setError(result.error||'Calendar sync failed.')}}><CalendarDays size={15}/> Sync Calendar</button>}</div></div>)}
        {!rows.length&&<div className="card p-10 text-center muted">No recruiting events yet.</div>}
      </div>
    </div>
  </div></AppShell>
}
