'use client';
import {useEffect,useState} from 'react';
import {Users} from 'lucide-react';
import {createClient} from '@/lib/supabase-browser';
import type {OwnerPreview} from '@/lib/owner-preview';

type AthleteOption={id:string;name:string};
export default function ParentAthleteSwitcher({selectedAthleteId,preview}:{selectedAthleteId:string;preview:OwnerPreview}){
 const c=createClient();const[athletes,setAthletes]=useState<AthleteOption[]>([]),[loading,setLoading]=useState(true);
 useEffect(()=>{(async()=>{if(preview.active&&preview.role==='parent'&&preview.athleteId){const{data:p}=await c.from('profiles').select('id,full_name,email').eq('id',preview.athleteId).maybeSingle();setAthletes([{id:preview.athleteId,name:p?.full_name||p?.email||'Athlete'}]);setLoading(false);return}const{data:{user}}=await c.auth.getUser();if(!user){setLoading(false);return}const{data:links}=await c.from('parent_guardian_access').select('athlete_user_id').eq('parent_user_id',user.id).eq('status','active').order('created_at',{ascending:true});const ids=[...new Set((links||[]).map((x:any)=>String(x.athlete_user_id)))];if(!ids.length){setLoading(false);return}const{data:profiles}=await c.from('profiles').select('id,full_name,email').in('id',ids);const pm=new Map((profiles||[]).map((p:any)=>[String(p.id),p]));setAthletes(ids.map(id=>({id,name:(pm.get(id) as any)?.full_name||(pm.get(id) as any)?.email||'Athlete'})));setLoading(false)})()},[preview.active,preview.role,preview.athleteId]);
 if(loading||athletes.length<=1)return null;const selected=athletes.some(a=>a.id===selectedAthleteId)?selectedAthleteId:athletes[0].id;
 const change=(id:string)=>{window.localStorage.setItem('rr-parent-athlete',id);const url=new URL(window.location.href);url.searchParams.set('athlete',id);window.location.href=url.pathname+url.search+url.hash};
 return <div className="sticky top-0 md:top-0 z-[45] border-b bg-white/95 backdrop-blur"><div className="max-w-7xl mx-auto px-4 sm:px-5 md:px-8 py-2.5 flex items-center justify-between gap-3"><div className="flex items-center gap-2 min-w-0"><Users size={17} className="shrink-0"/><div className="min-w-0"><div className="text-[11px] uppercase tracking-[.14em] font-black text-red-700">Parent View</div><div className="text-xs text-slate-500 hidden sm:block">Choose which athlete you are supporting.</div></div></div><label className="flex items-center gap-2 text-sm font-bold shrink-0"><span className="hidden sm:inline">Viewing</span><select className="input !min-h-9 !py-1.5 max-w-[210px]" value={selected} onChange={e=>change(e.target.value)}>{athletes.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label></div></div>
}
