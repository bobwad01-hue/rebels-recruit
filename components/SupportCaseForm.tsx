'use client';

import {useEffect,useState} from 'react';
import {createClient} from '@/lib/supabase-browser';

const options=[['missing_athlete','My athlete or player is missing'],['wrong_organization_access','The wrong organization has access'],['missing_import_history','Imported recruiting history is missing'],['google_disconnected','Google disconnected or stopped working'],['wrong_team','I joined the wrong team or organization'],['parent_access','Parent or guardian access is wrong'],['account_deletion','I need help with account deletion'],['other','Something else']];
const organizationRelated=new Set(['missing_athlete','wrong_organization_access','missing_import_history','wrong_team','parent_access']);

export default function SupportCaseForm(){
  const c=createClient();
  const[category,setCategory]=useState('missing_athlete'),[description,setDescription]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState(''),[orgs,setOrgs]=useState<any[]>([]),[targetOrg,setTargetOrg]=useState(''),[orgWarning,setOrgWarning]=useState('');

  useEffect(()=>{(async()=>{
    const{data:{user},error:authError}=await c.auth.getUser();
    if(authError||!user)return;
    const{data,error:e}=await c.rpc('support_case_organization_options');
    if(e){setOrgWarning('Organization routing is temporarily unavailable. You can still create a general support case.');return}
    const rows=(data||[]).map((x:any)=>({id:x.organization_id,name:x.organization_name||'Organization',relationship:x.relationship}));
    setOrgs(rows);
    if(rows.length===1)setTargetOrg(rows[0].id);
  })()},[]);

  async function submit(e:React.FormEvent){
    e.preventDefault();setMessage('');setError('');
    if(orgs.length>1&&organizationRelated.has(category)&&!targetOrg){setError('Choose the organization this issue is about so the right staff can investigate it.');return}
    setBusy(true);
    const{data,error:e2}=await c.rpc('create_support_case',{case_category:category,case_description:description,target_organization_id:targetOrg||null});
    if(e2)setError('We could not create the support case. Please try again.');
    else{setMessage(`Support case created. Reference: ${String(data).slice(0,8).toUpperCase()}`);setDescription('')}
    setBusy(false);
  }

  return <div className="card p-6"><h2 className="font-black text-lg">Get Help</h2><p className="muted text-sm mt-1">Report an access, data, import, organization, or Google connection problem. Rebels Recruit will attach a limited diagnostic snapshot so the issue can be investigated without asking you to recreate basic account details.</p><form onSubmit={submit} className="mt-4 space-y-3"><label className="block"><span className="text-sm font-bold">What happened?</span><select className="input mt-1" value={category} onChange={e=>setCategory(e.target.value)}>{options.map(([v,l])=><option value={v} key={v}>{l}</option>)}</select></label>{orgs.length>1&&<label className="block"><span className="text-sm font-bold">Which organization is this about?</span><select className="input mt-1" value={targetOrg} onChange={e=>setTargetOrg(e.target.value)} required={organizationRelated.has(category)}><option value="">{organizationRelated.has(category)?'Choose organization':'Not organization-specific'}</option>{orgs.map(o=><option key={o.id} value={o.id}>{o.name}{o.relationship==='parent'?' (through athlete access)':''}</option>)}</select><span className="muted text-xs mt-1 block">Selecting the organization routes the case only to that organization's Owner/Admin support view.</span></label>}{orgWarning&&<div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold">{orgWarning}</div>}<label className="block"><span className="text-sm font-bold">Tell us what you expected to see</span><textarea className="input mt-1 min-h-24" value={description} onChange={e=>setDescription(e.target.value)} required minLength={5} maxLength={4000} placeholder="Example: I joined my high school team, but my travel team disappeared from Organizations."/></label>{error&&<div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold">{error}</div>}{message&&<div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm font-semibold">{message}</div>}<button className="btn btn-red" disabled={busy||description.trim().length<5}>{busy?'Creating Support Case...':'Create Support Case'}</button></form></div>;
}
