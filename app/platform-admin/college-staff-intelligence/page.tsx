'use client';

import {useCallback,useEffect,useRef,useState} from 'react';
import AppShell from '@/components/AppShell';
import PageHeader from '@/components/PageHeader';
import {AlertCircle,CheckCircle2,ChevronDown,ExternalLink,Play,RefreshCw,Square} from 'lucide-react';

const opts=[['all','All Divisions'],['NCAA D1','D1'],['NCAA D2','D2'],['NCAA D3','D3'],['NAIA','NAIA'],['JC','JUCO']];
const groups=[
  ['all','All review schools'],['softball_discovery','Softball page discovery'],
  ['staff_discovery','Staff page discovery'],['quality','Quality gate'],
  ['timeout','Timeouts'],['not_found','Broken links / 404'],['other','Other reviews']
];
type Exception={college_id:string;name:string;status:string;reason:string;last_error:string|null;
  attempts:number;updated_at:string;staff_url:string|null;softball_url:string|null};
type Cleanup={division:string;exceptions:Exception[];summary:Record<string,number>};
const date=(v:string|null)=>v?new Date(v).toLocaleString():'—';
const errorLabel=(r:string)=>({
  quality:'Quality gate',timeout:'Timeout',staff_discovery:'Staff discovery',
  softball_discovery:'Softball discovery',not_found:'Broken link',blocked:'Access blocked',other:'Other'
} as Record<string,string>)[r]||r;

export default function Page(){
  const [d,setD]=useState<any>(null);
  const [division,setDivision]=useState('NCAA D2');
  const [cleanup,setCleanup]=useState<Cleanup|null>(null);
  const [group,setGroup]=useState('all');
  const [filter,setFilter]=useState('review');
  const [expanded,setExpanded]=useState(false);
  const [running,setRunning]=useState(false);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');
  const [runStats,setRunStats]=useState({processed:0,imported:0,review:0,blocked:0});
  const stop=useRef(false);

  const load=useCallback(async()=>{
    try{
      const response=await fetch('/api/platform/college-staff-intelligence/status?division='+encodeURIComponent(division),{cache:'no-store'});
      if(!response.ok) throw new Error('Could not load ingestion status');
      setD(await response.json());
      if(division!=='all'){
        const r=await fetch('/api/platform/college-staff-intelligence/cleanup?division='+encodeURIComponent(division),{cache:'no-store'});
        if(!r.ok) throw new Error('Could not load cleanup workbench');
        setCleanup(await r.json());
      }else setCleanup(null);
    }catch(e){setError(e instanceof Error?e.message:'Could not load status');}
  },[division]);
  useEffect(()=>{void load();const timer=window.setInterval(()=>{void load()},15000);return()=>window.clearInterval(timer)},[load]);

  async function runQueue(){
    setRunning(true);stop.current=false;setError('');setMessage('Processing queued schools, one at a time. Keep this page open.');
    let processed=0,imported=0,review=0,blocked=0;
    try{
      for(let i=0;i<500&&!stop.current;i++){
        const response=await fetch('/api/cron/college-softball-staff',{
          method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({bootstrap:true,division,limit:1}),cache:'no-store'
        });
        const data=await response.json().catch(()=>({}));
        if(!response.ok) throw new Error(data.error||'Ingestion request failed');
        if(!data.processed) break;
        processed+=data.processed;
        for(const result of data.results||[]){
          if(result.status==='ok') imported++;
          else if(/403|robots/i.test(result.error||'')) blocked++;
          else review++;
        }
        setRunStats({processed,imported,review,blocked});
        setMessage('Processed '+processed+' schools · '+imported+' imported · '+review+' review · '+blocked+' blocked');
        if(i%3===0) await load();
      }
      setMessage((stop.current?'Stopped after the current school. ':'Batch finished. ')+
        processed+' processed · '+imported+' imported · '+review+' review · '+blocked+' blocked.');
    }catch(e){setError(e instanceof Error?e.message:'Ingestion stopped unexpectedly');}
    finally{setRunning(false);await load();}
  }

  async function requeue(){
    if(division==='all'||running||busy)return;
    setBusy(true);setError('');setMessage('');
    try{
      const response=await fetch('/api/platform/college-staff-intelligence/cleanup',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({action:'requeue_reviews',division,group})
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok) throw new Error(data.error||'Could not requeue schools');
      await load();
      if(data.requeued){setMessage('Requeued '+data.requeued+' review schools. Starting cleanup…');void runQueue();}
      else setMessage('No review schools matched this group.');
    }catch(e){setError(e instanceof Error?e.message:'Could not requeue schools');}
    finally{setBusy(false);}
  }

  const exceptions=(cleanup?.exceptions||[]).filter(x=>filter==='all'||x.status===filter);
  const shown=expanded?exceptions:exceptions.slice(0,25);
  const reviewCount=cleanup?.summary.review||0;
  const pendingCount=cleanup?.summary.pending||0;
  return <AppShell><main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 md:px-8">
    <PageHeader eyebrow="PLATFORM ADMIN" title="College Staff Intelligence"
      subtitle="Official-source ingestion, coaching staff coverage and cleanup across college softball."/>
    <div className="mt-6 flex items-center gap-3">
      <label htmlFor="division" className="text-xs font-black uppercase text-slate-500">Division</label>
      <select id="division" className="input w-full max-w-52" value={division} disabled={running||busy}
        onChange={e=>{setDivision(e.target.value);setD(null);setCleanup(null);setExpanded(false);setMessage('');setError('');}}>
        {opts.map(([v,l])=><option value={v} key={v}>{l}</option>)}
      </select>
      <button type="button" className="btn ml-auto" onClick={()=>void load()} aria-label="Refresh status"><RefreshCw size={16}/>Refresh</button>
    </div>
    {!d?<div className="card mt-4 p-6">Loading…</div>:<>
      <section className="card mt-4 p-5 sm:p-6">
        <div className="flex justify-between gap-4"><div>
          <div className="rr-eyebrow">PIPELINE · {opts.find(x=>x[0]===division)?.[1]}</div>
          <div className="mt-1 text-3xl font-black">{d.complete} / {d.total}</div>
          <div className="muted text-sm">{d.percent}% processed · {d.coaches} active coaches</div>
        </div><div className={'font-black uppercase '+(d.state==='stalled'?'text-red-600':d.state==='complete'?'text-green-700':'text-slate-900')}>{d.state}</div></div>
        <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full bg-slate-950" style={{width:d.percent+'%'}}/>
        </div>
      </section>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        {['imported','review','blocked','processing','pending'].map(k=><div className="card p-4" key={k}>
          <div className="text-2xl font-black">{d[k]}</div><div className="text-xs font-bold uppercase text-slate-500">{k}</div>
        </div>)}
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[['Email',d.email],['Phone',d.phone],['X / Twitter',d.twitter]].map(([label,n]:any)=><div className="card p-4" key={label}>
          <div className="text-2xl font-black">{n} <span className="text-sm text-slate-400">/ {d.coaches}</span></div>
          <div className="text-xs font-bold uppercase text-slate-500">{label} coverage · {d.coaches?Math.round(n/d.coaches*100):0}%</div>
        </div>)}
      </div>
      {division==='all'&&<div className="card mt-4 overflow-x-auto"><table className="w-full min-w-[700px] text-sm">
        <thead><tr className="border-b text-left"><th className="p-3">Division</th><th>Programs</th><th>Processed</th><th>Coaches</th><th>Email</th><th>Phone</th><th>X</th><th>State</th></tr></thead>
        <tbody>{d.divisions?.map((x:any)=><tr className="border-b" key={x.division}>
          <td className="p-3 font-bold">{opts.find(o=>o[0]===x.division)?.[1]}</td><td>{x.total}</td>
          <td>{x.complete} ({x.percent}%)</td><td>{x.coaches}</td>
          <td>{x.coaches?Math.round(x.email/x.coaches*100):0}%</td>
          <td>{x.coaches?Math.round(x.phone/x.coaches*100):0}%</td>
          <td>{x.coaches?Math.round(x.twitter/x.coaches*100):0}%</td>
          <td className="font-bold uppercase">{x.state}</td></tr>)}</tbody>
      </table></div>}
      <p className="mt-4 text-xs text-slate-500">Last ingestion activity: {date(d.lastActivity)} · Refreshes every 15 seconds</p>
    </>}

    {division!=='all'&&<section className="card mt-6 overflow-hidden">
      <div className="border-b p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><div className="rr-eyebrow">CLEANUP WORKBENCH</div>
            <h2 className="mt-1 text-xl font-black">{opts.find(x=>x[0]===division)?.[1]} exception recovery</h2>
            <p className="mt-1 text-sm text-slate-500">Retry review schools by failure pattern, then process the queue without repeating manual approvals. Access-blocked sources remain excluded.</p>
          </div>
          <span className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-bold">{reviewCount} review · {cleanup?.summary.blocked||0} blocked</span>
        </div>
        <div className="mt-5 flex flex-wrap items-end gap-3">
          <div className="min-w-[190px] flex-1 sm:max-w-72">
            <label htmlFor="failure-group" className="mb-1 block text-xs font-bold text-slate-600">Retry group</label>
            <select id="failure-group" className="input w-full" value={group} onChange={e=>setGroup(e.target.value)} disabled={running||busy}>
              {groups.map(([value,label])=><option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          <button type="button" className="btn btn-red" disabled={running||busy||!reviewCount} onClick={()=>void requeue()}>
            <Play size={16}/>{busy?'Queuing…':'Retry & process reviews'}
          </button>
          <button type="button" className="btn" disabled={running||busy||!pendingCount} onClick={()=>void runQueue()}>
            <Play size={16}/>Process {pendingCount} queued
          </button>
          {running&&<button type="button" className="btn" onClick={()=>{stop.current=true;setMessage('Stopping after the current school…')}}>
            <Square size={15}/>Stop after current
          </button>}
        </div>
        {running&&<div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm font-semibold" role="status">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-red-600"/> Running cleanup: {runStats.processed} processed, {runStats.imported} imported, {runStats.review} review, {runStats.blocked} blocked.
        </div>}
        {message&&!running&&<div className="mt-4 flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-sm" role="status"><CheckCircle2 size={16} className="mt-0.5 shrink-0"/>{message}</div>}
        {error&&<div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert"><AlertCircle size={16} className="mt-0.5 shrink-0"/>{error}</div>}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3">
        <h3 className="font-black">Schools requiring attention</h3>
        <select aria-label="Filter exception status" className="input w-44" value={filter} onChange={e=>{setFilter(e.target.value);setExpanded(false)}}>
          <option value="review">Review</option><option value="blocked">Blocked</option>
          <option value="pending">Pending</option><option value="processing">Processing</option><option value="all">All exceptions</option>
        </select>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr><th className="px-5 py-3">School</th><th className="px-3 py-3">Issue</th>
              <th className="px-3 py-3">Attempts</th><th className="px-3 py-3">Updated</th><th className="px-5 py-3">Source</th></tr>
          </thead>
          <tbody className="divide-y">{shown.map(x=><tr key={x.college_id} className="hover:bg-slate-50/80">
            <td className="px-5 py-3 font-bold">{x.name}<div className="mt-1 text-xs font-normal text-slate-500">{x.status}</div></td>
            <td className="px-3 py-3"><div className="font-semibold">{errorLabel(x.reason)}</div>
              <div className="mt-1 max-w-64 break-words text-xs text-slate-500">{x.last_error||'—'}</div></td>
            <td className="px-3 py-3 tabular-nums">{x.attempts}</td>
            <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-500">{date(x.updated_at)}</td>
            <td className="px-5 py-3">{x.staff_url?.startsWith('https://')?
              <a className="inline-flex items-center gap-1 font-semibold text-slate-700 underline hover:text-red-700"
                href={x.staff_url} target="_blank" rel="noopener noreferrer">Official source <ExternalLink size={13}/></a>:
              <span className="text-xs text-slate-400">Not discovered</span>}</td>
          </tr>)}</tbody>
        </table>
        {!exceptions.length&&<p className="p-6 text-sm text-slate-500">No schools in this status.</p>}
      </div>
      {exceptions.length>25&&<div className="border-t p-4 text-center">
        <button type="button" className="btn" onClick={()=>setExpanded(v=>!v)}>
          {expanded?'Show first 25':'Show all '+exceptions.length} <ChevronDown size={15}/>
        </button>
      </div>}
    </section>}
  </main></AppShell>;
}
