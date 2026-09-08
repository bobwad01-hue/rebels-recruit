import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase-server';
import {createAdminClient} from '@/lib/supabase-admin';

const ENTITY='organization_calendar_event_rsvp';
const valid=new Set(['going','not_going']);

export async function GET(req:NextRequest){
  const c=await createClient();const {data:{user}}=await c.auth.getUser();
  if(!user)return NextResponse.json({error:'Please sign in again.'},{status:401});
  const admin=createAdminClient();
  const scope=req.nextUrl.searchParams.get('scope')||'me';
  if(scope!=='organization'){
    const {data,error}=await admin.from('audit_log').select('entity_id,metadata,created_at').eq('actor_user_id',user.id).eq('entity_type',ENTITY).order('created_at',{ascending:false});
    if(error)return NextResponse.json({error:error.message},{status:500});
    const seen=new Set<string>();const statuses:Record<string,string>={};
    for(const row of data||[]){const id=String(row.entity_id||'');if(!id||seen.has(id))continue;seen.add(id);const status=String((row.metadata as any)?.status||'');if(valid.has(status))statuses[id]=status}
    return NextResponse.json({statuses});
  }
  const {data:member}=await admin.from('organization_members').select('organization_id,role,organization_view_access').eq('user_id',user.id).eq('status','active').maybeSingle();
  if(!member)return NextResponse.json({events:{}});
  const canSeeAll=member.role==='owner'||member.role==='admin'||!!member.organization_view_access;
  let athleteIds:string[]=[];
  if(canSeeAll){const {data:ms}=await admin.from('organization_members').select('user_id,role').eq('organization_id',member.organization_id).eq('status','active');athleteIds=(ms||[]).filter((m:any)=>m.role==='athlete').map((m:any)=>m.user_id)}else{const {data:as}=await admin.from('athlete_advisor_assignments').select('athlete_user_id').eq('advisor_user_id',user.id).eq('status','active');athleteIds=(as||[]).map((a:any)=>a.athlete_user_id)}
  if(!athleteIds.length)return NextResponse.json({events:{}});
  const {data:logs,error}=await admin.from('audit_log').select('entity_id,actor_user_id,metadata,created_at').eq('organization_id',member.organization_id).eq('entity_type',ENTITY).in('actor_user_id',athleteIds).order('created_at',{ascending:false});
  if(error)return NextResponse.json({error:error.message},{status:500});
  const {data:profiles}=await admin.from('profiles').select('id,full_name,email').in('id',athleteIds);const pm=new Map((profiles||[]).map((p:any)=>[p.id,p]));
  const seen=new Set<string>();const events:Record<string,{going:any[];notGoing:any[]}>={};
  for(const row of logs||[]){const key=`${row.entity_id}:${row.actor_user_id}`;if(seen.has(key))continue;seen.add(key);const status=String((row.metadata as any)?.status||'');if(!valid.has(status))continue;const id=String(row.entity_id);if(!events[id])events[id]={going:[],notGoing:[]};const p:any=pm.get(row.actor_user_id)||{};const item={athleteUserId:row.actor_user_id,name:p.full_name||p.email||'Athlete'};if(status==='going')events[id].going.push(item);else events[id].notGoing.push(item)}
  return NextResponse.json({events});
}

export async function POST(req:NextRequest){
  const c=await createClient();const {data:{user}}=await c.auth.getUser();
  if(!user)return NextResponse.json({error:'Please sign in again.'},{status:401});
  let body:any;try{body=await req.json()}catch{return NextResponse.json({error:'Invalid request.'},{status:400})}
  const eventId=String(body?.eventId||''),status=String(body?.status||'');
  if(!eventId.startsWith('google:')||!valid.has(status))return NextResponse.json({error:'Event and Going / Not Going status are required.'},{status:400});
  const organizationId=eventId.split(':')[1]||null;const admin=createAdminClient();
  if(organizationId){const {data:member}=await admin.from('organization_members').select('user_id,role').eq('organization_id',organizationId).eq('user_id',user.id).eq('status','active').maybeSingle();if(!member||member.role!=='athlete')return NextResponse.json({error:'Only athletes can set attendance for organization events.'},{status:403})}
  const {error}=await admin.from('audit_log').insert({organization_id:organizationId,actor_user_id:user.id,action:'organization_calendar_event_rsvp_set',entity_type:ENTITY,entity_id:eventId,metadata:{status,event_name:body?.eventName||null,event_date:body?.eventDate||null}});
  if(error)return NextResponse.json({error:error.message},{status:500});
  return NextResponse.json({ok:true,eventId,status});
}
