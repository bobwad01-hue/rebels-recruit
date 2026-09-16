import Link from 'next/link';
import AppShell from '@/components/AppShell';
import PageHeader from '@/components/PageHeader';
import PushNotificationSettings from '@/components/PushNotificationSettings';
import PasswordSettings from '@/components/PasswordSettings';
import GoogleWorkspaceSettings from '@/components/GoogleWorkspaceSettings';
import AccountLifecycleSettings from '@/components/AccountLifecycleSettings';
import SupportCaseForm from '@/components/SupportCaseForm';
import {UsersRound,Building2,ChevronRight,AlertCircle} from 'lucide-react';
import {createClient} from '@/lib/supabase-server';

export default async function Settings(){
 const c=await createClient();
 const {data:{user}}=await c.auth.getUser();
 let peoplePending=0;
 if(user){
  const [{count:advisorPending},{count:familyPending}]=await Promise.all([
   c.from('athlete_advisor_assignments').select('id',{count:'exact',head:true}).eq('athlete_user_id',user.id).eq('status','pending'),
   c.from('parent_guardian_access').select('id',{count:'exact',head:true}).eq('athlete_user_id',user.id).eq('status','pending')
  ]);
  peoplePending=(advisorPending||0)+(familyPending||0);
 }
 return <AppShell><div className="max-w-4xl mx-auto px-5 md:px-8 py-6"><PageHeader title="Settings" subtitle="Account, access, notifications, and optional connections."/><div className="space-y-6"><div className="card p-6"><h2 className="font-black text-lg">Access & Permissions</h2><p className="muted text-sm mt-1">Control which parents, guardians, recruiting advisors, teams, and organizations can access your recruiting information.</p>{peoplePending>0&&<div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex gap-3 text-sm text-red-800"><AlertCircle size={18} className="shrink-0 mt-0.5"/><div><b>{peoplePending} access request{peoplePending===1?' needs':'s need'} your attention.</b><div className="mt-0.5">Review the highlighted Manage People Access section below.</div></div></div>}<div className="mt-4 space-y-3"><Link href="/manage-access" className={`rounded-xl p-4 flex items-center gap-3 transition ${peoplePending>0?'border-2 border-red-300 bg-red-50/60 shadow-sm hover:bg-red-50':'border hover:bg-slate-50'}`}><UsersRound size={20}/><div className="flex-1"><div className="flex flex-wrap items-center gap-2"><div className="font-black">Manage People Access</div>{peoplePending>0&&<span className="rounded-full bg-red-600 text-white px-2 py-0.5 text-[10px] font-black">{peoplePending} TO-DO</span>}</div><div className="muted text-xs mt-0.5">Review parent, guardian, and recruiting advisor permissions.</div>{peoplePending>0&&<div className="text-xs font-black text-red-700 mt-1">Action required →</div>}</div><ChevronRight size={18}/></Link><Link href="/organizations" className="border rounded-xl p-4 flex items-center gap-3 hover:bg-slate-50"><Building2 size={20}/><div className="flex-1"><div className="font-black">Organizations</div><div className="muted text-xs mt-0.5">Join multiple teams or organizations, approve access, or leave an organization.</div></div><ChevronRight size={18}/></Link></div></div><GoogleWorkspaceSettings/><PasswordSettings/><PushNotificationSettings/><SupportCaseForm/><AccountLifecycleSettings/><div className="card p-6"><h2 className="font-black">Rebels Recruit</h2><p className="muted mt-2">Your recruiting data stays in your account. Leaving a team or organization removes its access without deleting your recruiting history. Phone alerts use free web push notifications rather than paid text messages.</p></div></div></div></AppShell>
}