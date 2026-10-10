'use client';
import {useEffect,useState} from 'react';
import {createClient} from '@/lib/supabase-browser';

const labels:Record<string,string>={athlete:'Athlete',parent:'Parent / Guardian',advisor:'Advisor',admin:'Admin'};
const homes:Record<string,string>={athlete:'/dashboard',parent:'/parent',advisor:'/advisors',admin:'/advisors'};

export default function RoleSwitcher({activeRole}:{activeRole:string}){
 const c=createClient();const[roles,setRoles]=useState<string[]>([]);
 useEffect(()=>{c.auth.getUser().then(async({data:{user}})=>{if(!user)return;const{data}=await c.from('user_roles').select('role').eq('user_id',user.id);const order=['admin','advisor','parent','athlete'];const available=new Set((data||[]).map((x:any)=>x.role));if(available.has('athlete')){const{data:athleteProfile}=await c.from('athlete_profiles').select('user_id').eq('user_id',user.id).maybeSingle();if(!athleteProfile)available.delete('athlete')}setRoles(order.filter(r=>available.has(r)))})},[]);
 if(roles.length<2)return null;
 function choose(role:string){window.localStorage.setItem('rr-active-view',role);document.cookie=`rr-active-view=${encodeURIComponent(role)}; Path=/; Max-Age=31536000; SameSite=Lax`;window.location.assign(homes[role]||'/dashboard')}
 return <div className="mb-2 rounded-xl border bg-slate-50 p-2"><div className="px-2 pb-1 text-[10px] font-black uppercase tracking-[.12em] text-slate-400">Switch View</div>{roles.map(r=><button type="button" key={r} onClick={()=>choose(r)} aria-current={activeRole===r?'true':undefined} className={`w-full rounded-lg px-2.5 py-2 text-left text-xs font-bold ${activeRole===r?'bg-white text-slate-950 shadow-sm':'text-slate-600 hover:bg-white'}`}>{labels[r]||r}</button>)}</div>
}