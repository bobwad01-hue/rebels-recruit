'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import Link from 'next/link';
import {CheckCircle2,Mail,Search,Send,Sparkles,X} from 'lucide-react';
import {createClient} from '@/lib/supabase-browser';
import {EMAIL_STARTERS,mergeEmailStarters,starterById,type EmailStarter} from '@/lib/recruiting-email-playbook';
import {buildRecruitingEmailSubject} from '@/lib/recruiting-email-format';
import EmailVideoPicker from '@/components/EmailVideoPicker';
import RichEmailEditor,{type EmailAttachment,type RichEmailEditorHandle} from '@/components/RichEmailEditor';

type School={id:string;name:string;city?:string|null;state?:string|null};
type Coach={id:string;first_name:string|null;last_name:string|null;email:string|null;college_id:string;contact_verification_needed?:boolean|null;lifecycle_status?:string|null;colleges?:{name:string}|null};
type Choice={kind:'school'|'coach'|'email';label:string;school?:School;coach?:Coach;email?:string};
const validEmail=(value:string)=>/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value.trim())&&value.trim().length<=254;
const safeSearch=(value:string)=>value.replace(/[%(),]/g,' ').trim().slice(0,90);
const nameOf=(coach:Coach)=>[coach.first_name,coach.last_name].filter(Boolean).join(' ')||'Coach';
const draftKey=(userId:string)=>'rltnl:quick-email-draft:'+userId;

export default function RecruitingQuickComposer({readOnly=false}:{readOnly?:boolean}){
 const emailEditorRef=useRef<RichEmailEditorHandle>(null);
 const [userId,setUserId]=useState('');
 const [query,setQuery]=useState('');
 const [choice,setChoice]=useState<Choice|null>(null);
 const [schoolResults,setSchoolResults]=useState<School[]>([]);
 const [coachResults,setCoachResults]=useState<Coach[]>([]);
 const [schoolCoaches,setSchoolCoaches]=useState<Coach[]>([]);
 const [searching,setSearching]=useState(false);
 const [emailAddress,setEmailAddress]=useState('');
 const [recipientName,setRecipientName]=useState('');
 const [templates,setTemplates]=useState<EmailStarter[]>(()=>mergeEmailStarters([]));
 const [templateId,setTemplateId]=useState('custom');
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
 const selectedSchool=choice?.school||null;
 const selectedCoach=choice?.coach||null;
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
   setConnected(!connection.error&&connection.data?.gmail_connected===true);
   if(!templateRows.error)setTemplates(mergeEmailStarters((templateRows.data||[]) as any[]));
   setProfile(profileResponse);
   try{
    const saved=window.localStorage.getItem(draftKey(user.id));
    if(saved){
     const d=JSON.parse(saved);
     setSubject(String(d.subject||'').slice(0,200));
     setBody(String(d.body||'').slice(0,20000));
     setBodyHtml(String(d.bodyHtml||'').slice(0,100000));
     setTemplateId(String(d.templateId||'custom'));
     setOpening(Number(d.opening)||0);
     if(d.choice&&['school','coach','email'].includes(d.choice.kind)){
      setChoice(d.choice);
      setQuery(String(d.choice.label||''));
      setEmailAddress(String(d.emailAddress||''));
      setRecipientName(String(d.recipientName||''));
     }
    }
   }catch{/* Private browsing can disable draft storage. */}
   setDraftReady(true);
   setLoading(false);
  })();
  return()=>{alive=false};
 },[]);

 useEffect(()=>{
  if(!draftReady||!userId)return;
  try{window.localStorage.setItem(draftKey(userId),JSON.stringify({
   choice,subject,body,bodyHtml,templateId,opening,emailAddress,recipientName
  }))}catch{/* Draft persistence is best effort. */}
 },[draftReady,userId,choice,subject,body,bodyHtml,templateId,opening,emailAddress,recipientName]);

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

 function choose(next:Choice){
  setChoice(next);
  setQuery(next.label);
  setShowResults(false);
  setShowSchoolCoaches(next.kind==='school');
  setEmailAddress(next.kind==='email'?(next.email||''):(next.coach?.email||''));
  setRecipientName(next.coach?nameOf(next.coach):'');
  setError('');setNotice('');
 }
 function clearChoice(){
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
 function applyTemplate(id:string,index=0){
  setTemplateId(id);setOpening(index);setNotice('');
  setBodyHtml('');
  if(id==='custom'){setSubject('');setBody('');return}
  const template=starterById(id,templates),v=values();
  const topic=template.subjectTemplate?fill(template.subjectTemplate,v).split('|')[0].trim():template.label;
  setSubject(buildRecruitingEmailSubject(topic,v));
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
  if(bodyHtml.length>100000){setError('This formatted email is too long.');return}
  if(templateId!=='custom'&&/\[[A-Z][A-Z0-9 ’'&/.,-]{2,}\]/.test(body)){
   setError('Replace the bracketed template prompts with your own details before sending.');return;
  }
  if(connected!==true){setError('Connect Gmail in Settings before sending an email.');return}
  if(selectedCoach?.contact_verification_needed){setError('This coach has contact details that require verification before outreach.');return}
  if(selectedCoach&&selectedCoach.lifecycle_status!=='active'){setError('This coach is not currently active.');return}
  setBusy(true);
  try{
   const isCoach=!!selectedCoach;
   const response=await fetch(isCoach?'/api/google/gmail/send':'/api/google/gmail/manual-send',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify(isCoach?{
     coachId:selectedCoach.id,athleteUserId:userId,recipientEmail:to,
     subject:subject.trim(),body,bodyHtml,attachments,emailPurpose:templateId
    }:{
     collegeId:selectedSchool?.id||null,recipientEmail:to,recipientName,
     subject:subject.trim(),body,bodyHtml,attachments,emailPurpose:templateId
    })
   });
   const result=await response.json().catch(()=>({}));
   if(!response.ok||!result.messageId)throw new Error(result.error||'Gmail could not confirm the send.');
   setNotice(result.logged===false?'Email sent through Gmail, but recruiting activity could not be recorded.':'Email sent through Gmail and recorded in Recruiting Activity.');
   setSubject('');setBody('');setBodyHtml('');setAttachments([]);setTemplateId('custom');setOpening(0);
   try{window.localStorage.removeItem(draftKey(userId))}catch{}
   window.dispatchEvent(new Event('rltnl:coach-emails-updated'));
   window.dispatchEvent(new Event('rebels:data-changed'));
  }catch(err){setError(err instanceof Error?err.message:'Could not send email. Your draft is saved.')}
  finally{setBusy(false)}
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
    <p className="mt-1 text-xs text-slate-500">Search schools, coaches, or enter an email address.</p>
    <div className="relative mt-2">
     <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"/>
     <input id="quick-email-to" className="input w-full !pl-10 !pr-10" value={query}
      placeholder="School, coach, or coach@college.edu"
      onFocus={()=>{if(!choice)setShowResults(true)}}
      onChange={e=>{setQuery(e.target.value);setChoice(null);setShowResults(true);setEmailAddress('');}}
      onKeyDown={e=>{if(e.key==='Enter'&&!choice&&validEmail(query)){e.preventDefault();choose({kind:'email',label:query.trim(),email:query.trim()})}}}
      autoComplete="off" disabled={busy||readOnly}/>
     {choice&&<button type="button" onClick={clearChoice} aria-label="Change recipient" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"><X size={17}/></button>}
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
    {choice?.kind==='school'&&
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
   <div>
    <label htmlFor="quick-email-template" className="block text-sm font-black">Email starting point (optional)</label>
    <select id="quick-email-template" className="input mt-2 w-full" value={templateId} disabled={busy||readOnly}
     onChange={e=>applyTemplate(e.target.value)}>
     {templates.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}
    </select>
    {templateId!=='custom'&&<div className="mt-2 rounded-lg border bg-slate-50 p-3 text-xs text-slate-600">
     <div className="flex items-center gap-2 font-bold text-slate-800"><Sparkles size={15} className="text-red-600"/>RLTNL Email Playbook</div>
     <p className="mt-1">{currentTemplate.guidance}</p>
     {currentTemplate.openings.length>1&&<div className="mt-2 flex flex-wrap gap-2">{currentTemplate.openings.map((o,i)=>
      <button type="button" key={i} onClick={()=>applyTemplate(templateId,i)} disabled={busy||readOnly}
       className={'rounded-lg border px-2.5 py-1.5 text-xs font-bold '+(opening===i?'border-red-600 bg-red-50 text-red-700':'bg-white')}>{o.label}</button>)}</div>}
    </div>}
   </div>
   <label className="block text-sm font-black">Subject
    <input required className="input mt-2 w-full" maxLength={200} value={subject} onChange={e=>setSubject(e.target.value)} disabled={busy||readOnly} placeholder="Email subject"/>
   </label>
   <div>
    <div className="flex items-center justify-between gap-2">
     <label className="text-sm font-black">Message</label>
     <EmailVideoPicker athleteUserId={userId||undefined} onInsert={video=>emailEditorRef.current?.insertVideo(video)}/>
    </div>
    <RichEmailEditor ref={emailEditorRef} value={body} html={bodyHtml}
     onChange={(plain,html)=>{setBody(plain);setBodyHtml(html)}}
     attachments={attachments} onAttachmentsChange={setAttachments} disabled={busy||readOnly}/>
    <p className="mt-2 text-xs text-slate-500">Choose a font and size, format selected text, add links or attachments. Place the cursor in the message before choosing Add Video to insert the link at that spot. Up to 5 attachments (2.5 MB each, 3 MB total).</p>
   </div>
   {connected===false&&<p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
    Connect Gmail before sending. <Link href="/settings" className="font-bold underline">Gmail settings</Link>
   </p>}
   {error&&<p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
   {notice&&<p role="status" className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm font-semibold text-green-800"><CheckCircle2 size={17}/>{notice}</p>}
   <div className="flex flex-wrap items-center justify-between gap-3">
    <p className="text-xs text-slate-500">Your message draft is saved on this device (attachments are not saved). Sending is tracked in RLTNL.</p>
    <button type="submit" className="btn btn-red" disabled={busy||loading||readOnly||connected!==true||!validEmail(emailAddress)||!subject.trim()||!body.trim()}>
     <Send size={16}/>{readOnly?'Read-only preview':busy?'Sending…':'Send Email'}
    </button>
   </div>
  </form>}
 </section>;
}
