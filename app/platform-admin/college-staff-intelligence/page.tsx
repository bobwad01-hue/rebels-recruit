'use client';

import {useCallback,useEffect,useRef,useState} from 'react';
import AppShell from '@/components/AppShell';
import PageHeader from '@/components/PageHeader';
import {AlertCircle,ArrowRight,CheckCircle2,ChevronDown,ExternalLink,Play,RefreshCw,Square,ShieldCheck,X} from 'lucide-react';

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
type HostEvidence={verified:boolean;school_website:string;athletics_host:string;
  evidence_url:string|null;matched_link:string|null;checked_urls:string[];message:string};
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

type ManualCoach={name:string;title:string;role:string;email:string};
const manualRoleOptions=[
  ['head_coach','Head coach'],['associate_head_coach','Associate head coach'],
  ['assistant_coach','Assistant coach'],['pitching_coach','Pitching coach'],
  ['hitting_coach','Hitting coach'],['recruiting_coordinator','Recruiting coordinator'],
  ['graduate_assistant','Graduate assistant'],['volunteer_assistant','Volunteer assistant'],
  ['other_coaching_staff','Other softball coaching staff']
];
function roleFromTitle(title:string){
  const t=title.toLowerCase();
  if(/associate.*head/.test(t))return 'associate_head_coach';
  if(/head.*coach|head.*softball/.test(t))return 'head_coach';
  if(/graduate/.test(t))return 'graduate_assistant';
  if(/volunteer/.test(t))return 'volunteer_assistant';
  if(/pitching/.test(t))return 'pitching_coach';
  if(/hitting/.test(t))return 'hitting_coach';
  if(/recruiting/.test(t))return 'recruiting_coordinator';
  return 'assistant_coach';
}
function staffFromSavedNotes(notes:string):ManualCoach[]{
  const lines=notes.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  const out:ManualCoach[]=[];
  for(let i=0;i+1<lines.length&&out.length<8;i++){
    const name=lines[i],title=lines[i+1];
    if(!/^[\p{Lu}][\p{L}.'’\-]+(?:\s+[\p{Lu}][\p{L}.'’\-]+){1,3}$/u.test(name)
       ||!/softball|coach|assistant|pitching|hitting/i.test(title)
       ||title.length>120)continue;
    const next=lines[i+2]||'';
    const email=/^[\w.%+\-]+@[\w.\-]+\.[a-z]{2,}$/i.test(next)?next:'';
    if(out.some(c=>c.name.toLowerCase()===name.toLowerCase()))continue;
    out.push({name,title,role:roleFromTitle(title),email});
    i+=email?2:1;
  }
  return out;
}

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
  const [verifySaved,setVerifySaved]=useState(false);
  const [verifyError,setVerifyError]=useState('');
  const [verifyResult,setVerifyResult]=useState('');
  const [verifyResultKind,setVerifyResultKind]=useState<'success'|'review'|'queued'>('queued');
  const [manualMode,setManualMode]=useState(false);
  const [manualCoaches,setManualCoaches]=useState<ManualCoach[]>([]);
  const [manualConfirmed,setManualConfirmed]=useState(false);
  const [manualSaving,setManualSaving]=useState(false);
  const [manualError,setManualError]=useState('');
  const [hostEvidenceUrl,setHostEvidenceUrl]=useState('');
  const [hostEvidence,setHostEvidence]=useState<HostEvidence|null>(null);
  const [hostChecking,setHostChecking]=useState(false);
  const [hostApproving,setHostApproving]=useState(false);
  const [hostError,setHostError]=useState('');
  const [hostConfirmed,setHostConfirmed]=useState(false);
  const [hostEditing,setHostEditing]=useState(false);

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
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!verifySaving&&!manualSaving&&!hostApproving&&!hostChecking)setVerifySchool(null);};
    document.addEventListener('keydown',escape);
    const previous=document.body.style.overflow;document.body.style.overflow='hidden';
    return()=>{document.removeEventListener('keydown',escape);document.body.style.overflow=previous;};
  },[verifySchool,verifySaving,manualSaving,hostApproving,hostChecking]);

  function openVerify(school:Exception,suggestion?:QualityDiagnostic){
    setVerifySchool(school);
    // An inspection is a read-only parser preview, not an approval. Prefill the
    // inspected source to save typing; the Super Owner still opens and confirms it.
    const candidate=suggestion?.source_url?.startsWith('https://')
      ?suggestion.source_url:null;
    const navigation=school.staff_navigation_url;
    const preferred=candidate&&navigation&&candidate.split('#')[0]===navigation.split('#')[0]
      ?navigation:candidate;
    // A saved human-reviewed source takes precedence over any stale parser preview.
    setVerifyUrl(school.verification?.source_url||preferred||navigation||school.staff_url||school.softball_url||'');
    setVerifyOutcome(suggestion?'verified':school.verification?.outcome||'verified');
    const suggestedHeads=suggestion?.coaches.filter(c=>c.role==='head_coach')||[];
    setVerifyHead(school.verification?.head_coach_name||
      (suggestedHeads.length===1?suggestedHeads[0].name:''));
    setVerifyNotes(school.verification?.notes||'');
    setVerifyConfirmed(false);setVerifySaved(false);setVerifyError('');setVerifyResult('');
    setVerifyResultKind('queued');
    const needsManual=school.verification?.outcome==='verified'&&school.verification?.recheck_status==='needs_review';
    setManualMode(Boolean(needsManual));
    const fromNotes=staffFromSavedNotes(school.verification?.notes||'');
    setManualCoaches(fromNotes.length?fromNotes:[
      {name:school.verification?.head_coach_name||'',title:'Head Softball Coach',role:'head_coach',email:''}
    ]);
    setManualConfirmed(false);setManualError('');
    setHostEvidenceUrl('');setHostEvidence(null);setHostError('');
    setHostChecking(false);setHostApproving(false);setHostConfirmed(false);setHostEditing(false);
  }
  async function saveVerification(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!verifySchool||verifySaving||verifySaved)return;
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
      // A successful POST is persisted even if a subsequent recheck or refresh fails.
      // Lock the form to prevent accidental duplicate verifications and imports.
      setVerifySaved(true);
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
            const fromNotes=staffFromSavedNotes(verifyNotes);
            if(fromNotes.length)setManualCoaches(fromNotes);
            setManualMode(true);
            setManualConfirmed(false);
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



  async function checkHostEvidence(){
    if(!verifySchool||hostChecking||hostApproving)return;
    setHostChecking(true);setHostError('');setHostEvidence(null);setHostConfirmed(false);
    try{
      const response=await fetch('/api/platform/college-staff-intelligence/host-review',{
        method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',
        body:JSON.stringify({action:'check',college_id:verifySchool.college_id,
          evidence_url:hostEvidenceUrl})
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||'Could not check the university link');
      setHostEvidence(data as HostEvidence);
    }catch(e){setHostError(e instanceof Error?e.message:'Official university link check failed');}
    finally{setHostChecking(false);}
  }
  async function approveOfficialHost(){
    if(!verifySchool||!hostEvidence?.verified||!hostConfirmed||hostApproving||hostChecking)return;
    if(running||busy||diagnosing||enriching||backfillRunning||recoveryRunning){
      setHostError('Wait for the other pipeline task to finish.');return;
    }
    setHostApproving(true);setHostError('');
    try{
      const response=await fetch('/api/platform/college-staff-intelligence/host-review',{
        method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',
        body:JSON.stringify({action:'approve',college_id:verifySchool.college_id,
          evidence_url:hostEvidenceUrl,confirmed_approval:true})
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||'Official host approval failed');
      setVerifySaved(true);setVerifyResultKind('queued');
      setVerifyResult('Official athletics domain approved for this school using an independently verified university link. Your saved coaching URL, head coach, and notes are preserved. Running one-school quality recheck…');
      await load();
      // Only this school, never the full ingestion queue.
      try{
        const check=await fetch('/api/cron/college-softball-staff',{
          method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',
          body:JSON.stringify({bootstrap:true,division,college_id:verifySchool.college_id,limit:1})
        });
        const checked=await check.json().catch(()=>({}));
        if(!check.ok)throw new Error(checked.error||'Automatic recheck failed');
        const result=(checked.results||[])[0];
        if(result?.status==='ok'){
          setVerifyResult('Official athletics domain approved. Source passed the coaching quality gates; '+result.coaches+' coaches processed and school imported.');
          setVerifyResultKind('success');
        }else if(result){
          setVerifyResult('Official athletics domain approved and saved. Coaching staff still needs review: '+(result.error||'Quality gate not passed')+'. Use Review Saved Staff to finish without verifying the domain again.');
          setVerifyResultKind('review');
        }else{
          setVerifyResult('Official athletics domain approved. The targeted recheck is pending; Process Queued can finish it.');
          setVerifyResultKind('queued');
        }
      }catch(e){
        setVerifyResult('Official athletics domain approved and saved. Targeted recheck did not finish: '+
          (e instanceof Error?e.message:'Unknown error')+'. Use Process Queued; do not reverify the domain.');
        setVerifyResultKind('review');
      }
      await load();
    }catch(e){setHostError(e instanceof Error?e.message:'Official host approval failed');}
    finally{setHostApproving(false);}
  }

  async function importManuallyVerifiedStaff(){
    if(!verifySchool||!manualConfirmed||manualSaving||!canManualImport)return;
    if(running||busy||diagnosing||enriching||backfillRunning||recoveryRunning){
      setManualError('Wait for the other pipeline task to finish.');return;
    }
    setManualSaving(true);setManualError('');
    try{
      const response=await fetch('/api/platform/college-staff-intelligence/manual-staff',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({college_id:verifySchool.college_id,
          source_url:verifyUrl,coaches:manualCoaches}),cache:'no-store'
      });
      const saved=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(saved.error||'Manual staff import failed');
      setVerifySaved(true);setManualMode(false);setManualConfirmed(false);
      setVerifyResultKind('success');
      setVerifyResult('Your official-source verification was already saved. '+
        saved.coaches+' manually verified coaches are now imported ('+
        saved.created+' new, '+saved.updated+' existing). Official-source audit snapshots were recorded.');
      await load();
    }catch(e){setManualError(e instanceof Error?e.message:'Manual staff import failed');}
    finally{setManualSaving(false);}
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

  // Keep the guided verification list in sync with live queue status so schools
  // already imported disappear after the successful targeted recheck.
  const hostCases=(cleanup?.exceptions||[]).filter(s=>s.status==='review'&&
    s.verification?.outcome==='verified'&&s.verification.recheck_status==='host_review');
  const manualCases=(cleanup?.exceptions||[]).filter(s=>s.status==='review'&&
    s.verification?.outcome==='verified'&&s.verification.recheck_status==='needs_review');
  const activeVerification=cleanup?.exceptions.find(s=>s.college_id===verifySchool?.college_id)?.verification
    ||verifySchool?.verification;
  const needsHostApproval=Boolean(activeVerification?.outcome==='verified'
    &&activeVerification.recheck_status==='host_review'&&
    verifyUrl===activeVerification.source_url);
  const canManualImport=Boolean(verifySchool&&verifyOutcome==='verified'&&
    activeVerification?.outcome==='verified'&&activeVerification.recheck_status==='needs_review'&&
    verifyUrl===activeVerification.source_url);
  // Diagnostics are read-only snapshots. Render only schools still in the
  // live quality-gate review queue, never imported or blocked history.
  const activeQuality=diagnostics.filter(x=>(cleanup?.exceptions||[])
    .some(s=>s.college_id===x.college_id&&s.status==='review'&&s.reason==='quality'));
  const manualQuality=activeQuality.filter(x=>(cleanup?.exceptions||[])
    .some(s=>s.college_id===x.college_id&&s.verification?.outcome==='verified'
      &&s.verification.recheck_status==='needs_review'));
  const readyQuality=activeQuality.filter(x=>x.status==='candidate'
    &&!manualQuality.some(s=>s.college_id===x.college_id)
    &&[x.source_url,cleanup?.exceptions.find(s=>s.college_id===x.college_id)?.staff_url]
      .some(url=>url?.startsWith('https://')));
  const investigatedQuality=activeQuality.length-readyQuality.length-manualQuality.length;
  const hiddenQuality=diagnostics.length-activeQuality.length;
  const orderedQuality=[...activeQuality].sort((a,b)=>
    Number(readyQuality.some(x=>x.college_id===b.college_id))
    -Number(readyQuality.some(x=>x.college_id===a.college_id))
    ||a.name.localeCompare(b.name));
  const nextQuality=verifySchool
    ?orderedQuality.find(x=>x.college_id!==verifySchool.college_id):null;
  function reviewQualitySource(item:QualityDiagnostic){
    const school=cleanup?.exceptions.find(x=>x.college_id===item.college_id&&x.status==='review');
    if(school)openVerify(school,item);
  }
  // Selecting a retry issue also filters the review list for human inspection.
  // Filtering alone does not requeue or import anything.
  const exceptions=(cleanup?.exceptions||[]).filter(x=>
    (filter==='all'||x.status===filter)&&
    (filter!=='review'||group==='all'||x.reason===group));
  const shown=expanded?exceptions:exceptions.slice(0,25);
  const reviewCount=cleanup?.summary.review||0;
  const timeoutCount=(cleanup?.exceptions||[]).filter(x=>x.status==='review'&&x.reason==='timeout').length;
  const retryEligibleCount=(cleanup?.exceptions||[]).filter(x=>x.status==='review'
    &&!['inactive_program','staff_conflict','source_access','manual_verification'].includes(x.reason)
    &&(group==='all'||x.reason===group)).length;
  const qualityCount=(cleanup?.exceptions||[]).filter(x=>x.status==='review'&&x.reason==='quality').length;
  const pendingCount=cleanup?.summary.pending||0;
  const importedPercent=d?.total?Math.round(d.imported/d.total*100):0;
  return <AppShell><main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 md:px-8">
    <PageHeader eyebrow="PLATFORM ADMIN" title="College Staff Intelligence"
      subtitle="Official-source ingestion, coaching staff coverage and cleanup across college softball."/>
    <div className="mt-6 flex flex-wrap items-center gap-3">
      <label htmlFor="division" className="text-xs font-black uppercase text-slate-500">Division</label>
      <select id="division" className="input w-full max-w-52" value={division} disabled={running||busy||diagnosing||verifySaving}
        onChange={e=>{diagnoseStop.current=true;setDiagnostics([]);setDiagnosticTotal(0);setDiagnosticError('');setDivision(e.target.value);setD(null);setCleanup(null);setExpanded(false);setMessage('');setError('');}}>
        {opts.map(([v,l])=><option value={v} key={v}>{l}</option>)}
      </select>
      {division!=='all'&&<a href="#college-staff-cleanup" className="btn btn-red ml-auto">Continue {opts.find(x=>x[0]===division)?.[1]} cleanup <ArrowRight size={15}/></a>}
      <button type="button" className="btn" onClick={()=>void load()} aria-label="Refresh status"><RefreshCw size={16}/>Refresh</button>
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

    {division!=='all'&&<section id="college-staff-cleanup" className="card mt-6 scroll-mt-6 overflow-hidden">
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
            <label htmlFor="failure-group" className="mb-1 block text-xs font-bold text-slate-600">Issue group · filter & retry</label>
            <select id="failure-group" className="input w-full" value={group} onChange={e=>{setGroup(e.target.value);setExpanded(false);}} disabled={running||busy||diagnosing||verifySaving}>
              {groups.map(([value,label])=><option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          <button type="button" className="btn btn-red" disabled={running||busy||diagnosing||verifySaving||!retryEligibleCount} onClick={()=>void requeue()}>
            <Play size={16}/>{busy?'Queuing…':group==='all'?'Retry & process reviews':'Retry up to '+Math.min(10,retryEligibleCount)+' '+(groups.find(x=>x[0]===group)?.[1]||'reviews').toLowerCase()}
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
        {timeoutCount>0&&<div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-sm font-semibold text-slate-800">{timeoutCount} timeout school{timeoutCount===1?'':'s'} still need review. Inspect their official pages before retrying.</p>
          <button type="button" className="btn" onClick={()=>{
            setGroup('timeout');setFilter('review');setExpanded(true);
            document.getElementById('college-staff-attention')?.scrollIntoView({behavior:'smooth',block:'start'});
          }}>
            View {timeoutCount} timeout schools <ArrowRight size={15}/>
          </button>
        </div>}
        {qualityCount>0&&<div className="mt-4 border-t pt-4">
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="btn" disabled={running||busy||diagnosing} onClick={()=>void diagnoseQuality()}>
              <RefreshCw size={15}/>{diagnosing?'Inspecting official pages…':'Inspect '+qualityCount+' quality gate cases'}
            </button>
            <span className="text-xs text-slate-500">Read-only: checks official pages without importing, changing, or requeuing coach records.</span>
            {diagnosing&&<button type="button" className="btn" onClick={()=>{diagnoseStop.current=true;}}>Stop inspection</button>}
          </div>
          {(diagnosing||diagnostics.length>0)&&<p className="mt-2 text-xs font-semibold text-slate-600" role="status">
            {diagnosing?'Inspecting':'Inspected'} {diagnostics.length} of {diagnosticTotal||qualityCount} schools.
            {diagnostics.length>0&&' '+activeQuality.length+' still in quality-gate review · '+hiddenQuality+' no longer in quality-gate review.'}
          </p>}
          {diagnostics.length>0&&readyQuality.length>0&&<div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-3 py-3">
            <div className="flex-1 text-sm text-green-950">
              <strong>{readyQuality.length} school{readyQuality.length===1?'':'s'} ready for your official-source review.</strong>
              <span className="ml-1">The preview found coaching candidates, but nothing is approved or imported until you confirm the source.</span>
            </div>
            <button type="button" className="btn btn-red" disabled={running||busy||diagnosing||verifySaving}
              onClick={()=>reviewQualitySource(readyQuality[0])}>
              Review first source <ArrowRight size={15}/>
            </button>
          </div>}
          {diagnosticError&&<p className="mt-2 text-sm text-red-700" role="alert">{diagnosticError}</p>}
        </div>}
        {running&&<div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm font-semibold" role="status">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-red-600"/> Running cleanup: {runStats.processed} processed, {runStats.imported} imported, {runStats.review} review, {runStats.blocked} blocked.
        </div>}
        {message&&!running&&<div className="mt-4 flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-sm" role="status"><CheckCircle2 size={16} className="mt-0.5 shrink-0"/>{message}</div>}
        {error&&<div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert"><AlertCircle size={16} className="mt-0.5 shrink-0"/>{error}</div>}
      </div>
      {hostCases.length>0&&<div className="border-b border-blue-200 bg-blue-50 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-black text-slate-950">{hostCases.length} official coaching source{hostCases.length===1?'':'s'} saved · athletics domain approval needed</h3>
            <p className="mt-1 text-sm text-slate-700">Your source verification is saved. RLTNL checks for an independent link from the school's university website, then asks you to approve that athletics domain once. No repeat verification or automatic coach approval.</p>
          </div>
          <button type="button" className="btn btn-red" disabled={hostChecking||hostApproving||verifySaving}
            onClick={()=>openVerify(hostCases[0])}>Review first athletics domain <ArrowRight size={15}/></button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">{hostCases.map(s=>
          <button key={s.college_id} type="button" disabled={hostChecking||hostApproving||verifySaving}
            onClick={()=>openVerify(s)}
            className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-bold text-slate-900 hover:border-red-400">
            {s.name} · {s.verification?.source_url?.split('/')[2]||'Unrecognized athletics host'}
          </button>)}</div>
      </div>}
      {manualCases.length>0&&<div className="border-b border-amber-200 bg-amber-50 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-black text-amber-950">{manualCases.length} official source{manualCases.length===1?'':'s'} verified · staff import still needs review</h3>
            <p className="mt-1 text-sm text-amber-900">Your confirmation was saved. The parser could not safely extract the coaches. Review your saved staff details once and import them manually, with identity and contact safeguards.</p>
          </div>
          <button type="button" className="btn btn-red" onClick={()=>openVerify(manualCases[0])} disabled={manualSaving||verifySaving}>
            Review saved staff <ArrowRight size={15}/>
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">{manualCases.map(s=>
          <button key={s.college_id} type="button" onClick={()=>openVerify(s)}
            disabled={manualSaving||verifySaving}
            className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-bold text-amber-950 hover:border-red-500">
            {s.name} · {s.verification?.recheck_message||'Parser review required'}
          </button>)}</div>
      </div>}
      {diagnostics.length>0&&activeQuality.length===0&&!diagnosing&&<div className="border-b p-5 sm:p-6">
        <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-950" role="status">
          <CheckCircle2 size={19} className="mt-0.5 shrink-0"/>
          <div><strong>No inspected quality-gate cases remain in review.</strong>
            <p className="mt-1">{hiddenQuality} historical inspection result{hiddenQuality===1?' is':'s are'} hidden.
              Imported and blocked outcomes remain in the pipeline totals above; other unresolved issues are in Schools requiring attention below.</p>
          </div>
        </div>
      </div>}
      {activeQuality.length>0&&<div className="border-b p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h3 className="font-black">Quality gate inspection report · {activeQuality.length} open</h3>
            <p className="mt-1 text-xs text-slate-500">Only current quality-gate reviews are shown. Imported, blocked, or reclassified schools disappear automatically after status refresh. Parser previews are not imported coaches.</p>
          </div>
          <button type="button" className="btn" onClick={()=>void navigator.clipboard.writeText(
            activeQuality.map(x=>[x.name,x.status,x.issue,x.source_url||'',x.coaches.map(c=>c.name+' ('+c.title+')').join('; ')].join(' | ')).join('\n')
          )}>Copy open cases</button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-700">
          <span className="rounded-lg bg-green-50 px-3 py-2 text-green-800">{readyQuality.length} ready for source verification</span>
          {manualQuality.length>0&&<span className="rounded-lg bg-blue-50 px-3 py-2 text-blue-900">{manualQuality.length} verified source · manual import</span>}
          <span className="rounded-lg bg-amber-50 px-3 py-2 text-amber-900">{investigatedQuality} need investigation</span>
          <span className="text-slate-500">Reviewable schools first. No coach is imported by inspection.</span>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
          {orderedQuality.map(x=>{
            const school=cleanup?.exceptions.find(s=>s.college_id===x.college_id&&s.status==='review');
            const ready=readyQuality.some(s=>s.college_id===x.college_id);
            const savedManual=school?.verification?.outcome==='verified'&&school?.verification?.recheck_status==='needs_review';
            const liveSource=school?.verification?.source_url||school?.staff_navigation_url||school?.staff_url||x.source_url;
            return <article key={x.college_id} className="flex min-w-0 flex-col rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h4 className="font-black text-slate-950">{x.name}</h4>
                <span className={'rounded-md px-2 py-1 text-[11px] font-bold '+(ready?'bg-green-50 text-green-800':'bg-amber-50 text-amber-900')}>
                  {savedManual?'Source verified · staff import needed':ready?'Ready to verify':'Needs investigation'}
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-600">{savedManual
                ?school?.verification?.recheck_message||'Automated staff import stopped for review'
                :x.issue+' · '+x.head_count+' head coach candidate'+(x.head_count===1?'':'s')}</p>
              {x.coaches.length>0?<div className="mt-3 space-y-1.5 text-sm text-slate-800">
                {x.coaches.map((c,i)=><div key={i}><span className="font-semibold">{c.name}</span> <span className="text-slate-500">· {c.title}</span></div>)}
              </div>:<p className="mt-3 text-sm text-slate-500">No coach candidates. Find a current official coaching page and enter its URL in verification.</p>}
              <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 pt-4 text-xs">
                {liveSource?.startsWith('https://')&&
                  <a href={liveSource} target="_blank" rel="noopener noreferrer" className="font-bold text-blue-700 underline">
                    Open official page <ExternalLink size={12} className="inline"/>
                  </a>}
                <a href={'https://www.google.com/search?q='+encodeURIComponent(x.name+' softball coaches official athletics')}
                  target="_blank" rel="noopener noreferrer" className="font-bold text-blue-700 underline">
                  Find current staff <ExternalLink size={12} className="inline"/>
                </a>
              </div>
              {school&&<button type="button" className={'btn mt-3 w-full justify-center '+(ready?'btn-red':'')}
                disabled={running||busy||diagnosing||verifySaving}
                onClick={()=>reviewQualitySource(x)}>
                <ShieldCheck size={15}/>{savedManual?'Review saved coaches & import':ready?'Review & verify source':'Update / verify official source'} <ArrowRight size={14}/>
              </button>}
            </article>;
          })}
        </div>
      </div>}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3">
        <div id="college-staff-attention"><h3 className="font-black">Schools requiring attention</h3>
          <p className="mt-1 text-xs text-slate-500">Verify the official source beside each school. Source confirmation never approves coach contact details.</p>
          {filter==='review'&&group!=='all'&&<p className="mt-1 text-xs font-semibold text-blue-800">
            Showing {exceptions.length} {groups.find(x=>x[0]===group)?.[1]?.toLowerCase()} cases from {reviewCount} review schools.
            <button type="button" className="ml-2 underline" onClick={()=>{setGroup('all');setExpanded(false);}}>Show all review issues</button>
          </p>}
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
                  <ShieldCheck size={14}/>{x.verification?.recheck_status==='host_review'?'Approve athletics host':x.verification?'Edit verification':'Verify'}
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
              {(x.verification?.source_url||x.staff_navigation_url||x.staff_url)?.startsWith('https://')?
                <a className="inline-flex items-center gap-1 font-semibold text-slate-700 underline hover:text-red-700"
                  href={x.verification?.source_url||x.staff_navigation_url||x.staff_url||'#'} target="_blank" rel="noopener noreferrer">{x.verification?.recheck_status==='host_review'?'Saved proposed source':'Official source'} <ExternalLink size={13}/></a>:
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
      onMouseDown={e=>{if(e.target===e.currentTarget&&!verifySaving&&!manualSaving&&!hostChecking&&!hostApproving)setVerifySchool(null);}}>
      <section role="dialog" aria-modal="true" aria-labelledby="verify-title"
        className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div><div className="rr-eyebrow">OFFICIAL SOURCE VERIFICATION</div>
            <h2 id="verify-title" className="mt-1 text-xl font-black text-slate-950">{verifySchool.name}</h2>
            <p className="mt-1 text-xs text-slate-500">Confirm the source. If automated parsing fails, review the staff manually without repeating verification.</p>
          </div>
          <button type="button" disabled={verifySaving||manualSaving||hostChecking||hostApproving} aria-label="Close verification"
            onClick={()=>setVerifySchool(null)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-50">
            <X size={20}/></button>
        </div>
        <form onSubmit={e=>{if(manualMode||(needsHostApproval&&!hostEditing)){e.preventDefault();return;}void saveVerification(e);}} className="max-h-[min(75vh,720px)] space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
          {activeVerification?.outcome==='verified'&&<div className={'rounded-xl border p-3 text-sm '+
            (activeVerification.recheck_status==='passed'?'border-green-200 bg-green-50 text-green-900':
              'border-amber-200 bg-amber-50 text-amber-950')}>
            <strong>Official source verification saved.</strong>
            <p className="mt-1">{activeVerification.recheck_status==='needs_review'
              ?'The automatic importer stopped; it did not reject your research. You can review and import the staff manually below.'
              :activeVerification.recheck_status==='passed'?'Coaching staff imported.'
              :'Import status: '+activeVerification.recheck_status.replaceAll('_',' ')}</p>
            {activeVerification.recheck_message&&<p className="mt-1 text-xs">{activeVerification.recheck_message}</p>}
          </div>}
          {needsHostApproval&&!hostEditing&&<section className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm">
            <h3 className="font-black text-slate-950">Approve this school's official athletics domain</h3>
            <p className="mt-1 text-slate-700">You already verified the coaching page. RLTNL now needs independent evidence that this athletics domain belongs to {verifySchool.name}. Your saved verification will not be changed.</p>
            <div className="mt-3 rounded-lg bg-white p-3">
              <p className="text-xs font-semibold text-slate-500">Saved coaching page</p>
              <a className="mt-1 block break-all font-bold text-blue-700 underline" href={activeVerification?.source_url||'#'}
                target="_blank" rel="noopener noreferrer">{activeVerification?.source_url} <ExternalLink size={12} className="inline"/></a>
            </div>
            <div className="mt-3">
              <label htmlFor="host-evidence-url" className="text-xs font-bold text-slate-900">Official university page linking to this athletics site (optional)</label>
              <input id="host-evidence-url" type="url" className="input mt-1 w-full" value={hostEvidenceUrl}
                placeholder="Leave blank to check the university homepage automatically"
                disabled={hostChecking||hostApproving}
                onChange={e=>{setHostEvidenceUrl(e.target.value);setHostEvidence(null);setHostConfirmed(false);setHostError('');}}/>
              <p className="mt-1 text-xs text-slate-600">Must be on the school's existing university website, not the proposed athletics domain. RLTNL requires a direct link on that university page.</p>
            </div>
            <button type="button" className="btn mt-3" disabled={hostChecking||hostApproving}
              onClick={()=>void checkHostEvidence()}>
              <ShieldCheck size={15}/>{hostChecking?'Checking official university website…':'Check official university link'}
            </button>
            {hostEvidence&&<div className={'mt-3 rounded-lg border p-3 '+(hostEvidence.verified
              ?'border-green-200 bg-green-50 text-green-950':'border-amber-200 bg-amber-50 text-amber-950')} role="status">
              <p className="font-bold">{hostEvidence.verified?'Independent official link found':'Official link not yet confirmed'}</p>
              <p className="mt-1 text-xs">{hostEvidence.message}</p>
              {!hostEvidence.verified&&<p className="mt-2 text-xs">RLTNL has not approved this host. You can open <a href={hostEvidence.school_website}
                target="_blank" rel="noopener noreferrer" className="font-bold underline">the official university website</a>,
                find its Athletics link, and paste the university-side URL above. Official university Athletics-page redirects are also accepted.</p>}
              {hostEvidence.verified&&hostEvidence.evidence_url&&hostEvidence.matched_link&&
                <div className="mt-2 space-y-1 break-all text-xs">
                  <p>University evidence: <a href={hostEvidence.evidence_url} target="_blank" rel="noopener noreferrer" className="font-bold underline">{hostEvidence.evidence_url}</a></p>
                  <p>Linked athletics site: <a href={hostEvidence.matched_link} target="_blank" rel="noopener noreferrer" className="font-bold underline">{hostEvidence.matched_link}</a></p>
                </div>}
            </div>}
            {hostEvidence?.verified&&<label className="mt-3 flex items-start gap-2 rounded-lg border border-blue-200 bg-white p-3 text-sm">
              <input type="checkbox" className="mt-1" checked={hostConfirmed} disabled={hostApproving}
                onChange={e=>setHostConfirmed(e.target.checked)}/>
              <span>I approve <strong>{hostEvidence.athletics_host}</strong> as an official athletics host for <strong>{verifySchool.name}</strong> based on the independent university link. This approves the domain, not any coaching identities or contacts.</span>
            </label>}
            {hostError&&<p className="mt-3 text-sm font-semibold text-red-700" role="alert">{hostError}</p>}
            <button type="button" className="mt-3 text-xs font-semibold text-slate-600 underline"
              disabled={hostApproving||hostChecking} onClick={()=>{setHostEditing(true);setHostEvidence(null);setHostConfirmed(false);}}>
              The saved coaching URL is wrong? Edit source instead
            </button>
          </section>}
          {(!needsHostApproval||hostEditing)&&<>
          <div>
            <label htmlFor="verify-url" className="mb-1 block text-sm font-bold">Official softball coaching page URL</label>
            <input id="verify-url" type="url" autoFocus required={verifyOutcome==='verified'} value={verifyUrl}
              onChange={e=>{setVerifyUrl(e.target.value);setVerifyResult('');}}
              placeholder="https://schoolathletics.edu/sports/softball/coaches" className="input w-full" disabled={verifySaving||verifySaved}/>
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
          {diagnostics.some(x=>x.college_id===verifySchool.college_id)&&
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
              <div className="font-bold text-slate-900">Read-only coaching preview · not yet verified</div>
              <p className="mt-1 text-slate-600">{diagnostics.find(x=>x.college_id===verifySchool.college_id)?.issue}</p>
              <p className="mt-1 text-slate-600">Check the official page yourself. These names were found by the parser, not approved as canonical records.</p>
              <div className="mt-2 space-y-1 text-slate-800">
                {diagnostics.find(x=>x.college_id===verifySchool.college_id)?.coaches.map((c,i)=>
                  <div key={i}>{c.name} · {c.title}</div>)}
              </div>
            </div>}
          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-bold">What did you find?</legend>
            {[
              ['verified','Correct official coaching page'],
              ['incorrect_source','Incorrect or outdated source'],
              ['unable_to_verify','Cannot access or verify'],
              ['inactive_program','Softball program inactive']
            ].map(([value,label])=><label key={value} className={'flex cursor-pointer items-center gap-2.5 rounded-xl border p-3 text-sm '+(verifyOutcome===value?'border-slate-900 bg-slate-50':'border-slate-200')}>
              <input type="radio" name="verification-result" value={value} checked={verifyOutcome===value}
                onChange={()=>{setVerifyOutcome(value);setVerifyConfirmed(false);setVerifyResult('');}} disabled={verifySaving||verifySaved}/>
              <span className="font-medium">{label}</span>
            </label>)}
          </fieldset>
          {verifyOutcome==='verified'&&<div>
            <label htmlFor="verify-head" className="mb-1 block text-sm font-bold">Current head coach <span className="font-normal text-slate-500">(optional)</span></label>
            <input id="verify-head" className="input w-full" value={verifyHead} maxLength={120}
              onChange={e=>setVerifyHead(e.target.value)} placeholder="First and last name" disabled={verifySaving||verifySaved}/>
            <p className="mt-1 text-xs text-slate-500">A suggested name comes from the unverified preview. Check it on the official page; the importer must match it or stop for review.</p>
          </div>}
          <div>
            <label htmlFor="verify-notes" className="mb-1 block text-sm font-bold">Verification notes <span className="font-normal text-slate-500">(optional)</span></label>
            <textarea id="verify-notes" rows={2} maxLength={1000} value={verifyNotes} disabled={verifySaving||verifySaved}
              onChange={e=>setVerifyNotes(e.target.value)} placeholder="For example: Head coach shown in the 2026 staff listing" className="input w-full resize-y"/>
          </div>
          {(verifyOutcome==='verified'||verifyOutcome==='inactive_program')&&<label className="flex items-start gap-2.5 rounded-xl bg-slate-50 p-3 text-sm">
            <input id="verify-confirmation" type="checkbox" checked={verifyConfirmed}
              onChange={e=>{setVerifyConfirmed(e.target.checked);if(e.target.checked)setVerifyError('');}}
              disabled={verifySaving||verifySaved} aria-invalid={Boolean(verifyError&&!verifyConfirmed)}
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

          </>}
          {canManualImport&&<section className="rounded-xl border border-amber-300 bg-amber-50 p-3 sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><h3 className="font-black text-amber-950">Finish this school: verified staff</h3>
                <p className="mt-1 text-xs text-amber-900">The official source was saved. The parser found unreliable extra rows or no coaches. Your manual review can resolve this exception.</p></div>
              {!manualMode&&<button type="button" className="btn btn-red"
                onClick={()=>{setManualMode(true);setManualError('');}}>
                Review coaches <ArrowRight size={14}/></button>}
            </div>
            {manualMode&&<>
              <p className="mt-3 text-xs text-amber-950">Names and emails found in your saved notes are prefilled for convenience, <strong>not automatically approved</strong>. Check each field on the official page, correct it, and remove any non-coaches.</p>
              <div className="mt-3 space-y-3">{manualCoaches.map((c,i)=>
                <div key={i} className="rounded-lg border border-amber-200 bg-white p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-800">Coach {i+1}</span>
                    <button type="button" className="text-xs font-bold text-red-700 underline"
                      disabled={manualSaving}
                      onClick={()=>{setManualCoaches(rows=>rows.filter((_,j)=>j!==i));setManualConfirmed(false);}}>
                      Remove
                    </button>
                  </div>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div><label className="text-xs font-semibold text-slate-700">Full name</label>
                      <input className="input w-full" value={c.name} maxLength={120} disabled={manualSaving}
                        onChange={e=>{setManualCoaches(rows=>rows.map((r,j)=>j===i?{...r,name:e.target.value}:r));setManualConfirmed(false);}}
                        placeholder="First Last"/></div>
                    <div><label className="text-xs font-semibold text-slate-700">Coaching role</label>
                      <select className="input w-full" value={c.role} disabled={manualSaving}
                        onChange={e=>{setManualCoaches(rows=>rows.map((r,j)=>j===i?{...r,role:e.target.value}:r));setManualConfirmed(false);}}>
                        {manualRoleOptions.map(([value,label])=><option key={value} value={value}>{label}</option>)}
                      </select></div>
                    <div><label className="text-xs font-semibold text-slate-700">Official title</label>
                      <input className="input w-full" value={c.title} maxLength={120} disabled={manualSaving}
                        onChange={e=>{setManualCoaches(rows=>rows.map((r,j)=>j===i?{...r,title:e.target.value}:r));setManualConfirmed(false);}}
                        placeholder="Assistant Softball Coach"/></div>
                    <div><label className="text-xs font-semibold text-slate-700">Official email (optional)</label>
                      <input className="input w-full" type="email" value={c.email} disabled={manualSaving}
                        onChange={e=>{setManualCoaches(rows=>rows.map((r,j)=>j===i?{...r,email:e.target.value}:r));setManualConfirmed(false);}}
                        placeholder="coach@university.edu"/></div>
                  </div>
                </div>)}</div>
              {manualCoaches.length<8&&<button type="button" className="btn mt-3"
                disabled={manualSaving} onClick={()=>{setManualCoaches(rows=>[...rows,
                  {name:'',title:'Assistant Softball Coach',role:'assistant_coach',email:''}]);setManualConfirmed(false);}}>
                Add another coach
              </button>}
              <label className="mt-3 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-white p-3 text-sm">
                <input type="checkbox" checked={manualConfirmed} disabled={manualSaving}
                  onChange={e=>setManualConfirmed(e.target.checked)} className="mt-1"/>
                <span>I checked <strong>each coach's name, coaching role, and any email entered</strong> against the official school page. Import these structured records and preserve any existing verified contacts.</span>
              </label>
              {manualError&&<p className="mt-3 text-sm font-semibold text-red-700" role="alert">{manualError}</p>}
            </>}
          </section>}
          {verifyError&&<div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{verifyError}</div>}
          {verifyResult&&<div role="status" className={'rounded-xl border p-3 text-sm '+
            (verifyResultKind==='success'?'border-green-200 bg-green-50 text-green-900':
              verifyResultKind==='review'?'border-amber-200 bg-amber-50 text-amber-900':
              'border-slate-200 bg-slate-50 text-slate-800')}>{verifyResult}</div>}
          <div className="sticky bottom-0 z-10 -mx-5 -mb-5 flex flex-wrap justify-end gap-2 border-t bg-white px-5 py-4 shadow-[0_-6px_12px_rgba(15,23,42,0.05)] sm:-mx-6 sm:px-6">
            {needsHostApproval&&!hostEditing&&!verifySaved?
              <>
                <p className="mr-auto max-w-64 self-center text-xs font-semibold text-amber-800" role="status">
                  {hostChecking?'Checking the official university link…':
                    !hostEvidence?.verified?'Approval locked: an official university link must be confirmed above.':
                    !hostConfirmed?'Check the approval confirmation above to unlock the button.':
                    'Independent evidence confirmed. Ready for your approval.'}
                </p>
                <button type="button" className="btn" disabled={hostChecking||hostApproving}
                  onClick={()=>setVerifySchool(null)}>Close</button>
                {hostEvidence?.verified&&hostConfirmed&&<button type="button" className="btn btn-red"
                  disabled={hostChecking||hostApproving}
                  onClick={()=>void approveOfficialHost()}>
                  <ShieldCheck size={16}/>{hostApproving?'Approving & rechecking…':'Approve official athletics host'}
                </button>}
              </>:
            manualMode&&canManualImport?
              <>
                <button type="button" className="btn" disabled={manualSaving}
                  onClick={()=>{setManualMode(false);setManualError('');}}>Back</button>
                <button type="button" className="btn btn-red" disabled={manualSaving||!manualConfirmed||manualCoaches.length===0}
                  onClick={()=>void importManuallyVerifiedStaff()}>
                  <ShieldCheck size={16}/>{manualSaving?'Importing verified coaches…':'Import '+manualCoaches.length+' verified coaches'}
                </button>
              </>:
            verifySaved?
              <>
                {nextQuality&&
                  <button type="button" className="btn" onClick={()=>reviewQualitySource(nextQuality)}>
                    {nextQuality.status==='candidate'?'Verify next school':'Investigate next school'} <ArrowRight size={15}/>
                  </button>}
                <button type="button" className={verifyResultKind==='success'?'btn btn-red':'btn'}
                  onClick={()=>setVerifySchool(null)}>
                  {verifyResultKind==='success'&&<ShieldCheck size={16}/>}
                  {verifyResultKind==='success'?'Done':'Close'}
                </button>
              </>:
              <>
                <button type="button" className="btn" disabled={verifySaving} onClick={()=>setVerifySchool(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-red" disabled={verifySaving}>
                  <ShieldCheck size={16}/>{verifySaving?'Saving / rechecking…':'Save verification'}
                </button>
              </>}
          </div>
        </form>
      </section>
    </div>}
</AppShell>;
}
