"use client";
import {useEffect,useState} from "react";
import {useSearchParams} from "next/navigation";
import Link from "next/link";
import {ArrowLeft} from "lucide-react";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import OrganizationAccessLinks from "@/components/OrganizationAccessLinks";
import OrganizationPeopleAccess from "@/components/OrganizationPeopleAccess";

export default function OrganizationAccessPage(){
 const params=useSearchParams(),previewReadOnly=!!params.get("previewRole");
 const[organizations,setOrganizations]=useState<any[]>([]),[selected,setSelected]=useState(""),[loading,setLoading]=useState(true),[error,setError]=useState("");
 useEffect(()=>{fetch("/api/organization/setup",{cache:"no-store"}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error);const rows=d.organizations||[];setOrganizations(rows);setSelected(rows[0]?.id||"")}).catch(e=>setError(e.message||"Could not load organizations.")).finally(()=>setLoading(false))},[]);
 const org=organizations.find(o=>o.id===selected);
 return <AppShell><div className="max-w-5xl mx-auto px-4 sm:px-5 md:px-8 py-6">
  <PageHeader eyebrow="ADMIN SETTINGS" title="People & Access" subtitle="Manage reusable onboarding links, roles, team relationships and access requests." action={<Link href={"/organization/setup"+(previewReadOnly?"?previewRole=admin":"")} className="btn"><ArrowLeft size={16}/>Organization Management</Link>}/>
  {error&&<div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}
  {loading?<div className="card p-8 text-center muted">Loading access management...</div>:!organizations.length?<div className="card p-6"><div className="font-black">Admin access required</div><p className="muted text-sm mt-1">You need active Admin access to manage organization access.</p></div>:<>
   <div className="card p-4 mb-5"><label className="text-sm font-bold">Organization<select className="input mt-1" value={selected} onChange={e=>setSelected(e.target.value)}>{organizations.map(o=><option key={o.id} value={o.id}>{o.name}{o.branch_name?" · "+o.branch_name:""}</option>)}</select></label></div>
   {org&&<><OrganizationAccessLinks organizationId={org.id} teams={org.teams||[]} readOnly={previewReadOnly}/><OrganizationPeopleAccess organizationId={org.id} readOnly={previewReadOnly}/></>}
  </>}
 </div></AppShell>
}