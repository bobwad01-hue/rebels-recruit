// Scoped, composable access grants. A role grant never changes a person's
// account type or creates Parent/Advisor-to-Athlete consent relationships.
export type ScopedRole = "admin" | "advisor" | "athlete" | "parent";
export type RoleGrant = {
  actorId: string;
  targetId: string;
  organizationId?: string;
  teamId?: string;
  role: ScopedRole;
  enabled: boolean;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requireId(id: string | undefined, label: string) {
  if (!id || !UUID.test(id)) throw new Error(`Invalid ${label}.`);
}
function checked(result: { error?: { message: string } | null }) {
  if (result.error) throw new Error(result.error.message);
}
async function ensureLegacyMember(admin: any, organizationId: string, userId: string, role: ScopedRole, actorId: string) {
  if (role === "parent") return;
  const current = await admin.from("organization_members").select("id,role,status")
    .eq("organization_id", organizationId).eq("user_id", userId).maybeSingle();
  checked(current);
  // The legacy membership holds only one role; canonical grants retain all roles.
  if (current.data?.status === "active" && (role !== "admin" || current.data.role === "owner")) return;
  if (current.data?.status === "active" && current.data.role !== "admin" && role === "admin"
      && ["advisor", "athlete"].includes(current.data.role)) {
    checked(await admin.from("organization_user_roles").upsert({
      organization_id: organizationId, user_id: userId, role: current.data.role,
      status: "active", granted_by: actorId, revoked_at: null,
    }, { onConflict: "organization_id,user_id,role" }));
  }
  const values = { role, status: "active", organization_view_access: role === "admin",
    suspended_at: null, suspended_by: null };
  if (current.data) checked(await admin.from("organization_members").update(values).eq("id", current.data.id));
  else checked(await admin.from("organization_members").insert({
    ...values, organization_id: organizationId, user_id: userId, joined_at: new Date().toISOString(),
  }));
}
async function reconcileLegacyMember(admin: any, organizationId: string, userId: string, removedRole: ScopedRole) {
  if (removedRole === "parent") return;
  const current = await admin.from("organization_members").select("id,role,status")
    .eq("organization_id", organizationId).eq("user_id", userId).maybeSingle();
  checked(current);
  if (!current.data || current.data.status !== "active" || current.data.role !== removedRole) return;
  const grants = await admin.from("organization_user_roles").select("role")
    .eq("organization_id", organizationId).eq("user_id", userId).eq("status", "active");
  checked(grants);
  const roles = new Set((grants.data || []).map((x: any) => x.role));
  let replacement = ["admin", "advisor", "athlete"].find(r => roles.has(r));
  if (!replacement) {
    const teams = await admin.from("teams").select("id").eq("organization_id", organizationId);
    checked(teams);
    const ids = (teams.data || []).map((x: any) => x.id);
    if (ids.length) {
      const scoped = await admin.from("team_user_roles").select("role")
        .eq("user_id", userId).eq("status", "active").in("team_id", ids);
      checked(scoped);
      const teamRoles = new Set((scoped.data || []).map((x: any) => x.role));
      if (teamRoles.has("athlete")) replacement = "athlete";
      else if (teamRoles.has("advisor")) replacement = "advisor";
      // Team Admin alone must NOT become an organization-wide Admin.
    }
  }
  if (replacement) {
    checked(await admin.from("organization_members").update({
      role: replacement, organization_view_access: replacement === "admin",
    }).eq("id", current.data.id));
  } else {
    checked(await admin.from("organization_members").update({
      status: "revoked", organization_view_access: false, suspended_at: new Date().toISOString(),
    }).eq("id", current.data.id));
  }
}
async function syncGlobalRole(admin: any, userId: string, role: ScopedRole) {
  const [profile, orgRoles, teamRoles] = await Promise.all([
    admin.from("profiles").select("app_role").eq("id", userId).single(),
    admin.from("organization_user_roles").select("role").eq("user_id", userId).eq("role", role).eq("status", "active").limit(1),
    admin.from("team_user_roles").select("role").eq("user_id", userId).eq("role", role).eq("status", "active").limit(1),
  ]);
  checked(profile); checked(orgRoles); checked(teamRoles);
  let keep = profile.data?.app_role === role || !!orgRoles.data?.length || !!teamRoles.data?.length;
  if (role === "athlete" && !keep) {
    const athlete = await admin.from("athlete_profiles").select("user_id").eq("user_id", userId).maybeSingle();
    checked(athlete); keep = !!athlete.data;
  }
  if (role === "parent" && !keep) {
    const parent = await admin.from("parent_guardian_access").select("id")
      .eq("parent_user_id", userId).eq("status", "active").limit(1);
    checked(parent); keep = !!parent.data?.length;
  }
  if (keep) checked(await admin.from("user_roles").upsert({ user_id: userId, role }, { onConflict: "user_id,role" }));
  else checked(await admin.from("user_roles").delete().eq("user_id", userId).eq("role", role));
}

export async function setScopedRole(admin: any, grant: RoleGrant) {
  const { actorId, targetId, role, enabled } = grant;
  requireId(actorId, "actor"); requireId(targetId, "account");
  if (!["admin", "advisor", "athlete", "parent"].includes(role) || typeof enabled !== "boolean")
    throw new Error("Choose a valid role and access setting.");
  if (Boolean(grant.organizationId) === Boolean(grant.teamId))
    throw new Error("Choose either an organization or a team.");
  const profile = await admin.from("profiles").select("id").eq("id", targetId).maybeSingle();
  checked(profile);
  if (!profile.data) throw new Error("Account not found. The person must have an RLTNL account first.");

  let organizationId = grant.organizationId || "";
  if (grant.teamId) {
    requireId(grant.teamId, "team");
    const team = await admin.from("teams").select("id,organization_id,archived_at")
      .eq("id", grant.teamId).maybeSingle();
    checked(team);
    if (!team.data || team.data.archived_at) throw new Error("Active team not found.");
    organizationId = team.data.organization_id;
  } else {
    requireId(organizationId, "organization");
    const org = await admin.from("organizations").select("id").eq("id", organizationId).maybeSingle();
    checked(org);
    if (!org.data) throw new Error("Organization not found.");
  }

  const table = grant.teamId ? "team_user_roles" : "organization_user_roles";
  const scopeKey = grant.teamId ? "team_id" : "organization_id";
  const scopeId = grant.teamId || organizationId;
  const existing = await admin.from(table).select("status")
    .eq(scopeKey, scopeId).eq("user_id", targetId).eq("role", role).maybeSingle();
  checked(existing);
  if (grant.organizationId && role === "admin" && !enabled) {
    const members = await admin.from("organization_members").select("user_id")
      .eq("organization_id", organizationId).eq("role", "admin").eq("status", "active");
    checked(members);
    const canonical = await admin.from("organization_user_roles").select("user_id")
      .eq("organization_id", organizationId).eq("role", "admin").eq("status", "active");
    checked(canonical);
    const admins = new Set([...(members.data || []), ...(canonical.data || [])].map((x: any) => x.user_id));
    if (admins.has(targetId) && admins.size <= 1) throw new Error("An organization must retain at least one active Organization Admin.");
  }
  const now = new Date().toISOString();
  if (enabled) {
    if (role === "athlete") {
      checked(await admin.from("athlete_profiles").upsert({ user_id: targetId }, { onConflict: "user_id", ignoreDuplicates: true }));
    }
    checked(await admin.from(table).upsert({
      [scopeKey]: scopeId, user_id: targetId, role, status: "active",
      granted_by: actorId, granted_at: now, revoked_at: null,
    }, { onConflict: `${scopeKey},user_id,role` }));
    if (grant.teamId && role === "athlete") {
      checked(await admin.from("team_members").upsert({ team_id: grant.teamId, user_id: targetId }, { onConflict: "team_id,user_id" }));
      const athlete = await admin.from("athlete_profiles").select("primary_team_id").eq("user_id", targetId).maybeSingle();
      checked(athlete);
      if (!athlete.data?.primary_team_id) checked(await admin.from("athlete_profiles").update({
        primary_team_id: grant.teamId, primary_organization_id: organizationId,
      }).eq("user_id", targetId));
    }
    if (!grant.teamId && role !== "parent") await ensureLegacyMember(admin, organizationId, targetId, role, actorId);
    if (grant.teamId && ["advisor", "athlete"].includes(role))
      await ensureLegacyMember(admin, organizationId, targetId, role, actorId);
    checked(await admin.from("user_roles").upsert({ user_id: targetId, role }, { onConflict: "user_id,role" }));
    checked(await admin.from("profiles").update({ registration_status: "active" }).eq("id", targetId));
  } else {
    checked(await admin.from(table).update({ status: "revoked", revoked_at: now })
      .eq(scopeKey, scopeId).eq("user_id", targetId).eq("role", role));
    if (grant.teamId && role === "athlete") {
      checked(await admin.from("team_members").delete().eq("team_id", grant.teamId).eq("user_id", targetId));
      const athlete = await admin.from("athlete_profiles").select("primary_team_id").eq("user_id", targetId).maybeSingle();
      checked(athlete);
      if (athlete.data?.primary_team_id === grant.teamId) checked(await admin.from("athlete_profiles").update({
        primary_team_id: null, primary_organization_id: null,
      }).eq("user_id", targetId));
    }
    if (!grant.teamId || role === "athlete" || role === "advisor") await reconcileLegacyMember(admin, organizationId, targetId, role);
    // Scoped grants are independent of Parent/Advisor-to-Athlete consent links.
    await syncGlobalRole(admin, targetId, role);
  }
  const audit = await admin.from("audit_log").insert({
    organization_id: organizationId, actor_user_id: actorId,
    action: "scoped_role_assignment_updated", entity_type: "profile", entity_id: targetId,
    metadata: { scope: grant.teamId ? "team" : "organization", teamId: grant.teamId || null, role, enabled },
  });
  if (audit.error) console.error("Role assignment audit failed:", audit.error.message);
}
