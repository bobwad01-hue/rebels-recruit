import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase-server';
import {createAdminClient} from '@/lib/supabase-admin';
import {normalizeJourneyStage} from '@/lib/recruiting-journey';

export async function POST(req:NextRequest){
 const c=await createClient();const {data:{user}}=await c.auth.getUser();if(!user)return NextResponse.json({error:'Please sign in again.'},{status:401});
 let body:any;try{body=await req.json()}catch{return NextResponse.json({error:'Invalid request.'},{status:400})}
 const requested=[...new Set((Array.isArray(body.athleteIds)?body.athleteIds:[]).map((x:any)=>String(x)).filter(Boolean))].slice(0,500);if(!requested.length)return NextResponse.json({milestones:[]});
 const admin=createAdminClient();const {data:memberships}=await admin.from('organization_members').select('organization_id,role,organization_view_access').eq('user_id',user.id).eq('status','active');const staff=(memberships||[]).find((m:any)=>['owner','admin','advisor'].includes(m.role));if(!staff)return NextResponse.json({error:'Forbidden'},{status:403});
 const {data:athleteMembers}=await admin.from('organization_members').select('user_id').eq('organization_id',staff.organization_id).eq('role','athlete').eq('status','active').in('user_id',requested);let allowed=new Set((athleteMembers||[]).map((m:any)=>m.user_id));
 if(staff.role==='advisor'&&!staff.organization_view_access){const {data:assignments}=await admin.from('athlete_advisor_assignments').select('athlete_user_id').eq('organization_id',staff.organization_id).eq('advisor_user_id',user.id).eq('status','active').in('athlete_user_id',[...allowed]);allowed=new Set((assignments||[]).map((a:any)=>a.athlete_user_id))}
 if(!allowed.size)return NextResponse.json({milestones:[]});
 const {data,error}=await admin.from('audit_log').select('id,entity_id,actor_user_id,metadata,created_at').eq('organization_id',staff.organization_id).eq('entity_type','recruiting_journey').order('created_at',{ascending:false}).limit(5000);if(error)return NextResponse.json({error:error.message},{status:500});
 const milestones=(data||[]).filter((x:any)=>allowed.has(String(x.metadata?.athlete_user_id||''))).map((x:any)=>({id:x.id,athleteUserId:String(x.metadata.athlete_user_id),relationshipId:x.entity_id,collegeId:x.metadata?.college_id,stage:normalizeJourneyStage(x.metadata?.stage),previousStage:x.metadata?.previous_stage?normalizeJourneyStage(x.metadata.previous_stage):null,milestoneDate:x.metadata?.milestone_date||String(x.created_at).slice(0,10),note:x.metadata?.note||'',offerType:x.metadata?.offer_type||'',actorUserId:x.actor_user_id,createdAt:x.created_at}));
 return NextResponse.json({milestones},{headers:{'Cache-Control':'private, max-age=15, stale-while-revalidate=60'}})
}
