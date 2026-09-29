import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

function code() {
  return randomBytes(5).toString("hex").toUpperCase();
}
async function viewer() {
  const c = await createClient();
  const {
    data: { user },
  } = await c.auth.getUser();
  if (!user) return null;
  return user;
}
async function managed(admin: any, userId: string, organizationId?: string) {
  const { data: platform } = await admin.from("platform_roles").select("role").eq("user_id", userId).eq("role", "super_owner").maybeSingle();
  if (platform) {
    let q = admin.from("organizations").select("id");
    if (organizationId) q = q.eq("id", organizationId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return (data || []).map((x:any)=>({organization_id:x.id}));
  }
  let q = admin.from("organization_members").select("organization_id").eq("user_id", userId).eq("role", "admin").eq("status", "active");
  if (organizationId) q = q.eq("organization_id", organizationId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data || [];
}
async function uniqueCode(admin: any) {
  for (let i = 0; i < 5; i++) {
    const joinCode = code();
    const { data } = await admin
      .from("organizations")
      .select("id")
      .eq("join_code", joinCode)
      .maybeSingle();
    if (!data) return joinCode;
  }
  throw new Error("Could not generate a unique organization code. Try again.");
}

export async function GET() {
  const user = await viewer();
  if (!user)
    return NextResponse.json(
      { error: "Please sign in again." },
      { status: 401 },
    );
  const admin = createAdminClient();
  try {
    const memberships = await managed(admin, user.id);
    const {data:platformOwner}=await admin.from("platform_roles").select("role").eq("user_id",user.id).eq("role","super_owner").maybeSingle();
    const ids = memberships.map((m: any) => m.organization_id);
    if (!ids.length) return NextResponse.json({ organizations: [], canCreate: !!platformOwner });
    const { data: organizations, error } = await admin
      .from("organizations")
      .select(
        "id,name,branch_name,city,state,join_code,teams(id,name,age_group,archived_at),organization_members(user_id,role,status,organization_view_access)",
      )
      .in("id", ids)
      .order("name");
    if (error) throw new Error(error.message);
    const staffIds = [...new Set((organizations || []).flatMap((o:any)=>(o.organization_members || []).filter((m:any)=>["admin","advisor"].includes(m.role)).map((m:any)=>m.user_id)))];
    const {data:staffProfiles}=staffIds.length?await admin.from("profiles").select("id,full_name,email").in("id",staffIds):{data:[] as any[]};
    const {data:staffInvites}=ids.length?await admin.from("organization_staff_invites").select("id,organization_id,email,role,organization_view_access,status,invited_at,invite_token").in("organization_id",ids).eq("status","pending"):{data:[] as any[]};
    const staffById=new Map((staffProfiles||[]).map((p:any)=>[String(p.id),p]));
    return NextResponse.json({
      canCreate: !!platformOwner,
      organizations: (organizations || []).map((o: any) => ({
        ...o,
        teams: (o.teams || []).sort((a: any, b: any) =>
          String(a.name).localeCompare(String(b.name)),
        ),
        staff: (o.organization_members || []).filter((m:any)=>["admin","advisor"].includes(m.role)).map((m:any)=>({...m,profile:staffById.get(String(m.user_id))||null})),
        staffInvites:(staffInvites||[]).filter((i:any)=>i.organization_id===o.id),
      })),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not load organization setup.",
      },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const user = await viewer();
  if (!user)
    return NextResponse.json(
      { error: "Please sign in again." },
      { status: 401 },
    );
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const action = String(body?.action || ""),
    admin = createAdminClient();
  try {
    if (action === "create") {
      const { data: platformOwner } = await admin.from("platform_roles").select("role").eq("user_id", user.id).eq("role", "super_owner").maybeSingle();
      if (!platformOwner)
        return NextResponse.json(
          { error: "Only the Rebels Recruit Super Owner can create an organization." },
          { status: 403 },
        );
      const name = String(body.name || "").trim(),
        branchName = String(body.branchName || "").trim() || null,
        city = String(body.city || "").trim(),
        state = String(body.state || "")
          .trim()
          .toUpperCase();
      if (!name || !city || !state)
        return NextResponse.json(
          { error: "Organization, city and state are required." },
          { status: 400 },
        );
      const joinCode = await uniqueCode(admin);
      const { data: organization, error } = await admin
        .from("organizations")
        .insert({
          name,
          branch_name: branchName,
          city,
          state,
          join_code: joinCode,
        })
        .select("id,name,branch_name,city,state,join_code")
        .single();
      if (error) throw new Error(error.message);
      const { data: platformRole } = await admin.from("platform_roles").select("role").eq("user_id", user.id).eq("role", "super_owner").maybeSingle();
      if (!platformRole) {
        const { error: memberError } = await admin
          .from("organization_members")
          .insert({
            organization_id: organization.id,
            user_id: user.id,
            role: "admin",
            status: "active",
            joined_at: new Date().toISOString(),
          });
        if (memberError) throw new Error(memberError.message);
      }
      return NextResponse.json({ ok: true, organization });
    }
    const organizationId = String(body.organizationId || "");
    if (
      !organizationId ||
      !(await managed(admin, user.id, organizationId)).length
    )
      return NextResponse.json(
        { error: "Admin access is required for this organization." },
        { status: 403 },
      );
    if (action === "getJoinLinks") {
      const {data:organization}=await admin.from("organizations").select("id,name,teams(id,name,age_group,archived_at)").eq("id",organizationId).single();
      const scopes=[{role:"admin",teamId:null,requiresApproval:true},...((organization?.teams||[]).filter((t:any)=>!t.archived_at).flatMap((t:any)=>["advisor","athlete","parent"].map(role=>({role,teamId:t.id,requiresApproval:false}))))];
      for(const scope of scopes){
        const {data:existing}=await admin.from("organization_join_links").select("id").eq("organization_id",organizationId).eq("role",scope.role).eq("active",true).is("team_id",scope.teamId).maybeSingle();
        if(!existing)await admin.from("organization_join_links").insert({organization_id:organizationId,team_id:scope.teamId,role:scope.role,requires_approval:scope.requiresApproval,created_by:user.id});
      }
      const {data:links,error}=await admin.from("organization_join_links").select("id,team_id,role,token,requires_approval,active,created_at").eq("organization_id",organizationId).eq("active",true);
      if(error)throw new Error(error.message);
      const appUrl=(process.env.NEXT_PUBLIC_APP_URL||"https://www.rltnl.com").replace(/\/$/,"");
      return NextResponse.json({ok:true,links:(links||[]).map((x:any)=>({...x,url:`${appUrl}/join/${x.token}`}))});
    }
    if (action === "manageUserRole") {
      const target=String(body.userId||""),role=String(body.role||""),enabled=Boolean(body.enabled),teamIds=Array.isArray(body.teamIds)?body.teamIds.map(String):[];
      if(!target||!["admin","advisor","athlete","parent"].includes(role))return NextResponse.json({error:"Person and role are required."},{status:400});
      if(enabled)await admin.from("organization_user_roles").upsert({organization_id:organizationId,user_id:target,role,status:"active",granted_by:user.id,granted_at:new Date().toISOString(),revoked_at:null},{onConflict:"organization_id,user_id,role"});
      else await admin.from("organization_user_roles").update({status:"revoked",revoked_at:new Date().toISOString()}).eq("organization_id",organizationId).eq("user_id",target).eq("role",role);
      if(role!=="admin"){
        if(!enabled)await admin.from("team_user_roles").update({status:"revoked",revoked_at:new Date().toISOString()}).eq("user_id",target).eq("role",role).in("team_id",(await admin.from("teams").select("id").eq("organization_id",organizationId)).data?.map((x:any)=>x.id)||[]);
        else for(const teamId of teamIds){const {data:team}=await admin.from("teams").select("id").eq("id",teamId).eq("organization_id",organizationId).maybeSingle();if(team)await admin.from("team_user_roles").upsert({team_id:teamId,user_id:target,role,status:"active",granted_by:user.id,granted_at:new Date().toISOString(),revoked_at:null},{onConflict:"team_id,user_id,role"});}
      }
      return NextResponse.json({ok:true});
    }
    if (action === "setStaffRoles") {
      const target=String(body.userId||""), wantsAdmin=Boolean(body.admin), wantsAdvisor=Boolean(body.advisor);
      if(!target||(!wantsAdmin&&!wantsAdvisor))return NextResponse.json({error:"Choose Advisor, Admin, or Advisor + Admin."},{status:400});
      for(const role of ["admin","advisor"]){
        const enabled=role==="admin"?wantsAdmin:wantsAdvisor;
        if(enabled){
          const {error:roleError}=await admin.from("organization_user_roles").upsert({organization_id:organizationId,user_id:target,role,status:"active",granted_by:user.id,granted_at:new Date().toISOString(),revoked_at:null},{onConflict:"organization_id,user_id,role"});if(roleError)throw new Error(roleError.message);
          const {error:globalError}=await admin.from("user_roles").upsert({user_id:target,role},{onConflict:"user_id,role"});if(globalError)throw new Error(globalError.message);
        }else{
          const {error:revokeError}=await admin.from("organization_user_roles").update({status:"revoked",revoked_at:new Date().toISOString()}).eq("organization_id",organizationId).eq("user_id",target).eq("role",role);if(revokeError)throw new Error(revokeError.message);
        }
      }
      const legacyRole=wantsAdmin?"admin":"advisor";
      const {data:legacy}=await admin.from("organization_members").select("id").eq("organization_id",organizationId).eq("user_id",target).maybeSingle();
      if(legacy){const {error:e}=await admin.from("organization_members").update({role:legacyRole,status:"active",organization_view_access:wantsAdmin}).eq("id",legacy.id);if(e)throw new Error(e.message)}
      else{const {error:e}=await admin.from("organization_members").insert({organization_id:organizationId,user_id:target,role:legacyRole,status:"active",organization_view_access:wantsAdmin,joined_at:new Date().toISOString()});if(e)throw new Error(e.message)}
      return NextResponse.json({ok:true});
    }
    if (action === "inviteStaff") {
      const email=String(body.email||"").trim().toLowerCase(), role=String(body.role||"advisor");
      if(!email||!["admin","advisor"].includes(role)) return NextResponse.json({error:"A valid staff email and role are required."},{status:400});
      const {data:existingProfile}=await admin.from("profiles").select("id,email").ilike("email",email).maybeSingle();
      if(existingProfile){
        const {data:existingMember}=await admin.from("organization_members").select("id").eq("organization_id",organizationId).eq("user_id",existingProfile.id).maybeSingle();
        if(existingMember) return NextResponse.json({error:"That person already has access to this organization."},{status:400});
      }
      await admin.from("organization_staff_invites").update({status:"cancelled"}).eq("organization_id",organizationId).eq("email",email).eq("status","pending");
      const {data:invite,error}=await admin.from("organization_staff_invites").insert({organization_id:organizationId,email,role,organization_view_access:role==="admin"?true:Boolean(body.organizationViewAccess),invited_by:user.id}).select("id,invite_token").single();
      if(error) throw new Error(error.message);
      const appUrl=(process.env.NEXT_PUBLIC_APP_URL||"https://www.rltnl.com").replace(/\/$/,"");
      const inviteUrl=`${appUrl}/signup?staff_token=${encodeURIComponent(String(invite.invite_token))}`;
      return NextResponse.json({ok:true,inviteUrl});
    }
    if (action === "cancelStaffInvite") {
      const {error}=await admin.from("organization_staff_invites").update({status:"cancelled"}).eq("id",String(body.inviteId||"")).eq("organization_id",organizationId).eq("status","pending");
      if(error) throw new Error(error.message);return NextResponse.json({ok:true});
    }
    if (action === "updateStaff") {
      const target=String(body.userId||""), role=String(body.role||"advisor");
      if(!target||!["admin","advisor"].includes(role)) return NextResponse.json({error:"Staff member and role are required."},{status:400});
      const {data:current}=await admin.from("organization_members").select("role,status").eq("organization_id",organizationId).eq("user_id",target).maybeSingle();
      if(!current) return NextResponse.json({error:"Staff access was not found."},{status:404});
      if(current.role==="admin"&&role!=="admin"){const {count}=await admin.from("organization_members").select("*",{count:"exact",head:true}).eq("organization_id",organizationId).eq("role","admin").eq("status","active");if((count||0)<=1)return NextResponse.json({error:"Add another Admin before changing the organization's last Admin."},{status:400});}
      const {error}=await admin.from("organization_members").update({role,organization_view_access:role==="admin"?true:Boolean(body.organizationViewAccess),organization_view_granted_by:role==="admin"||body.organizationViewAccess?user.id:null,organization_view_granted_at:role==="admin"||body.organizationViewAccess?new Date().toISOString():null}).eq("organization_id",organizationId).eq("user_id",target);
      if(error) throw new Error(error.message);
      await admin.from("user_roles").upsert({user_id:target,role},{onConflict:"user_id,role"});
      return NextResponse.json({ok:true});
    }
    if (action === "removeStaff") {
      const target=String(body.userId||"");const {data:current}=await admin.from("organization_members").select("role").eq("organization_id",organizationId).eq("user_id",target).maybeSingle();
      if(current?.role==="admin"){const {count}=await admin.from("organization_members").select("*",{count:"exact",head:true}).eq("organization_id",organizationId).eq("role","admin").eq("status","active");if((count||0)<=1)return NextResponse.json({error:"You cannot remove the organization's last Admin."},{status:400});}
      const {error}=await admin.from("organization_members").update({status:"revoked",suspended_at:new Date().toISOString(),suspended_by:user.id}).eq("organization_id",organizationId).eq("user_id",target);
      if(error) throw new Error(error.message);return NextResponse.json({ok:true});
    }
    if (action === "update") {
      const name = String(body.name || "").trim(),
        branchName = String(body.branchName || "").trim() || null,
        city = String(body.city || "").trim(),
        state = String(body.state || "")
          .trim()
          .toUpperCase();
      if (!name || !city || !state)
        return NextResponse.json(
          { error: "Organization, city and state are required." },
          { status: 400 },
        );
      const { error } = await admin
        .from("organizations")
        .update({ name, branch_name: branchName, city, state })
        .eq("id", organizationId);
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true });
    }
    if (action === "regenerateCode") {
      const joinCode = await uniqueCode(admin);
      const { error } = await admin
        .from("organizations")
        .update({ join_code: joinCode })
        .eq("id", organizationId);
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true, joinCode });
    }
    if (action === "addTeam") {
      const name = String(body.name || "").trim(),
        ageGroup = String(body.ageGroup || "").trim() || null;
      if (!name)
        return NextResponse.json(
          { error: "Team name is required." },
          { status: 400 },
        );
      const { error } = await admin
        .from("teams")
        .insert({ organization_id: organizationId, name, age_group: ageGroup });
      if (error)
        throw new Error(
          error.code === "23505"
            ? "That team already exists in this organization."
            : error.message,
        );
      return NextResponse.json({ ok: true });
    }
    if (action === "renameTeam") {
      const teamId = String(body.teamId || ""),
        name = String(body.name || "").trim(),
        ageGroup = String(body.ageGroup || "").trim() || null;
      if (!teamId || !name)
        return NextResponse.json(
          { error: "Team and name are required." },
          { status: 400 },
        );
      const { error } = await admin
        .from("teams")
        .update({ name, age_group: ageGroup })
        .eq("id", teamId)
        .eq("organization_id", organizationId);
      if (error)
        throw new Error(
          error.code === "23505"
            ? "That team already exists in this organization."
            : error.message,
        );
      return NextResponse.json({ ok: true });
    }
    if (action === "archiveTeam") {
      const teamId = String(body.teamId || "");
      const { count } = await admin
        .from("team_members")
        .select("*", { count: "exact", head: true })
        .eq("team_id", teamId);
      if (count)
        return NextResponse.json(
          { error: "Move players to another team before archiving this team." },
          { status: 400 },
        );
      const { error } = await admin
        .from("teams")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", teamId)
        .eq("organization_id", organizationId);
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true });
    }
    if (action === "restoreTeam") {
      const teamId = String(body.teamId || "");
      const { error } = await admin
        .from("teams")
        .update({ archived_at: null })
        .eq("id", teamId)
        .eq("organization_id", organizationId);
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json(
      { error: "Unsupported organization action." },
      { status: 400 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not update organization setup.",
      },
      { status: 500 },
    );
  }
}
