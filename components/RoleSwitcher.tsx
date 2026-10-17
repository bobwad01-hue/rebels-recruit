'use client';
import {useEffect,useState} from 'react';
import {createClient} from '@/lib/supabase-browser';

const labels:Record<string,string>={athlete:'Athlete',parent:'Parent / Guardian',advisor:'Advisor',admin:'Admin'};
const homes:Record<string,string>={athlete:'/dashboard',parent:'/parent',advisor:'/advisors',admin:'/organization'};

export default function RoleSwitcher({activeRole,platformView=false}:{activeRole:string;platformView?:boolean}){
 const c=createClient();
 const[roles,setRoles]=useState<string[]>([]);
 const[superOwner,setSuperOwner]=useState(false);
 const[teamAdminOnly,setTeamAdminOnly]=useState(false);
 useEffect(()=>{
  c.auth.getUser().then(async({data:{user}})=>{
   if(!user)return;
   const[{data},{data:platform}]=await Promise.all([
    c.from('user_roles').select('role').eq('user_id',user.id),
    c.from('platform_roles').select('role').eq('user_id',user.id).eq('role','super_owner').maybeSingle(),
   ]);
   setSuperOwner(Boolean(platform));
   const order=['admin','advisor','parent','athlete'];
   const available=new Set((data||[]).map((x:any)=>x.role));
   if(available.has('athlete')){
    const{data:athleteProfile}=await c.from('athlete_profiles').select('user_id').eq('user_id',user.id).maybeSingle();
    if(!athleteProfile)available.delete('athlete');
   }
   setRoles(order.filter(r=>available.has(r)));
   if(available.has('admin')){
    const [{data:orgAdmin},{data:teamAdmin}]=await Promise.all([
      c.from('organization_members').select('organization_id').eq('user_id',user.id).eq('role','admin').eq('status','active').limit(1),
      c.from('team_user_roles').select('team_id').eq('user_id',user.id).eq('role','admin').eq('status','active').limit(1),
    ]);
    setTeamAdminOnly(!orgAdmin?.length&&Boolean(teamAdmin?.length));
   }
  });
 },[]);
 if(roles.length<2&&!superOwner)return null;
 function choose(role:string){
  if(role==='super_owner'){window.location.assign('/platform-admin');return}
  window.localStorage.setItem('rr-active-view',role);
  document.cookie=`rr-active-view=${encodeURIComponent(role)}; Path=/; Max-Age=31536000; SameSite=Lax`;
  window.location.assign(role==='admin'&&teamAdminOnly?'/advisors':homes[role]||'/dashboard');
 }
 return <div className="mb-2 rounded-xl border bg-slate-50 p-2">
  <div className="px-2 pb-1 text-[10px] font-black uppercase tracking-[.12em] text-slate-400">Switch View</div>
  {superOwner&&<button type="button" onClick={()=>choose('super_owner')} aria-current={platformView?'true':undefined} className={`w-full rounded-lg px-2.5 py-2 text-left text-xs font-bold ${platformView?'bg-white text-slate-950 shadow-sm':'text-slate-600 hover:bg-white'}`}>Super Owner</button>}
  {roles.map(r=><button type="button" key={r} onClick={()=>choose(r)} aria-current={!platformView&&activeRole===r?'true':undefined} className={`w-full rounded-lg px-2.5 py-2 text-left text-xs font-bold ${!platformView&&activeRole===r?'bg-white text-slate-950 shadow-sm':'text-slate-600 hover:bg-white'}`}>{r==='admin'&&teamAdminOnly?'Team Admin':labels[r]||r}</button>)}
 </div>;
}
