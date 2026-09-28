"use client";
import {useEffect,useState} from "react";
import {X} from "lucide-react";
export default function ManageOrganizationAccessModal({person,teams,busy,onClose,onSave}:{person:any;teams:any[];busy:boolean;onClose:()=>void;onSave:(role:string,enabled:boolean,teamIds:string[])=>void}){
 const[role,setRole]=useState("advisor"),[enabled,setEnabled]=useState(true),[selected,setSelected]=useState<string[]>([]);
 useEffect(()=>{if(!person)return;const first=person.roles?.[0]||"advisor";setRole(first);setEnabled(person.roles?.includes(first));setSelected((person.teamRoles||[]).filter((x:any)=>x.role===first).map((x:any)=>x.team_id))},[person]);
 if(!person)return null;
 function changeRole(next:string){setRole(next);setEnabled(person.roles?.includes(next));setSelected((person.teamRoles||[]).filter((x:any)=>x.role===next).map((x:any)=>x.team_id))}
 return <div className="fixed inset-0 z-[120] grid place-items-center bg-slate-950/55 p-4" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)onClose()}}>
  <div role="dialog" aria-modal="true" aria-labelledby="manage-access-title" className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl bg-white p-5 sm:p-6 shadow-2xl">
   <div className="flex items-start justify-between gap-4"><div><div className="rr-eyebrow">MANAGE ACCESS</div><h2 id="manage-access-title" className="mt-1 text-xl font-black">{person.profile?.full_name||person.profile?.email||"RLTNL user"}</h2><p className="muted text-xs mt-1">{person.profile?.email||""}</p></div><button className="btn p-2" disabled={busy} onClick={onClose} aria-label="Close"><X size={16}/></button></div>
   <div className="mt-5"><label className="text-sm font-bold">Role<select className="input mt-1" value={role} onChange={e=>changeRole(e.target.value)}><option value="admin">Admin</option><option value="advisor">Advisor</option><option value="athlete">Athlete</option><option value="parent">Parent</option></select></label></div>
   <label className="mt-4 flex items-center gap-3 rounded-xl border p-3 text-sm font-bold"><input type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)}/>Active {role} role</label>
   {role!=="admin"&&enabled&&<div className="mt-5"><div className="text-sm font-black">Team assignments</div><p className="muted text-xs mt-1">Select every team this {role} should be connected to.</p><div className="mt-3 max-h-52 overflow-y-auto rounded-xl border divide-y">{teams.filter(t=>!t.archived_at).map(t=><label key={t.id} className="flex items-center gap-3 p-3 text-sm"><input type="checkbox" checked={selected.includes(t.id)} onChange={e=>setSelected(v=>e.target.checked?[...v,t.id]:v.filter(id=>id!==t.id))}/><span className="font-semibold">{t.name}</span></label>)}</div></div>}
   {role==="parent"&&<p className="mt-4 rounded-xl bg-slate-50 border p-3 text-xs muted">Team membership does not grant access to every athlete. Parent ↔ Athlete access is confirmed separately.</p>}
   <div className="mt-6 flex justify-end gap-3"><button className="btn" disabled={busy} onClick={onClose}>Cancel</button><button className="btn btn-red" disabled={busy} onClick={()=>onSave(role,enabled,selected)}>{busy?"Saving...":"Save Access"}</button></div>
  </div>
 </div>
}