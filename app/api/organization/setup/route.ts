import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

function code() {
  return randomBytes(5).toString("hex").toUpperCase();
}
const FAMILY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function familySignupCode() {
  const bytes = randomBytes(10);
  const chars = Array.from(bytes, byte => FAMILY_ALPHABET[byte % FAMILY_ALPHABET.length]).join("");
  return `${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8)}`;
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
  if((data||[]).length)return (data||[]).map((x:any)=>({...x,organization_admin:true,team_ids:null}));
  let teamsQ=admin.from("teams").select("id,organization_id");
  if(organizationId)teamsQ=teamsQ.eq("organization_id",organizationId);
  const{data:teams,error:teamError}=await teamsQ;if(teamError)throw new Error(teamError.message);
  const ids=(teams||[]).map((x:any)=>x.id);if(!ids.length)return [];
  const{data:teamRoles,error:roleError}=await admin.from("team_user_roles").select("team_id").eq("user_id",userId).eq("role","admin").eq("status","active").in("team_id",ids);if(roleError)throw new Error(roleError.message);
  const byOrg=new Map<string,string[]>();for(const r of teamRoles||[]){const t=(teams||[]).find((x:any)=>x.id===r.team_id);if(t){const a=byOrg.get(t.organization_id)||[];a.push(t.id);byOrg.set(t.organization_id,a)}}
  return [...byOrg.entries()].map(([organization_id,team_ids])=>({organization_id,organization_admin:false,team_ids}));
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
function inferredAge(name:string,ageGroup?:string|null){
  const source=`${ageGroup||""} ${name||""}`.trim();
  const m=source.match(/(?:^|\s)(1[0-9]|[8-9])\s*u?\b/i);
  return m?Number(m[1]):0;
}
function teamRank(team:any,type:string){
  const name=String(team.name||"").toLowerCase(),age=inferredAge(name,team.age_group);
  if(type==="high_school"){
    const level=name.includes("varsity")&&!name.includes("junior")?400:name.includes("junior varsity")||/\bjv\b/.test(name)?300:name.includes("c-team")||name.includes("c team")?200:name.includes("freshman")?100:0;
    return [level,0,String(team.name||"")];
  }
  const label=/\bpremier\b/.test(name)?90:/\bplatinum\b/.test(name)?85:/\bnational\b/.test(name)?80:/\bgold\b/.test(name)?70:/\bregional\b/.test(name)?60:/\b[a]\b/.test(name)||new RegExp(`\\b${age}a\\b`).test(name)?50:/\b[b]\b/.test(name)||new RegExp(`\\b${age}b\\b`).test(name)?40:10;
  return [age,label,String(team.name||"")];
}
function smartSort(teams:any[],type:string){
  return [...teams].sort((a,b)=>{const A=teamRank(a,type),B=teamRank(b,type);return Number(B[0])-Number(A[0])||Number(B[1])-Number(A[1])||String(A[2]).localeCompare(String(B[2]));});
}
async function applySmartOrder(admin:any,organizationId:string,type:string){
  const {data:teams,error}=await admin.from("teams").select("id,name,age_group,archived_at").eq("organization_id",organizationId).is("archived_at",null);
  if(error)throw new Error(error.message);
  const sorted=smartSort(teams||[],type);
  for(let i=0;i<sorted.length;i++){const {error:e}=await admin.from("teams").update({sort_order:(i+1)*10}).eq("id",sorted[i].id);if(e)throw new Error(e.message);}
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
    const ids = memberships.map((m: any) => m.organization_id);const scopeByOrg=new Map(memberships.map((m:any)=>[String(m.organization_id),m]));
    if (!ids.length) return NextResponse.json({ organizations: [], canCreate: !!platformOwner });
    const { data: organizations, error } = await admin
      .from("organizations")
      .select(
        "id,name,branch_name,city,state,join_code,organization_type,teams(id,name,age_group,archived_at,sort_order),organization_members(user_id,role,status,organization_view_access)",
      )
      .in("id", ids)
      .order("name");
    if (error) throw new Error(error.message);
    const teamIds=[...new Set((organizations||[]).flatMap((o:any)=>(o.teams||[]).map((t:any)=>t.id)))];
    const [{data:teamMembers},{data:teamRoles},{data:orgRoles},{data:parentLinks}]=await Promise.all([
      teamIds.length?admin.from("team_members").select("team_id,user_id").in("team_id",teamIds):Promise.resolve({data:[] as any[]}),
      teamIds.length?admin.from("team_user_roles").select("team_id,user_id,role,status").in("team_id",teamIds).eq("status","active"):Promise.resolve({data:[] as any[]}),
      admin.from("organization_user_roles").select("organization_id,user_id,role,status").in("organization_id",ids).eq("status","active"),
      admin.from("parent_guardian_access").select("parent_user_id,athlete_user_id,status").eq("status","active")
    ]);
    const allUserIds=[...new Set([...(organizations||[]).flatMap((o:any)=>(o.organization_members||[]).map((m:any)=>m.user_id)),...(teamMembers||[]).map((x:any)=>x.user_id),...(teamRoles||[]).map((x:any)=>x.user_id),...(parentLinks||[]).flatMap((x:any)=>[x.parent_user_id,x.athlete_user_id])])];
    const {data:staffProfiles}=allUserIds.length?await admin.from("profiles").select("id,full_name,email").in("id",allUserIds):{data:[] as any[]};
    const {data:staffInvites}=ids.length?await admin.from("organization_staff_invites").select("id,organization_id,email,role,organization_view_access,status,invited_at,invite_token").in("organization_id",ids).eq("status","pending"):{data:[] as any[]};
    const staffById=new Map((staffProfiles||[]).map((p:any)=>[String(p.id),p]));
    return NextResponse.json({
      canCreate: !!platformOwner,
      organizations: (organizations || []).map((o: any) => ({
        ...o,
        teams: (o.teams || []).filter((t:any)=>{const scope:any=scopeByOrg.get(String(o.id));return scope?.organization_admin!==false||scope?.team_ids?.includes(String(t.id))}).sort((a: any, b: any) =>
          (Number(a.sort_order ?? 999999) - Number(b.sort_order ?? 999999)) || String(a.name).localeCompare(String(b.name)),
        ),
        staff: (o.organization_members || []).filter((m:any)=>["admin","advisor"].includes(m.role)).map((m:any)=>({...m,profile:staffById.get(String(m.user_id))||null,roles:(orgRoles||[]).filter((r:any)=>r.organization_id===o.id&&r.user_id===m.user_id).map((r:any)=>r.role)})),
        roster: (o.teams||[]).map((t:any)=>({teamId:t.id,members:[...(teamMembers||[]).filter((x:any)=>x.team_id===t.id).map((x:any)=>({userId:x.user_id,role:"athlete"})),...(teamRoles||[]).filter((x:any)=>x.team_id===t.id).map((x:any)=>({userId:x.user_id,role:x.role}))].filter((x:any,i:number,a:any[])=>a.findIndex((y:any)=>y.userId===x.userId&&y.role===x.role)===i).map((x:any)=>({...x,profile:staffById.get(String(x.userId))||null,linkedAthletes:x.role==="parent"?(parentLinks||[]).filter((p:any)=>p.parent_user_id===x.userId).map((p:any)=>({id:p.athlete_user_id,name:staffById.get(String(p.athlete_user_id))?.full_name||"Athlete"})):[]}))})),
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
          .toUpperCase(),
        organizationType = ["travel_club","high_school"].includes(String(body.organizationType||"")) ? String(body.organizationType) : null;
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
          organization_type: organizationType,
        })
        .select("id,name,branch_name,city,state,join_code,organization_type")
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
    const access=organizationId?await managed(admin,user.id,organizationId):[];
    const scope:any=access[0]||null;
    if (
      !organizationId ||
      !access.length
    )
      return NextResponse.json(
        { error: "Admin access is required for this organization." },
        { status: 403 },
      );
    if (action === "getJoinLinks") {
      const {data:organization,error:orgError}=await admin.from("organizations").select("id,name,teams(id,name,age_group,archived_at)").eq("id",organizationId).single();
      if(orgError)throw new Error(orgError.message);
      const visibleTeams=(organization?.teams||[]).filter((t:any)=>!t.archived_at&&(scope?.organization_admin!==false||scope?.team_ids?.includes(String(t.id))));
      // One family link per team. Advisor links remain separate and require Admin approval.
      const scopes=[
        ...(scope?.organization_admin===false?[]:["advisor","admin","advisor_admin"].map(role=>({
          role,teamId:null,requiresApproval:true,
        }))),
        ...visibleTeams.flatMap((t:any)=>[
          {role:"family",teamId:t.id,requiresApproval:false},
          {role:"advisor",teamId:t.id,requiresApproval:true},
        ]),
      ];
      for(const linkScope of scopes){
        const {data:existing,error:lookupError}=await admin.from("organization_join_links")
          .select("id,requires_approval,signup_code").eq("organization_id",organizationId)
          .eq("role",linkScope.role).eq("active",true).is("team_id",linkScope.teamId).maybeSingle();
        if(lookupError)throw new Error(lookupError.message);
        if(!existing){
          const {error:insertError}=await admin.from("organization_join_links").insert({
            organization_id:organizationId,team_id:linkScope.teamId,role:linkScope.role,
            requires_approval:linkScope.requiresApproval,created_by:user.id,
            ...(linkScope.role==="family"?{signup_code:familySignupCode()}:{}),
          });
          if(insertError)throw new Error(insertError.message);
        }else if(linkScope.role==="family"&&!existing.signup_code){
          const {error:updateError}=await admin.from("organization_join_links")
            .update({signup_code:familySignupCode()}).eq("id",existing.id);
          if(updateError)throw new Error(updateError.message);
        }else if(["advisor","admin","advisor_admin"].includes(linkScope.role)&&!existing.requires_approval){
          const {error:updateError}=await admin.from("organization_join_links")
            .update({requires_approval:true}).eq("id",existing.id);
          if(updateError)throw new Error(updateError.message);
        }
      }
      const ids=visibleTeams.map((t:any)=>t.id);
      const {data:links,error}=await admin.from("organization_join_links")
        .select("id,team_id,role,token,signup_code,requires_approval,active,created_at")
        .eq("organization_id",organizationId).eq("active",true).in("role",["family","advisor","admin","advisor_admin"]);
      if(error)throw new Error(error.message);
      const visible=(links||[]).filter((x:any)=>x.team_id
        ? ids.includes(x.team_id)&&["family","advisor"].includes(x.role)
        : scope?.organization_admin!==false&&["advisor","admin","advisor_admin"].includes(x.role));
      const appUrl=(process.env.NEXT_PUBLIC_APP_URL||"https://www.rltnl.com").replace(/\/$/,"");
      return NextResponse.json({ok:true,links:visible.map((x:any)=>({
        ...x,url:x.role==="family"?`${appUrl}/signup?join_token=${x.token}`:`${appUrl}/join/${x.token}`,
      }))});
    }
    if(scope?.organization_admin===false&&!["getJoinLinks","manageUserRole","setTeamAccess"].includes(action))return NextResponse.json({error:"Organization Admin access is required for that action."},{status:403});
    if (action === "manageUserRole") {
      const target=String(body.userId||""),role=String(body.role||""),enabled=Boolean(body.enabled),teamIds=Array.isArray(body.teamIds)?body.teamIds.map(String):[];
      if(!target||!["admin","advisor","athlete","parent"].includes(role))return NextResponse.json({error:"Person and role are required."},{status:400});
      if(scope?.organization_admin===false){
        if(!teamIds.length||teamIds.some((id:string)=>!scope.team_ids?.includes(id)))return NextResponse.json({error:"Team Admins can manage roles only inside their assigned team(s)."},{status:403});
        for(const teamId of scope.team_ids||[])await admin.from("team_user_roles").update({status:"revoked",revoked_at:new Date().toISOString()}).eq("user_id",target).eq("role",role).eq("team_id",teamId);
        if(enabled)for(const teamId of teamIds)await admin.from("team_user_roles").upsert({team_id:teamId,user_id:target,role,status:"active",granted_by:user.id,granted_at:new Date().toISOString(),revoked_at:null},{onConflict:"team_id,user_id,role"});
        if(enabled)await admin.from("user_roles").upsert({user_id:target,role},{onConflict:"user_id,role"});
        return NextResponse.json({ok:true});
      }
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
    if (action === "setTeamAccess") {
      const target=String(body.userId||""),teamId=String(body.teamId||""),mode=String(body.mode||"remove");
      if(scope?.organization_admin===false&&!scope.team_ids?.includes(teamId))return NextResponse.json({error:"That team is outside your Team Admin scope."},{status:403});
      const {data:team}=await admin.from("teams").select("id").eq("id",teamId).eq("organization_id",organizationId).maybeSingle();
      if(!target||!team)return NextResponse.json({error:"Team access was not found."},{status:404});
      const teamIds=((await admin.from("teams").select("id").eq("organization_id",organizationId)).data||[]).map((x:any)=>x.id);
      const targetTeams=body.scope==="organization"?teamIds:body.scope==="allTeams"?teamIds:[teamId];
      if(mode==="suspend"){
        await admin.from("team_user_roles").update({status:"suspended",revoked_at:new Date().toISOString()}).eq("user_id",target).in("team_id",targetTeams);
      }else{
        await admin.from("team_user_roles").update({status:"revoked",revoked_at:new Date().toISOString()}).eq("user_id",target).in("team_id",targetTeams);
        await admin.from("team_members").delete().eq("user_id",target).in("team_id",targetTeams);
      }
      if(body.scope==="organization"){
        const {data:member}=await admin.from("organization_members").select("role").eq("organization_id",organizationId).eq("user_id",target).maybeSingle();
        if(member?.role==="admin"){const {count}=await admin.from("organization_members").select("*",{count:"exact",head:true}).eq("organization_id",organizationId).eq("role","admin").eq("status","active");if((count||0)<=1)return NextResponse.json({error:"You cannot remove or suspend the organization's last Admin."},{status:400});}
        await admin.from("organization_members").update({status:mode==="suspend"?"suspended":"revoked",suspended_at:new Date().toISOString(),suspended_by:user.id}).eq("organization_id",organizationId).eq("user_id",target);
      }
      return NextResponse.json({ok:true});
    }
    if (action === "update") {
      const name = String(body.name || "").trim(),
        branchName = String(body.branchName || "").trim() || null,
        city = String(body.city || "").trim(),
        state = String(body.state || "")
          .trim()
          .toUpperCase(),
        organizationType = ["travel_club","high_school"].includes(String(body.organizationType||"")) ? String(body.organizationType) : null;
      if (!name || !city || !state)
        return NextResponse.json(
          { error: "Organization, city and state are required." },
          { status: 400 },
        );
      const {data:before}=await admin.from("organizations").select("organization_type").eq("id",organizationId).single();
      const { error } = await admin
        .from("organizations")
        .update({ name, branch_name: branchName, city, state, organization_type: organizationType })
        .eq("id", organizationId);
      if (error) throw new Error(error.message);
      if(organizationType && before?.organization_type!==organizationType) await applySmartOrder(admin,organizationId,organizationType);
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
        ageGroupInput = String(body.ageGroup || "").trim(),
        ageGroup = ageGroupInput || (inferredAge(name) ? `${inferredAge(name)}U` : null);
      const {data:existingTeams}=await admin.from("teams").select("id,name,age_group,sort_order").eq("organization_id",organizationId).is("archived_at",null);
      const nextSort=(existingTeams||[]).reduce((m:any,t:any)=>Math.max(m,Number(t.sort_order||0)),0)+10;
      if (!name)
        return NextResponse.json(
          { error: "Team name is required." },
          { status: 400 },
        );
      const { error } = await admin
        .from("teams")
        .insert({ organization_id: organizationId, name, age_group: ageGroup, sort_order: nextSort });
      if (error)
        throw new Error(
          error.code === "23505"
            ? "That team already exists in this organization."
            : error.message,
        );
      const {data:o}=await admin.from("organizations").select("organization_type").eq("id",organizationId).single();
      if(o?.organization_type) await applySmartOrder(admin,organizationId,o.organization_type);
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
    if (action === "reorderTeams") {
      const teamIds=Array.isArray(body.teamIds)?body.teamIds.map(String):[];
      const {data:owned}=await admin.from("teams").select("id").eq("organization_id",organizationId).in("id",teamIds);
      if(!teamIds.length||(owned||[]).length!==teamIds.length)return NextResponse.json({error:"Team order is invalid."},{status:400});
      for(let i=0;i<teamIds.length;i++){const {error}=await admin.from("teams").update({sort_order:(i+1)*10}).eq("id",teamIds[i]).eq("organization_id",organizationId);if(error)throw new Error(error.message);}
      return NextResponse.json({ok:true});
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
