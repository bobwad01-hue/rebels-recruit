"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {Check,Copy,ExternalLink,ClipboardList} from "lucide-react";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import {createClient} from "@/lib/supabase-browser";

type Field={label:string;value:string};
const clean=(value:unknown)=>value===null||value===undefined?"":String(value).trim();
export default function RecruitingQuickFill(){
 const [loading,setLoading]=useState(true),[error,setError]=useState(""),[groups,setGroups]=useState<{title:string;fields:Field[]}[]>([]),[copied,setCopied]=useState("");
 useEffect(()=>{let active=true;(async()=>{try{
  const db=createClient(),{data:{user},error:authError}=await db.auth.getUser();
  if(authError||!user)throw new Error("Sign in to view your recruiting information.");
  const [p,a,signature,team]=await Promise.all([
   db.from("profiles").select("full_name,phone,email").eq("id",user.id).maybeSingle(),
   db.from("athlete_profiles").select("*").eq("user_id",user.id).maybeSingle(),
   fetch("/api/profile/email-signature",{cache:"no-store"}),
   fetch("/api/profile/team",{cache:"no-store"})
  ]);
  if(p.error||a.error)throw new Error("Your profile information could not be loaded.");
  const sig=signature.ok?(await signature.json()).signature||{}:{};
  const t=team.ok?await team.json():{};
  const athlete:Record<string,any>=a.data||{},profile:Record<string,any>=p.data||{};
  const teamRow=(t.teams||[]).find((x:any)=>x.id===t.currentTeamId);
  const orgRow=(t.organizations||[]).find((x:any)=>x.organization_id===t.currentOrganizationId);
  const positions=Array.isArray(athlete.positions)?athlete.positions.join(", "):"";
  const majors=Array.isArray(athlete.interested_majors)?athlete.interested_majors.join(", "):"";
  const sections=[
   {title:"Personal & Contact",fields:[["Full name",profile.full_name],["Email",user.email||profile.email],["Phone",profile.phone],["Hometown", [athlete.home_city,athlete.primary_state].filter(Boolean).join(", ")],["ZIP code",athlete.home_zip]]},
   {title:"Softball & Travel Team",fields:[["Graduation year",athlete.class_year],["Primary position",Array.isArray(athlete.positions)?athlete.positions[0]:""],["Positions",positions],["Jersey number",athlete.jersey_number],["Bats / Throws",sig.throwBat],["Travel organization",orgRow?.organizations?.name||orgRow?.name],["Travel team",teamRow?.name],["Travel coach",sig.travelTeamCoachName],["Travel coach email",sig.travelTeamCoachEmail],["Travel coach phone",sig.travelTeamCoachPhone]]},
   {title:"Academics & High School",fields:[["High school",athlete.school_name],["High school city",sig.highSchoolCity],["High school state",sig.highSchoolState],["GPA",athlete.gpa],["Interested majors",majors],["High school coach",sig.highSchoolCoachName],["High school coach email",sig.highSchoolCoachEmail],["High school coach phone",sig.highSchoolCoachPhone],["NCAA Eligibility Center number",sig.ncaaNumber]]},
   {title:"Recruiting Links",fields:[["X / Twitter",sig.xTwitter],["SportsRecruits profile",sig.sportsRecruitsUrl]]}
  ].map(section=>({title:section.title,fields:section.fields.map(([label,value])=>({label:clean(label),value:clean(value)}))}));
  if(active)setGroups(sections);
 }catch(e){if(active)setError(e instanceof Error?e.message:"Unable to load your information.")}finally{if(active)setLoading(false)}})();return()=>{active=false}},[]);
 async function copy(value:string,label:string){try{await navigator.clipboard.writeText(value);setCopied(label)}catch{setCopied("")}}
 return <AppShell><div className="max-w-5xl mx-auto">
  <PageHeader title="Recruiting QuickFill" subtitle="Your recruiting information, ready to copy into college questionnaires."/>
  <div className="card p-4 sm:p-5 mb-5 flex flex-wrap items-center justify-between gap-3">
   <div><p className="font-bold text-slate-900">No second profile to fill out.</p><p className="text-sm text-slate-600 mt-1">Open a college's recruiting form in another tab, then copy your saved answers from here. Always review before submitting.</p></div>
   <Link href="/profile" className="btn inline-flex items-center gap-2"><ExternalLink size={16}/>Complete or Update Profile</Link>
  </div>
  {loading&&<div className="card p-10 text-center text-slate-600">Loading your recruiting information…</div>}
  {error&&<div className="card p-6 text-red-700" role="alert">{error}</div>}
  {!loading&&!error&&<div className="grid gap-5 md:grid-cols-2">{groups.map(group=><section key={group.title} className="card p-5 sm:p-6 min-w-0"><h2 className="font-black text-lg flex items-center gap-2"><ClipboardList size={19} className="text-red-600"/>{group.title}</h2><div className="mt-4 divide-y divide-slate-100">{group.fields.map(field=><div key={field.label} className="py-3 flex items-center justify-between gap-3"><div className="min-w-0"><div className="text-xs font-semibold text-slate-500">{field.label}</div><div className={"text-sm mt-1 break-words "+(field.value?"font-semibold text-slate-900":"italic text-slate-400")}>{field.value||"Not in your profile"}</div></div><button type="button" disabled={!field.value} onClick={()=>copy(field.value,field.label)} className="btn shrink-0 text-xs inline-flex items-center gap-1.5 disabled:opacity-40" aria-label={"Copy "+field.label}>{copied===field.label?<Check size={14}/>:<Copy size={14}/>} {copied===field.label?"Copied":"Copy"}</button></div>)}</div></section>)}</div>}
  {!loading&&!error&&<p className="text-sm text-slate-500 mt-5 mb-8">Missing something? Use <Link href="/profile" className="underline font-semibold">Complete or Update Profile</Link> to maintain one source of truth. RLTNL does not fill or submit external college forms for you.</p>}
 </div></AppShell>
}