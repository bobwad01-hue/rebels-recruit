'use client';
import {useEffect,useState} from 'react';
import {AlertCircle,ExternalLink,Mail,RefreshCw,ShieldCheck,Unplug} from 'lucide-react';
import {createClient} from '@/lib/supabase-browser';

type State={
  gmail_connected?:boolean;
  google_email?:string|null;
  gmail_scope?:string|null;
  gmail_last_synced_at?:string|null;
  gmail_watch_expiration?:string|null;
};

export default function GoogleWorkspaceSettings(){
  const c=createClient();
  const [state,setState]=useState<State>({});
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');

  async function load(){
    const {data:{user}}=await c.auth.getUser();
    if(!user)return;
    const {data}=await c.from('google_workspace_connections')
      .select('gmail_connected,google_email,gmail_scope,gmail_last_synced_at,gmail_watch_expiration')
      .eq('user_id',user.id).maybeSingle();
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

  async function syncNow(){
    setBusy(true);setMessage('');setError('');
    try{
      // Repair push monitoring and independently scan the inbox for messages
      // missed while notifications were unavailable.
      const watch=await fetch('/api/google/gmail/watch',{method:'POST',cache:'no-store'});
      const watchResult=await watch.json().catch(()=>({})) as {error?:string};
      const sync=await fetch('/api/google/gmail/sync',{method:'POST',cache:'no-store'});
      const result=await sync.json().catch(()=>({})) as {error?:string;logged?:number};
      if(!sync.ok){
        setError(result.error||'Could not check incoming coach emails.');
      }else{
        setMessage(`Gmail checked successfully. ${result.logged||0} new coach ${result.logged===1?'email was':'emails were'} added to your recruiting history.`);
      }
      if(!watch.ok)setError(watchResult.error||'Incoming email monitoring could not be restarted. Try again or reconnect Gmail.');
      await load();
      if(sync.ok)window.dispatchEvent(new Event('rltnl:coach-emails-updated'));
    }catch{setError('Could not refresh Gmail. Please try again.')}
    finally{setBusy(false)}
  }

  const gmail=Boolean(state.gmail_connected);
  const canRead=gmail&&Boolean(state.gmail_scope?.includes('gmail.readonly'));
  const now=Date.now();
  const watchActive=Boolean(state.gmail_watch_expiration&&new Date(state.gmail_watch_expiration).getTime()>now);
  const syncRecent=Boolean(state.gmail_last_synced_at&&now-new Date(state.gmail_last_synced_at).getTime()<26*60*60*1000);
  const healthy=canRead&&watchActive&&syncRecent;
  const status=!gmail?'Not connected':!canRead?'Reconnect required':healthy?'Incoming monitoring active':'Sync needs attention';

  return (
    <div className="card p-6">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center"><ShieldCheck size={19}/></div>
        <div>
          <h2 className="font-black text-lg">Google Connections</h2>
          <p className="muted text-sm mt-1">Connect Gmail only when you want RLTNL Recruiting to use it. This permission is separate from signing in with Google.</p>
        </div>
      </div>
      {error&&<div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 flex gap-2" role="alert"><AlertCircle size={17}/><span>{error}</span></div>}
      {message&&<div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800" role="status">{message}</div>}
      <div className="mt-5">
        <div className="border rounded-xl p-4">
          <div className="flex items-center gap-2 font-black"><Mail size={18}/> Gmail</div>
          <p className="muted text-sm mt-2">Connect Gmail so RLTNL can match recruiting emails from college coaches to the correct school and coach relationship, keep those communications in your recruiting history, and let you send coach emails from inside RLTNL. RLTNL does not modify or delete your Gmail messages.</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className={`pill ${healthy?'bg-green-50 text-green-700':gmail?'bg-amber-50 text-amber-800':''}`}>{status}</span>
            <div className="ml-auto flex flex-wrap gap-2">
              {gmail?<>
                {canRead&&<button className="btn py-1.5 px-2.5 text-xs" disabled={busy} onClick={syncNow}><RefreshCw size={13}/>{busy?'Checking…':'Sync & repair'}</button>}
                <a className="btn py-1.5 px-2.5 text-xs" href="/api/google/connect?service=gmail"><RefreshCw size={13}/> Reconnect</a>
                <button className="btn py-1.5 px-2.5 text-xs" disabled={busy} onClick={disconnect}><Unplug size={13}/> Disconnect</button>
              </>:<a className="btn py-1.5 px-2.5 text-xs" href="/api/google/connect?service=gmail"><ExternalLink size={13}/> Connect Gmail</a>}
            </div>
          </div>
          {gmail&&<div className="mt-3 space-y-1 text-xs text-slate-600">
            {!canRead?<p className="text-amber-800">Gmail can send messages, but incoming coach email access is missing. Reconnect Gmail to approve reading incoming messages.</p>
              :!watchActive?<p className="text-amber-800">Incoming email notifications need to be restarted. Select Sync & repair to restore monitoring and check for missed messages.</p>
              :!syncRecent?<p className="text-amber-800">Your incoming email check is overdue. Select Sync & repair to catch up.</p>
              :<p>Incoming coach email monitoring is enabled. RLTNL also checks for missed messages automatically.</p>}
            <p>Last successful inbox check: {state.gmail_last_synced_at?new Date(state.gmail_last_synced_at).toLocaleString():'Not yet checked'}</p>
          </div>}
        </div>
      </div>
    </div>
  );
}
