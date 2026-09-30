"use client";
import {useEffect,useState} from "react";
import {Check,Copy} from "lucide-react";

type Team={id:string;name:string;age_group?:string|null;archived_at?:string|null};
type AccessLink={id:string;team_id:string|null;role:"admin"|"advisor"|"athlete"|"parent";url:string;requires_approval:boolean};

export default function OrganizationAccessLinks({organizationId,teams,readOnly=false}:{organizationId:string;teams:Team[];readOnly?:boolean}){
 const [links,setLinks]=useState<AccessLink[]>([]),[loading,setLoading]=useState(false),[error,setError]=useState(""),[copied,setCopied]=useState("");
 async function load(){if(readOnly)return;setLoading(true);setError("");try{const r=await fetch("/api/organization/setup",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"getJoinLinks",organizationId})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Could not prepare access links.");setLinks(d.links||[])}catch(e){setError(e instanceof Error?e.message:"Could not prepare access links.")}finally{setLoading(false)}}
 useEffect(()=>{setLinks([]);setError("");setCopied("");if(!readOnly)load()},[organizationId,readOnly]);
 async function copy(link:AccessLink,label:string){await navigator.clipboard.writeText(link.url);setCopied(link.id);window.setTimeout(()=>setCopied(""),1600)}
 const active=teams.filter(t=>!t.archived_at);
 return <section className="card p-5 sm:p-6 mt-5">
  <div className="rr-eyebrow">ACCESS & ONBOARDING</div><h2 className="font-black text-lg">Reusable Access Links</h2>
  <p className="muted text-sm mt-1">Share these links through Sprocket, text, or your normal team communication. Existing users add access to their current RLTNL account.</p>
  {error&&<div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</div>}
  {loading&&!links.length&&<div className="mt-5 rounded-xl border bg-slate-50 p-4 text-sm font-semibold text-slate-600">Loading access links...</div>}
  {!!links.length&&<div className="mt-5 space-y-5">
   <div><div className="text-xs font-black uppercase tracking-wide text-slate-500 mb-2">Teams</div><div className="space-y-3">{active.map(team=><div key={team.id} className="rounded-xl border p-4"><div className="font-black">{team.name}</div>{team.age_group&&<div className="muted text-xs">{team.age_group}</div>}<div className="flex flex-wrap gap-2 mt-3">{(["advisor","athlete","parent"] as const).map(role=>{const l=links.find(x=>x.team_id===team.id&&x.role===role);return <button key={role} className="btn px-3 py-2 text-xs" disabled={!l} onClick={()=>l&&copy(l,role)}>{l&&copied===l.id?<Check size={14}/>:<Copy size={14}/>} {role==="advisor"?"Advisor":role==="athlete"?"Athlete":"Parent"} Link</button>})}</div></div>)}</div></div>
  </div>}
  <div className="mt-5 rounded-xl border bg-slate-50 p-4 text-xs"><b>One person. One RLTNL account. Multiple relationships.</b><p className="muted mt-1">Using another team link adds access without replacing existing roles. Parent team membership never grants access to every athlete on that team; Parent ↔ Athlete access is established separately.</p></div>
 </section>
}