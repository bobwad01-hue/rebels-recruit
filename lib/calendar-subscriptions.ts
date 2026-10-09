import {createAdminClient} from '@/lib/supabase-admin';
import {fetchPublicIcs} from '@/lib/calendar-ics';

export type CalendarContext={userId:string;organizationIds:string[];organizationAdminIds:string[];teamIds:string[];teamAdminIds:string[]};
const uniq=(a:string[])=>[...new Set(a.filter(Boolean))];
export async function calendarContext(userId:string):Promise<CalendarContext>{
 const db=createAdminClient();
 const [orgs,memberTeams,roles,parents,advisors]=await Promise.all([
  db.from('organization_members').select('organization_id,role').eq('user_id',userId).eq('status','active'),
  db.from('team_members').select('team_id').eq('user_id',userId),
  db.from('team_user_roles').select('team_id,role').eq('user_id',userId).eq('status','active'),
  db.from('parent_guardian_access').select('athlete_user_id,permissions').eq('parent_user_id',userId).eq('status','active'),
  db.from('athlete_advisor_assignments').select('athlete_user_id').eq('advisor_user_id',userId).eq('status','active')
 ]);
 const linkedAthletes=uniq([...(parents.data||[]).filter((p:any)=>p.permissions?.view_events!==false).map((p:any)=>p.athlete_user_id),...(advisors.data||[]).map((a:any)=>a.athlete_user_id)]);
 const linkedTeams=linkedAthletes.length?await db.from('team_members').select('team_id').in('user_id',linkedAthletes):{data:[]};
 const teamIds=uniq([...(memberTeams.data||[]).map((t:any)=>t.team_id),...(roles.data||[]).map((t:any)=>t.team_id),...(linkedTeams.data||[]).map((t:any)=>t.team_id)]);
 const teamRows=teamIds.length?await db.from('teams').select('id,organization_id').in('id',teamIds):{data:[]};
 const organizationAdminIds=uniq((orgs.data||[]).filter((o:any)=>o.role==='admin'||o.role==='owner').map((o:any)=>o.organization_id));
 const teamAdminIds=uniq((roles.data||[]).filter((t:any)=>t.role==='admin').map((t:any)=>t.team_id));
 return{userId,organizationIds:uniq([...(orgs.data||[]).map((o:any)=>o.organization_id),...(teamRows.data||[]).map((t:any)=>t.organization_id)]),organizationAdminIds,teamIds,teamAdminIds};
}
export function canManageCalendar(ctx:CalendarContext,orgId:string,teamId:string|null){
 return ctx.organizationAdminIds.includes(orgId)||Boolean(teamId&&ctx.teamAdminIds.includes(teamId));
}
export function canSeeCalendar(ctx:CalendarContext,orgId:string,teamId:string|null){
 return ctx.organizationAdminIds.includes(orgId)||(ctx.organizationIds.includes(orgId)&&(!teamId||ctx.teamIds.includes(teamId)));
}
export async function syncCalendarSubscription(subscription:any){
 const db=createAdminClient(),id=String(subscription.id),org=String(subscription.organization_id);
 try{
  const parsed=await fetchPublicIcs(subscription.feed_url,org);
  // Reattach historical RSVP records from the removed OAuth integration using unambiguous name/date matches.
  const {data:history}=await db.from('audit_log').select('metadata').eq('organization_id',org).eq('entity_type','organization_calendar_event_rsvp').order('created_at',{ascending:false}).limit(1000);
  const key=(name:string,date:string)=>name.trim().toLowerCase().replace(/\s+/g,' ')+'|'+date;
  const legacy=new Map<string,Set<string>>(),matches=new Map<string,number>();
  for(const row of history||[]){const m:any=row.metadata||{},name=String(m.event_name||''),date=String(m.event_date||''),id=String(m.event_id||'');if(!name||!date||!id.startsWith('google:'+org+':'))continue;const k=key(name,date);if(!legacy.has(k))legacy.set(k,new Set());legacy.get(k)!.add(id);}
  for(const e of parsed){const k=key(e.name,e.date);matches.set(k,(matches.get(k)||0)+1);}
  for(const e of parsed){const k=key(e.name,e.date),ids=legacy.get(k);if(ids?.size===1&&matches.get(k)===1)e.eventId=[...ids][0];}
  for(let i=0;i<parsed.length;i+=150){const rows=parsed.slice(i,i+150).map(e=>({...e,subscription_id:id,organization_id:org,updated_at:new Date().toISOString()}));const {error}=await db.from('calendar_subscription_events').upsert(rows,{onConflict:'subscription_id,event_key'});if(error)throw error;}
  const {data:previous,error:readError}=await db.from('calendar_subscription_events').select('id,event_key').eq('subscription_id',id);
  if(readError)throw readError;
  const current=new Set(parsed.map(x=>x.eventKey)),obsolete=(previous||[]).filter((r:any)=>!current.has(r.event_key)).map((r:any)=>r.id);
  for(let i=0;i<obsolete.length;i+=150){const {error}=await db.from('calendar_subscription_events').delete().in('id',obsolete.slice(i,i+150));if(error)throw error;}
  const {error:stateError}=await db.from('calendar_subscriptions').update({last_synced_at:new Date().toISOString(),last_error:null}).eq('id',id);if(stateError)throw stateError;
  return{ok:true,count:parsed.length};
 }catch(e){const message=e instanceof Error?e.message:'Calendar sync failed';await db.from('calendar_subscriptions').update({last_error:message.slice(0,300)}).eq('id',id);return{ok:false,error:message}}
}
export async function calendarEventAccess(ctx:CalendarContext,eventId:string){
 const db=createAdminClient();
 const {data:entries}=await db.from('calendar_subscription_events').select('subscription_id,organization_id').eq('event_id',eventId).limit(30);
 if(!entries?.length)return null;
 const {data:subs}=await db.from('calendar_subscriptions').select('id,organization_id,team_id,enabled').in('id',entries.map((x:any)=>x.subscription_id));
 return (subs||[]).filter((s:any)=>s.enabled&&canSeeCalendar(ctx,s.organization_id,s.team_id)).sort((a:any,b:any)=>Number(Boolean(a.team_id))-Number(Boolean(b.team_id)))[0]||null;
}
