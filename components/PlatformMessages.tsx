'use client';
import {useCallback,useEffect,useState} from 'react';
import {MessageSquare,Send,ExternalLink,RefreshCw} from 'lucide-react';

type Entry={id:string;thread_id:string;sender_user_id:string;body:string;source_url:string|null;created_at:string;read_at:string|null};
type Thread={id:string;source_type:string;source_id:string;recipient_user_id:string;recipient_name:string|null;subject:string;updated_at:string;unread:number;messages:Entry[]};
export default function PlatformMessages(){
 const [threads,setThreads]=useState<Thread[]>([]);
 const [selected,setSelected]=useState<string|null>(null);
 const [me,setMe]=useState<string|null>(null);
 const [draft,setDraft]=useState('');
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [online,setOnline]=useState(true);
 const load=useCallback(async()=>{
  try{
   const response=await fetch('/api/platform/messages',{cache:'no-store'});
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(data.error||'Could not load RLTNL messages.');
   const list:Thread[]=data.threads||[];
   setThreads(list);
   const requested=new URLSearchParams(window.location.search).get('platformThread');
   setSelected(current=>current&&list.some(t=>t.id===current)?current:
     requested&&list.some(t=>t.id===requested)?requested:list[0]?.id||null);
   setError('');
  }catch(e){setError(e instanceof Error?e.message:'Could not load RLTNL messages.')}
  finally{setLoading(false)}
 },[]);
 useEffect(()=>{void load();const timer=window.setInterval(()=>{void load()},30000);return()=>window.clearInterval(timer)},[load]);
 useEffect(()=>{let active=true;void import('@/lib/supabase-browser').then(({createClient})=>createClient().auth.getUser()).then(({data})=>{if(active)setMe(data.user?.id||null)});return()=>{active=false}},[]);
 useEffect(()=>{setOnline(navigator.onLine);const yes=()=>setOnline(true),no=()=>setOnline(false);window.addEventListener('online',yes);window.addEventListener('offline',no);return()=>{window.removeEventListener('online',yes);window.removeEventListener('offline',no)}},[]);
 const current=threads.find(t=>t.id===selected);
 useEffect(()=>{if(!current?.unread)return;
  let active=true;
  (async()=>{
   const response=await fetch('/api/platform/messages',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({thread_id:current.id})});
   if(active&&response.ok){await load();window.dispatchEvent(new Event('rltnl:platform-messages-updated'))}
  })().catch(()=>{});
  return()=>{active=false};
 },[current?.id,current?.unread,load]);
 async function send(){
  if(!current||!draft.trim()||busy||!online)return;
  setBusy(true);setError('');
  try{
   const response=await fetch('/api/platform/messages',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({thread_id:current.id,body:draft.trim()})});
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(data.error||'Could not send your reply.');
   setDraft('');await load();window.dispatchEvent(new Event('rltnl:platform-messages-updated'));
  }catch(e){setError(e instanceof Error?e.message:'Could not send reply.')}
  finally{setBusy(false)}
 }
 if(!loading&&!threads.length&&!error)return null;
 return <section id="platform-messages" className="card mb-6 overflow-hidden scroll-mt-20">
  <div className="flex items-center justify-between gap-3 border-b p-4 sm:p-5">
   <div><div className="rr-eyebrow">RLTNL SUPPORT</div><h2 className="mt-1 text-lg font-black">Messages from RLTNL</h2>
    <p className="mt-1 text-xs text-slate-500">Updates on your feedback and coach information reports. You can reply here.</p></div>
   <button type="button" className="btn text-xs" onClick={()=>void load()}><RefreshCw size={15}/>Refresh</button>
  </div>
  {error&&<p role="alert" className="px-5 pt-4 text-sm font-bold text-red-700">{error}</p>}
  {loading?<div className="p-5 text-sm text-slate-500">Loading RLTNL messages…</div>:
  <div className="grid min-h-[340px] md:grid-cols-[minmax(210px,32%)_1fr]">
   <div className="max-h-[520px] overflow-auto border-b md:border-b-0 md:border-r">
    {threads.map(t=><button type="button" key={t.id} onClick={()=>setSelected(t.id)}
      className={`block w-full border-b px-4 py-4 text-left hover:bg-slate-50 ${selected===t.id?'bg-slate-100':''}`}>
      <div className="flex items-start justify-between gap-2"><b className="text-sm">{t.subject}</b>
       {t.unread>0&&<span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">{t.unread}</span>}
      </div>
      {t.recipient_name&&<p className="mt-1 text-xs text-slate-600">To: {t.recipient_name}</p>}
      <p className="mt-1 text-xs text-slate-500">{new Date(t.updated_at).toLocaleString()}</p>
     </button>)}
   </div>
   <div className="flex min-h-[340px] flex-col p-4 sm:p-5">
    {current?<><div className="border-b pb-3 text-sm font-black">{current.subject}</div>
     <div className="max-h-[420px] min-h-[180px] flex-1 space-y-3 overflow-auto py-4">
      {current.messages.map(m=><div key={m.id} className={`flex ${m.sender_user_id===me?'justify-end':'justify-start'}`}>
       <div className={`max-w-[90%] rounded-2xl px-4 py-3 ${m.sender_user_id===me?'bg-slate-900 text-white':'bg-slate-100'}`}>
        <p className="whitespace-pre-wrap break-words text-sm">{m.body}</p>
        {m.source_url&&<a className={`mt-2 inline-flex items-center gap-1 break-all text-xs font-bold underline ${m.sender_user_id===me?'text-white':'text-blue-700'}`}
         href={m.source_url} target="_blank" rel="noopener noreferrer">Official source <ExternalLink size={12}/></a>}
        <p className="mt-2 text-[11px] opacity-60">{new Date(m.created_at).toLocaleString()}</p>
       </div>
      </div>)}
     </div>
     <div className="flex items-end gap-2 border-t pt-3">
      <textarea rows={2} className="input min-w-0 flex-1" aria-label="Reply to RLTNL"
       placeholder="Reply to RLTNL…" value={draft} onChange={e=>setDraft(e.target.value)}/>
      <button type="button" className="btn btn-red" disabled={!draft.trim()||busy||!online} onClick={()=>void send()}>
       <Send size={16}/>{busy?'Sending…':'Send'}</button>
     </div>
    </>:<div className="flex flex-1 items-center justify-center text-sm text-slate-500"><MessageSquare size={17} className="mr-2"/>Select a conversation</div>}
   </div>
  </div>}
 </section>;
}
