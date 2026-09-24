"use client";
import { useRef, useState } from "react";
import { Camera, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase-browser";

export default function PlayerPhotoUpload({athleteId,name,initialUrl,onSaved,compact=false}:{athleteId:string;name:string;initialUrl?:string|null;onSaved?:(url:string)=>void;compact?:boolean}){
 const input=useRef<HTMLInputElement>(null),[url,setUrl]=useState(initialUrl||""),[busy,setBusy]=useState(false),[msg,setMsg]=useState("");
 const initials=(name||"Player").split(/\s+/).map(x=>x[0]).join("").slice(0,2).toUpperCase();
 async function pick(file?:File){if(!file)return;setMsg("");if(!["image/jpeg","image/png","image/webp"].includes(file.type)){setMsg("Use a JPG, PNG or WebP photo.");return}if(file.size>5*1024*1024){setMsg("Photo must be 5 MB or smaller.");return}setBusy(true);const c=createClient();const ext=file.type==="image/png"?"png":file.type==="image/webp"?"webp":"jpg",key=`${athleteId}/profile.${ext}`;const up=await c.storage.from("player-photos").upload(key,file,{upsert:true,contentType:file.type,cacheControl:"3600"});if(up.error){setMsg(up.error.message);setBusy(false);return}const publicUrl=c.storage.from("player-photos").getPublicUrl(key).data.publicUrl+"?v="+Date.now();const save=await c.from("profiles").update({avatar_url:publicUrl}).eq("id",athleteId);setBusy(false);if(save.error){setMsg(save.error.message);return}setUrl(publicUrl);setMsg("Photo updated.");onSaved?.(publicUrl)}
 return <div className={compact?"flex items-center gap-3":"flex flex-col sm:flex-row sm:items-center gap-4"}>
  <button type="button" onClick={()=>input.current?.click()} className={`relative shrink-0 overflow-hidden rounded-2xl border bg-slate-100 grid place-items-center font-black text-slate-500 ${compact?"h-16 w-16":"h-24 w-24"}`} aria-label="Change player photo">{url?<img src={url} alt={name} className="h-full w-full object-cover"/>:<span className="text-xl">{initials}</span>}<span className="absolute bottom-1 right-1 h-7 w-7 rounded-full bg-slate-950 text-white grid place-items-center border-2 border-white"><Camera size={13}/></span></button>
  <div><button type="button" className="btn" disabled={busy} onClick={()=>input.current?.click()}><Upload size={15}/>{busy?"Uploading...":url?"Change Photo":"Upload Photo"}</button><div className="muted text-xs mt-2">JPG, PNG or WebP · 5 MB max. A clear square headshot works best.</div>{msg&&<div className={`text-xs font-bold mt-2 ${msg==="Photo updated."?"text-emerald-700":"text-red-600"}`}>{msg}</div>}</div>
  <input ref={input} className="hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{pick(e.target.files?.[0]);e.currentTarget.value=""}}/>
 </div>
}