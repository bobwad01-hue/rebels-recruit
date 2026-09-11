import Link from 'next/link';
import AppShell from '@/components/AppShell';
import PageHeader from '@/components/PageHeader';
import SupportCaseActions from '@/components/SupportCaseActions';
import {createClient} from '@/lib/supabase-server';
import {createAdminClient} from '@/lib/supabase-admin';
import {AlertTriangle} from 'lucide-react';

export const dynamic='force-dynamic';

const label=(v:string)=>({
  missing_athlete:'Missing athlete',
  wrong_organization_access:'Wrong organization access',
  missing_import_history:'Missing import history',
  google_disconnected:'Google disconnected',
  wrong_team:'Wrong team',
  parent_access:'Parent access',
  account_deletion:'Account deletion',
  other:'Other'
} as any)[v]||v;
const statusLabel=(v:string)=>({open:'Open',investigating:'Investigating',resolved:'Resolved'} as any)[v]||v;
const eventLabel=(v:string)=>({status_changed:'Status changed',note_updated:'Investigation note updated'} as any)[v]||v;

export default async function SupportPage({searchParams}:{searchParams:Promise<{organization?:string}>}){
  const c=await createClient();
  const admin=createAdminClient();
  const{data:{user}}=await c.auth.getUser();
  if(!user)return null;

  const{data:memberships,error:membershipError}=await c.from('organization_members').select('organization_id,role,organizations(name)').eq('user_id',user.id).eq('status','active');
  const staffMemberships=(memberships||[]).filter((m:any)=>m.role==='owner'||m.role==='admin');
  if(membershipError||!staffMemberships.length)return <AppShell><div className="max-w-6xl mx-auto px-5 md:px-8 py-6"><PageHeader title="Support Cases" subtitle="Diagnose organization access and data issues."/><div className="card p-6 border-amber-200 bg-amber-50"><div className="font-black flex gap-2"><AlertTriangle size={18}/>You do not have access to support diagnostics</div><p className="text-sm mt-2">This page is limited to active organization Owners and Admins.</p></div></div></AppShell>;

  const params=await searchParams;
  const requested=typeof params.organization==='string'?params.organization:'';
  const me=staffMemberships.find((m:any)=>m.organization_id===requested)||staffMemberships[0];
  const orgName=Array.isArray(me.organizations)?me.organizations[0]?.name:me.organizations?.name;

  const{data:cases,error:caseError}=await admin.from('support_cases').select('id,reporter_user_id,organization_id,category,status,description,diagnostic_snapshot,created_at,updated_at,resolved_at,resolution_note').eq('organization_id',me.organization_id).order('created_at',{ascending:false}).limit(100);
  if(caseError)return <AppShell><div className="max-w-6xl mx-auto px-5 md:px-8 py-6"><PageHeader title="Support Cases" subtitle="Diagnose organization access and data issues."/><div className="card p-6 border-amber-200 bg-amber-50"><div className="font-black">Support cases are temporarily unavailable</div><p className="text-sm mt-2">The organization is still intact. Try loading this page again later.</p></div></div></AppShell>;

  const reporterIds=[...new Set((cases||[]).map((x:any)=>x.reporter_user_id).filter(Boolean))];
  const caseIds=(cases||[]).map((x:any)=>x.id);
  const [profileResult,eventResult]=await Promise.all([
    reporterIds.length?admin.from('profiles').select('id,full_name,email').in('id',reporterIds):Promise.resolve({data:[],error:null}),
    caseIds.length?admin.from('support_case_events').select('id,case_id,event_type,from_status,to_status,note,created_at').in('case_id',caseIds).order('created_at',{ascending:false}):Promise.resolve({data:[],error:null})
  ] as any);
  const profiles=(profileResult as any).data||[],profileError=(profileResult as any).error;
  const caseEvents=(eventResult as any).data||[],eventError=(eventResult as any).error;
  const pm=new Map(profiles.map((p:any)=>[p.id,p]));
  const eventsByCase=new Map<string,any[]>();
  for(const event of caseEvents){const list=eventsByCase.get(event.case_id)||[];list.push(event);eventsByCase.set(event.case_id,list)}

  return <AppShell><div className="max-w-6xl mx-auto px-5 md:px-8 py-6"><PageHeader title="Support Cases" subtitle={`Investigate issues reported to ${orgName||'this organization'} without changing recruiting data until the cause is clear.`}/>
    {staffMemberships.length>1&&<div className="card p-4 mb-5"><div className="text-sm font-black">Organization</div><div className="flex flex-wrap gap-2 mt-2">{staffMemberships.map((m:any)=>{const n=Array.isArray(m.organizations)?m.organizations[0]?.name:m.organizations?.name;const active=m.organization_id===me.organization_id;return <Link key={m.organization_id} href={`/organization/support?organization=${encodeURIComponent(m.organization_id)}`} className={`btn ${active?'btn-red':''}`}>{n||'Organization'}</Link>})}</div></div>}
    {profileError&&<div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold">Cases loaded, but some reporter names are temporarily unavailable.</div>}
    {eventError&&<div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold">Cases loaded, but some investigation history is temporarily unavailable.</div>}
    <div className="space-y-3">{(cases||[]).map((x:any)=>{const p:any=pm.get(x.reporter_user_id),d=x.diagnostic_snapshot||{},history=eventsByCase.get(x.id)||[];return <div className="card p-5" key={x.id}><div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2"><div><div className="rr-eyebrow">{label(x.category)}</div><div className="font-black text-lg">{p?.full_name||p?.email||'Organization user'}</div><div className="muted text-xs mt-1">Case {String(x.id).slice(0,8).toUpperCase()} · Created {new Date(x.created_at).toLocaleString()}</div>{x.resolved_at&&<div className="muted text-xs mt-1">Resolved {new Date(x.resolved_at).toLocaleString()}</div>}</div><span className="status-pill">{statusLabel(x.status)}</span></div><p className="text-sm mt-4">{x.description}</p><div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2 mt-4 text-xs"><Diag k="Active organizations" v={Array.isArray(d.active_organizations)?d.active_organizations.length:'Not captured'}/><Diag k="Schools" v={d.school_count??'Not captured'}/><Diag k="Coach relationships" v={d.coach_relationship_count??'Not captured'}/><Diag k="Recorded activity" v={d.interaction_count??'Not captured'}/><Diag k="Parent links as parent" v={d.parent_links_as_parent??'Not captured'}/><Diag k="Parent links as athlete" v={d.parent_links_as_athlete??'Not captured'}/><Diag k="Google Calendar" v={d.google_connection?.calendar_connected?'Connected':d.google_connection?'Not connected':'No connection record'}/></div><SupportCaseActions caseId={x.id} status={x.status} resolutionNote={x.resolution_note}/>{history.length>0&&<details className="mt-4 border-t pt-4"><summary className="cursor-pointer font-bold text-sm">Investigation history ({history.length})</summary><div className="mt-3 space-y-2">{history.slice(0,12).map((e:any)=><div key={e.id} className="rounded-xl border p-3 text-sm"><div className="font-bold">{eventLabel(e.event_type)}{e.from_status!==e.to_status?` · ${statusLabel(e.from_status)} to ${statusLabel(e.to_status)}`:''}</div><div className="muted text-xs mt-1">{new Date(e.created_at).toLocaleString()}</div>{e.note&&<p className="mt-2 whitespace-pre-wrap">{e.note}</p>}</div>)}</div></details>}</div>})}{!cases?.length&&<div className="card p-8 text-center"><div className="font-black">No support cases</div><p className="muted text-sm mt-1">Users can choose this organization when creating a diagnostic support case from Settings.</p></div>}</div>
  </div></AppShell>;
}

function Diag({k,v}:{k:string;v:any}){return <div className="rounded-xl border p-3"><div className="muted">{k}</div><div className="font-black mt-1">{String(v)}</div></div>}
