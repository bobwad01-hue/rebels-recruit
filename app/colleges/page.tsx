import AppShell from '@/components/AppShell';
import CollegesCoachesBoard from '@/components/CollegesCoachesBoard';
import {createClient} from '@/lib/supabase-server';

export default async function Colleges(){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 const [colleges,coaches,masterColleges,masterCoaches]=await Promise.all([
  supabase.from('athlete_colleges').select('id,status,fit_rating,created_at,colleges(id,name,division,state,city,conference)').eq('athlete_user_id',user?.id).order('created_at',{ascending:false}),
  supabase.from('athlete_coaches').select('id,relationship_rating,last_contact_date,next_step,created_at,college_id,colleges(id,name,state,city,division,conference),college_coaches(id,first_name,last_name,title,email,phone)').eq('athlete_user_id',user?.id).order('created_at',{ascending:false}),
  supabase.from('colleges').select('id,name,division,state,city,conference,school_type').order('name').limit(2500),
  supabase.from('college_coaches').select('id,college_id,first_name,last_name,title,email,phone').order('last_name').limit(5000)
 ]);
 return <AppShell><div className="max-w-7xl mx-auto px-5 md:px-8 py-6"><CollegesCoachesBoard colleges={colleges.data||[]} coaches={coaches.data||[]} masterColleges={masterColleges.data||[]} masterCoaches={masterCoaches.data||[]}/></div></AppShell>
}
