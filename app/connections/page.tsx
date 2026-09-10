import AppShell from '@/components/AppShell';
import CollegesCoachesBoard from '@/components/CollegesCoachesBoard';
import PageHeader from '@/components/PageHeader';
import {createClient} from '@/lib/supabase-server';
import {resolveOwnerPreview} from '@/lib/owner-preview';

async function loadAllColleges(supabase:any){const rows:any[]=[];for(let from=0;from<20000;from+=1000){const {data}=await supabase.from('colleges').select('id,name,division,state,city,conference,school_type').order('name').range(from,from+999);rows.push(...(data||[]));if(!data||data.length<1000)break}return rows}
export default async function Connections({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();const sp=await searchParams;const preview=user?await resolveOwnerPreview(supabase,user.id,sp):{active:false,role:null,athleteId:null};const athleteId=preview.active&&preview.role==='athlete'&&preview.athleteId?preview.athleteId:user?.id;
 const [colleges,coaches,masterColleges,masterCoaches]=await Promise.all([
  supabase.from('athlete_colleges').select('id,athlete_user_id,status,fit_rating,created_at,archived_at,archived_reason,colleges(id,name,division,state,city,conference)').eq('athlete_user_id',athleteId).order('created_at',{ascending:false}),
  supabase.from('athlete_coaches').select('id,relationship_rating,last_contact_date,next_step,created_at,college_id,archived_at,archived_reason,colleges(id,name,state,city,division,conference),college_coaches(id,first_name,last_name,title,email,phone)').eq('athlete_user_id',athleteId).order('created_at',{ascending:false}),
  loadAllColleges(supabase),
  supabase.from('college_coaches').select('id,college_id,first_name,last_name,title,email,phone').order('last_name').limit(5000)
 ]);
 return <AppShell><div className="max-w-7xl mx-auto px-4 sm:px-5 md:px-8 py-6"><PageHeader eyebrow="RELATIONSHIPS" title="Connections" subtitle="Your active school and coach relationships — where they stand, who you know, and what relationship context matters next."/><div className="[&>div:first-child]:hidden [&>div:nth-child(2)>div:nth-child(3)]:hidden"><CollegesCoachesBoard colleges={colleges.data||[]} coaches={coaches.data||[]} masterColleges={masterColleges||[]} masterCoaches={masterCoaches.data||[]}/></div></div></AppShell>
}
