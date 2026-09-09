import AppShell from '@/components/AppShell';
import PageHeader from '@/components/PageHeader';
import AdvisorInvitationActions from '@/app/dashboard/AdvisorInvitationActions';
import {createClient} from '@/lib/supabase-server';

export default async function AdvisorRequestsPage(){
 const c=await createClient();const {data:{user}}=await c.auth.getUser();if(!user)return null;
 const {data:requests}=await c.from('athlete_advisor_assignments').select('id,advisor_user_id,relationship_type,invited_at,status').eq('athlete_user_id',user.id).eq('status','pending').order('invited_at',{ascending:false});
 const ids=[...new Set((requests||[]).map((r:any)=>r.advisor_user_id))];
 const {data:profiles}=ids.length?await c.from('profiles').select('id,full_name,email').in('id',ids):{data:[]};
 const names=new Map((profiles||[]).map((p:any)=>[p.id,p]));
 return <AppShell><div className="max-w-4xl mx-auto px-5 md:px-8 py-6"><PageHeader title="Advisor Requests" subtitle="You control which recruiting advisors can access your recruiting information."/>
 <div className="space-y-3 mt-5">{(requests||[]).map((r:any)=>{const p:any=names.get(r.advisor_user_id);return <section key={r.id} className="card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"><div><div className="font-black text-lg">{p?.full_name||p?.email||'Recruiting advisor'}</div><div className="muted text-sm mt-1">is requesting access to help with your recruiting journey.</div>{r.relationship_type&&<div className="text-xs muted mt-2">Relationship: {r.relationship_type}</div>}</div><AdvisorInvitationActions id={r.id}/></section>})}{!requests?.length&&<div className="card p-8 text-center"><div className="font-black">No pending advisor requests</div><div className="muted text-sm mt-2">New requests will appear here for you to accept or decline.</div></div>}</div></div></AppShell>
}
