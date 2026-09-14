import AppShell from '@/components/AppShell';
import CollegesCoachesBoard from '@/components/CollegesCoachesBoard';
import PageHeader from '@/components/PageHeader';
import {EmptyState,PageFrame,StatePanel} from '@/components/ProductUI';
import {createClient} from '@/lib/supabase-server';
import {resolveOwnerPreview} from '@/lib/owner-preview';

async function loadAllColleges(supabase:any){
 const rows:any[]=[];
 for(let from=0;from<20000;from+=1000){
  const {data,error}=await supabase.from('colleges').select('id,name,division,state,city,conference,school_type').order('name').range(from,from+999);
  if(error)throw error;
  rows.push(...(data||[]));
  if(!data||data.length<1000)break;
 }
 return rows;
}

export default async function Connections({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const supabase=await createClient();
 const {data:{user},error:authError}=await supabase.auth.getUser();
 if(authError)return <AppShell><PageFrame size="5xl"><StatePanel tone="error" title="Connections unavailable" description="We could not verify your account. Refresh the page and try again."/></PageFrame></AppShell>;
 const sp=await searchParams;
 const preview=user?await resolveOwnerPreview(supabase,user.id,sp):{active:false,role:null,athleteId:null};
 const athleteId=preview.active&&preview.role==='athlete'&&preview.athleteId?preview.athleteId:user?.id;
 if(!athleteId)return <AppShell><PageFrame size="5xl"><StatePanel tone="error" title="Sign in to review Connections" description="Your recruiting relationships are available after you sign in."/></PageFrame></AppShell>;
 const [colleges,coaches]=await Promise.all([
  supabase.from('athlete_colleges').select('id,athlete_user_id,status,fit_rating,created_at,archived_at,archived_reason,colleges(id,name,division,state,city,conference)').eq('athlete_user_id',athleteId).order('created_at',{ascending:false}),
  supabase.from('athlete_coaches').select('id,relationship_rating,last_contact_date,next_step,created_at,college_id,archived_at,archived_reason,colleges(id,name,state,city,division,conference),college_coaches(id,first_name,last_name,title,email,phone)').eq('athlete_user_id',athleteId).order('created_at',{ascending:false})
 ]);
 if(colleges.error||coaches.error){console.error('Connections relationship load failed',colleges.error||coaches.error);return <AppShell><PageFrame size="5xl"><StatePanel tone="error" title="Connections could not be loaded" description="We could not load your recruiting relationships. Your data has not been changed. Refresh the page and try again."/></PageFrame></AppShell>}
 const noRelationships=(colleges.data||[]).length===0&&(coaches.data||[]).length===0;
 if(noRelationships)return <AppShell><PageFrame><PageHeader eyebrow="YOUR RECRUITING RELATIONSHIPS" title="Connections" subtitle="Keep the schools you are pursuing and the coaches you know in one place."/><div className="mt-5"><EmptyState title="Start with one school" description="Add the first school you want to pursue. Once it is in Connections, you can add coaches, log conversations, and see what to do next." href="/colleges/new" actionLabel="Add Your First School"/></div></PageFrame></AppShell>;
 const [masterCollegesResult,masterCoachesResult]=await Promise.allSettled([
  loadAllColleges(supabase),
  supabase.from('college_coaches').select('id,college_id,first_name,last_name,title,email,phone').order('last_name').limit(5000)
 ]);
 let masterColleges:any[]=[];let masterCoaches:any[]=[];const unavailable:string[]=[];
 if(masterCollegesResult.status==='fulfilled')masterColleges=masterCollegesResult.value;else unavailable.push('school search catalog');
 if(masterCoachesResult.status==='fulfilled'&&!masterCoachesResult.value.error)masterCoaches=masterCoachesResult.value.data||[];else unavailable.push('coach search catalog');
 return <AppShell><PageFrame><PageHeader eyebrow="YOUR RECRUITING RELATIONSHIPS" title="Connections" subtitle="See where each school and coach relationship stands, then act on the one that needs attention."/>{unavailable.length>0&&<div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">Some search information is temporarily unavailable: {unavailable.join(' and ')}. Your saved relationships are still available below.</div>}<div className="mt-5 [&>div:first-child]:hidden [&>div:nth-child(2)>div:nth-child(3)]:hidden"><CollegesCoachesBoard colleges={colleges.data||[]} coaches={coaches.data||[]} masterColleges={masterColleges} masterCoaches={masterCoaches}/></div></PageFrame></AppShell>;
}
