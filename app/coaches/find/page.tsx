import AppShell from '@/components/AppShell';
import PageHeader from '@/components/PageHeader';
import {PageFrame,StatePanel} from '@/components/ProductUI';
import FindCoaches from '@/components/FindCoaches';
import {createClient} from '@/lib/supabase-server';

export default async function FindCoachesPage({searchParams}:{searchParams:Promise<{search?:string;college?:string}>}){
 const c=await createClient();
 const {data:{user}}=await c.auth.getUser();
 if(!user)return <AppShell><PageFrame size="5xl"><StatePanel tone="error" title="Sign in to find coaches" description="Sign in as an athlete to save coach connections."/></PageFrame></AppShell>;
 const params=await searchParams;
 return <AppShell><PageFrame size="5xl">
  <PageHeader eyebrow="COACH DIRECTORY" title="Find Coaches" subtitle="Search college softball coaches by name or school, then choose who belongs in your recruiting connections."/>
  <FindCoaches athleteId={user.id} initialSearch={typeof params.search==='string'?params.search.slice(0,100):''} collegeId={typeof params.college==='string'?params.college:''}/>
 </PageFrame></AppShell>;
}
