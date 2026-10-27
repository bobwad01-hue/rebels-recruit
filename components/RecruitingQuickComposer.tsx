'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import Link from 'next/link';
import {CheckCircle2,ChevronDown,Mail,Search,Send,Sparkles,X} from 'lucide-react';
import {createClient} from '@/lib/supabase-browser';
import {EMAIL_STARTERS,mergeEmailStarters,starterById,type EmailStarter} from '@/lib/recruiting-email-playbook';
import {buildRecruitingEmailSubject,hasUnresolvedRecruitingSubjectFields} from '@/lib/recruiting-email-format';
import EmailVideoPicker from '@/components/EmailVideoPicker';
import RichEmailEditor,{type EmailAttachment,type RichEmailEditorHandle} from '@/components/RichEmailEditor';
import EmailSignatureSettings from '@/components/EmailSignatureSettings';
import EmailSubjectSettings from '@/components/EmailSubjectSettings';

type School={id:string;name:string;city?:string|null;state?:string|null};
type Coach={id:string;first_name:string|null;last_name:string|null;email:string|null;college_id:string;contact_verification_needed?:boolean|null;lifecycle_status?:string|null;colleges?:{name:string}|null};
type Choice={kind:'school'|'coach'|'email';label:string;school?:School;coach?:Coach;email?:string};
const validEmail=(value:string)=>/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value.trim())&&value.trim().length<=254;
const safeSearch=(value:string)=>value.replace(/[%(),]/g,' ').trim().slice(0,90);
const nameOf=(coach:Coach)=>[coach.first_name,coach.last_name].filter(Boolean).join(' ')||'Coach';
const draftKey=(userId:string,schoolId?:string)=>'rltnl:quick-email-draft:'+userId+(schoolId?':manual:'+schoolId:'');
function writeMyOwnSubject(profile:any,college=''){
 const a=profile?.athlete||{},p=profile?.profile||{},sig=profile?.signature||{};
 return buildRecruitingEmailSubject('Introduction',{
  name:p.full_name||a.full_name||'',grad:a.class_year||a.grad_year||'',
  positions:Array.isArray(a.positions)?a.positions.join('/'):a.position||'',
  throwBat:sig.throwBat||a.throw_bat||'',gpa:a.gpa??'',college,
  jersey:a.jersey_number||'',
 },sig);
}

type Props={readOnly?:boolean;initialSchool?:School;manualOnly?:boolean;onSent?:()=>void;onBusyChange?:(busy:boolean)=>void};
export default function RecruitingQuickComposer({readOnly=false,initialSchool,manualOnly=false,onSent,onBusyChange}:Props){
 const draftSchoolId=manualOnly?initialSchool?.id:undefined;
 const emailEditorRef=useRef<RichEmailEditorHandle>(null);
 const [userId,setUserId]=useState('');
 const [query,setQuery]=useState('');
 const [choice,setChoice]=useState<Choice|null>(null);
 const [schoolResults,setSchoolResults]=useState<School[]>([]);
 const [coachResults,setCoachResults]=useState<Coach[]>([]);
 const [schoolCoaches,setSchoolCoaches]=useState<Coach[]>([]);
 const [ccOptions,setCcOptions]=useState<Coach[]>([]);
 const [ccCoachIds,setCcCoachIds]=useState<string[]>([]);
 const [ccLoading,setCcLoading]=useState(false);
 const [searching,setSearching]=useState(false);
 const [emailAddress,setEmailAddress]=useState('');
 const [recipientName,setRecipientName]=useState('');
 const [templates,setTemplates]=useState<EmailStarter[]>(()=>mergeEmailStarters([]));
 const [templateId,setTemplateId]=useState('custom');
 const [personalTemplates,setPersonalTemplates]=useState<{id:string;name:string;subject:string;body:string}[]>([]);
 const [templateName,setTemplateName]=useState('');
 const [templateNotice,setTemplateNotice]=useState('');
 const [templateBusy,setTemplateBusy]=useState(false);
 const [opening,setOpening]=useState(0);
 const [profile,setProfile]=useState<any>(null);
 const [subject,setSubject]=useState('');
 const [body,setBody]=useState('');
 const [bodyHtml,setBodyHtml]=useState('');
 const [attachments,setAttachments]=useState<EmailAttachment[]>([]);
 const [connected,setConnected]=useState<boolean|null>(null);
 const [loading,setLoading]=useState(true);
 const [draftReady,setDraftReady]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [showResults,setShowResults]=useState(false);
 const [showSchoolCoaches,setShowSchoolCoaches]=useState(false);
 const selectedSchool=manualOnly?(initialSchool||null):(choice?.school||null);
 const selectedCoach=manualOnly?null:(choice?.coach||null);
 const currentTemplate=useMemo(()=>starterById(templateId,templates),[templateId,templates]);

 useEffect(()=>{
  let alive=true;
  const c=createClient();
  (async()=>{
   const {data:{user}}=await c.auth.getUser();
   if(!alive)return;
   if(!user){setError('Sign in to compose a recruiting email.');setLoading(false);return}
   const [roles,connection,templateRows,profileResponse]=await Promise.all([
    c.from('user_roles').select('role').eq('user_id',user.id),
    c.from('google_workspace_connections').select('gmail_connected').eq('user_id',user.id).maybeSingle(),
    c.from('recruiting_email_templates').select('id,label,purpose,guidance,ask,subject_template,openings,full_signature,requires_school_reason,is_active,sort_order').order('sort_order'),
    fetch('/api/profile/email-signature',{cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>null)
   ]);
   if(!alive)return;
   if(!(roles.data||[]).some((r:any)=>r.role==='athlete'))setError('Compose Email is available to athletes.');
   setUserId(user.id);
   const {data:ownTemplates}=await c.from('athlete_email_templates').select('id,name,subject,body').eq('athlete_user_id',user.id).order('created_at',{ascending:false}).limit(30);
   if(!alive)return;
   setPersonalTemplates(ownTemplates||[]);
   setConnected(!connection.error&&connection.data?.gmail_connected===true);
   if(!templateRows.error)setTemplates(mergeEmailStarters((templateRows.data||[]) as any[]));
   setProfile(profileResponse);
   let restoreBlankCustom=true;
   try{
    const saved=window.localStorage.getItem(draftKey(user.id,draftSchoolId));
    if(saved){
     const d=JSON.parse(saved);
     restoreBlankCustom=String(d.templateId||'custom')==='custom'&&!String(d.subject||'').trim()&&!String(d.body||'').trim()&&!String(d.bodyHtml||'').trim();
     setSubject(String(d.subject||'').slice(0,200));
     setBody(String(d.body||'').slice(0,20000));
     setBodyHtml(String(d.bodyHtml||'').slice(0,100000));
     setTemplateId(String(d.templateId||'custom'));
     setOpening(Number(d.opening)||0);
     if(!manualOnly&&Array.isArray(d.ccCoachIds))setCcCoachIds(d.ccCoachIds.map(String).slice(0,10));
     if(d.choice&&['school','coach','email'].includes(d.choice.kind)){
      setChoice(d.choice);
      setQuery(String(d.choice.label||''));
      setEmailAddress(String(d.emailAddress||''));
      setRecipientName(String(d.recipientName||''));
     }
    }
   }catch{/* Private browsing can disable draft storage. */}
   if(restoreBlankCustom)setSubject(writeMyOwnSubject(profileResponse,initialSchool?.name||''));
   if(manualOnly&&initialSchool){setChoice({kind:'school',label:initialSchool.name,school:initialSchool});setQuery(initialSchool.name)}
   setDraftReady(true);
   setLoading(false);
  })();
  return()=>{alive=false};
 },[]);

 useEffect(()=>{
  if(!draftReady||!userId)return;
  try{window.localStorage.setItem(draftKey(userId,draftSchoolId),JSON.stringify({
   choice,subject,body,bodyHtml,templateId,opening,emailAddress,recipientName,ccCoachIds
  }))}catch{/* Draft persistence is best effort. */}
 },[draftReady,userId,choice,subject,body,bodyHtml,templateId,opening,emailAddress,recipientName,ccCoachIds]);

 useEffect(()=>{
  if(choice||!showResults||safeSearch(query).length<2){setSchoolResults([]);setCoachResults([]);setSearching(false);return}
  let active=true;
  const timer=window.setTimeout(async()=>{
   setSearching(true);
   const c=createClient(),term=safeSearch(query);
   const tokens=term.split(/\s+/).filter(Boolean);
   const coachQuery=c.from('college_coaches').select('id,first_name,last_name,email,college_id,contact_verification_needed,lifecycle_status,colleges(name)');
   const coachSearch=tokens.length>1
    ? coachQuery.ilike('first_name','%'+tokens[0]+'%').ilike('last_name','%'+tokens.slice(1).join(' ')+'%').limit(12)
    : coachQuery.or('first_name.ilike.%'+term+'%,last_name.ilike.%'+term+'%,email.ilike.%'+term+'%').limit(12);
   const [schools,coaches]=await Promise.all([
    c.from('colleges').select('id,name,city,state').ilike('name','%'+term+'%').limit(8),
    coachSearch
   ]);
   if(!active)return;
   setSchoolResults((schools.data||[]) as School[]);
   setCoachResults((coaches.data||[]).map((co:any)=>({...co,colleges:Array.isArray(co.colleges)?co.colleges[0]:co.colleges})) as Coach[]);
   setSearching(false);
  },250);
  return()=>{active=false;window.clearTimeout(timer)};
 },[query,choice,showResults]);

 useEffect(()=>{
  if(!selectedSchool||selectedCoach){setSchoolCoaches([]);return}
  let active=true;
  const c=createClient();
  void c.from('college_coaches').select('id,first_name,last_name,email,college_id,contact_verification_needed,lifecycle_status')
   .eq('college_id',selectedSchool.id).order('last_name').limit(120).then(({data})=>{
    if(active)setSchoolCoaches((data||[]).filter((co:any)=>co.lifecycle_status==='active') as Coach[]);
   });
  return()=>{active=false};
 },[selectedSchool?.id,selectedCoach?.id]);

 useEffect(()=>{
  if(!selectedCoach||!selectedSchool||!userId){setCcOptions([]);setCcLoading(false);return}
  let active=true;setCcLoading(true);
  void (async()=>{
   const c=createClient();
   const {data:coaches,error:coachError}=await c.from('college_coaches').select('id,first_name,last_name,email,college_id,contact_verification_needed,lifecycle_status').eq('college_id',selectedSchool.id).eq('lifecycle_status','active').limit(100);
   const eligible=((coaches||[]) as Coach[]).filter(co=>co.id!==selectedCoach.id&&!!co.email&&!co.contact_verification_needed);
   if(!active)return;
   if(coachError||!eligible.length){setCcOptions([]);setCcLoading(false);return}
   const {data:linked,error:linkError}=await c.from('athlete_coaches').select('coach_id').eq('athlete_user_id',userId).in('coach_id',eligible.map(co=>co.id)).is('archived_at',null);
   if(!active)return;
   const ids=new Set((linked||[]).map((row:any)=>row.coach_id));
   setCcOptions(linkError?[]:eligible.filter(co=>ids.has(co.id)));setCcLoading(false);
  })();
  return()=>{active=false};
 },[selectedCoach?.id,selectedSchool?.id,userId]);
 function choose(next:Choice){
  setCcCoachIds([]);
  setChoice(next);
  setQuery(next.label);
  setShowResults(false);
  setShowSchoolCoaches(next.kind==='school');
  setEmailAddress(next.kind==='email'?(next.email||''):(next.coach?.email||''));
  setRecipientName(next.coach?nameOf(next.coach):'');
  setError('');setNotice('');
 }
 function clearChoice(){
  setCcCoachIds([]);
  setChoice(null);setQuery('');setEmailAddress('');setRecipientName('');
  setSchoolCoaches([]);setShowSchoolCoaches(false);setShowResults(true);
 }
 function values(){
  const a=profile?.athlete||{},p=profile?.profile||{},s=profile?.signature||{};
  return {
   name:p.full_name||a.full_name||'',grad:a.class_year||a.grad_year||'',
   school:a.school_name||a.school||'',positions:Array.isArray(a.positions)?a.positions.join('/'):a.position||'',
   gpa:a.gpa||'',jersey:a.jersey_number||'',travelTeam:s.travelTeamName||a.travel_team||'',
   academic:Array.isArray(a.interested_majors)?a.interested_majors.join(' or '):a.academic_interest||'',
   college:selectedSchool?.name||'your program',mobile:p.phone||'',email:p.email||'',
   twitter:s.xTwitter||a.twitter||'',sports:s.sportsRecruitsUrl||a.sportsrecruits_url||'',
   travelCoach:s.travelTeamCoachName||'',travelCoachPhone:s.travelTeamCoachPhone||'',
   hsCity:s.highSchoolCity||'',hsState:s.highSchoolState||'',
   hsCoach:s.highSchoolCoachName||'',hsCoachPhone:s.highSchoolCoachPhone||'',
   throwBat:s.throwBat||a.throw_bat||'',ncaa:s.ncaaNumber||a.ncaa_number||''
  };
 }
 function fill(text:string,v:Record<string,unknown>){
  return text.replace(/{{(\w+)}}/g,(_,key)=>String(v[key]||'['+key+']'));
 }
 function signature(v:ReturnType<typeof values>){
  const settings=profile?.signature||{};
  if(settings.signatureMode==='none')return '';
  if(settings.signatureMode==='custom')return String(settings.customSignature||'');
  const lines:string[]=[];
  if(v.name)lines.push(v.name+' Profile Summary');
  if(v.mobile)lines.push('Mobile: '+v.mobile);
  if(v.email)lines.push('Email: '+v.email);
  if(v.grad)lines.push('Graduation Year: '+v.grad);
  if(v.sports)lines.push('SportsRecruits Profile: '+v.sports);
  if(v.travelTeam)lines.push('Travel Team: '+v.travelTeam);
  return lines.join('\n');
 }
 async function savePersonalTemplate(){
  if(!userId||!templateName.trim()||!subject.trim()||!body.trim()){setTemplateNotice('Add a template name, subject and message first.');return}
  if(personalTemplates.length>=30){setTemplateNotice('You have 30 templates. Remove one before saving another.');return}
  setTemplateBusy(true);setTemplateNotice('');
  const {data,error}=await createClient().from('athlete_email_templates').insert({athlete_user_id:userId,name:templateName.trim().slice(0,80),subject:subject.slice(0,200),body:body.slice(0,30000)}).select('id,name,subject,body').single();
  setTemplateBusy(false);
  if(error||!data){setTemplateNotice('Unable to save template. Please try again.');return}
  setPersonalTemplates(current=>[data,...current]);setTemplateName('');setTemplateNotice('Saved privately. Available on your other devices.');
 }
 function loadPersonalTemplate(id:string){
  const item=personalTemplates.find(t=>t.id===id);
  if(!item||!window.confirm('Replace your current draft with this saved message?'))return;
  setTemplateId('custom');setSubject(item.subject);setBody(item.body);setBodyHtml('');setAttachments([]);
  setTemplateNotice('Template loaded. Personalize it for this coach before sending.');
 }
 async function removePersonalTemplate(id:string){
  if(!window.confirm('Delete this template? Your current draft will stay unchanged.'))return;
  const {error}=await createClient().from('athlete_email_templates').delete().eq('id',id).eq('athlete_user_id',userId);
  if(error){setTemplateNotice('Unable to delete template.');return}
  setPersonalTemplates(current=>current.filter(t=>t.id!==id));setTemplateNotice('Template removed.');
 }
 function applyTemplate(id:string,index=0){
  setTemplateId(id);setOpening(index);setNotice('');
  setBodyHtml('');
  if(id==='custom'){setSubject(buildRecruitingEmailSubject('Introduction',values(),profile?.signature));setBody('');return}
  const template=starterById(id,templates),v=values();
  const topic=template.subjectTemplate?fill(template.subjectTemplate,v).split('|')[0].trim():template.label;
  setSubject(buildRecruitingEmailSubject(topic,v,profile?.signature));
  const coachLastName=selectedCoach?.last_name||'';
  const greeting=coachLastName?'Hello Coach '+coachLastName+',':'Hello Coach,';
  const openingText=fill(template.openings[index]?.text||template.openings[0]?.text||'',v);
  const ask=fill(template.ask||'',v),sig=signature(v);
  setBody([greeting,openingText,ask,sig].filter(Boolean).join('\n\n'));
 }
 async function send(e:React.FormEvent){
  e.preventDefault();
  if(busy||readOnly)return;
  setError('');setNotice('');
  const to=emailAddress.trim().toLowerCase();
  if(!validEmail(to)){setError('Select a coach or enter a valid recipient email address.');return}
  if(!subject.trim()||!body.trim()){setError('Enter a subject and message before sending.');return}
  if(hasUnresolvedRecruitingSubjectFields(subject)){
   setError('Replace [Subject] and any missing athlete details in the Subject field before sending.');return;
  }
  if(bodyHtml.length>100000){setError('This formatted email is too long.');return}
  if(templateId!=='custom'&&/\[[A-Z][A-Z0-9 ’'&/.,-]{2,}\]/.test(body)){
   setError('Replace the bracketed template prompts with your own details before sending.');return;
  }
  if(connected!==true){setError('Connect Gmail in Settings before sending an email.');return}
  if(ccLoading){setError('Wait for additional coach recipients to load.');return}
  if(selectedCoach?.contact_verification_needed){setError('This coach has contact details that require verification before outreach.');return}
  if(selectedCoach&&selectedCoach.lifecycle_status!=='active'){setError('This coach is not currently active.');return}
  setBusy(true);onBusyChange?.(true);
  try{
   const isCoach=!!selectedCoach&&!manualOnly;
   const allowedCc=ccCoachIds.filter(id=>ccOptions.some(co=>co.id===id));
   if(isCoach&&allowedCc.length!==ccCoachIds.length)throw new Error('Some CC recipients are no longer available. Please reselect them.');
   const response=await fetch(isCoach?'/api/google/gmail/send':'/api/google/gmail/manual-send',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify(isCoach?{
     coachId:selectedCoach.id,athleteUserId:userId,recipientEmail:to,ccCoachIds:allowedCc,
     subject:subject.trim(),body,bodyHtml,attachments,emailPurpose:templateId
    }:{
     collegeId:selectedSchool?.id||null,recipientEmail:to,recipientName,
     subject:subject.trim(),body,bodyHtml,attachments,emailPurpose:templateId
    })
   });
   const result=await response.json().catch(()=>({}));
   if(!response.ok||!result.messageId)throw new Error(result.error||'Gmail could not confirm the send.');
   setNotice(result.logged===false?'Email sent through Gmail, but recruiting activity could not be recorded.':'Email sent through Gmail and recorded in Recruiting Activity.');
   setSubject(writeMyOwnSubject(profile,selectedSchool?.name||''));setBody('');setBodyHtml('');setAttachments([]);setCcCoachIds([]);setTemplateId('custom');setOpening(0);
   try{window.localStorage.removeItem(draftKey(userId,draftSchoolId))}catch{}
   window.dispatchEvent(new Event('rltnl:coach-emails-updated'));
   window.dispatchEvent(new Event('rebels:data-changed'));
   onSent?.();
  }catch(err){setError(err instanceof Error?err.message:'Could not send email. Your draft is saved.')}
  finally{setBusy(false);onBusyChange?.(false)}
 }
 return <section className="card w-full min-w-0 p-4 sm:p-5" aria-label="Compose recruiting email">
  <div className="flex items-start gap-3">
   <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-700"><Mail size={20}/></div>
   <div className="min-w-0"><h2 className="text-lg font-black">Compose Email</h2>
    <p className="mt-1 text-sm text-slate-600">Start a recruiting conversation with any college coach. You do not need an existing Connection.</p></div>
  </div>
  {loading?<p className="mt-5 text-sm text-slate-600">Preparing your email composer…</p>:
  <form onSubmit={send} className="mt-5 space-y-4">
   <div>
    <label htmlFor="quick-email-to" className="block text-sm font-black">To</label>
    <p className="mt-1 text-xs text-slate-500">{manualOnly?"This school is selected. Enter the coach’s email address below.":"Search schools, coaches, or enter an email address."}</p>
    <div className="relative mt-2">
     <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"/>
     <input id="quick-email-to" className="input w-full !pl-10 !pr-10" value={query}
      placeholder="School, coach, or coach@college.edu"
      onFocus={()=>{if(!choice)setShowResults(true)}}
      onChange={e=>{setQuery(e.target.value);setChoice(null);setShowResults(true);setEmailAddress('');}}
      onKeyDown={e=>{if(e.key==='Enter'&&!choice&&validEmail(query)){e.preventDefault();choose({kind:'email',label:query.trim(),email:query.trim()})}}}
      autoComplete="off" disabled={busy||readOnly||manualOnly}/>
     {choice&&!manualOnly&&<button type="button" onClick={clearChoice} aria-label="Change recipient" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"><X size={17}/></button>}
    </div>
    {!choice&&showResults&&query.trim().length>=2&&
     <div className="mt-2 max-h-60 overflow-y-auto rounded-xl border bg-white shadow-sm" role="listbox" aria-label="Recipient search results">
      {validEmail(query)&&<button type="button" role="option" aria-selected={false} className="block w-full border-b px-3 py-3 text-left hover:bg-red-50"
       onClick={()=>choose({kind:'email',label:query.trim(),email:query.trim()})}>
       <span className="block text-sm font-bold">Use email address: {query.trim()}</span>
       <span className="text-xs text-slate-500">Send directly without choosing a school</span>
      </button>}
      {coachResults.map(co=><button type="button" key={co.id} role="option" aria-selected={false} className="block w-full border-b px-3 py-3 text-left hover:bg-slate-50"
       onClick={()=>choose({kind:'coach',label:nameOf(co)+' · '+(co.colleges?.name||'College'),coach:co,school:{id:co.college_id,name:co.colleges?.name||'College'}})}>
       <span className="block text-sm font-bold">{nameOf(co)} · {co.colleges?.name||'College'}</span>
       <span className="text-xs text-slate-500">{co.email||'Email address needed'}</span>
      </button>)}
      {schoolResults.map(sc=><button type="button" key={sc.id} role="option" aria-selected={false} className="block w-full border-b px-3 py-3 text-left hover:bg-slate-50"
       onClick={()=>choose({kind:'school',label:sc.name,school:sc})}>
       <span className="block text-sm font-bold">{sc.name}</span>
       <span className="text-xs text-slate-500">School · {[sc.city,sc.state].filter(Boolean).join(', ')}</span>
      </button>)}
      {searching&&<p className="p-3 text-xs text-slate-500">Searching directory…</p>}
      {!searching&&!schoolResults.length&&!coachResults.length&&!validEmail(query)&&<p className="p-3 text-xs text-slate-500">No matches. You can enter a complete email address directly.</p>}
     </div>}
    {choice?.kind==='school'&&!manualOnly&&
     <div className="mt-3 rounded-xl border bg-slate-50 p-3">
      <div className="text-sm font-bold">Choose a coach at {selectedSchool?.name}, or enter an email below.</div>
      {schoolCoaches.length>0&&<div className="mt-2">
       <button type="button" className="text-xs font-bold text-red-700 underline" onClick={()=>setShowSchoolCoaches(v=>!v)}>
        {showSchoolCoaches?'Hide coaches':'Show coaches'} ({schoolCoaches.length})
       </button>
       {showSchoolCoaches&&<div className="mt-2 max-h-40 overflow-y-auto rounded-lg border bg-white">
        {schoolCoaches.map(co=><button type="button" key={co.id} className="block w-full border-b px-3 py-2 text-left text-sm hover:bg-red-50"
         onClick={()=>choose({kind:'coach',label:nameOf(co)+' · '+(selectedSchool?.name||'College'),coach:co,school:selectedSchool||undefined})}>
         <span className="font-bold">{nameOf(co)}</span><span className="ml-2 text-xs text-slate-500">{co.email||'Email address needed'}</span>
        </button>)}
       </div>}
      </div>}
     </div>}
    {choice&&(!selectedCoach?.email||choice.kind!=='coach')&&
     <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <label className="text-xs font-bold">Recipient email address
       <input type="email" required maxLength={254} className="input mt-1 w-full" value={emailAddress} onChange={e=>setEmailAddress(e.target.value)} disabled={busy||readOnly}/>
      </label>
      {!selectedCoach&&<label className="text-xs font-bold">Recipient name (optional)
       <input className="input mt-1 w-full" maxLength={120} value={recipientName} onChange={e=>setRecipientName(e.target.value)} disabled={busy||readOnly}/>
      </label>}
     </div>}
    {selectedCoach?.contact_verification_needed&&<p className="mt-2 text-xs font-bold text-amber-800">This coach's contact details need verification before sending.</p>}
   </div>
   {selectedCoach&&ccOptions.length>0&&<details className="rounded-xl border bg-white">
    <summary className="cursor-pointer px-3 py-3 text-sm font-bold">CC another coach at {selectedSchool?.name||'this school'}{ccCoachIds.length>0?' ('+ccCoachIds.length+' selected)':''}</summary>
    <div className="space-y-2 border-t px-3 py-3"><p className="text-xs text-slate-600">Only eligible coaches already in My Coach Connections appear. All recipients can see who was copied.</p>
     {ccOptions.map(co=><label key={co.id} className="flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 text-sm"><input type="checkbox" className="mt-1" checked={ccCoachIds.includes(co.id)} disabled={busy||readOnly||ccLoading} onChange={e=>setCcCoachIds(current=>e.target.checked?[...current,co.id]:current.filter(id=>id!==co.id))}/><span><span className="block font-semibold">{nameOf(co)}</span><span className="block break-all text-xs text-slate-500">{co.email}</span></span></label>)}
    </div>
   </details>}
   <div>
    <label className="block text-sm font-black">How would you like to start?</label>
    <div className="mt-2 grid grid-cols-2 gap-2" role="group" aria-label="Email writing approach">
     <button type="button" disabled={busy||readOnly} aria-pressed={templateId==='custom'} onClick={()=>{if(templateId!=='custom')applyTemplate('custom')}} className={`rounded-xl border px-3 py-3 text-left text-sm font-bold transition ${templateId==='custom'?'border-red-500 bg-red-50 text-red-800':'border-slate-200 bg-white text-slate-700 hover:border-red-300'}`}>Write My Own<span className="mt-1 block text-xs font-normal">Use your own words</span></button>
     <button type="button" disabled={busy||readOnly} aria-pressed={templateId!=='custom'} onClick={()=>{if(templateId==='custom')applyTemplate(templates.find(t=>t.id!=='custom')?.id||'custom')}} className={`rounded-xl border px-3 py-3 text-left text-sm font-bold transition ${templateId!=='custom'?'border-red-500 bg-red-50 text-red-800':'border-slate-200 bg-white text-slate-700 hover:border-red-300'}`}>Start With a Template<span className="mt-1 block text-xs font-normal">A helpful starting point</span></button>
    </div>
    {templateId!=='custom'&&<div className="relative mt-3">
     <label htmlFor="quick-email-template" className="block text-xs font-bold text-slate-700">Choose a starting point</label>
     <select id="quick-email-template" className="input mt-1 w-full appearance-none !pr-12" value={templateId} disabled={busy||readOnly} onChange={e=>applyTemplate(e.target.value)}>
      {templates.filter(t=>t.id!=='custom').map(t=><option key={t.id} value={t.id}>{t.label}</option>)}
     </select>
     <ChevronDown aria-hidden="true" size={18} className="pointer-events-none absolute right-4 bottom-3 text-slate-600"/>
    </div>}
    {templateId!=='custom'&&<div className="mt-2 rounded-lg border bg-slate-50 p-3 text-xs text-slate-600">
     <div className="flex items-center gap-2 font-bold text-slate-800"><Sparkles size={15} className="text-red-600"/>RLTNL Email Playbook</div>
     <p className="mt-1">{currentTemplate.guidance}</p>
     {currentTemplate.openings.length>1&&<div className="mt-2 flex flex-wrap gap-2">{currentTemplate.openings.map((o,i)=>
      <button type="button" key={i} onClick={()=>applyTemplate(templateId,i)} disabled={busy||readOnly}
       className={'rounded-lg border px-2.5 py-1.5 text-xs font-bold '+(opening===i?'border-red-600 bg-red-50 text-red-700':'bg-white')}>{o.label}</button>)}</div>}
    </div>}
   </div>
   {!readOnly&&personalTemplates.length>0&&<div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
    <h3 className="text-sm font-black text-slate-900">My Saved Templates</h3>
    <p className="mt-1 text-xs text-slate-600">Start from a message you've written before, then personalize it for this coach.</p>
    {!!personalTemplates.length&&<div className="mt-3 space-y-2">
     <label htmlFor="quick-personal-template" className="block text-xs font-bold text-slate-700">Reuse one of My Templates</label>
     <select id="quick-personal-template" className="input w-full" value="" disabled={busy||templateBusy} onChange={e=>loadPersonalTemplate(e.target.value)}><option value="">Choose a saved template…</option>{personalTemplates.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select>
     <div className="flex flex-wrap gap-1.5">{personalTemplates.map(t=><button type="button" key={t.id} disabled={busy||templateBusy} onClick={()=>void removePersonalTemplate(t.id)} className="rounded-lg border bg-white px-2 py-1 text-xs text-slate-600 hover:text-red-700" title={`Remove ${t.name}`}>Remove {t.name}</button>)}</div>
    </div>}
   </div>}
   <EmailSubjectSettings profile={profile} disabled={busy||readOnly} inputId="quick-email-subject"
    topic={templateId==='custom'?'[Subject]':currentTemplate.subjectTemplate?fill(currentTemplate.subjectTemplate,values()).split('|')[0].trim():currentTemplate.label}
    fields={values()} onSaved={next=>setProfile((current:any)=>({...current,signature:{...(current?.signature||{}),...next}}))}>
    <input id="quick-email-subject" required className="input mt-2 w-full" maxLength={200} value={subject} onChange={e=>setSubject(e.target.value)} disabled={busy||readOnly} placeholder="Email subject"/>
   </EmailSubjectSettings>
   <div>
    <label className="text-sm font-black">Message</label>
    <RichEmailEditor ref={emailEditorRef} compact value={body} html={bodyHtml}
     videoPicker={<EmailVideoPicker athleteUserId={userId||undefined} onInsert={video=>emailEditorRef.current?.insertVideo(video)}/>}
     onChange={(plain,html)=>{setBody(plain);setBodyHtml(html)}}
     attachments={attachments} onAttachmentsChange={setAttachments} disabled={busy||readOnly}/>
    <p className="mt-2 text-xs text-slate-500">Choose a font and size, format selected text, add links or attachments. Place the cursor in the message before choosing Add Video to insert the link at that spot. Up to 5 attachments (2.5 MB each, 3 MB total).</p>
    <EmailSignatureSettings profile={profile} disabled={busy||readOnly} onSaved={next=>setProfile((current:any)=>({...current,signature:{...(current?.signature||{}),...next}}))}/>
   </div>
   {!readOnly&&<section className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 sm:p-4">
    <h3 className="text-sm font-black text-slate-900">My Templates</h3>
    <p className="mt-1 text-xs text-slate-600">Save your own email to reuse with other coaches. Your templates are private and sync across devices.</p>
    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
     <input aria-label="Template name" className="input min-w-0 flex-1" maxLength={80} placeholder="Name this message (e.g. Tournament introduction)" value={templateName} onChange={e=>setTemplateName(e.target.value)} disabled={busy||templateBusy}/>
     <button type="button" className="btn border bg-white font-bold" onClick={()=>void savePersonalTemplate()} disabled={busy||templateBusy}>{templateBusy?'Saving…':'Save as Template'}</button>
    </div>
    {templateNotice&&<p role="status" className="mt-2 text-xs font-semibold text-slate-700">{templateNotice}</p>}
   </section>}
   {connected===false&&<p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
    Connect Gmail before sending. <Link href="/settings" className="font-bold underline">Gmail settings</Link>
   </p>}
   {error&&<p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
   {notice&&<p role="status" className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm font-semibold text-green-800"><CheckCircle2 size={17}/>{notice}</p>}
   <div className="flex flex-wrap items-center justify-between gap-3">
    <p className="text-xs text-slate-500">Your message draft is saved on this device (attachments are not saved). Sending is tracked in RLTNL.</p>
    <button type="submit" className="btn btn-red" disabled={busy||loading||ccLoading||readOnly||connected!==true||!validEmail(emailAddress)||!subject.trim()||!body.trim()}>
     <Send size={16}/>{readOnly?'Read-only preview':busy?'Sending…':'Send Email'}
    </button>
   </div>
  </form>}
 </section>;
}
