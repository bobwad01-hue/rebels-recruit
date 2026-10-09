import {NextRequest} from 'next/server';
import {createClient} from '@/lib/supabase-server';
import {createAdminClient} from '@/lib/supabase-admin';
import {calendarContext,type CalendarContext} from '@/lib/calendar-subscriptions';

// Super Owner role previews use the target athlete's team memberships, never the owner's broad access.
export type CalendarPreviewResult={ctx:CalendarContext;error?:never}|{error:string;ctx?:never};
export async function previewCalendarContext(req:NextRequest,ctx:CalendarContext):Promise<CalendarPreviewResult>{
 const role=req.nextUrl.searchParams.get('previewRole');
 if(!role)return {ctx};
 if(!['athlete','parent','advisor','admin'].includes(role))return {error:'Invalid preview role.'};
 const client=await createClient();
 const {data:{user}}=await client.auth.getUser();
 if(!user)return {error:'Sign in to preview events.'};
 const {data:platform}=await client.from('platform_roles').select('role').eq('user_id',user.id).eq('role','super_owner').maybeSingle();
 if(!platform)return {error:'Role previews require Super Owner access.'};
 const db=createAdminClient();
 if(role==='admin'){
  const orgId=req.nextUrl.searchParams.get('previewOrg')||'';
  if(!orgId)return {error:'Choose an organization to preview.'};
  const {data:org}=await db.from('organizations').select('id').eq('id',orgId).maybeSingle();
  if(!org)return {error:'Organization not found.'};
  return {ctx:{...ctx,organizationIds:[orgId],organizationAdminIds:[orgId],teamIds:[],teamAdminIds:[]}};
 }
 const athleteId=req.nextUrl.searchParams.get('previewAthlete')||'';
 if(!athleteId)return {error:'Choose an athlete to preview.'};
 const {data:membership}=await db.from('organization_members').select('organization_id').eq('user_id',athleteId).eq('role','athlete').eq('status','active').limit(1).maybeSingle();
 if(!membership)return {error:'Preview athlete has no active organization membership.'};
 const {data:teamRows}=await db.from('team_members').select('team_id').eq('user_id',athleteId);
 const {data:teams}=await db.from('teams').select('id,organization_id').in('id',(teamRows||[]).map((t:any)=>t.team_id).length?(teamRows||[]).map((t:any)=>t.team_id):['00000000-0000-0000-0000-000000000000']);
 const valid=(teams||[]).filter((t:any)=>t.organization_id===membership.organization_id);
 return {ctx:{...ctx,organizationIds:[membership.organization_id],organizationAdminIds:[],teamIds:valid.map((t:any)=>t.id),teamAdminIds:[]}};
}
