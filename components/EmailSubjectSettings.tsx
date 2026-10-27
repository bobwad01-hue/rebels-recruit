'use client';
import {useEffect,useState,type ReactNode} from 'react';
import {
  buildRecruitingEmailSubject,DEFAULT_RECRUITING_SUBJECT_TEMPLATE,
  validateRecruitingSubjectTemplate,
  type RecruitingEmailSubjectFields,
} from '@/lib/recruiting-email-format';

type Mode='default'|'custom';
type Preference={subjectMode:Mode;customSubjectTemplate:string};
type Props={profile:any;topic:string;fields:RecruitingEmailSubjectFields;onSaved:(next:Preference)=>void;disabled?:boolean;inputId:string;labelClassName?:string;children:ReactNode};

export default function EmailSubjectSettings({profile,topic,fields,onSaved,disabled=false,inputId,labelClassName='text-sm font-black',children}:Props){
 const [open,setOpen]=useState(false);
 const [mode,setMode]=useState<Mode>('default');
 const [custom,setCustom]=useState(DEFAULT_RECRUITING_SUBJECT_TEMPLATE);
 const [saving,setSaving]=useState(false);
 const [feedback,setFeedback]=useState('');
 useEffect(()=>{
  const s=profile?.signature||{};
  setMode(s.subjectMode==='custom'?'custom':'default');
  setCustom(typeof s.customSubjectTemplate==='string'&&s.customSubjectTemplate.trim()
   ?s.customSubjectTemplate:DEFAULT_RECRUITING_SUBJECT_TEMPLATE);
 },[profile?.signature?.subjectMode,profile?.signature?.customSubjectTemplate]);
 const invalid=mode==='custom'?validateRecruitingSubjectTemplate(custom):null;
 const preview=buildRecruitingEmailSubject(topic,fields,{subjectMode:mode,customSubjectTemplate:custom});
 async function save(){
  if(saving||disabled||invalid)return;
  setSaving(true);setFeedback('');
  try{
   const response=await fetch('/api/profile/email-signature',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({subjectMode:mode,customSubjectTemplate:custom}),
   });
   const result=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(result.error||'Unable to save subject preference.');
   onSaved({subjectMode:mode,customSubjectTemplate:custom});
   setOpen(false);
   setFeedback('Subject preference saved. New starting points will use it; this draft is unchanged.');
  }catch(error){setFeedback(error instanceof Error?error.message:'Unable to save subject preference.')}
  finally{setSaving(false)}
 }
 return <div className="min-w-0 text-sm">
  <div className="flex flex-wrap items-center justify-start gap-3">
   <label htmlFor={inputId} className={labelClassName}>Subject</label>
   <button type="button" className="text-xs font-semibold text-red-700 underline underline-offset-2 disabled:opacity-50"
    disabled={disabled||saving} aria-expanded={open} aria-controls={inputId+'-settings'}
    onClick={()=>{setOpen(v=>!v);setFeedback('')}}>{open?'Close Subject Settings':'Manage Subject'}</button>
  </div>
  {children}
  {open&&<div id={inputId+'-settings'} className="mt-3 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
   <label className="block text-xs font-semibold" htmlFor="email-subject-mode">Subject format for future emails</label>
   <select id="email-subject-mode" aria-label="Email subject preference" className="input w-full"
    disabled={disabled||saving} value={mode} onChange={e=>setMode(e.target.value as Mode)}>
    <option value="default">RLTNL subject (default)</option>
    <option value="custom">My custom subject format</option>
   </select>
   {mode==='custom'&&<>
    <label className="block text-xs font-semibold" htmlFor="email-subject-custom">Custom subject format</label>
    <textarea id="email-subject-custom" aria-label="Custom email subject format" rows={2} maxLength={200}
     className="input w-full" disabled={disabled||saving} value={custom}
     onChange={e=>setCustom(e.target.value)} />
    <p className="text-xs leading-5 text-slate-600">
     Available fields: <code>{'{{topic}}'}</code>, <code>{'{{name}}'}</code>, <code>{'{{grad}}'}</code>,
     <code>{'{{positionsAndBats}}'}</code>, <code>{'{{positions}}'}</code>, <code>{'{{bats}}'}</code>,
     <code>{'{{gpaLabel}}'}</code>, <code>{'{{gpa}}'}</code>, <code>{'{{college}}'}</code>,
     <code>{'{{jersey}}'}</code>. GPA automatically uses two decimal places.
    </p>
    {invalid&&<p role="alert" className="text-xs font-semibold text-red-700">{invalid}</p>}
   </>}
   <div className="rounded-lg border bg-white p-3">
    <p className="text-xs font-bold text-slate-600">Preview for this starting point</p>
    <p className="mt-1 break-words text-sm font-semibold text-slate-900">{preview}</p>
   </div>
   <button type="button" className="btn btn-red" disabled={disabled||saving||!!invalid}
    onClick={()=>void save()}>{saving?'Saving…':'Save subject'}</button>
   <p className="text-xs text-slate-500">Changes apply when choosing a starting point for a future email. Your current subject and saved drafts are not overwritten. You can always edit a single subject directly.</p>
  </div>}
  {feedback&&<p role="status" className="mt-2 text-xs text-slate-600">{feedback}</p>}
 </div>;
}
