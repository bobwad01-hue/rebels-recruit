import {NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase-server';

async function owner(){
 const c=await createClient(); const {data:{user}}=await c.auth.getUser(); if(!user)return {c,user:null};
 const {data:r}=await c.from('platform_roles').select('role').eq('user_id',user.id).eq('role','super_owner').maybeSingle();
 return {c,user:r?user:null};
}
export async function GET(){const {c,user}=await owner();if(!user)return NextResponse.json({error:'Forbidden'},{status:403});
 const {data,error}=await c.from('college_coach_update_suggestions').select('id,coach_id,submitted_by_user_id,suggestion_type,details,proposed_email,proposed_phone,proposed_title,proposed_x_url,proposed_college_id,status,created_at,college_coaches(id,first_name,last_name,title,email,phone,x_url,college_id,lifecycle_status,colleges(name))').eq('status','pending').order('created_at',{ascending:true});
 return NextResponse.json(error?{error:error.message}:{suggestions:data||[]},{status:error?500:200})}
export async function POST(req:Request){const {c,user}=await owner();if(!user)return NextResponse.json({error:'Forbidden'},{status:403});const b=await req.json();const {data:s}=await c.from('college_coach_update_suggestions').select('*').eq('id',b.id).eq('status','pending').maybeSingle();if(!s)return NextResponse.json({error:'Suggestion not found'},{status:404});
 if(b.decision==='reject'){const {error}=await c.from('college_coach_update_suggestions').update({status:'rejected',reviewed_at:new Date().toISOString(),reviewed_by_user_id:user.id}).eq('id',s.id);return NextResponse.json(error?{error:error.message}:{ok:true},{status:error?500:200})}
 if(b.decision!=='accept')return NextResponse.json({error:'Invalid decision'},{status:400});
 const patch:any={updated_by_user_id:user.id,updated_at:new Date().toISOString(),source_note:'Verified community update approved by RLTNL'};
 if(s.suggestion_type==='contact_update'||s.suggestion_type==='incorrect_info'){if(s.proposed_email)patch.email=s.proposed_email;if(s.proposed_phone)patch.phone=s.proposed_phone;if(s.proposed_x_url)patch.x_url=s.proposed_x_url;if(s.proposed_title)patch.title=s.proposed_title}
 if(s.suggestion_type==='title_update'&&s.proposed_title)patch.title=s.proposed_title;
 if(s.suggestion_type==='left_program'){patch.lifecycle_status='departed';patch.departed_at=new Date().toISOString().slice(0,10);patch.lifecycle_note=s.details||'Community report verified by RLTNL'}
 if(s.suggestion_type==='retired'){patch.lifecycle_status='retired';patch.departed_at=new Date().toISOString().slice(0,10);patch.lifecycle_note=s.details||'Retirement verified by RLTNL'}
 if(s.suggestion_type==='moved_school'&&s.proposed_college_id){const {data:coach}=await c.from('college_coaches').select('college_id').eq('id',s.coach_id).single();patch.previous_college_id=coach?.college_id||null;patch.college_id=s.proposed_college_id;patch.lifecycle_status='active';patch.departed_at=null;patch.lifecycle_note=s.details||'School move verified by RLTNL'}
 if(s.suggestion_type==='other'&&!Object.keys(patch).some(k=>!['updated_by_user_id','updated_at','source_note'].includes(k)))return NextResponse.json({error:'Other suggestions require manual investigation before acceptance.'},{status:400});
 const {error:u}=await c.from('college_coaches').update(patch).eq('id',s.coach_id);if(u)return NextResponse.json({error:u.message},{status:500});
 const {error:r}=await c.from('college_coach_update_suggestions').update({status:'accepted',reviewed_at:new Date().toISOString(),reviewed_by_user_id:user.id}).eq('id',s.id);return NextResponse.json(r?{error:r.message}:{ok:true},{status:r?500:200})}