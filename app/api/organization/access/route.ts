import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@/lib/supabase-server";
import {createAdminClient} from "@/lib/supabase-admin";

async function context(req:NextRequest){
 const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)return null;
 const organizationId=req.nextUrl.searchParams.get("organizationId")||"";const admin=createAdminClient();
 const{data:owner}=await admin.from("platform_roles").select("role").eq("user_id",user.id).eq("role","super_owner").maybeSingle();
 if(owner)return{user,admin,organizationId,organizationAdmin:true,teamIds:null as string[]|null};
 const{data:member}=await admin.from("organization_members").select("id").eq("organization_id",organizationId).eq("user_id",user.id).eq("role","admin").eq("status","active").maybeSingle();
 if(member)return{user,admin,organizationId,organizationAdmin:true,teamIds:null as string[]|null};
 const{data:orgTeams}=await admin.from("teams").select("id").eq("organization_id",organizationId);
 const ids=(orgTeams||[]).map((x:any)=>String(x.id));
 const{data:teamAdmin}=ids.length?await admin.from("team_user_roles").select("team_id").eq("user_id",user.id).eq("role","admin").eq("status","active").in("team_id",ids):{data:[]};
 const teamIds=(teamAdmin||[]).map((x:any)=>String(x.team_id));
 if(!teamIds.length)return null;
 return{user,admin,organizationId,organizationAdmin:false,teamIds};
}
export async function GET(req:NextRequest){
 const c=await context(req);if(!c)return NextResponse.json({error:"Admin access is required."},{status:403});const{admin,organizationId}=c;
 let teamQuery=admin.from("teams").select("id,name,age_group,archived_at").eq("organization_id",organizationId);if(c.teamIds)teamQuery=teamQuery.in("id",c.teamIds);const{data:teams}=await teamQuery;
 const{data:roles}=await admin.from("organization_user_roles").select("user_id,role,status").eq("organization_id",organizationId).eq("status","active");
 const teamIds=(teams||[]).map((t:any)=>t.id);const{data:teamRoles}=teamIds.length?await admin.from("team_user_roles").select("team_id,user_id,role,status").in("team_id",teamIds).eq("status","active"):{data:[]};
 const{data:requests}=await admin.from("organization_join_requests").select("id,user_id,team_id,role,status,requested_at").eq("organization_id",organizationId).eq("status","pending");
 const userIds=[...new Set([...(roles||[]).map((x:any)=>x.user_id),...(requests||[]).map((x:any)=>x.user_id)])];const{data:profiles}=userIds.length?await admin.from("profiles").select("id,full_name,email").in("id",userIds):{data:[]};const byId=new Map((profiles||[]).map((p:any)=>[String(p.id),p]));
 const people=[...new Set((roles||[]).map((x:any)=>String(x.user_id)))].map(uid=>({user_id:uid,profile:byId.get(uid)||null,roles:(roles||[]).filter((x:any)=>String(x.user_id)===uid).map((x:any)=>x.role),teamRoles:(teamRoles||[]).filter((x:any)=>String(x.user_id)===uid).map((x:any)=>({team_id:x.team_id,role:x.role}))}));
 return NextResponse.json({people,teams:teams||[],requests:(requests||[]).map((x:any)=>({...x,profile:byId.get(String(x.user_id))||null}))});
}
export async function POST(req:NextRequest){
 const c=await context(req);if(!c)return NextResponse.json({error:"Admin access is required."},{status:403});const{user,admin,organizationId}=c;const body=await req.json();const action=String(body.action||"");
 if(!c.organizationAdmin&&action==="review"){const{data:reqRow}=await admin.from("organization_join_requests").select("team_id").eq("id",String(body.requestId||"")).maybeSingle();if(!reqRow?.team_id||!c.teamIds?.includes(String(reqRow.team_id)))return NextResponse.json({error:"That request is outside your team Admin scope."},{status:403});}
 if(!c.organizationAdmin&&action==="saveAccess"){const selected=Array.isArray(body.teamIds)?body.teamIds.map(String):[];if(String(body.role||"")==="admin"||selected.some((id:string)=>!c.teamIds?.includes(id)))return NextResponse.json({error:"Team Admins can manage access only for their assigned team(s). Organization Admin access is required for organization-wide roles."},{status:403});}
 if(action==="review"){
  const id=String(body.requestId||""),decision=String(body.decision||"");
  const{data:r,error:requestError}=await admin.from("organization_join_requests")
    .select("id,user_id,team_id,role").eq("id",id).eq("organization_id",organizationId).eq("status","pending").maybeSingle();
  if(requestError)return NextResponse.json({error:requestError.message},{status:500});
  if(!r||!["approved","declined"].includes(decision))return NextResponse.json({error:"Pending request not found."},{status:404});
  if(!r.team_id&&!c.organizationAdmin)return NextResponse.json({error:"Organization Admin approval is required."},{status:403});
  if(decision==="approved"){
    const roles=r.role==="advisor_admin"?["advisor","admin"]:[r.role];
    if(roles.some((role:string)=>!["advisor","admin"].includes(role)))return NextResponse.json({error:"This staff request cannot be approved here."},{status:400});
    for(const role of roles){
      if(r.team_id){
        const{error}=await admin.from("team_user_roles").upsert({
          team_id:r.team_id,user_id:r.user_id,role,status:"active",granted_by:user.id,revoked_at:null,
        },{onConflict:"team_id,user_id,role"});
        if(error)return NextResponse.json({error:error.message},{status:500});
      }else{
        const{error}=await admin.from("organization_user_roles").upsert({
          organization_id:organizationId,user_id:r.user_id,role,status:"active",granted_by:user.id,revoked_at:null,
        },{onConflict:"organization_id,user_id,role"});
        if(error)return NextResponse.json({error:error.message},{status:500});
      }
      const{error:userRoleError}=await admin.from("user_roles").upsert({
        user_id:r.user_id,role,
      },{onConflict:"user_id,role"});
      if(userRoleError)return NextResponse.json({error:userRoleError.message},{status:500});
    }
    if(!r.team_id){
      const primaryRole=roles.includes("admin")?"admin":"advisor";
      const{data:existing}=await admin.from("organization_members").select("id")
        .eq("organization_id",organizationId).eq("user_id",r.user_id).maybeSingle();
      const membership={
        role:primaryRole,status:"active",organization_view_access:primaryRole==="admin",
        joined_at:new Date().toISOString(),
      };
      const {error:memberError}=existing
        ?await admin.from("organization_members").update(membership).eq("id",existing.id)
        :await admin.from("organization_members").insert({
          organization_id:organizationId,user_id:r.user_id,...membership,
        });
      if(memberError)return NextResponse.json({error:memberError.message},{status:500});
    }
    const{error:profileError}=await admin.from("profiles").update({
      advisor_account_type:"organization",commercial_status:"not_required",
    }).eq("id",r.user_id);
    if(profileError)return NextResponse.json({error:profileError.message},{status:500});
  }
  const{error:updateError}=await admin.from("organization_join_requests")
    .update({status:decision,reviewed_by:user.id,reviewed_at:new Date().toISOString()})
    .eq("id",id).eq("status","pending");
  if(updateError)return NextResponse.json({error:updateError.message},{status:500});
  return NextResponse.json({ok:true});
 }
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