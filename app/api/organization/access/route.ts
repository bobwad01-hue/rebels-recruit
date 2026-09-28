import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@/lib/supabase-server";
import {createAdminClient} from "@/lib/supabase-admin";

async function context(req:NextRequest){
 const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)return null;
 const organizationId=req.nextUrl.searchParams.get("organizationId")||"";const admin=createAdminClient();
 const{data:owner}=await admin.from("platform_roles").select("role").eq("user_id",user.id).eq("role","super_owner").maybeSingle();
 if(!owner){const{data:member}=await admin.from("organization_members").select("id").eq("organization_id",organizationId).eq("user_id",user.id).eq("role","admin").eq("status","active").maybeSingle();if(!member)return null}
 return{user,admin,organizationId};
}
export async function GET(req:NextRequest){
 const c=await context(req);if(!c)return NextResponse.json({error:"Admin access is required."},{status:403});const{admin,organizationId}=c;
 const{data:teams}=await admin.from("teams").select("id,name,age_group,archived_at").eq("organization_id",organizationId);
 const{data:roles}=await admin.from("organization_user_roles").select("user_id,role,status").eq("organization_id",organizationId).eq("status","active");
 const teamIds=(teams||[]).map((t:any)=>t.id);const{data:teamRoles}=teamIds.length?await admin.from("team_user_roles").select("team_id,user_id,role,status").in("team_id",teamIds).eq("status","active"):{data:[]};
 const{data:requests}=await admin.from("organization_join_requests").select("id,user_id,team_id,role,status,requested_at").eq("organization_id",organizationId).eq("status","pending");
 const userIds=[...new Set([...(roles||[]).map((x:any)=>x.user_id),...(requests||[]).map((x:any)=>x.user_id)])];const{data:profiles}=userIds.length?await admin.from("profiles").select("id,full_name,email").in("id",userIds):{data:[]};const byId=new Map((profiles||[]).map((p:any)=>[String(p.id),p]));
 const people=[...new Set((roles||[]).map((x:any)=>String(x.user_id)))].map(uid=>({user_id:uid,profile:byId.get(uid)||null,roles:(roles||[]).filter((x:any)=>String(x.user_id)===uid).map((x:any)=>x.role),teamRoles:(teamRoles||[]).filter((x:any)=>String(x.user_id)===uid).map((x:any)=>({team_id:x.team_id,role:x.role}))}));
 return NextResponse.json({people,teams:teams||[],requests:(requests||[]).map((x:any)=>({...x,profile:byId.get(String(x.user_id))||null}))});
}
export async function POST(req:NextRequest){
 const c=await context(req);if(!c)return NextResponse.json({error:"Admin access is required."},{status:403});const{user,admin,organizationId}=c;const body=await req.json();const action=String(body.action||"");
 if(action==="review"){const id=String(body.requestId||""),decision=String(body.decision||"");const{data:r}=await admin.from("organization_join_requests").select("id,user_id,team_id,role").eq("id",id).eq("organization_id",organizationId).eq("status","pending").maybeSingle();if(!r||!["approved","declined"].includes(decision))return NextResponse.json({error:"Pending request not found."},{status:404});if(decision==="approved"){await admin.from("organization_user_roles").upsert({organization_id:organizationId,user_id:r.user_id,role:r.role,status:"active",granted_by:user.id,revoked_at:null},{onConflict:"organization_id,user_id,role"});await admin.from("user_roles").upsert({user_id:r.user_id,role:r.role},{onConflict:"user_id,role"});}await admin.from("organization_join_requests").update({status:decision,reviewed_by:user.id,reviewed_at:new Date().toISOString()}).eq("id",id);return NextResponse.json({ok:true});}
 if(action==="saveAccess"){
  const target=String(body.userId||""),role=String(body.role||""),enabled=Boolean(body.enabled),selected=Array.isArray(body.teamIds)?body.teamIds.map(String):[];
  if(!target||!["admin","advisor","athlete","parent"].includes(role))return NextResponse.json({error:"Person and role are required."},{status:400});
  if(enabled)await admin.from("organization_user_roles").upsert({organization_id:organizationId,user_id:target,role,status:"active",granted_by:user.id,granted_at:new Date().toISOString(),revoked_at:null},{onConflict:"organization_id,user_id,role"});
  else await admin.from("organization_user_roles").update({status:"revoked",revoked_at:new Date().toISOString()}).eq("organization_id",organizationId).eq("user_id",target).eq("role",role);
  if(role!=="admin"){
   const{data:orgTeams}=await admin.from("teams").select("id").eq("organization_id",organizationId);const ids=(orgTeams||[]).map((t:any)=>t.id);
   if(ids.length)await admin.from("team_user_roles").update({status:"revoked",revoked_at:new Date().toISOString()}).eq("user_id",target).eq("role",role).in("team_id",ids);
   if(enabled)for(const teamId of selected){if(ids.includes(teamId))await admin.from("team_user_roles").upsert({team_id:teamId,user_id:target,role,status:"active",granted_by:user.id,granted_at:new Date().toISOString(),revoked_at:null},{onConflict:"team_id,user_id,role"});}
  }
  if(enabled)await admin.from("user_roles").upsert({user_id:target,role},{onConflict:"user_id,role"});
  return NextResponse.json({ok:true});
 }
 return NextResponse.json({error:"Unknown action."},{status:400});
}