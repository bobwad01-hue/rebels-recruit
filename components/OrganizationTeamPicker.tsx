'use client';
import {useMemo,useState} from 'react';

type Props={organizations:any[];teams:any[];organizationId:string;teamId:string;onOrganizationChange:(id:string)=>void;onTeamChange:(id:string)=>void};
const label=(m:any)=>{const o=Array.isArray(m?.organizations)?m.organizations[0]:m?.organizations;return [o?.name,o?.branch_name,[o?.city,o?.state].filter(Boolean).join(', ')].filter(Boolean).join(' · ')};
export default function OrganizationTeamPicker({organizations,teams,organizationId,teamId,onOrganizationChange,onTeamChange}:Props){
 const selected=organizations.find(m=>m.organization_id===organizationId);const [query,setQuery]=useState(selected?label(selected):'');const [open,setOpen]=useState(false);
 const matches=useMemo(()=>{const q=query.trim().toLowerCase();return organizations.filter(m=>!q||label(m).toLowerCase().includes(q)).slice(0,20)},[organizations,query]);
 const teamOptions=useMemo(()=>teams.filter(t=>t.organization_id===organizationId),[teams,organizationId]);
 function choose(m:any){setQuery(label(m));setOpen(false);onOrganizationChange(m.organization_id)}
 return <>
  <label className="relative"><b className="text-sm">Organization *</b><input required className="input mt-1" value={query} placeholder="Start typing organization name" autoComplete="off" onFocus={()=>setOpen(true)} onChange={e=>{setQuery(e.target.value);setOpen(true);if(organizationId){onOrganizationChange('');onTeamChange('')}}}/>{open&&<div className="absolute z-40 left-0 right-0 mt-1 max-h-60 overflow-auto rounded-xl border bg-white shadow-lg">{matches.map(m=><button key={m.organization_id} type="button" className="block w-full px-4 py-3 text-left text-sm hover:bg-slate-50" onMouseDown={e=>e.preventDefault()} onClick={()=>choose(m)}>{label(m)}</button>)}{!matches.length&&<div className="px-4 py-3 text-sm text-slate-500">No matching organizations.</div>}</div>}<span className="muted text-xs mt-1 block">Start typing, then select your organization from the results.</span></label>
  <label><b className="text-sm">Team *</b><select required className="input mt-1" value={teamId} onChange={e=>onTeamChange(e.target.value)} disabled={!organizationId||teamOptions.length===0}><option value="">{!organizationId?'Choose organization first':teamOptions.length?'Select team':'No teams available'}</option>{teamOptions.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select>{organizationId&&teamOptions.length===0&&<span className="text-xs mt-1 block text-amber-700">No active teams are available for this organization.</span>}</label>
 </>;
}
