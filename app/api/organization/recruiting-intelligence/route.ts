import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase-server';
export const dynamic='force-dynamic';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;
export async function GET(req:NextRequest){
 const db=await createClient();
 const {data:{user},error:authError}=await db.auth.getUser();
 if(authError||!user)return NextResponse.json({error:'Sign in required.'},{status:401});
 const orgId=req.nextUrl.searchParams.get('organizationId')||'';
 if(!uuid.test(orgId))return NextResponse.json({error:'Invalid organization.'},{status:400});
 const {data:member,error:memberError}=await db.from('organization_members').select('role,organization_view_access').eq('organization_id',orgId).eq('user_id',user.id).eq('status','active').limit(1).maybeSingle();
 if(memberError)return NextResponse.json({error:'Organization access could not be verified.'},{status:500});
 if(!member||member.role!=='admin')return NextResponse.json({error:'Organization administrator access required.'},{status:403});
 const members=await db.from('organization_members').select('user_id').eq('organization_id',orgId).eq('role','athlete').eq('status','active').limit(1000);
 if(members.error)return NextResponse.json({error:'Athlete roster could not be loaded.'},{status:500});
 if((members.data||[]).length===1000)return NextResponse.json({error:'Roster exceeds report limit.'},{status:409});
 const ids=[...new Set((members.data||[]).map(m=>m.user_id).filter(id=>uuid.test(id)))];
 const empty={athletes:[],schools:[],coaches:[],interactions:[],reminders:[],tasks:[],events:[],truncated:false};
 if(!ids.length)return NextResponse.json(empty);
 const [athletes,schools,coaches,interactions,reminders,tasks,events]=await Promise.all([
 db.from('profiles').select('id,full_name').in('id',ids).limit(1000),
 db.from('athlete_colleges').select('id,athlete_user_id,status,archived_at,colleges(id,name)').in('athlete_user_id',ids).limit(1000),
 db.from('athlete_coaches').select('id,athlete_user_id,last_contact_date,next_step,archived_at,colleges(id,name),college_coaches(id,first_name,last_name,title)').in('athlete_user_id',ids).limit(1000),
 db.from('interactions').select('id,athlete_user_id,college_id,coach_id,type,date,created_at,source').in('athlete_user_id',ids).order('created_at',{ascending:false}).limit(1000),
 db.from('reminders').select('id,athlete_user_id,title,due_date,status,colleges(id,name),college_coaches(id,first_name,last_name)').in('athlete_user_id',ids).limit(500),
 db.from('advisor_tasks').select('id,athlete_user_id,title,due_date,status').in('athlete_user_id',ids).limit(500),
 db.from('athlete_events').select('id,athlete_user_id,status,events(id,name,date,type,location,colleges(id,name))').in('athlete_user_id',ids).limit(500)
 ]);
 const results={athletes,schools,coaches,interactions,reminders,tasks,events};
 for(const [name,result] of Object.entries(results))if(result.error)return NextResponse.json({error:name+' could not be loaded.'},{status:500});
 return NextResponse.json({athletes:athletes.data||[],schools:schools.data||[],coaches:coaches.data||[],interactions:interactions.data||[],reminders:reminders.data||[],tasks:tasks.data||[],events:events.data||[],truncated:[athletes,schools,coaches,interactions].some(r=>(r.data||[]).length===1000)||[reminders,tasks,events].some(r=>(r.data||[]).length===500)},{headers:{'Cache-Control':'private, no-store'}});
}
