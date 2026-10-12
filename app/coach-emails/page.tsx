import AppShell from '@/components/AppShell';
import PageHeader from '@/components/PageHeader';
import CoachEmailAlerts from '@/components/CoachEmailAlerts';
import {createClient} from '@/lib/supabase-server';
import {redirect} from 'next/navigation';
export const dynamic='force-dynamic';
export default async function CoachEmailInbox(){
 const c=await createClient();
 const {data:{user}}=await c.auth.getUser();
 if(!user)redirect('/login');
 return <AppShell><div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8"><PageHeader title="Coach Emails" subtitle="Your recruiting email conversations, organized around what needs your attention."/><div className="mt-5"><CoachEmailAlerts variant="inbox"/></div></div></AppShell>;
}
