import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase-server';
import {createAdminClient} from '@/lib/supabase-admin';
import {calendarContext,calendarEventAccess,canSeeCalendar} from '@/lib/calendar-subscriptions';
import {previewCalendarContext} from '@/lib/calendar-preview';
const ENTITY='organization_calendar_event_rsvp';const valid=new Set(['going','not_going']);
async function membership(admin:any,userId:string,organizationId?:string|null){let q=admin.from('organization_members').select('organization_id,role,organization_view_access').eq('user_id',userId).eq('status','active');if(organizationId)q=q.eq('organization_id',organizationId);const {data}=await q.limit(1).maybeSingle();return data||null}
function metaEventId(row:any){return String((row?.metadata as any)?.event_id||'')}
function norm(v:string){return v.toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').trim()}
async function matchCollege(admin:any,userId:string,name:string,location:string){const hay=norm(`${name} ${location}`);if(!hay)return null;const {data:tracked}=await admin.from('athlete_colleges').select('college_id,colleges(id,name,city,state)').eq('athlete_user_id',userId);const candidates=(tracked||[]).map((r:any)=>r.colleges).flat().filter(Boolean);const matches=candidates.filter((college:any)=>{const school=norm(String(college.name||''));if(school&&hay.includes(school))return true;const aliases=school.replace(/^university of /,'').replace(/ university$/,'').replace(/ college$/,'');return aliases.length>=5&&hay.includes(aliases)});return matches.length===1?matches[0].id:null}
async function attendance(admin:any,organizationId:string,eventId:string,onlyTeamId:string|null=null){
 const {data:ms}=await admin.from('organization_members').select('user_id,role').eq('organization_id',organizationId).eq('status','active');
 const athleteIds=(ms||[]).filter((m:any)=>m.role==='athlete').map((m:any)=>m.user_id);
 if(!athleteIds.length)return {going:[],notGoing:[],teams:[]};
 const {data:teams}=await admin.from('teams').select('id,name').eq('organization_id',organizationId).is('archived_at',null);
 const allTeams=(teams||[]).filter((t:any)=>!onlyTeamId||t.id===onlyTeamId);
 const {data:members}=await admin.from('team_members').select('team_id,user_id').in('user_id',athleteIds);
 const memberTeams=new Map<string,string[]>();for(const m of members||[]){const v=memberTeams.get(m.user_id)||[];v.push(m.team_id);memberTeams.set(m.user_id,v)}
 const allowed=new Set(allTeams.map((t:any)=>t.id));
 const {data:logs}=await admin.from('audit_log').select('actor_user_id,metadata,created_at').eq('organization_id',organizationId).eq('entity_type',ENTITY).in('actor_user_id',athleteIds).order('created_at',{ascending:false});
 const {data:profiles}=await admin.from('profiles').select('id,full_name,email').in('id',athleteIds);
 const pm=new Map((profiles||[]).map((p:any)=>[p.id,p])),seen=new Set<string>(),going:any[]=[],notGoing:any[]=[];
 const groups=allTeams.map((t:any)=>({id:t.id,name:t.name,going:[] as any[],notGoing:[] as any[]}));
 for(const row of logs||[]){if(metaEventId(row)!==eventId||seen.has(row.actor_user_id))continue;seen.add(row.actor_user_id);
  const status=String((row.metadata as any)?.status||'');if(!valid.has(status))continue;
  const athleteTeams=(memberTeams.get(row.actor_user_id)||[]).filter(id=>allowed.has(id));
  if(onlyTeamId&&!athleteTeams.length)continue;
  const p:any=pm.get(row.actor_user_id)||{},item={athleteUserId:row.actor_user_id,name:p.full_name||p.email||'Athlete',teamIds:athleteTeams};
  (status==='going'?going:notGoing).push(item);
  for(const t of groups)if(athleteTeams.includes(t.id))(status==='going'?t.going:t.notGoing).push(item);
 }
 return{going,notGoing,teams:groups};
}
export async function GET(req:NextRequest){const c=await createClient();const {data:{user}}=await c.auth.getUser();if(!user)return NextResponse.json({error:'Please sign in again.'},{status:401});const admin=createAdminClient(),scope=req.nextUrl.searchParams.get('scope')||'me',eventId=req.nextUrl.searchParams.get('eventId');if(eventId){const signedIn=await calendarContext(user.id),preview=await previewCalendarContext(req,signedIn);if('error' in preview)return NextResponse.json({error:preview.error},{status:403});const ctx=preview.ctx!,sub=await calendarEventAccess(ctx,eventId);if(!sub)return NextResponse.json({error:'You do not have access to this event.'},{status:403});return NextResponse.json({eventId,...await attendance(admin,sub.organization_id,eventId,sub.team_id)})}if(scope!=='organization'){const {data,error}=await admin.from('audit_log').select('metadata,created_at').eq('actor_user_id',user.id).eq('entity_type',ENTITY).order('created_at',{ascending:false});if(error)return NextResponse.json({error:error.message},{status:500});const seen=new Set<string>(),statuses:Record<string,string>={};for(const row of data||[]){const id=metaEventId(row);if(!id||seen.has(id))continue;seen.add(id);const s=String((row.metadata as any)?.status||'');if(valid.has(s))statuses[id]=s}return NextResponse.json({statuses})}const member=await membership(admin,user.id);if(!member)return NextResponse.json({events:{}});const canSeeAll=member.role==='owner'||member.role==='admin';let athleteIds:string[]=[];if(canSeeAll){const {data:ms}=await admin.from('organization_members').select('user_id,role').eq('organization_id',member.organization_id).eq('status','active');athleteIds=(ms||[]).filter((m:any)=>m.role==='athlete').map((m:any)=>m.user_id)}else{const {data:as}=await admin.from('athlete_advisor_assignments').select('athlete_user_id').eq('advisor_user_id',user.id).eq('status','active');athleteIds=(as||[]).map((a:any)=>a.athlete_user_id)}if(!athleteIds.length)return NextResponse.json({events:{}});const {data:logs,error}=await admin.from('audit_log').select('actor_user_id,metadata,created_at').eq('organization_id',member.organization_id).eq('entity_type',ENTITY).in('actor_user_id',athleteIds).order('created_at',{ascending:false});if(error)return NextResponse.json({error:error.message},{status:500});const {data:profiles}=await admin.from('profiles').select('id,full_name,email').in('id',athleteIds);const pm=new Map((profiles||[]).map((p:any)=>[p.id,p])),seen=new Set<string>(),events:Record<string,{going:any[];notGoing:any[]}>={};for(const row of logs||[]){const id=metaEventId(row);if(!id)continue;const key=`${id}:${row.actor_user_id}`;if(seen.has(key))continue;seen.add(key);const s=String((row.metadata as any)?.status||'');if(!valid.has(s))continue;if(!events[id])events[id]={going:[],notGoing:[]};const p:any=pm.get(row.actor_user_id)||{},item={athleteUserId:row.actor_user_id,name:p.full_name||p.email||'Athlete'};(s==='going'?events[id].going:events[id].notGoing).push(item)}const ctx=await calendarContext(user.id),ids=Object.keys(events);
if(ids.length){const {data:cached}=await admin.from('calendar_subscription_events').select('event_id,subscription_id').in('event_id',ids.slice(0,1000));
 const subIds=[...new Set((cached||[]).map((x:any)=>x.subscription_id))];
 const {data:subs}=subIds.length?await admin.from('calendar_subscriptions').select('id,organization_id,team_id,enabled').in('id',subIds):{data:[]};
 const permitted=new Set((cached||[]).filter((x:any)=>(subs||[]).some((s:any)=>s.id===x.subscription_id&&s.enabled&&canSeeCalendar(ctx,s.organization_id,s.team_id))).map((x:any)=>x.event_id));
 for(const id of ids)if(!permitted.has(id))delete events[id];
}
return NextResponse.json({events})}
export async function POST(req:NextRequest){const c=await createClient();const {data:{user}}=await c.auth.getUser();if(!user)return NextResponse.json({error:'Please sign in again.'},{status:401});let body:any;try{body=await req.json()}catch{return NextResponse.json({error:'Invalid request.'},{status:400})}const eventId=String(body?.eventId||''),status=String(body?.status||'');if(!eventId.startsWith('google:')||!valid.has(status))return NextResponse.json({error:'Event and Going / Not Going status are required.'},{status:400});const organizationId=eventId.split(':')[1]||'';const admin=createAdminClient(),member=await membership(admin,user.id,organizationId),ctx=await calendarContext(user.id),sub=await calendarEventAccess(ctx,eventId);if(!member||member.role!=='athlete'||!sub||sub.organization_id!==organizationId||(sub.team_id&&!ctx.teamIds.includes(sub.team_id)))return NextResponse.json({error:'Only athletes with access to this calendar event can set attendance.'},{status:403});
let prepEventId:string|null=null;
const {data:prior}=await admin.from('audit_log').select('metadata').eq('organization_id',organizationId).eq('actor_user_id',user.id).eq('entity_type',ENTITY).order('created_at',{ascending:false}).limit(100);
for(const row of prior||[]){const m=(row.metadata||{}) as any;if(String(m.event_id||'')===eventId&&m.local_event_id){prepEventId=String(m.local_event_id);break}}
if(status==='going'){
  if(prepEventId){
    const {data:existing}=await admin.from('events').select('id,college_id,name,location').eq('id',prepEventId).maybeSingle();
    if(existing&&!existing.college_id){const collegeId=await matchCollege(admin,user.id,String(body?.eventName||existing.name||''),String(body?.eventLocation||existing.location||''));if(collegeId)await admin.from('events').update({college_id:collegeId}).eq('id',prepEventId)}
  }
  if(!prepEventId){
    const name=String(body?.eventName||'Organization recruiting event'),date=String(body?.eventDate||''),location=String(body?.eventLocation||'');
    if(date){
      const collegeId=await matchCollege(admin,user.id,name,location);
      const {data:created,error:createError}=await admin.from('events').insert({name,type:'College Camp',date,location:body?.eventLocation||null,registration_url:body?.eventUrl||null,created_by_user_id:user.id,college_id:collegeId}).select('id').single();
      if(createError)return NextResponse.json({error:'Attendance could not be connected to Event Prep. Please try again.'},{status:500});
      prepEventId=created.id;
      await admin.from('athlete_events').upsert({athlete_user_id:user.id,event_id:prepEventId,status:'going'},{onConflict:'athlete_user_id,event_id'});
    }
  }
}
if(prepEventId){
  const {error:attendanceError}=await admin.from('athlete_events').upsert({athlete_user_id:user.id,event_id:prepEventId,status},{onConflict:'athlete_user_id,event_id'});
  if(attendanceError)return NextResponse.json({error:'Attendance could not be synchronized with Event Prep. Please try again.'},{status:500});
}
const {error}=await admin.from('audit_log').insert({organization_id:organizationId,actor_user_id:user.id,action:'organization_calendar_event_rsvp_set',entity_type:ENTITY,entity_id:organizationId,metadata:{event_id:eventId,status,event_name:body?.eventName||null,event_date:body?.eventDate||null,local_event_id:prepEventId}});
if(error)return NextResponse.json({error:error.message},{status:500});return NextResponse.json({ok:true,eventId,status,prepEventId,...await attendance(admin,organizationId,eventId,sub.team_id)})}
