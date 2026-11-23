import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
export const dynamic = 'force-dynamic';
export async function GET() {
 const db = await createClient();
 const {data:{user},error} = await db.auth.getUser();
 if(error || !user) return NextResponse.json({error:'Sign in required.'},{status:401});
 const assignments=await db.from('athlete_advisor_assignments').select('athlete_user_id').eq('advisor_user_id',user.id).eq('status','active').limit(500);
 if(assignments.error) return NextResponse.json({error:'Advisor access could not be verified.'},{status:500});
 const ids=[...new Set((assignments.data||[]).map(a=>a.athlete_user_id))];
 if(!ids.length)return NextResponse.json({athletes:[],schools:[],coaches:[],interactions:[],reminders:[],tasks:[],events:[],truncated:false});
 const [athletes,schools,coaches,interactions,reminders,tasks,events]=await Promise.all([
 db.from('profiles').select('id,full_name').in('id',ids),
 db.from('athlete_colleges').select('id,athlete_user_id,status,archived_at,colleges(id,name)').in('athlete_user_id',ids).limit(1000),
 db.from('athlete_coaches').select('id,athlete_user_id,last_contact_date,next_step,archived_at,colleges(id,name),college_coaches(id,first_name,last_name,title)').in('athlete_user_id',ids).limit(1000),
 db.from('interactions').select('id,athlete_user_id,college_id,coach_id,type,date,created_at,note,initiated_by,email_subject,source').in('athlete_user_id',ids).order('created_at',{ascending:false}).limit(1000),
 db.from('reminders').select('id,athlete_user_id,title,due_date,status,colleges(id,name),college_coaches(id,first_name,last_name)').in('athlete_user_id',ids).limit(500),
 db.from('advisor_tasks').select('id,athlete_user_id,title,description,due_date,status').in('athlete_user_id',ids).limit(500),
 db.from('athlete_events').select('id,athlete_user_id,status,events(id,name,date,type,location,colleges(id,name))').in('athlete_user_id',ids).limit(500)]);
 const results={athletes,schools,coaches,interactions,reminders,tasks,events};
 for(const [name,result] of Object.entries(results))if(result.error)return NextResponse.json({error:name+' could not be loaded.'},{status:500});
 return NextResponse.json({athletes:athletes.data||[],schools:schools.data||[],coaches:coaches.data||[],interactions:interactions.data||[],reminders:reminders.data||[],tasks:tasks.data||[],events:events.data||[],truncated:[schools,coaches,interactions].some(r=>(r.data||[]).length===1000)||[reminders,tasks,events].some(r=>(r.data||[]).length===500)});
}