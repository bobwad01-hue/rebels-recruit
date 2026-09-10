import AppShell from '@/components/AppShell';
import PageHeader from '@/components/PageHeader';
import AdvisorInvitationActions from '@/app/dashboard/AdvisorInvitationActions';
import FamilyAccessSection from './FamilyAccessSection';
import {createClient} from '@/lib/supabase-server';
import {UserPlus,UsersRound} from 'lucide-react';

export default async function ManageAccessPage(){
 const c=await createClient();
 const {data:{user}}=await c.auth.getUser();
 if(!user)return null;
 const {data:requests}=await c.from('athlete_advisor_assignments').select('id,advisor_user_id,relationship_type,invited_at,status').eq('athlete_user_id',user.id).eq('status','pending').order('invited_at',{ascending:false});
 const ids=[...new Set((requests||[]).map((r:any)=>r.advisor_user_id))];
 const {data:profiles}=ids.length?await c.from('profiles').select('id,full_name,email').in('id',ids):{data:[]};
 const names=new Map((profiles||[]).map((p:any)=>[p.id,p]));
 return <AppShell><div className="max-w-4xl mx-auto px-5 md:px-8 py-6"><PageHeader title="Manage Access" subtitle="Control who can view and help with your recruiting information."/>
 <section className="mt-6"><div className="flex items-center gap-2 mb-3"><UserPlus size={18}/><div><h2 className="font-black text-lg">Advisor Access</h2><p className="muted text-sm">Review advisor requests and decide who can help with your recruiting journey.</p></div></div><div className="space-y-3">{(requests||[]).map((r:any)=>{const p:any=names.get(r.advisor_user_id);return <div key={r.id} className="card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"><div><div className="font-black text-lg">{p?.full_name||p?.email||'Recruiting advisor'}</div><div className="muted text-sm mt-1">is requesting access to help with your recruiting journey.</div>{r.relationship_type&&<div className="text-xs muted mt-2">Relationship: {r.relationship_type}</div>}</div><AdvisorInvitationActions id={r.id}/></div>})}{!requests?.length&&<div className="card p-6 text-center"><div className="font-black">No pending advisor requests</div><div className="muted text-sm mt-2">New advisor requests will appear here for you to accept or decline.</div></div>}</div></section>
 <section className="mt-9 pt-8 border-t"><div className="flex items-center gap-2 mb-3"><UsersRound size={18}/><div><h2 className="font-black text-lg">Family Access</h2><p className="muted text-sm">Approve parents or guardians and choose exactly what they can see.</p></div></div><FamilyAccessSection/></section>
 </div></AppShell>;
}
