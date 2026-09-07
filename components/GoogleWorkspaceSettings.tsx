'use client';
import {useEffect,useState} from 'react';
import {CalendarDays,Mail,ShieldCheck,ExternalLink,RefreshCw,Unplug,AlertCircle} from 'lucide-react';
import {createClient} from '@/lib/supabase-browser';

type State={gmail_connected?:boolean;calendar_connected?:boolean;google_email?:string|null};
type Service='gmail'|'calendar';

export default function GoogleWorkspaceSettings(){
  const c=createClient();
  const [state,setState]=useState<State>({});
  const [busy,setBusy]=useState<Service|null>(null);
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');

  async function load(){
    const {data:{user}}=await c.auth.getUser();
    if(!user)return;
    const {data}=await c.from('google_workspace_connections').select('gmail_connected,calendar_connected,google_email').eq('user_id',user.id).maybeSingle();
    setState(data||{});
  }
  useEffect(()=>{void load()},[]);

  async function disconnect(service:Service){
    const label=service==='gmail'?'Gmail':'Google Calendar';
    if(!window.confirm(`Disconnect ${label}? Rebels Recruit will delete its saved authorization for this service and stop using it.`))return;
    setBusy(service);setMessage('');setError('');
    try{
      const res=await fetch('/api/google/disconnect',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({service})});
      let data:any={};try{data=await res.json()}catch{}
      if(!res.ok){setError(data.error||`Could not disconnect ${label}.`);return}
      setMessage(`${label} disconnected. Rebels Recruit no longer has a saved token for it.`);
      await load();
    }catch{setError(`Could not disconnect ${label}.`)}finally{setBusy(null)}
  }

  const gmail=state.gmail_connected,cal=state.calendar_connected;
  return <div className="card p-6">
    <div className="flex items-start gap-3"><div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center"><ShieldCheck size={19}/></div><div><h2 className="font-black text-lg">Google Connections</h2><p className="muted text-sm mt-1">Connect Gmail and Google Calendar only when you want Rebels Recruit to use them. These permissions are separate from signing in with Google.</p></div></div>
    {error&&<div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 flex gap-2"><AlertCircle size={17} className="shrink-0 mt-0.5"/><span>{error}</span></div>}
    {message&&<div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{message}</div>}
    <div className="grid md:grid-cols-2 gap-4 mt-5">
      <div className="border rounded-xl p-4"><div className="flex items-center gap-2 font-black"><Mail size={18}/> Gmail</div><p className="muted text-sm mt-2">Review and send recruiting emails through your connected Gmail account. Rebels Recruit does not need permission to read your inbox.</p><div className="mt-4 flex flex-wrap items-center gap-2"><span className={`pill ${gmail?'bg-green-50 text-green-700':''}`}>{gmail?'Connected':'Not connected'}</span><div className="ml-auto flex flex-wrap gap-2">{gmail?<><a className="btn py-1.5 px-2.5 text-xs" href="/api/google/connect?service=gmail"><RefreshCw size={13}/> Reconnect</a><button type="button" className="btn py-1.5 px-2.5 text-xs" disabled={busy==='gmail'} onClick={()=>disconnect('gmail')}><Unplug size={13}/>{busy==='gmail'?'Disconnecting...':'Disconnect'}</button></>:<a className="btn py-1.5 px-2.5 text-xs" href="/api/google/connect?service=gmail"><ExternalLink size={13}/> Connect Gmail</a>}</div></div></div>
      <div className="border rounded-xl p-4"><div className="flex items-center gap-2 font-black"><CalendarDays size={18}/> Google Calendar</div><p className="muted text-sm mt-2">Keep Rebels Recruit camps, visits, calls, deadlines and follow-ups on your Google Calendar. Rebels Recruit only updates or removes calendar items it created.</p><div className="mt-4 flex flex-wrap items-center gap-2"><span className={`pill ${cal?'bg-green-50 text-green-700':''}`}>{cal?'Connected':'Not connected'}</span><div className="ml-auto flex flex-wrap gap-2">{cal?<><a className="btn py-1.5 px-2.5 text-xs" href="/api/google/connect?service=calendar"><RefreshCw size={13}/> Reconnect</a><button type="button" className="btn py-1.5 px-2.5 text-xs" disabled={busy==='calendar'} onClick={()=>disconnect('calendar')}><Unplug size={13}/>{busy==='calendar'?'Disconnecting...':'Disconnect'}</button></>:<a className="btn py-1.5 px-2.5 text-xs" href="/api/google/connect?service=calendar"><ExternalLink size={13}/> Connect Calendar</a>}</div></div></div>
    </div>
    <p className="muted text-xs mt-4">Gmail and Calendar are independent opt-ins. Disconnecting one deletes only that service's saved token and does not affect the other service or your normal Rebels Recruit sign-in.</p>
  </div>
}
