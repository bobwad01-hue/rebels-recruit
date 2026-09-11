'use client';

import Link from 'next/link';
import {useEffect,useMemo,useState} from 'react';
import {BarChart3,ChevronRight,Users} from 'lucide-react';
import AppShell from '@/components/AppShell';
import PageHeader from '@/components/PageHeader';
import {EmptyState,FilterBar,MetricCard,PageFrame,StatePanel} from '@/components/ProductUI';
import {createClient} from '@/lib/supabase-browser';

type Player={id:string;name:string;classYear?:number|null;teamIds:string[];ageGroups:string[];fit:any|null};
type Team={id:string;name:string;age_group?:string|null};
const arr=(v:any)=>Array.isArray(v)?v:[];
const money=(v:any)=>v==null?'Not set':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(v));
const duration=(m:any)=>{if(m==null)return 'Not set';if(m>=99999)return 'Anywhere';const h=Math.floor(Number(m)/60),r=Number(m)%60;return h?`${h} hr${h===1?'':'s'}${r?` ${r} min`:''}`:`${r} min`};
const pct=(n:number,d:number)=>d?`${Math.round(n/d*100)}%`:'0%';

export default function FitInsights(){
 const c=createClient();const [players,setPlayers]=useState<Player[]>([]),[teams,setTeams]=useState<Team[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const [team,setTeam]=useState('all'),[age,setAge]=useState('all'),[player,setPlayer]=useState('all');
 useEffect(()=>{load()},[]);
 async function load(){
  setLoading(true);setError('');
  try{
   const {data:{user},error:authError}=await c.auth.getUser();if(authError)throw authError;if(!user){setError('Sign in to view School Fit Insights.');return}
   const {data:membership,error:membershipError}=await c.from('organization_members').select('organization_id,role,organization_view_access,status').eq('user_id',user.id).eq('status','active').maybeSingle();if(membershipError)throw membershipError;if(!membership){setError('We could not find an active organization membership for this account.');return}
   const orgId=membership.organization_id;let athleteIds:string[]=[];
   if(membership.role==='owner'||membership.role==='admin'||membership.organization_view_access){const {data:members,error:e}=await c.from('organization_members').select('user_id').eq('organization_id',orgId).eq('role','athlete').eq('status','active');if(e)throw e;athleteIds=(members||[]).map((x:any)=>x.user_id)}
   else{const {data:assignments,error:e}=await c.from('athlete_advisor_assignments').select('athlete_user_id').eq('advisor_user_id',user.id).eq('organization_id',orgId).eq('status','active');if(e)throw e;athleteIds=(assignments||[]).map((x:any)=>x.athlete_user_id)}
   const [{data:t,error:teamError},{data:tm,error:memberError}]=await Promise.all([c.from('teams').select('id,name,age_group').eq('organization_id',orgId).order('name'),c.from('team_members').select('team_id,user_id')]);if(teamError)throw teamError;if(memberError)throw memberError;setTeams(t||[]);
   if(!athleteIds.length){setPlayers([]);return}
   const [{data:profiles,error:profileError},{data:athleteProfiles,error:athleteError},{data:fits,error:fitError}]=await Promise.all([c.from('profiles').select('id,full_name').in('id',athleteIds),c.from('athlete_profiles').select('user_id,class_year').in('user_id',athleteIds),c.from('college_fit_profiles').select('*').in('user_id',athleteIds)]);if(profileError)throw profileError;if(athleteError)throw athleteError;if(fitError)throw fitError;
   const pm=new Map((profiles||[]).map((x:any)=>[x.id,x]));const am=new Map((athleteProfiles||[]).map((x:any)=>[x.user_id,x]));const fm=new Map((fits||[]).map((x:any)=>[x.user_id,x]));const teamMap=new Map((t||[]).map((x:any)=>[x.id,x]));
   setPlayers(athleteIds.map(id=>{const tids=(tm||[]).filter((x:any)=>x.user_id===id).map((x:any)=>x.team_id);return {id,name:(pm.get(id) as any)?.full_name||'Player',classYear:(am.get(id) as any)?.class_year,teamIds:tids,ageGroups:[...new Set(tids.map((tid:string)=>(teamMap.get(tid) as any)?.age_group).filter(Boolean))] as string[],fit:fm.get(id)||null}}).sort((a,b)=>a.name.localeCompare(b.name)));
  }catch(e:any){console.error('School Fit Insights load failed',e);setError('We could not load School Fit Insights. Your recruiting data has not been changed. Check your connection and try again.')}finally{setLoading(false)}
 }
 const filtered=useMemo(()=>players.filter(p=>(team==='all'||p.teamIds.includes(team))&&(age==='all'||p.ageGroups.includes(age))&&(player==='all'||p.id===player)),[players,team,age,player]);
 const completed=filtered.filter(p=>p.fit);const total=filtered.length;
 const count=(key:string,value:string)=>completed.filter(p=>arr(p.fit?.[key]).includes(value)).length;
 const priorities=useMemo(()=>{const m=new Map<string,number>();completed.forEach(p=>arr(p.fit?.top_priorities).forEach((v:string)=>m.set(v,(m.get(v)||0)+1)));return [...m.entries()].sort((a,b)=>b[1]-a[1]).slice(0,8)},[completed]);
 const majors=useMemo(()=>{const m=new Map<string,number>();completed.forEach(p=>arr(p.fit?.academic_interests).forEach((v:string)=>m.set(v,(m.get(v)||0)+1)));return [...m.entries()].sort((a,b)=>b[1]-a[1]).slice(0,10)},[completed]);
 if(loading)return <AppShell><PageFrame size="5xl"><StatePanel title="Loading School Fit Insights" description="We’re gathering the players, teams, and Fit Profiles you’re allowed to view."/></PageFrame></AppShell>;
 if(error)return <AppShell><PageFrame size="5xl"><StatePanel tone="error" title="School Fit Insights unavailable" description={error} action={<button className="btn" onClick={load}>Try again</button>}/></PageFrame></AppShell>;
 return <AppShell><PageFrame>
  <PageHeader title="School Fit Insights" subtitle="See what matters to your players at the organization, team, age-group, and individual level."/>
  {!players.length ? (
   <EmptyState title="No players are in this view yet" description="When athletes are assigned to you—or added to the organization if you have organization-wide access—their School Fit preferences will appear here." href="/advisors/access" actionLabel="Review player access"/>
  ) : (
   <>
    <FilterBar><select className="input" value={team} onChange={e=>{setTeam(e.target.value);setPlayer('all')}}><option value="all">All teams</option>{teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select><select className="input" value={age} onChange={e=>{setAge(e.target.value);setPlayer('all')}}><option value="all">All age groups</option><option value="14U">14U</option><option value="16U">16U</option><option value="18U">18U</option></select><select className="input" value={player} onChange={e=>setPlayer(e.target.value)}><option value="all">All players in this view</option>{players.filter(p=>(team==='all'||p.teamIds.includes(team))&&(age==='all'||p.ageGroups.includes(age))).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></FilterBar>
    {!filtered.length ? (
     <div className="mt-5"><EmptyState title="No players match these filters" description="Your access is working, but this team, age-group, and player combination has no matches. Change a filter to broaden the view."/></div>
    ) : (
     <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5"><MetricCard label="Players in view" value={total}/><MetricCard label="Fit Profiles completed" value={completed.length} detail={pct(completed.length,total)}/><MetricCard label="Need a Fit Profile" value={total-completed.length}/><MetricCard label="Top priority" value={priorities[0]?.[0]||'—'} detail={priorities[0]?`${priorities[0][1]} player${priorities[0][1]===1?'':'s'}`:''}/></div>
      {player!=='all'&&filtered[0]&&<Individual player={filtered[0]}/>} 
      {player==='all'&&<><div className="grid lg:grid-cols-2 gap-5 mt-5"><Breakdown title="Distance from home" rows={[['≤ 2 hours',completed.filter(p=>(p.fit?.max_drive_minutes??99999)<=120).length],['≤ 4 hours',completed.filter(p=>(p.fit?.max_drive_minutes??99999)<=240).length],['≤ 6 hours',completed.filter(p=>(p.fit?.max_drive_minutes??99999)<=360).length],['Anywhere',completed.filter(p=>(p.fit?.max_drive_minutes??0)>=99999).length]]} total={completed.length}/><Breakdown title="Softball levels players will consider" rows={['NCAA DI','NCAA DII','NCAA DIII','NAIA','JUCO'].map(v=>[v,count('divisions',v)] as [string,number])} total={completed.length}/><Breakdown title="Top priorities" rows={priorities} total={completed.length}/><Breakdown title="School setting" rows={['Rural','College town','Suburban','Urban'].map(v=>[v,count('settings',v)] as [string,number])} total={completed.length}/><Breakdown title="School size" rows={['Small','Medium','Large'].map(v=>[v,count('school_sizes',v)] as [string,number])} total={completed.length}/><Breakdown title="Weather" rows={['Warm most of the year','Four seasons','Cooler climate','Snow is okay'].map(v=>[v,count('weather_preferences',v)] as [string,number])} total={completed.length}/><Breakdown title="Religious affiliation" rows={['Prefer religious affiliation','Open to religious affiliation','Don’t want religious affiliation','No preference'].map(v=>[v,count('religious_affiliation_preferences',v)] as [string,number])} total={completed.length}/><Breakdown title="Most common academic interests" rows={majors} total={completed.length}/></div>
      <section className="card p-5 mt-5"><div className="flex items-center gap-2"><Users size={18}/><h2 className="font-black text-lg">Players in this view</h2></div><div className="mt-4 divide-y">{filtered.map(p=><button key={p.id} onClick={()=>setPlayer(p.id)} className="w-full py-3 text-left flex items-center gap-3 hover:bg-slate-50 px-2 rounded-lg"><div className="flex-1"><div className="font-bold">{p.name}</div><div className="muted text-xs">{p.classYear?`Class of ${p.classYear}`:'Class year not set'} · {p.fit?'Fit Profile complete':'Fit Profile not completed'}</div></div><ChevronRight size={17}/></button>)}</div></section></>}
     </>
    )}
   </>
  )}
 </PageFrame></AppShell>;
}
function Breakdown({title,rows,total}:{title:string;rows:[string,number][];total:number}){return <section className="card p-5"><div className="flex items-center gap-2"><BarChart3 size={18}/><h2 className="font-black text-lg">{title}</h2></div><div className="mt-4 space-y-3">{rows.filter(([,n])=>n>0).map(([label,n])=><div key={label}><div className="flex justify-between text-sm"><span className="font-semibold">{label}</span><span>{n} · {pct(n,total)}</span></div><div className="h-2 bg-slate-100 rounded-full mt-1 overflow-hidden"><div className="h-full bg-slate-900" style={{width:pct(n,total)}}/></div></div>)}{!rows.some(([,n])=>n>0)&&<div className="muted text-sm">No completed answers in this view yet.</div>}</div></section>}
function Chips({values}:{values:any}){const a=arr(values);return a.length?<div className="flex flex-wrap gap-1.5">{a.map((v:string)=><span key={v} className="pill text-xs">{v}</span>)}</div>:<span className="muted">Not set</span>}
function Individual({player}:{player:Player}){const f=player.fit;if(!f)return <section className="card p-6 mt-5"><h2 className="font-black text-xl">{player.name}</h2><p className="muted mt-2">This player has not completed a School Fit Profile yet.</p><Link href={`/advisors/player/${player.id}`} className="btn mt-4">Open Player</Link></section>;return <section className="card p-6 mt-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-black text-2xl">{player.name} · School Fit Profile</h2><p className="muted text-sm mt-1">Last updated {f.updated_at?new Date(f.updated_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):'not available'}</p></div><Link href={`/advisors/player/${player.id}`} className="btn">Open Player</Link></div><div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 mt-6"><Field label="Top priorities"><Chips values={f.top_priorities}/></Field><Field label="Distance">{duration(f.max_drive_minutes)}{f.distance_importance?` · ${f.distance_importance}`:''}</Field><Field label="Maximum annual cost">{money(f.max_annual_cost)}{f.cost_importance?` · ${f.cost_importance}`:''}</Field><Field label="Would attend with no athletic scholarship">{f.athletic_aid_required||'Not set'}</Field><Field label="Academic interests"><Chips values={f.academic_interests}/></Field><Field label="Softball levels"><Chips values={f.divisions}/></Field><Field label="School sizes"><Chips values={f.school_sizes}/></Field><Field label="Campus settings"><Chips values={f.settings}/></Field><Field label="Weather"><Chips values={f.weather_preferences}/></Field><Field label="School types"><Chips values={f.school_types}/></Field><Field label="Religious affiliation"><Chips values={f.religious_affiliation_preferences}/></Field><Field label="Competition priorities"><Chips values={f.competition_preferences}/></Field><Field label="Campus experience"><Chips values={f.campus_experience}/></Field><Field label="City access"><Chips values={f.city_access_preferences}/></Field>{f.notes&&<Field label="Player notes" wide>{f.notes}</Field>}</div></section>}
function Field({label,children,wide=false}:{label:string;children:React.ReactNode;wide?:boolean}){return <div className={`rounded-xl border p-4 ${wide?'md:col-span-2 xl:col-span-3':''}`}><div className="muted text-xs font-bold uppercase">{label}</div><div className="mt-2 text-sm font-semibold">{children}</div></div>}
