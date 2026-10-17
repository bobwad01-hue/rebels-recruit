import AppShell from '@/components/AppShell';
import PageHeader from '@/components/PageHeader';
import AdvisorInvitationActions from '@/app/dashboard/AdvisorInvitationActions';
import FamilyAccessSection from './FamilyAccessSection';
import AdvisorAccessActions from './AdvisorAccessActions';
import TeamAdminAccessActions from './TeamAdminAccessActions';
import {createClient} from '@/lib/supabase-server';
import {createAdminClient} from '@/lib/supabase-admin';
import {UserPlus,UsersRound,AlertTriangle} from 'lucide-react';

export default async function ManageAccessPage(){
 const c=await createClient();
 const {data:{user},error:authError}=await c.auth.getUser();
 if(authError||!user)return <AppShell><div className="max-w-4xl mx-auto px-5 md:px-8 py-6"><PageHeader title="Support Team" subtitle="Choose who can support your recruiting journey and manage their access."/><div className="card p-6 border-amber-200 bg-amber-50"><div className="font-black flex items-center gap-2"><AlertTriangle size={18}/>Access settings are unavailable</div><p className="text-sm mt-2">We could not verify your account. Sign in again or refresh the page. No permissions have been changed.</p></div></div></AppShell>;
 const admin=createAdminClient();
 const {data:requests,error:requestsError}=await c.from('athlete_advisor_assignments').select('id,advisor_user_id,relationship_type,invited_at,status').eq('athlete_user_id',user.id).eq('status','pending').order('invited_at',{ascending:false});
 const {data:activeAdvisors,error:activeError}=await c.from('athlete_advisor_assignments').select('id,advisor_user_id,relationship_type,status').eq('athlete_user_id',user.id).eq('status','active');
 const ids=[...new Set([...(requests||[]),...(activeAdvisors||[])].map((r:any)=>r.advisor_user_id))];
 const {data:profiles,error:profilesError}=ids.length?await admin.from('profiles').select('id,full_name,email').in('id',ids):{data:[],error:null};
 const names=new Map((profiles||[]).map((p:any)=>[p.id,p]));
 // Team Admin access is derived from the athlete's current team memberships.
 // No per-athlete invitation is needed; explicit athlete revocations take priority.
 const {data:myTeams,error:myTeamsError}=await admin.from('team_members')
   .select('team_id,teams(id,name,archived_at)').eq('user_id',user.id);
 const activeTeams=(myTeams||[]).filter((m:any)=>!m.teams?.archived_at);
 const teamIds=[...new Set(activeTeams.map((m:any)=>String(m.team_id)))];
 const [teamAdminsResult,revocationsResult]=await Promise.all([
  teamIds.length?admin.from('team_user_roles').select('team_id,user_id').in('team_id',teamIds)
    .eq('role','admin').eq('status','active'):{data:[],error:null},
  admin.from('athlete_team_admin_revocations').select('admin_user_id').eq('athlete_user_id',user.id),
 ]);
 const teamAdminIds=[...new Set((teamAdminsResult.data||[]).map((x:any)=>String(x.user_id)).filter(id=>id!==user.id))];
 const {data:teamAdminProfiles,error:teamAdminProfilesError}=teamAdminIds.length
   ?await admin.from('profiles').select('id,full_name,email').in('id',teamAdminIds)
   :{data:[],error:null};
 const teamAdminNames=new Map((teamAdminProfiles||[]).map((p:any)=>[String(p.id),p]));
 const blockedAdmins=new Set((revocationsResult.data||[]).map((x:any)=>String(x.admin_user_id)));
 const teamNameById=new Map(activeTeams.map((x:any)=>[String(x.team_id),String(x.teams?.name||'Team')]));
 const teamAdmins=teamAdminIds.map(id=>({
   id,profile:teamAdminNames.get(id) as any,
   teams:[...new Set((teamAdminsResult.data||[]).filter((x:any)=>String(x.user_id)===id).map((x:any)=>teamNameById.get(String(x.team_id))||'Team'))],
   revoked:blockedAdmins.has(id),
 }));
 const teamAdminError=myTeamsError||teamAdminsResult.error||revocationsResult.error||teamAdminProfilesError;
 return <AppShell><div className="max-w-4xl mx-auto px-5 md:px-8 py-6"><PageHeader title="Support Team" subtitle="Choose who can support your recruiting journey and manage their access."/>
 <section className="mt-6"><div className="mb-5 rounded-xl border bg-slate-50 p-4"><div className="font-black">You control your Support Team.</div><p className="muted text-sm mt-1">Pending Parent / Guardian and Advisor requests appear here. Parent / Guardian and recruiting Advisor connections require your approval. Team Admins assigned to your team automatically receive access to your recruiting work, but you can revoke a Team Admin's access below. Approved Advisors can also review tracked recruiting emails, including saved message text and coach replies. You can revoke their access at any time.</p></div><div className="flex items-center gap-2 mb-3"><UserPlus size={18}/><div><h2 className="font-black text-lg">Pending Advisor Requests</h2><p className="muted text-sm">Approve or decline Advisors who want to help with your recruiting journey.</p></div></div><div className="space-y-3">{requestsError?<div className="card p-6 border-amber-200 bg-amber-50"><div className="font-black flex items-center gap-2"><AlertTriangle size={18}/>Advisor requests are temporarily unavailable</div><p className="text-sm mt-2">We could not load advisor requests. This does not mean you have no requests, and no access has been changed.</p></div>:<>{profilesError&&<div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold">Advisor requests loaded, but some advisor names are temporarily unavailable.</div>}{(requests||[]).map((r:any)=>{const p:any=names.get(r.advisor_user_id);const advisorName=typeof p?.full_name==='string'?p.full_name.trim():'';return <div key={r.id} className="card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"><div><div className="font-black text-lg">{advisorName||'Advisor name unavailable'}</div><div className="muted text-sm mt-1">{r.relationship_type||'Recruiting Advisor'}{p?.email?` · ${p.email}`:''}</div><div className="muted text-sm mt-1">Wants access to help with your recruiting journey, including tracked coach emails and their saved message content.</div>{!advisorName&&<div className="text-sm text-amber-700 mt-2">We cannot display this advisor's name right now. Try again before accepting.</div>}</div><AdvisorInvitationActions id={r.id} canAccept={Boolean(advisorName)}/></div>})}{!requests?.length&&<div className="card p-6 text-center"><div className="font-black">No pending advisor requests</div><div className="muted text-sm mt-2">New advisor requests will appear here for you to accept or decline.</div></div>}</>}</div></section>
 <section className="mt-9 pt-8 border-t"><div className="flex items-center gap-2 mb-3"><UsersRound size={18}/><div><h2 className="font-black text-lg">Parent / Guardian Access</h2><p className="muted text-sm">Approve parents or guardians for full recruiting visibility, or revoke their entire connection.</p></div></div><FamilyAccessSection/></section>
 <section className="mt-9 pt-8 border-t">
  <div className="flex items-center gap-2 mb-3"><UsersRound size={18}/><div>
   <h2 className="font-black text-lg">Team Admin Access</h2>
   <p className="muted text-sm">Team Admins are connected automatically through your team. You decide whether each Team Admin can access your recruiting work.</p>
  </div></div>
  {teamAdminError?<div role="alert" className="card p-5 border-amber-200 bg-amber-50 text-sm">Team Admin access could not be verified. No access settings have been changed. Please refresh and try again.</div>
  :<div className="space-y-3">{teamAdmins.map(t=><div key={t.id} className="card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
   <div><div className="font-black text-lg">{t.profile?.full_name||t.profile?.email||'Team Admin'}</div>
   {t.profile?.email&&<div className="muted text-sm mt-1">{t.profile.email}</div>}
   <div className="text-xs muted mt-2">Team{t.teams.length===1?'':'s'}: {t.teams.join(', ')}</div>
   <div className={`text-xs font-bold mt-2 ${t.revoked?'text-amber-800':'text-green-700'}`}>{t.revoked?'Access revoked by you':'Automatic team access active'}</div>
   </div>
   <TeamAdminAccessActions adminId={t.id} revoked={t.revoked}/>
  </div>)}
  {!teamAdmins.length&&<div className="card p-6 text-center"><div className="font-black">No Team Admins assigned</div><div className="muted text-sm mt-2">Your team's Admins will appear here when assigned.</div></div>}
  </div>}
  <p className="muted text-xs mt-3">Revoking access removes this person's automatic Team Admin permission for your recruiting data. It does not remove their team role or affect other athletes. If you have separately approved this person as an Advisor, revoke that connection in Advisor Access as well.</p>
 </section>
 <section className="mt-9 pt-8 border-t"><div className="flex items-center gap-2 mb-3"><UsersRound size={18}/><div><h2 className="font-black text-lg">Advisor Access</h2><p className="muted text-sm">Approved Advisors can view your recruiting activity and tracked email messages, including saved message content and coach replies. You can revoke an Advisor's access at any time.</p></div></div>{activeError?<div className="card p-5 border-amber-200 bg-amber-50 text-sm">Advisor access is temporarily unavailable. No access has been changed.</div>:<div className="space-y-3">{(activeAdvisors||[]).map((r:any)=>{const p:any=names.get(r.advisor_user_id);return <div key={r.id} className="card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"><div><div className="font-black text-lg">{p?.full_name||p?.email||'Recruiting advisor'}</div>{p?.email&&<div className="muted text-sm mt-1">{p.email} · active</div>}{r.relationship_type&&<div className="text-xs muted mt-2">Relationship: {r.relationship_type}</div>}</div><AdvisorAccessActions id={r.id}/></div>})}{!activeAdvisors?.length&&<div className="card p-6 text-center"><div className="font-black">No active advisors</div><div className="muted text-sm mt-2">Advisors you approve will appear here.</div></div>}</div>}</section>
 </div></AppShell>;
}
