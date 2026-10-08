"use client";
import {useEffect,useState} from "react";
import {useRouter,useSearchParams} from "next/navigation";
import Link from "next/link";
import {Check,UserRound} from "lucide-react";
import {PrimaryBrand} from "@/components/BrandLogo";
export default function ParentConnect(){
 const router=useRouter(),params=useSearchParams(),teamId=params.get("team")||"";const[data,setData]=useState<any>(null),[error,setError]=useState(""),[busy,setBusy]=useState("");
 async function load(){const r=await fetch("/api/parent/connect?team="+encodeURIComponent(teamId),{cache:"no-store"}),d=await r.json();if(!r.ok)setError(d.error||"Could not load athletes.");else setData(d)}
 useEffect(()=>{if(teamId)load();else router.replace("/parent")},[teamId,router]);
 async function request(id:string){setBusy(id);const r=await fetch("/api/parent/connect",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({teamId,athleteId:id})}),d=await r.json();if(!r.ok)setError(d.error||"Could not request connection.");else await load();setBusy("")}
 if(!teamId)return <div className="min-h-screen bg-slate-50 grid place-items-center p-6"><div className="card bg-white p-6 text-center muted">Opening Parent Home to connect with your athlete…</div></div>;
 return <div className="min-h-screen bg-slate-50 p-4 sm:p-6"><div className="mx-auto w-full max-w-xl"><div className="card bg-white p-6 sm:p-8"><PrimaryBrand className="text-xl justify-center"/><div className="mt-8 rr-eyebrow">PARENT SETUP</div><h1 className="text-2xl font-black mt-1">Connect to Your Athlete</h1><p className="muted mt-2">{data?.team?.name?<>Select your athlete on <strong>{data.team.name}</strong>. They'll confirm the connection before you can view their recruiting information.</>:<>Choose the athlete you support.</>}</p>
 {error&&<div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</div>}
 {!data&&!error&&<div className="mt-6 muted text-sm">Loading team athletes...</div>}
 {data&&<div className="mt-6 space-y-2">{data.athletes?.map((a:any)=><div key={a.id} className="rounded-xl border p-4 flex items-center gap-3"><div className="h-10 w-10 rounded-full bg-slate-100 grid place-items-center"><UserRound size={19}/></div><div className="flex-1 min-w-0"><div className="font-black truncate">{a.full_name||"Athlete"}</div>{a.connection&&<div className="text-xs font-semibold text-slate-500 capitalize">{a.connection} connection</div>}</div>{a.connection?<span className="inline-flex items-center gap-1 text-xs font-bold text-green-700"><Check size={14}/>{a.connection==="pending"?"Requested":"Connected"}</span>:<button className="btn btn-red px-3 py-2 text-xs" disabled={busy===a.id} onClick={()=>request(a.id)}>{busy===a.id?"Sending...":"Request Connection"}</button>}</div>)}{!data.athletes?.length&&<div className="rounded-xl border p-5 text-center"><div className="font-black">No athletes are available yet</div><p className="muted text-sm mt-1">An organization Admin can confirm the team roster before you connect.</p></div>}</div>}
 <div className="mt-6 border-t pt-5"><Link href="/parent" className="btn w-full text-center">Go to Parent Home</Link></div></div></div></div>
}