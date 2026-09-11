'use client';
import {useEffect,useState} from 'react';
import AppShell from '@/components/AppShell';
import PageHeader from '@/components/PageHeader';
import {createClient} from '@/lib/supabase-browser';
import {Building2,CheckCircle2,LogOut,Plus,ShieldCheck} from 'lucide-react';

type Membership={organization_id:string;role:string;status:string;joined_at:string|null;organizations:any};
const one=(v:any)=>Array.isArray(v)?v[0]:v;

export default function OrganizationsPage(){
 const c=createClient();
 const [rows,setRows]=useState<Membership[]>([]),[code,setCode]=useState(''),[busy,setBusy]=useState(false),[msg,setMsg]=useState(''),[claimed,setClaimed]=useState(0);
 async function load(){
  const {data:{user}}=await c.auth.getUser();if(!user)return;
  const {data:claim}=await c.rpc('claim_pending_player_records_for_current_user');
  if(claim?.claimed)setClaimed(Number(claim.claimed)||0);
  const {data}=await c.from('organization_members').select('organization_id,role,status,joined_at,organizations(id,name)').eq('user_id',user.id).eq('role','athlete').order('joined_at',{ascending:false});
  setRows((data||[]) as any);
 }
 useEffect(()=>{load()},[]);
 async function join(){if(!code.trim())return;setBusy(true);setMsg('');const {error}=await c.rpc('join_organization_by_code',{code:code.trim()});setBusy(false);if(error){setMsg(error.message);return}setCode('');setMsg('Organization joined. Your recruiting account stays yours, and this organization now has access while the membership is active.');await load()}
 async function accept(orgId:string){setBusy(true);setMsg('');const {error}=await c.rpc('accept_organization_membership',{target_org:orgId});setBusy(false);if(error){setMsg(error.message);return}setMsg('Organization access approved.');await load()}
 async function leave(orgId:string,name:string){if(!confirm(`Leave ${name}? Your recruiting history stays in your Rebels Recruit account, but this organization will lose access.`))return;setBusy(true);setMsg('');const {error}=await c.rpc('leave_organization',{target_org:orgId});setBusy(false);if(error){setMsg(error.message);return}setMsg(`You left ${name}. Your recruiting history is still in your account.`);await load()}
 return <AppShell><div className="max-w-4xl mx-auto px-5 md:px-8 py-6"><PageHeader eyebrow="YOUR ACCESS" title="Organizations" subtitle="Join more than one team or organization and control who can access your recruiting information."/>
 {claimed>0&&<div className="card p-5 mb-5 border-green-200 bg-green-50"><div className="font-black flex items-center gap-2"><CheckCircle2 size={18}/>Your recruiting history is already here</div><p className="text-sm mt-1">We matched imported recruiting information to your verified email. Review any pending organization access below.</p></div>}
 {msg&&<div className="card p-4 mb-5 text-sm font-semibold">{msg}</div>}
 <div className="card p-5 sm:p-6 mb-5"><div className="flex gap-3 items-start"><Plus className="text-red-600 shrink-0"/><div><h2 className="font-black text-lg">Join Organization</h2><p className="muted text-sm mt-1">Use a team or organization code. You can belong to a travel team and high school team at the same time.</p></div></div><div className="flex flex-col sm:flex-row gap-2 mt-4"><input className="input flex-1" placeholder="Organization code" value={code} onChange={e=>setCode(e.target.value.toUpperCase())}/><button className="btn btn-red" disabled={busy||!code.trim()} onClick={join}>Join Organization</button></div></div>
 <div className="space-y-3">{rows.map(r=>{const org=one(r.organizations),name=org?.name||'Organization';return <div className="card p-5" key={r.organization_id}><div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"><div className="flex gap-3"><Building2 className="shrink-0"/><div><div className="font-black">{name}</div><div className="muted text-sm mt-1">{r.status==='active'?'Active access':r.status==='pending'?'Waiting for your approval':'Not active'}</div></div></div><div className="flex flex-wrap gap-2">{r.status==='pending'&&<button className="btn btn-red" disabled={busy} onClick={()=>accept(r.organization_id)}><ShieldCheck size={16}/>Approve Access</button>}{r.status==='active'&&<button className="btn" disabled={busy} onClick={()=>leave(r.organization_id,name)}><LogOut size={16}/>Leave Organization</button>}{r.status==='left'&&<button className="btn" disabled={busy} onClick={()=>accept(r.organization_id)}>Rejoin</button>}</div></div></div>})}{!rows.length&&<div className="rr-empty-state"><div className="font-black">No organizations yet</div><p>Join a travel team, high school program, or other organization when you are ready to share access.</p></div>}</div>
 <div className="card p-5 mt-5"><div className="font-black">Your account stays yours</div><p className="muted text-sm mt-1">Leaving an organization never deletes your schools, coaches, recruiting history, Journey, videos, or other player data. It only removes that organization's access.</p></div>
 </div></AppShell>}
