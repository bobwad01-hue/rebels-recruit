import {NextRequest} from 'next/server';
import {createClient} from '@/lib/supabase-server';
import {createAdminClient} from '@/lib/supabase-admin';
import {calendarContext,athleteCalendarContext,type CalendarContext} from '@/lib/calendar-subscriptions';

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
 try{
  const athleteScope=await athleteCalendarContext(athleteId);
  if(!athleteScope.organizationIds.length)return {error:'Preview athlete has no active team or organization membership.'};
  return {ctx:{...athleteScope,userId:ctx.userId}};
 }catch{return {error:'Preview athlete calendar membership could not be verified.'};}

}
