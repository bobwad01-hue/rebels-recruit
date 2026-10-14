'use client';

import {useCallback,useEffect,useRef,useState} from 'react';
import AppShell from '@/components/AppShell';
import PageHeader from '@/components/PageHeader';
import {AlertCircle,CheckCircle2,ChevronDown,ExternalLink,Play,RefreshCw,Square,ShieldCheck,X} from 'lucide-react';

const opts=[['all','All Divisions'],['NCAA D1','D1'],['NCAA D2','D2'],['NCAA D3','D3'],['NAIA','NAIA'],['JC','JUCO']];
const groups=[
  ['all','All review schools'],['softball_discovery','Softball page discovery'],
  ['staff_discovery','Staff page discovery'],['quality','Quality gate'],
  ['timeout','Timeouts'],['not_found','Broken links / 404'],['other','Other reviews']
];
type Verification={outcome:'verified'|'incorrect_source'|'unable_to_verify'|'inactive_program';
  source_url:string|null;head_coach_name:string|null;notes:string|null;verified_by_user_id:string;
  verified_at:string;recheck_status:string;recheck_message:string|null;rechecked_at:string|null};
type Exception={college_id:string;name:string;status:string;reason:string;last_error:string|null;
  attempts:number;updated_at:string;staff_url:string|null;staff_navigation_url:string|null;
  softball_url:string|null;verification:Verification|null};
type Cleanup={division:string;exceptions:Exception[];summary:Record<string,number>};
type ContactBackfill={
  run:{id:string;status:'running'|'paused'|'completed';queued_count:number;created_at:string;completed_at:string|null}|null;
  preview:{eligible:number;schools:number;missing_email:number;missing_phone:number};
  progress:{total:number;pending:number;processing:number;enriched:number;no_email:number;
    error:number;blocked:number;added_emails:number;added_phones:number}|null;
};
type ContactRecoveryCase={
  coach_id:string;coach:string;school:string;issue:string;status:string;attempts:number;
  error:string|null;source_candidate_url:string|null;review_note:string|null;
  official_bio_url:string|null;added_email:boolean;added_phone:boolean;
};
type ContactRecovery={
  total:number;retry_total:number;pending:number;processing:number;enriched:number;
  checked:number;error:number;blocked:number;needs_review:number;
  added_emails:number;added_phones:number;cases:ContactRecoveryCase[];
};
type QualityDiagnostic={college_id:string;name:string;source_url:string|null;status:string;issue:string;
  head_count:number;coaches:{name:string;title:string;role:string;has_email:boolean;has_bio:boolean}[]};
const date=(v:string|null)=>v?new Date(v).toLocaleString():'—';
const errorLabel=(r:string)=>({
  quality:'Quality gate',timeout:'Timeout',inactive_program:'Program discontinued',staff_conflict:'Staff sources conflict',source_access:'Source access review',staff_discovery:'Staff discovery',
  softball_discovery:'Softball discovery',not_found:'Broken link',blocked:'Access blocked',
  manual_verification:'Manual verification',other:'Other'
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
  const [enriching,setEnriching]=useState(false);
  const [backfill,setBackfill]=useState<ContactBackfill|null>(null);
  const [backfillRunning,setBackfillRunning]=useState(false);
  const [backfillError,setBackfillError]=useState('');
  const backfillStop=useRef(false);
  const backfillRunningRef=useRef(false);
  const [recovery,setRecovery]=useState<ContactRecovery|null>(null);
  const [recoveryRunning,setRecoveryRunning]=useState(false);
  const [recoveryError,setRecoveryError]=useState('');
  const recoveryRunningRef=useRef(false);
  const recoveryStop=useRef(false);
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');
  const [runStats,setRunStats]=useState({processed:0,imported:0,review:0,blocked:0});
  const stop=useRef(false);
  const diagnoseStop=useRef(false);
  const [diagnosing,setDiagnosing]=useState(false);
  const [diagnostics,setDiagnostics]=useState<QualityDiagnostic[]>([]);
  const [diagnosticTotal,setDiagnosticTotal]=useState(0);
  const [diagnosticError,setDiagnosticError]=useState('');
  const [verifySchool,setVerifySchool]=useState<Exception|null>(null);
  const [verifyUrl,setVerifyUrl]=useState('');
  const [verifyOutcome,setVerifyOutcome]=useState('verified');
  const [verifyHead,setVerifyHead]=useState('');
  const [verifyNotes,setVerifyNotes]=useState('');
  const [verifyConfirmed,setVerifyConfirmed]=useState(false);
  const [verifySaving,setVerifySaving]=useState(false);
  const [verifyError,setVerifyError]=useState('');
  const [verifyResult,setVerifyResult]=useState('');
  const [verifyResultKind,setVerifyResultKind]=useState<'success'|'review'|'queued'>('queued');

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
  const loadBackfill=useCallback(async()=>{
    const r=await fetch('/api/platform/college-staff-intelligence/contact-backfill',{cache:'no-store'});
    const data=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(data.error||'Could not load contact backfill');
    setBackfill(data as ContactBackfill);
    return data as ContactBackfill;
  },[]);
  useEffect(()=>{
    void loadBackfill().catch(e=>setBackfillError(e instanceof Error?e.message:'Could not load backfill'));
    const timer=window.setInterval(()=>{void loadBackfill().catch(()=>{})},15000);
    return()=>window.clearInterval(timer);
  },[loadBackfill]);
  const loadRecovery=useCallback(async()=>{
    const r=await fetch('/api/platform/college-staff-intelligence/contact-recovery',{cache:'no-store'});
    const data=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(data.error||'Could not load contact recovery');
    setRecovery(data as ContactRecovery);
    return data as ContactRecovery;
  },[]);
  useEffect(()=>{
    void loadRecovery().catch(e=>setRecoveryError(e instanceof Error?e.message:'Could not load contact recovery'));
    const timer=window.setInterval(()=>{void loadRecovery().catch(()=>{})},15000);
    return()=>window.clearInterval(timer);
  },[loadRecovery]);

  useEffect(()=>{
    if(!verifySchool)return;
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!verifySaving)setVerifySchool(null);};
    document.addEventListener('keydown',escape);
    const previous=document.body.style.overflow;document.body.style.overflow='hidden';
    return()=>{document.removeEventListener('keydown',escape);document.body.style.overflow=previous;};
  },[verifySchool,verifySaving]);

  function openVerify(school:Exception){
    setVerifySchool(school);
    setVerifyUrl(school.verification?.source_url||school.staff_navigation_url||school.staff_url||school.softball_url||'');
    setVerifyOutcome(school.verification?.outcome||'verified');
    setVerifyHead(school.verification?.head_coach_name||'');
    setVerifyNotes(school.verification?.notes||'');
    setVerifyConfirmed(false);setVerifyError('');setVerifyResult('');
    setVerifyResultKind('queued');
  }
  async function saveVerification(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!verifySchool||verifySaving)return;
    if(running||busy||diagnosing||enriching||backfillRunning||recoveryRunning){
      setVerifyError('Another pipeline task is running. Finish or stop it before saving this verification.');
      return;
    }
    if((verifyOutcome==='verified'||verifyOutcome==='inactive_program')&&!verifyConfirmed){
      setVerifyError('Check the official-source confirmation box before saving.');
      document.getElementById('verify-confirmation')?.scrollIntoView({behavior:'smooth',block:'center'});
      return;
    }
    setVerifySaving(true);setVerifyError('');setVerifyResult('');
    try{
      const response=await fetch('/api/platform/college-staff-intelligence/verify',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({college_id:verifySchool.college_id,outcome:verifyOutcome,
          source_url:verifyUrl,head_coach_name:verifyOutcome==='verified'?verifyHead:'',
          notes:verifyNotes,confirmed_official:verifyConfirmed}),cache:'no-store'
      });
      const saved=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(saved.error||'Could not save source verification');
      if(typeof saved.source_url==='string')setVerifyUrl(saved.source_url);
      setVerifyResult((saved.anchor_preserved?'Your # section link was preserved for future navigation. ':'')+
        (saved.message||'Verification saved.'));
      setVerifyResultKind(saved.recheck_status==='host_review'?'review':'queued');
      await load();
      if(saved.should_recheck){
        // Process exactly the verified school; never run the entire pending queue.
        try{
          const check=await fetch('/api/cron/college-softball-staff',{
            method:'POST',headers:{'Content-Type':'application/json'},
            body:JSON.stringify({bootstrap:true,division,college_id:verifySchool.college_id,limit:1}),cache:'no-store'
          });
          const checked=await check.json().catch(()=>({}));
          if(!check.ok)throw new Error(checked.error||'Automatic check could not finish');
          const result=(checked.results||[])[0];
          if(result?.status==='ok'){
            setVerifyResult('Source passed the coaching quality gates. '+result.coaches+' coach candidates processed; the school is now imported.');
            setVerifyResultKind('success');
          }else if(result){
            setVerifyResult('Source saved, but automated import was stopped for review: '+(result.error||'Quality gate not passed'));
            setVerifyResultKind('review');
          }else{
            setVerifyResult('Source saved. Recheck is still pending; use Process Queued if it does not finish.');
            setVerifyResultKind('queued');
          }
        }catch(e){
          setVerifyResult('Source saved and queued, but the automatic check did not finish: '+
            (e instanceof Error?e.message:'Unknown error')+'. You can process the pending school from this page.');
          setVerifyResultKind('review');
        }
        await load();
      }
    }catch(e){setVerifyError(e instanceof Error?e.message:'Could not save verification');}
    finally{setVerifySaving(false);}
  }

  async function runQueue(){
    if(backfillRunning)return;
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


  async function enrichCoachContacts(){
    if(running||busy||diagnosing||verifySaving||enriching||backfillRunning)return;
    setEnriching(true);setBusy(true);setError('');setMessage('Checking queued individual coach bios for missing contact details…');
    try{
      const response=await fetch('/api/cron/college-softball-staff',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({profile_enrichment:true,limit:10}),cache:'no-store'
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||'Coach contact enrichment failed');
      const results=Array.isArray(data.results)?data.results:[];
      const enriched=results.filter((x:{status:string})=>x.status==='enriched').length;
      const missing=results.filter((x:{status:string})=>x.status==='no_email').length;
      const failed=results.filter((x:{status:string})=>x.status==='error'||x.status==='blocked').length;
      setMessage(data.processed
        ?'Contact-only check complete: '+enriched+' coach profiles enriched, '+missing+' without published email, '+failed+' need review. '+(data.pending||0)+' still queued. Existing contact fields were preserved.'
        :'No coach profiles are currently queued for contact enrichment.');
      await load();
    }catch(e){setError(e instanceof Error?e.message:'Could not enrich coach contacts');}
    finally{setEnriching(false);setBusy(false);}
  }

  async function diagnoseQuality(){
    if(division==='all'||running||busy||diagnosing||backfillRunning)return;
    diagnoseStop.current=false;
    setDiagnosing(true);setDiagnosticError('');setDiagnostics([]);setDiagnosticTotal(0);
    let offset=0;
    try{
      for(let i=0;i<100&&!diagnoseStop.current;i++){
        const response=await fetch('/api/cron/college-softball-staff',{
          method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({diagnose_quality:true,division,offset,limit:3}),cache:'no-store'
        });
        const data=await response.json().catch(()=>({}));
        if(!response.ok)throw new Error(data.error||'Quality gate inspection failed');
        if(diagnoseStop.current)break;
        setDiagnosticTotal(data.total||0);
        setDiagnostics(prev=>[...prev,...(data.results||[])]);
        if(data.next_offset===null||data.next_offset===undefined)break;
        if(data.next_offset<=offset)throw new Error('Inspection did not advance');
        offset=data.next_offset;
      }
    }catch(e){setDiagnosticError(e instanceof Error?e.message:'Could not inspect quality gate sources');}
    finally{setDiagnosing(false);}
  }
  async function requeue(){
    if(division==='all'||running||busy||diagnosing||backfillRunning)return;
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

  async function contactBackfillAction(action:'start'|'resume'|'pause'){
    const response=await fetch('/api/platform/college-staff-intelligence/contact-backfill',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({action}),cache:'no-store'
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||'Could not '+action+' contact backfill');
    setBackfill(data as ContactBackfill);
    return data as ContactBackfill;
  }

  async function runContactBackfill(action:'start'|'resume'|'continue'){
    if(backfillRunningRef.current||running||busy||diagnosing||verifySaving||enriching||recoveryRunning)return;
    backfillRunningRef.current=true;backfillStop.current=false;setBackfillRunning(true);setBackfillError('');
    try{
      const initial=action==='continue'?await loadBackfill():await contactBackfillAction(action);
      if(!initial.run||initial.run.status!=='running')return;
      const runId=initial.run.id;
      // Requests are bounded to 3 coaches and run sequentially. The progress
      // survives a page refresh, and the browser can resume without rechecking.
      for(let i=0;i<1000&&!backfillStop.current;i++){
        const response=await fetch('/api/cron/college-softball-staff',{
          method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({profile_enrichment:true,backfill_run_id:runId,limit:3}),cache:'no-store'
        });
        const data=await response.json().catch(()=>({}));
        if(!response.ok)throw new Error(data.error||'Contact batch failed');
        const current=await loadBackfill();
        if(current.run?.status!=='running')break;
        if((current.progress?.pending||0)===0&&(current.progress?.processing||0)===0)break;
        if(!data.processed){
          setBackfillError('No coach was claimed in this batch. Processing stopped safely; use Continue Backfill to retry.');
          break;
        }
        if(i%5===0)await load();
      }
      await loadBackfill();await load();
    }catch(e){
      setBackfillError(e instanceof Error?e.message:'Backfill stopped. Progress was saved; you can continue.');
    }finally{backfillRunningRef.current=false;setBackfillRunning(false);}
  }

  async function pauseContactBackfill(){
    backfillStop.current=true;
    try{await contactBackfillAction('pause');}
    catch(e){setBackfillError(e instanceof Error?e.message:'Could not pause backfill');}
  }

  async function runContactRecovery(){
    if(recoveryRunningRef.current||backfillRunning||running||busy||diagnosing||verifySaving||enriching)return;
    recoveryRunningRef.current=true;recoveryStop.current=false;
    setRecoveryRunning(true);setRecoveryError('');
    try{
      for(let i=0;i<24&&!recoveryStop.current;i++){
        const before=await loadRecovery();
        if(before.pending===0)break;
        const response=await fetch('/api/cron/college-softball-staff',{
          method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({contact_recovery:true,limit:2}),cache:'no-store'
        });
        const data=await response.json().catch(()=>({}));
        if(!response.ok)throw new Error(data.error||'Contact exception recovery request failed');
        const current=await loadRecovery();
        if(current.pending===0)break;
        if(!data.processed){
          setRecoveryError('No profile was claimed. The queue is saved; refresh before continuing.');
          break;
        }
        if(i%4===0)await load();
      }
      await loadRecovery();await load();
    }catch(e){
      setRecoveryError(e instanceof Error?e.message:'Recovery interrupted. Saved progress is safe; retry the remaining profiles.');
    }finally{recoveryRunningRef.current=false;setRecoveryRunning(false);}
  }
  const recoveryReview=(recovery?.cases||[]).filter(x=>['needs_review','error','blocked'].includes(x.status));
  const recoveryFinished=recovery?recovery.total-recovery.pending-recovery.processing:0;

  const exceptions=(cleanup?.exceptions||[]).filter(x=>filter==='all'||x.status===filter);
  const shown=expanded?exceptions:exceptions.slice(0,25);
  const reviewCount=cleanup?.summary.review||0;
  const qualityCount=(cleanup?.exceptions||[]).filter(x=>x.status==='review'&&x.reason==='quality').length;
  const pendingCount=cleanup?.summary.pending||0;
  const importedPercent=d?.total?Math.round(d.imported/d.total*100):0;
  return <AppShell><main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 md:px-8">
    <PageHeader eyebrow="PLATFORM ADMIN" title="College Staff Intelligence"
      subtitle="Official-source ingestion, coaching staff coverage and cleanup across college softball."/>
    <div className="mt-6 flex items-center gap-3">
      <label htmlFor="division" className="text-xs font-black uppercase text-slate-500">Division</label>
      <select id="division" className="input w-full max-w-52" value={division} disabled={running||busy||diagnosing||verifySaving}
        onChange={e=>{diagnoseStop.current=true;setDiagnostics([]);setDiagnosticTotal(0);setDiagnosticError('');setDivision(e.target.value);setD(null);setCleanup(null);setExpanded(false);setMessage('');setError('');}}>
        {opts.map(([v,l])=><option value={v} key={v}>{l}</option>)}
      </select>
      <button type="button" className="btn ml-auto" onClick={()=>void load()} aria-label="Refresh status"><RefreshCw size={16}/>Refresh</button>
    </div>
    {!d?<div className="card mt-4 p-6">Loading…</div>:<>
      <section className="card mt-4 p-5 sm:p-6">
        <div className="flex justify-between gap-4"><div>
          <div className="rr-eyebrow">PIPELINE · {opts.find(x=>x[0]===division)?.[1]}</div>
          <div className="mt-1 text-3xl font-black">{d.imported} / {d.total}</div>
          <div className="muted text-sm">{importedPercent}% imported · {d.coaches} active coaches</div>
          <div className="mt-1 text-xs text-slate-500">{d.complete} of {d.total} programs assessed · {d.review} review · {d.blocked} blocked</div>
        </div><div className={'font-black uppercase '+(d.state==='stalled'?'text-red-600':d.state==='complete'?'text-green-700':'text-slate-900')}>{d.state}</div></div>
        <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full bg-slate-950" style={{width:importedPercent+'%'}}/>
        </div>
      </section>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        {['imported','review','blocked','processing','pending'].map(k=><div className="card p-4" key={k}>
          <div className="text-2xl font-black">{d[k]}</div><div className="text-xs font-bold uppercase text-slate-500">{k}</div>
        </div>)}
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[['Email',d.email],['Phone',d.phone],['Coach X',d.twitter]].map(([label,n]:any)=><div className="card p-4" key={label}>
          <div className="text-2xl font-black">{n} <span className="text-sm text-slate-400">/ {d.coaches}</span></div>
          <div className="text-xs font-bold uppercase text-slate-500">{label} coverage · {d.coaches?Math.round(n/d.coaches*100):0}%</div>
        </div>)}
      </div>
      <p className="mt-2 text-xs text-slate-500">X coverage counts profiles stored on coach records. Shared athletics and unrelated sports accounts are excluded when identified; remaining profiles may still need verification.</p>
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

    <section className="card mt-6 p-5 sm:p-6" aria-label="Coach contact backfill">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="rr-eyebrow">CONTACT DATA COMPLETENESS · ALL DIVISIONS</div>
          <h2 className="mt-1 text-xl font-black">Backfill missing coach contacts</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            One-time audit of individual official coach bios, including Sidearm pages, across already-imported schools.
            Only missing email and phone fields are filled from verified sources. Profiles checked with the corrected parser are skipped; older Sidearm checks receive one targeted recheck.
          </p>
        </div>
        {backfill?.run&&<span className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold uppercase text-slate-700">{backfill.run.status==='running'&&!backfillRunning?'Ready to continue':backfill.run.status==='running'?'Processing':backfill.run.status}</span>}
      </div>
      {backfill&&<div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl bg-slate-50 p-3"><div className="text-xl font-black">{backfill.run?.queued_count??backfill.preview.eligible}</div>
          <div className="text-xs text-slate-500">{backfill.run?'Originally queued':'Eligible unreviewed profiles'}</div></div>
        <div className="rounded-xl bg-slate-50 p-3"><div className="text-xl font-black">{backfill.progress?backfill.progress.total-backfill.progress.pending-backfill.progress.processing:0}</div>
          <div className="text-xs text-slate-500">Checked</div></div>
        <div className="rounded-xl bg-slate-50 p-3"><div className="text-xl font-black">{backfill.progress?.added_emails||0}</div>
          <div className="text-xs text-slate-500">New verified emails</div></div>
        <div className="rounded-xl bg-slate-50 p-3"><div className="text-xl font-black">{backfill.progress?.added_phones||0}</div>
          <div className="text-xs text-slate-500">New verified phones</div></div>
      </div>}
      {backfill?.run&&backfill.progress&&<div className="mt-4">
        <div className="mb-2 flex justify-between text-xs font-semibold text-slate-600">
          <span>{backfill.progress.total-backfill.progress.pending-backfill.progress.processing} / {backfill.progress.total} checked</span>
          <span>{backfill.progress.total?Math.round((backfill.progress.total-backfill.progress.pending-backfill.progress.processing)/backfill.progress.total*100):100}%</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full bg-slate-950 transition-all" style={{width:(backfill.progress.total?Math.round((backfill.progress.total-backfill.progress.pending-backfill.progress.processing)/backfill.progress.total*100):100)+'%'}}/>
        </div>
        <p className="mt-2 text-xs text-slate-600">
          {backfill.progress.enriched} improved · {backfill.progress.no_email} checked with no new contact · {backfill.progress.error+backfill.progress.blocked} need review · {backfill.progress.pending} waiting
        </p>
      </div>}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {!backfill?.run&&<button type="button" className="btn btn-red"
          disabled={!backfill||!backfill.preview.eligible||backfillRunning||running||busy||diagnosing||verifySaving||enriching}
          onClick={()=>void runContactBackfill('start')}><Play size={16}/>Start one-time backfill</button>}
        {backfill?.run?.status==='paused'&&<button type="button" className="btn btn-red"
          disabled={backfillRunning||running||busy||diagnosing||verifySaving||enriching}
          onClick={()=>void runContactBackfill('resume')}><Play size={16}/>Resume backfill</button>}
        {backfill?.run?.status==='running'&&!backfillRunning&&<button type="button" className="btn btn-red"
          disabled={running||busy||diagnosing||verifySaving||enriching}
          onClick={()=>void runContactBackfill('continue')}><Play size={16}/>Continue backfill</button>}
        {backfillRunning&&<button type="button" className="btn" onClick={()=>void pauseContactBackfill()}>
          <Square size={16}/>Pause after current batch</button>}
        {backfill?.run?.status==='completed'&&<span className="flex items-center gap-2 text-sm font-bold text-green-700"><CheckCircle2 size={17}/>One-time backfill complete</span>}
        <button type="button" className="btn" onClick={()=>void loadBackfill().catch(e=>setBackfillError(String(e)))}>
          <RefreshCw size={16}/>Refresh progress
        </button>
      </div>
      <p className="mt-3 text-xs text-slate-500">Click Continue Backfill once to process small batches automatically while this page stays open. You can pause, leave, and resume later without losing progress. No new paid background service is required.</p>
      {backfillError&&<p className="mt-3 text-sm text-red-700" role="alert"><AlertCircle size={15} className="mr-2 inline"/>{backfillError}</p>}
    </section>

    <section className="card mt-6 p-5 sm:p-6" aria-label="Contact exception recovery">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="rr-eyebrow">TARGETED CONTACT RECOVERY · ALL DIVISIONS</div>
          <h2 className="mt-1 text-xl font-black">Recover contact exceptions</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Rechecks only the 26 transient website failures and five valid athletics-host false positives.
            Two source conflicts are held for review, including a broken SJU bio and a Green Bay coach identity discrepancy.
            The completed 960-profile backfill stays unchanged.
          </p>
        </div>
        {recovery&&<span className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold uppercase text-slate-700">
          {recoveryRunning?'Retrying':recovery.pending?'Ready to retry':'Retry pass complete'}
        </span>}
      </div>
      {recovery&&<div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl bg-slate-50 p-3"><div className="text-xl font-black">{recoveryFinished} / {recovery.total}</div>
          <div className="text-xs text-slate-500">Classified / processed</div></div>
        <div className="rounded-xl bg-slate-50 p-3"><div className="text-xl font-black">{recovery.enriched}</div>
          <div className="text-xs text-slate-500">Profiles improved</div></div>
        <div className="rounded-xl bg-slate-50 p-3"><div className="text-xl font-black">{recovery.added_emails} / {recovery.added_phones}</div>
          <div className="text-xs text-slate-500">New emails / phones</div></div>
        <div className="rounded-xl bg-slate-50 p-3"><div className="text-xl font-black">{recovery.needs_review+recovery.error+recovery.blocked}</div>
          <div className="text-xs text-slate-500">Unresolved cases</div></div>
      </div>}
      {recovery&&<div className="mt-4">
        <div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-600">
          <span>{recovery.retry_total-recovery.pending-recovery.processing} of {recovery.retry_total} targeted retries finished</span>
          <span>{recovery.pending} waiting</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full bg-slate-950 transition-all"
            style={{width:(recovery.retry_total?Math.round((recovery.retry_total-recovery.pending-recovery.processing)/recovery.retry_total*100):100)+'%'}}/>
        </div>
        <p className="mt-2 text-xs text-slate-600">
          {recovery.checked} rechecked with no new contacts · {recovery.error+recovery.blocked} retry failures · {recovery.needs_review} source review
        </p>
      </div>}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {recovery&&recovery.pending>0&&!recoveryRunning&&<button type="button" className="btn btn-red"
          disabled={backfillRunning||running||busy||diagnosing||verifySaving||enriching}
          onClick={()=>void runContactRecovery()}><Play size={16}/>Recover {recovery.pending} remaining profiles</button>}
        {recoveryRunning&&<button type="button" className="btn"
          onClick={()=>{recoveryStop.current=true;}}><Square size={16}/>Stop after current batch</button>}
        {recovery&&recovery.pending===0&&recovery.processing===0&&<span className="flex items-center gap-2 text-sm font-bold text-green-700">
          <CheckCircle2 size={17}/>One-time retry pass finished</span>}
        <button type="button" className="btn" onClick={()=>void loadRecovery().catch(e=>setRecoveryError(String(e)))}>
          <RefreshCw size={16}/>Refresh results
        </button>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Runs two profiles per request while this page stays open. Each failed profile gets at most one targeted retry.
        Original coach contacts, source verification states, and backfill history are preserved.
      </p>
      {recoveryError&&<p className="mt-3 text-sm text-red-700" role="alert"><AlertCircle size={15} className="mr-2 inline"/>{recoveryError}</p>}
      {recoveryReview.length>0&&<div className="mt-5 border-t pt-4">
        <h3 className="text-sm font-black">Cases still requiring source review ({recoveryReview.length})</h3>
        <div className="mt-3 space-y-3">
          {recoveryReview.map(item=><div key={item.coach_id} className="rounded-xl border border-slate-200 p-3 text-sm">
            <div className="flex flex-wrap justify-between gap-2">
              <div className="font-bold">{item.coach} <span className="font-normal text-slate-600">· {item.school}</span></div>
              <span className="text-xs font-semibold uppercase text-slate-500">{item.issue.replaceAll('_',' ')} · {item.status.replaceAll('_',' ')}</span>
            </div>
            <p className="mt-1 text-xs text-slate-600">{item.review_note||item.error||'Official source needs another review.'}</p>
            <div className="mt-2 flex flex-wrap gap-4 text-xs">
              {item.official_bio_url&&<a className="font-semibold text-blue-700 underline" href={item.official_bio_url}
                target="_blank" rel="noopener noreferrer">Original coach bio <ExternalLink size={12} className="inline"/></a>}
              {item.source_candidate_url&&<a className="font-semibold text-blue-700 underline" href={item.source_candidate_url}
                target="_blank" rel="noopener noreferrer">Official replacement candidate <ExternalLink size={12} className="inline"/></a>}
            </div>
          </div>)}
        </div>
      </div>}
    </section>

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
            <select id="failure-group" className="input w-full" value={group} onChange={e=>setGroup(e.target.value)} disabled={running||busy||diagnosing||verifySaving}>
              {groups.map(([value,label])=><option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          <button type="button" className="btn btn-red" disabled={running||busy||diagnosing||verifySaving||!reviewCount} onClick={()=>void requeue()}>
            <Play size={16}/>{busy?'Queuing…':'Retry & process reviews'}
          </button>
          <button type="button" className="btn" disabled={running||busy||diagnosing||verifySaving||!pendingCount} onClick={()=>void runQueue()}>
            <Play size={16}/>Process {pendingCount} queued
          </button>
          <button type="button" className="btn" disabled={running||busy||diagnosing||verifySaving||enriching} onClick={()=>void enrichCoachContacts()}>
            <RefreshCw size={16}/>{enriching?'Checking coach bios…':'Enrich coach contacts'}
          </button>
          {running&&<button type="button" className="btn" onClick={()=>{stop.current=true;setMessage('Stopping after the current school…')}}>
            <Square size={15}/>Stop after current
          </button>}
        </div>
        {qualityCount>0&&<div className="mt-4 border-t pt-4">
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="btn" disabled={running||busy||diagnosing} onClick={()=>void diagnoseQuality()}>
              <RefreshCw size={15}/>{diagnosing?'Inspecting official pages…':'Inspect '+qualityCount+' quality gate cases'}
            </button>
            <span className="text-xs text-slate-500">Read-only: checks official pages without importing, changing, or requeuing coach records.</span>
            {diagnosing&&<button type="button" className="btn" onClick={()=>{diagnoseStop.current=true;}}>Stop inspection</button>}
          </div>
          {(diagnosing||diagnostics.length>0)&&<p className="mt-2 text-xs font-semibold text-slate-600">
            {diagnosing?'Inspecting':'Inspected'} {diagnostics.length} of {diagnosticTotal||qualityCount} schools.
            {diagnostics.length>0&&' '+diagnostics.filter(x=>x.status==='candidate').length+' currently pass primary-source parsing.'}
          </p>}
          {diagnosticError&&<p className="mt-2 text-sm text-red-700" role="alert">{diagnosticError}</p>}
        </div>}
        {running&&<div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm font-semibold" role="status">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-red-600"/> Running cleanup: {runStats.processed} processed, {runStats.imported} imported, {runStats.review} review, {runStats.blocked} blocked.
        </div>}
        {message&&!running&&<div className="mt-4 flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-sm" role="status"><CheckCircle2 size={16} className="mt-0.5 shrink-0"/>{message}</div>}
        {error&&<div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert"><AlertCircle size={16} className="mt-0.5 shrink-0"/>{error}</div>}
      </div>
      {diagnostics.length>0&&<div className="border-b p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h3 className="font-black">Quality gate inspection report</h3>
            <p className="mt-1 text-xs text-slate-500">Unverified parser preview from the saved official source. A passing preview is not an imported coach.</p>
          </div>
          <button type="button" className="btn" onClick={()=>void navigator.clipboard.writeText(
            diagnostics.map(x=>[x.name,x.status,x.issue,x.source_url||'',x.coaches.map(c=>c.name+' ('+c.title+')').join('; ')].join(' | ')).join('\\n')
          )}>Copy report</button>
        </div>
        <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>
            <th className="px-3 py-2">School</th><th className="px-3 py-2">Diagnostic</th>
            <th className="px-3 py-2">Coach candidates (not imported)</th><th className="px-3 py-2">Source</th>
          </tr></thead>
          <tbody className="divide-y">{diagnostics.map(x=><tr key={x.college_id}>
            <td className="px-3 py-3 font-semibold">{x.name}</td>
            <td className="px-3 py-3"><div>{x.issue}</div><div className="mt-1 text-xs text-slate-500">{x.head_count} head coach candidates</div></td>
            <td className="px-3 py-3 text-xs">{x.coaches.length?x.coaches.map(c=>c.name+' ('+c.title+')').join('; '):'None identified'}</td>
            <td className="px-3 py-3 text-xs">{x.source_url?.startsWith('https://')?
              <a href={x.source_url} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">Official source ↗</a>:'No source'}
              <div className="mt-1"><a href={'https://www.google.com/search?q='+encodeURIComponent(x.name+' softball coaches official athletics')}
                target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">Search Google ↗</a></div>
            </td>
          </tr>)}</tbody>
        </table></div>
      </div>}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3">
        <div><h3 className="font-black">Schools requiring attention</h3>
          <p className="mt-1 text-xs text-slate-500">Verify the official source beside each school. Source confirmation never approves coach contact details.</p>
        </div>
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
            <td className="px-5 py-3">
              <div className="font-bold">{x.name}</div>
              <div className="mt-1 text-xs text-slate-500">{x.status}</div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button type="button" disabled={running||busy||diagnosing||verifySaving}
                  onClick={()=>openVerify(x)}
                  className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-900 hover:border-red-300 hover:text-red-700 disabled:opacity-50">
                  <ShieldCheck size={14}/>{x.verification?'Edit verification':'Verify'}
                </button>
                {x.verification&&<span className={'rounded-md px-2 py-1 text-[11px] font-semibold '+
                  (x.verification.recheck_status==='passed'?'bg-green-50 text-green-800':
                    x.verification.outcome==='inactive_program'?'bg-slate-100 text-slate-700':
                    'bg-amber-50 text-amber-800')}>
                  {x.verification.outcome==='inactive_program'?'Reported inactive':
                    x.verification.outcome==='incorrect_source'?'Incorrect source':
                    x.verification.outcome==='unable_to_verify'?'Unable to verify':
                    x.verification.recheck_status==='passed'?'Source checked · imported':
                    x.verification.recheck_status==='pending'?'Source verified · queued':
                    x.verification.recheck_status==='host_review'?'New host review':
                    'Source verified · needs review'}
                </span>}
              </div>
              {x.verification&&<div className="mt-1 text-[11px] font-normal text-slate-500">
                Last checked by Super Owner · {date(x.verification.verified_at)}
              </div>}
            </td>
            <td className="px-3 py-3"><div className="font-semibold">{errorLabel(x.reason)}</div>
              <div className="mt-1 max-w-64 break-words text-xs text-slate-500">{x.last_error||'—'}</div></td>
            <td className="px-3 py-3 tabular-nums">{x.attempts}</td>
            <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-500">{date(x.updated_at)}</td>
            <td className="px-5 py-3"><div className="flex flex-col items-start gap-2">
              {(x.staff_navigation_url||x.staff_url)?.startsWith('https://')?
                <a className="inline-flex items-center gap-1 font-semibold text-slate-700 underline hover:text-red-700"
                  href={x.staff_navigation_url||x.staff_url||'#'} target="_blank" rel="noopener noreferrer">Official source <ExternalLink size={13}/></a>:
                <span className="text-xs text-slate-400">Not discovered</span>}
              <a className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 underline hover:text-blue-900"
                href={'https://www.google.com/search?q='+encodeURIComponent(x.name+' softball coaches official athletics')}
                target="_blank" rel="noopener noreferrer">Search Google <ExternalLink size={12}/></a>
            </div></td>
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
  </main>    {verifySchool&&<div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/60 p-3 sm:p-6"
      onMouseDown={e=>{if(e.target===e.currentTarget&&!verifySaving)setVerifySchool(null);}}>
      <section role="dialog" aria-modal="true" aria-labelledby="verify-title"
        className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div><div className="rr-eyebrow">OFFICIAL SOURCE VERIFICATION</div>
            <h2 id="verify-title" className="mt-1 text-xl font-black text-slate-950">{verifySchool.name}</h2>
            <p className="mt-1 text-xs text-slate-500">Confirm the school source, not every coach or contact field.</p>
          </div>
          <button type="button" disabled={verifySaving} aria-label="Close verification"
            onClick={()=>setVerifySchool(null)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-50">
            <X size={20}/></button>
        </div>
        <form onSubmit={e=>void saveVerification(e)} className="max-h-[min(75vh,720px)] space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
          <div>
            <label htmlFor="verify-url" className="mb-1 block text-sm font-bold">Official softball coaching page URL</label>
            <input id="verify-url" type="url" autoFocus required={verifyOutcome==='verified'} value={verifyUrl}
              onChange={e=>{setVerifyUrl(e.target.value);setVerifyResult('');}}
              placeholder="https://schoolathletics.edu/sports/softball/coaches" className="input w-full" disabled={verifySaving}/>
            <div className="mt-2 flex flex-wrap gap-4 text-xs">
              {verifyUrl.startsWith('https://')&&<a href={verifyUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-blue-700 underline">Open entered URL <ExternalLink size={12}/></a>}
              <a href={'https://www.google.com/search?q='+encodeURIComponent(verifySchool.name+' softball coaches official athletics')}
                target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-blue-700 underline">
                Find official page <ExternalLink size={12}/></a>
            </div>
            {verifyUrl.includes('#')&&<p className="mt-2 text-xs text-slate-600">
              RLTNL keeps this # section link for opening the coaching section. The importer fetches the same page without the # anchor.
            </p>}
          </div>
          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-bold">What did you find?</legend>
            {[
              ['verified','Correct official coaching page'],
              ['incorrect_source','Incorrect or outdated source'],
              ['unable_to_verify','Cannot access or verify'],
              ['inactive_program','Softball program inactive']
            ].map(([value,label])=><label key={value} className={'flex cursor-pointer items-center gap-2.5 rounded-xl border p-3 text-sm '+(verifyOutcome===value?'border-slate-900 bg-slate-50':'border-slate-200')}>
              <input type="radio" name="verification-result" value={value} checked={verifyOutcome===value}
                onChange={()=>{setVerifyOutcome(value);setVerifyConfirmed(false);setVerifyResult('');}} disabled={verifySaving}/>
              <span className="font-medium">{label}</span>
            </label>)}
          </fieldset>
          {verifyOutcome==='verified'&&<div>
            <label htmlFor="verify-head" className="mb-1 block text-sm font-bold">Current head coach <span className="font-normal text-slate-500">(optional)</span></label>
            <input id="verify-head" className="input w-full" value={verifyHead} maxLength={120}
              onChange={e=>setVerifyHead(e.target.value)} placeholder="First and last name" disabled={verifySaving}/>
            <p className="mt-1 text-xs text-slate-500">If entered, the importer must find this head coach on the official page or stop for review.</p>
          </div>}
          <div>
            <label htmlFor="verify-notes" className="mb-1 block text-sm font-bold">Verification notes <span className="font-normal text-slate-500">(optional)</span></label>
            <textarea id="verify-notes" rows={2} maxLength={1000} value={verifyNotes} disabled={verifySaving}
              onChange={e=>setVerifyNotes(e.target.value)} placeholder="For example: Head coach shown in the 2026 staff listing" className="input w-full resize-y"/>
          </div>
          {(verifyOutcome==='verified'||verifyOutcome==='inactive_program')&&<label className="flex items-start gap-2.5 rounded-xl bg-slate-50 p-3 text-sm">
            <input id="verify-confirmation" type="checkbox" checked={verifyConfirmed}
              onChange={e=>{setVerifyConfirmed(e.target.checked);if(e.target.checked)setVerifyError('');}}
              disabled={verifySaving} aria-invalid={Boolean(verifyError&&!verifyConfirmed)}
              className="mt-1"/>
            <span>{verifyOutcome==='verified'
              ?'I checked this school’s official athletics or university source and confirm this URL is for its softball coaching staff.'
              :'I checked an official school source indicating this softball program is inactive.'}</span>
          </label>}
          {(verifyOutcome==='verified'||verifyOutcome==='inactive_program')&&!verifyConfirmed&&
            <p className="text-xs text-amber-800">Required: confirm the official school source before saving.</p>}
          {verifyOutcome==='verified'&&<p className="text-xs text-slate-500">
            Saving a recognized official host starts a targeted recheck. Coach imports still require the existing quality gates; unfamiliar domains are held for review.
          </p>}
          {verifyError&&<div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{verifyError}</div>}
          {verifyResult&&<div role="status" className={'rounded-xl border p-3 text-sm '+
            (verifyResultKind==='success'?'border-green-200 bg-green-50 text-green-900':
              verifyResultKind==='review'?'border-amber-200 bg-amber-50 text-amber-900':
              'border-slate-200 bg-slate-50 text-slate-800')}>{verifyResult}</div>}
          <div className="sticky bottom-0 z-10 -mx-5 -mb-5 flex flex-wrap justify-end gap-2 border-t bg-white px-5 py-4 shadow-[0_-6px_12px_rgba(15,23,42,0.05)] sm:-mx-6 sm:px-6">
            <button type="button" className="btn" disabled={verifySaving} onClick={()=>setVerifySchool(null)}>
              {verifyResult?'Close':'Cancel'}
            </button>
            <button type="submit" className="btn btn-red" disabled={verifySaving}>
              <ShieldCheck size={16}/>{verifySaving?'Saving / rechecking…':'Save verification'}
            </button>
          </div>
        </form>
      </section>
    </div>}
</AppShell>;
}
