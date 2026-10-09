import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase-server';
import {createAdminClient} from '@/lib/supabase-admin';
import {calendarContext,canManageCalendar,canSeeCalendar,syncCalendarSubscription} from '@/lib/calendar-subscriptions';
import {normalizePublicGoogleIcs} from '@/lib/calendar-ics';
import {previewCalendarContext} from '@/lib/calendar-preview';
export const dynamic='force-dynamic';
export const maxDuration=60;
async function authorize(){const client=await createClient();const {data:{user}}=await client.auth.getUser();if(!user)return null;return await calendarContext(user.id)}
async function teamsInOrg(db:any,org:string){const {data}=await db.from('teams').select('id,name,organization_id').eq('organization_id',org).is('archived_at',null).order('name');return data||[]}
function fail(message:string,status=400){return NextResponse.json({error:message},{status})}
export async function GET(req:NextRequest){
 const signedIn=await authorize();if(!signedIn)return fail('Please sign in again.',401);
 const preview=req.nextUrl.searchParams.get('mode')==='manage'?{ctx:signedIn}:await previewCalendarContext(req,signedIn);
 if('error' in preview)return fail(String(preview.error),403);
 let ctx=preview.ctx!;
 const parentAthlete=req.nextUrl.searchParams.get('parentAthlete');
 // Parent Events must reflect the selected athlete, not every child linked to the account.
 if(parentAthlete&&!req.nextUrl.searchParams.has('previewRole')&&req.nextUrl.searchParams.get('mode')!=='manage'){
  const db=createAdminClient();
  const {data:access}=await db.from('parent_guardian_access').select('athlete_user_id,permissions').eq('parent_user_id',signedIn.userId).eq('athlete_user_id',parentAthlete).eq('status','active').maybeSingle();
  if(!access||access.permissions?.view_events===false)return fail('Events access for this athlete is unavailable.',403);
  const {data:membership}=await db.from('organization_members').select('organization_id').eq('user_id',parentAthlete).eq('role','athlete').eq('status','active');
  const orgIds=[...new Set((membership||[]).map((m:any)=>String(m.organization_id)))];
  const {data:teamMembers}=await db.from('team_members').select('team_id').eq('user_id',parentAthlete);
  const ids=(teamMembers||[]).map((t:any)=>t.team_id);
  const {data:teams}=ids.length?await db.from('teams').select('id,organization_id').in('id',ids):{data:[]};
  ctx={...signedIn,organizationIds:orgIds,organizationAdminIds:[],teamAdminIds:[],teamIds:(teams||[]).filter((t:any)=>orgIds.includes(t.organization_id)).map((t:any)=>t.id)};
 }
 const db=createAdminClient(),orgIds=ctx.organizationIds;
 if(!orgIds.length)return NextResponse.json(req.nextUrl.searchParams.get('mode')==='manage'?{subscriptions:[],organizations:[],teams:[]}:{events:[]});
 const {data:subscriptions,error}=await db.from('calendar_subscriptions').select('*').in('organization_id',orgIds).order('created_at',{ascending:false});
 if(error)return fail('Calendar subscriptions could not be loaded.',500);
 const visible=(subscriptions||[]).filter((s:any)=>canSeeCalendar(ctx,s.organization_id,s.team_id));
 if(req.nextUrl.searchParams.get('mode')==='manage'){
  const manageable=visible.filter((s:any)=>canManageCalendar(ctx,s.organization_id,s.team_id));
  const {data:organizations}=await db.from('organizations').select('id,name').in('id',orgIds);
  const {data:teams}=await db.from('teams').select('id,name,organization_id').in('organization_id',orgIds).is('archived_at',null).order('name');
  return NextResponse.json({subscriptions:manageable,organizations:(organizations||[]).filter((o:any)=>ctx.organizationAdminIds.includes(o.id)||(teams||[]).some((t:any)=>t.organization_id===o.id&&ctx.teamAdminIds.includes(t.id))),teams:(teams||[]).filter((t:any)=>ctx.organizationAdminIds.includes(t.organization_id)||ctx.teamAdminIds.includes(t.id)),organizationAdminIds:ctx.organizationAdminIds});
 }
 const active=visible.filter((s:any)=>s.enabled);
 if(!active.length)return NextResponse.json({events:[]});
 // Seeded or newly connected feeds are loaded on first view; failures are not retried on every page load.
 for(const sub of active.filter((s:any)=>!s.last_synced_at&&!s.last_error).slice(0,3))await syncCalendarSubscription(sub);
 const ids=active.map((s:any)=>s.id);
 const {data:entries,error:entryError}=await db.from('calendar_subscription_events').select('*').in('subscription_id',ids).gte('date',new Date(Date.now()-120*86400000).toISOString().slice(0,10)).order('date').limit(5000);
 if(entryError)return fail('Subscribed events could not be loaded.',500);
 const bySub=new Map(active.map((s:any)=>[s.id,s]));
 const {data:orgs}=await db.from('organizations').select('id,name').in('id',orgIds);
 const names=new Map((orgs||[]).map((o:any)=>[o.id,o.name]));
 const {data:teams}=await db.from('teams').select('id,name').in('organization_id',orgIds);
 const teamNames=new Map((teams||[]).map((t:any)=>[t.id,t.name]));
 const events=new Map<string,any>();
 for(const entry of entries||[]){const sub:any=bySub.get(entry.subscription_id);if(!sub)continue;
  const existing=events.get(entry.event_id);
  if(existing){if(!sub.team_id)existing.allTeams=true;else if(!existing.teamIds.includes(sub.team_id))existing.teamIds.push(sub.team_id);continue;}
  events.set(entry.event_id,{id:entry.event_id,name:entry.name,date:entry.date,end_date:entry.end_date,type:'College Camp',location:entry.location,description:entry.description,registration_url:entry.registration_url,organizationId:entry.organization_id,organizationName:names.get(entry.organization_id)||'Organization',calendarName:sub.name,teamIds:sub.team_id?[sub.team_id]:[],allTeams:!sub.team_id,_source:'org'});
 }
 return NextResponse.json({events:[...events.values()].map(e=>({...e,teamNames:e.teamIds.map((id:string)=>teamNames.get(id)||'Team')}))});
}
export async function POST(req:NextRequest){
 const ctx=await authorize();if(!ctx)return fail('Please sign in again.',401);
 let body:any;try{body=await req.json()}catch{return fail('Invalid request.')}
 const db=createAdminClient();
 if(body.action==='sync'){
  const {data:sub}=await db.from('calendar_subscriptions').select('*').eq('id',String(body.id||'')).maybeSingle();
  if(!sub||!canManageCalendar(ctx,sub.organization_id,sub.team_id))return fail('You cannot manage this subscription.',403);
  const result=await syncCalendarSubscription(sub);return NextResponse.json(result,{status:result.ok?200:502});
 }
 const organizationId=String(body.organizationId||''),teamId=body.teamId?String(body.teamId):null,name=String(body.name||'').trim();
 if(!ctx.organizationIds.includes(organizationId)||!canManageCalendar(ctx,organizationId,teamId))return fail('You cannot manage this calendar scope.',403);
 if(teamId){const teams=await teamsInOrg(db,organizationId);if(!teams.some((t:any)=>t.id===teamId))return fail('Choose a team in the selected organization.')}
 if(!name||name.length>120)return fail('Enter a calendar name (120 characters maximum).');
 let url:string;try{url=normalizePublicGoogleIcs(String(body.url||''))}catch(e){return fail(e instanceof Error?e.message:'Invalid calendar URL.')}
 const {data:sub,error}=await db.from('calendar_subscriptions').insert({organization_id:organizationId,team_id:teamId,name,feed_url:url,created_by_user_id:ctx.userId}).select('*').single();
 if(error)return fail(error.code==='23505'?'This calendar is already subscribed at that scope.':'Calendar subscription could not be saved.',error.code==='23505'?409:500);
 const sync=await syncCalendarSubscription(sub);
 return NextResponse.json({subscription:sub,sync},{status:201});
}
export async function PATCH(req:NextRequest){
 const ctx=await authorize();if(!ctx)return fail('Please sign in again.',401);
 let body:any;try{body=await req.json()}catch{return fail('Invalid request.')}
 const db=createAdminClient(),{data:sub}=await db.from('calendar_subscriptions').select('*').eq('id',String(body.id||'')).maybeSingle();
 if(!sub||!canManageCalendar(ctx,sub.organization_id,sub.team_id))return fail('You cannot manage this subscription.',403);
 const update:any={updated_at:new Date().toISOString()};
 if(typeof body.enabled==='boolean')update.enabled=body.enabled;
 if(typeof body.name==='string'){if(!body.name.trim()||body.name.trim().length>120)return fail('Enter a valid calendar name.');update.name=body.name.trim();}
 if(body.teamId!==undefined){const next=body.teamId?String(body.teamId):null;if(!canManageCalendar(ctx,sub.organization_id,next))return fail('You cannot move this calendar to that scope.',403);if(next){const teams=await teamsInOrg(db,sub.organization_id);if(!teams.some((t:any)=>t.id===next))return fail('Choose a team in the organization.')}update.team_id=next;}
 const {error}=await db.from('calendar_subscriptions').update(update).eq('id',sub.id);
 if(error)return fail('Could not update the subscription.',500);
 return NextResponse.json({ok:true});
}
export async function DELETE(req:NextRequest){
 const ctx=await authorize();if(!ctx)return fail('Please sign in again.',401);
 let body:any;try{body=await req.json()}catch{return fail('Invalid request.')}
 const db=createAdminClient(),{data:sub}=await db.from('calendar_subscriptions').select('*').eq('id',String(body.id||'')).maybeSingle();
 if(!sub||!canManageCalendar(ctx,sub.organization_id,sub.team_id))return fail('You cannot manage this subscription.',403);
 const {error}=await db.from('calendar_subscriptions').delete().eq('id',sub.id);
 if(error)return fail('Could not remove the subscription.',500);
 return NextResponse.json({ok:true});
}
