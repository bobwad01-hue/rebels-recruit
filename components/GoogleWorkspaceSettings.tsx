'use client';
import {useEffect,useState} from 'react';
import {AlertCircle,ExternalLink,Mail,RefreshCw,ShieldCheck,Unplug} from 'lucide-react';
import {createClient} from '@/lib/supabase-browser';

type State={gmail_connected?:boolean;google_email?:string|null};

export default function GoogleWorkspaceSettings(){
  const c=createClient();
  const [state,setState]=useState<State>({});
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');

  async function load(){
    const {data:{user}}=await c.auth.getUser();
    if(!user)return;
    const {data}=await c.from('google_workspace_connections').select('gmail_connected,google_email').eq('user_id',user.id).maybeSingle();
    setState(data||{});
  }

  useEffect(()=>{void load()},[]);

  async function disconnect(){
    if(!window.confirm(`Disconnect Gmail for ${state.google_email||'this account'}? RLTNL Recruiting will delete its saved authorization for Gmail and stop using it. Your Google data will not be deleted.`))return;
    setBusy(true);setMessage('');setError('');
    try{
      const res=await fetch('/api/google/disconnect',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({service:'gmail'})});
      let data:any={};try{data=await res.json()}catch{}
      if(!res.ok){setError(data.error||'Could not disconnect Gmail.');return}
      setMessage('Gmail disconnected. RLTNL Recruiting no longer has a saved Gmail authorization.');
      await load();
    }catch{setError('Could not disconnect Gmail.')}
    finally{setBusy(false)}
  }

  const gmail=Boolean(state.gmail_connected);
  return (
    <div className="card p-6">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center"><ShieldCheck size={19}/></div>
        <div>
          <h2 className="font-black text-lg">Google Connections</h2>
          <p className="muted text-sm mt-1">Connect Gmail only when you want RLTNL Recruiting to use it. This permission is separate from signing in with Google.</p>
        </div>
      </div>
      {error&&<div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 flex gap-2"><AlertCircle size={17}/><span>{error}</span></div>}
      {message&&<div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{message}</div>}
      <div className="mt-5">
        <div className="border rounded-xl p-4">
          <div className="flex items-center gap-2 font-black"><Mail size={18}/> Gmail</div>
          <p className="muted text-sm mt-2">Connect Gmail so RLTNL can match emails from college coaches you are already tracking, add those recruiting messages to your Journey, identify follow-up needs, recover historical recruiting email content when requested, and send coach emails from inside RLTNL. RLTNL does not modify or delete your Gmail messages.</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className={`pill ${gmail?'bg-green-50 text-green-700':''}`}>{gmail?'Connected':'Not connected'}</span>
            <div className="ml-auto flex gap-2">
              {gmail?<>
                <a className="btn py-1.5 px-2.5 text-xs" href="/api/google/connect?service=gmail"><RefreshCw size={13}/> Reconnect</a>
                <button className="btn py-1.5 px-2.5 text-xs" disabled={busy} onClick={disconnect}><Unplug size={13}/> Disconnect</button>
              </>:<a className="btn py-1.5 px-2.5 text-xs" href="/api/google/connect?service=gmail"><ExternalLink size={13}/> Connect Gmail</a>}
            </div>
          </div>
        </div>
        
      </div>
    </div>
  );
}
