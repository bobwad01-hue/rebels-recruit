import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase-server';
import {createAdminClient} from '@/lib/supabase-admin';

const ENTITY='athlete_college_target_rank';

async function latestRanks(admin:any,athleteIds:string[]){
  if(!athleteIds.length)return new Map<string,number>();
  const {data,error}=await admin.from('audit_log').select('actor_user_id,entity_id,metadata,created_at').eq('entity_type',ENTITY).in('actor_user_id',athleteIds).order('created_at',{ascending:false});
  if(error)throw new Error(error.message);
  const seen=new Set<string>();const ranks=new Map<string,number>();
  for(const row of data||[]){const key=`${row.actor_user_id}:${row.entity_id}`;if(seen.has(key))continue;seen.add(key);const rank=Number((row.metadata as any)?.rank);if(Number.isFinite(rank)&&rank>0)ranks.set(key,rank)}
  return ranks;
}

async function buildTargets(admin:any,athleteIds:string[]){
  if(!athleteIds.length)return [];
  const [rels,profiles,ranks]=await Promise.all([
    admin.from('athlete_colleges').select('id,athlete_user_id,status,archived_at,colleges(id,name,division,state,conference)').in('athlete_user_id',athleteIds),
    admin.from('profiles').select('id,full_name,email').in('id',athleteIds),
    latestRanks(admin,athleteIds)
  ]);
  if(rels.error)throw new Error(rels.error.message);if(profiles.error)throw new Error(profiles.error.message);
  const pm=new Map((profiles.data||[]).map((p:any)=>[String(p.id),p]));
  const groups=new Map<string,any[]>();
  for(const r of rels.data||[]){if(r.archived_at)continue;const c=Array.isArray(r.colleges)?r.colleges[0]:r.colleges;const rank=ranks.get(`${r.athlete_user_id}:${r.id}`)||999999;const item={relationshipId:r.id,athleteUserId:r.athlete_user_id,collegeId:c?.id||null,name:c?.name||'School',division:c?.division||null,state:c?.state||null,conference:c?.conference||null,status:r.status||'Researching',rank};groups.set(String(r.athlete_user_id),[...(groups.get(String(r.athlete_user_id))||[]),item])}
  return athleteIds.map(id=>{const p:any=pm.get(String(id))||{};const targets=(groups.get(String(id))||[]).sort((a,b)=>a.rank-b.rank||a.name.localeCompare(b.name)).map((x,i)=>({...x,rank:i+1}));return {athleteUserId:id,name:p.full_name||p.email||'Athlete',targets}});
}

export async function GET(req:NextRequest){
  const c=await createClient();const {data:{user}}=await c.auth.getUser();if(!user)return NextResponse.json({error:'Please sign in again.'},{status:401});
  const admin=createAdminClient();const scope=req.nextUrl.searchParams.get('scope')||'me';
  if(scope==='me'){const players=await buildTargets(admin,[user.id]);return NextResponse.json({targets:players[0]?.targets||[]})}
  const {data:member}=await admin.from('organization_members').select('organization_id,role,organization_view_access').eq('user_id',user.id).eq('status','active').maybeSingle();if(!member)return NextResponse.json({players:[]});
  const canAll=member.role==='owner'||member.role==='admin'||!!member.organization_view_access;let athleteIds:string[]=[];
  if(canAll){const {data:ms}=await admin.from('organization_members').select('user_id,role').eq('organization_id',member.organization_id).eq('status','active');athleteIds=(ms||[]).filter((m:any)=>m.role==='athlete').map((m:any)=>m.user_id)}else{const {data:as}=await admin.from('athlete_advisor_assignments').select('athlete_user_id').eq('advisor_user_id',user.id).eq('status','active');athleteIds=(as||[]).map((a:any)=>a.athlete_user_id)}
  return NextResponse.json({players:await buildTargets(admin,athleteIds)});
}

export async function POST(req:NextRequest){
  const c=await createClient();const {data:{user}}=await c.auth.getUser();if(!user)return NextResponse.json({error:'Please sign in again.'},{status:401});
  let body:any;try{body=await req.json()}catch{return NextResponse.json({error:'Invalid request.'},{status:400})}
  const order=Array.isArray(body?.order)?body.order.map(String):[];if(!order.length)return NextResponse.json({error:'Target order is required.'},{status:400});
  const admin=createAdminClient();const {data:rels,error}=await admin.from('athlete_colleges').select('id,athlete_user_id,archived_at').in('id',order);if(error)return NextResponse.json({error:error.message},{status:500});
  if((rels||[]).some((r:any)=>String(r.athlete_user_id)!==user.id||r.archived_at))return NextResponse.json({error:'You can only rank your current school relationships.'},{status:403});
  const validIds=new Set((rels||[]).map((r:any)=>String(r.id)));if(order.some((id:string)=>!validIds.has(id)))return NextResponse.json({error:'One or more target relationships are invalid.'},{status:400});
  const {data:member}=await admin.from('organization_members').select('organization_id').eq('user_id',user.id).eq('status','active').maybeSingle();
  const rows=order.map((id:string,i:number)=>({organization_id:member?.organization_id||null,actor_user_id:user.id,action:'target_rank_set',entity_type:ENTITY,entity_id:id,metadata:{rank:i+1}}));
  const {error:writeError}=await admin.from('audit_log').insert(rows);if(writeError)return NextResponse.json({error:writeError.message},{status:500});
  return NextResponse.json({ok:true,order});
}
