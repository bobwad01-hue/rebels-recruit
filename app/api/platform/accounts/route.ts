import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const jsonError = (message: string, status = 400) => NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });

async function ownerContext() {
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return null;
  const admin = createAdminClient();
  const { data: owner, error: roleError } = await admin.from("platform_roles")
    .select("user_id").eq("user_id", user.id).eq("role", "super_owner").maybeSingle();
  if (roleError || !owner) return null;
  return { admin, actorId: user.id };
}

// Page in a stable order. The Supabase REST API otherwise limits individual queries to 1,000 rows.
async function allRows(makeQuery: () => any) {
  const results: any[] = [];
  const pageSize = 500;
  for (let offset = 0; offset < 50000; offset += pageSize) {
    const { data, error } = await makeQuery().range(offset, offset + pageSize - 1);
    if (error) throw new Error(error.message);
    results.push(...(data || []));
    if (!data || data.length < pageSize) return results;
  }
  throw new Error("Account directory is larger than the current retrieval limit.");
}

type OrganizationAccess = {
  id: string; name: string; roles: string[]; grants: string[]; status: string;
};
type TeamAccess = {
  id: string; name: string; organization_id: string; organization_name: string;
  roles: string[]; archived: boolean;
};

export async function GET(req: NextRequest) {
  const ctx = await ownerContext();
  if (!ctx) return jsonError("Super Owner access required.", 403);
  const { admin, actorId } = ctx;
  const historyFor = req.nextUrl.searchParams.get("historyFor");
  if (historyFor !== null) {
    if (!uuid.test(historyFor)) return jsonError("Invalid account ID.");
    const { data, error } = await admin.from("audit_log")
      .select("id,action,metadata,created_at,actor_user_id")
      .eq("entity_type", "profile").eq("entity_id", historyFor)
      .order("created_at", { ascending: false }).limit(25);
    if (error) return jsonError("Unable to load account access history.", 500);
    const { data: authRecord } = await admin.auth.admin.getUserById(historyFor);
    return NextResponse.json({
      history: data || [],
      authDetails: authRecord?.user ? {
        last_sign_in_at: authRecord.user.last_sign_in_at || null,
        email_confirmed_at: authRecord.user.email_confirmed_at || null,
        providers: authRecord.user.app_metadata?.providers || [],
      } : null,
    }, { headers: { "Cache-Control": "private, no-store" } });
  }
  try {
    const [
      profiles, organizations, teams, orgMembers, orgRoles, teamRoles,
      teamMembers, platformRoles, globalRoles, pendingRequests, parentLinks,
    ] = await Promise.all([
      allRows(() => admin.from("profiles").select("id,full_name,email,app_role,created_at,profile_completed_at,advisor_account_type,commercial_status,account_status,suspended_at,suspension_reason").order("id")),
      allRows(() => admin.from("organizations").select("id,name,branch_name").order("id")),
      allRows(() => admin.from("teams").select("id,name,organization_id,archived_at").order("id")),
      allRows(() => admin.from("organization_members").select("id,user_id,organization_id,role,status").order("id")),
      allRows(() => admin.from("organization_user_roles").select("organization_id,user_id,role,status").eq("status", "active").order("organization_id").order("user_id").order("role")),
      allRows(() => admin.from("team_user_roles").select("team_id,user_id,role,status").eq("status", "active").order("team_id").order("user_id").order("role")),
      allRows(() => admin.from("team_members").select("team_id,user_id").order("team_id").order("user_id")),
      allRows(() => admin.from("platform_roles").select("user_id,role").order("user_id").order("role")),
      allRows(() => admin.from("user_roles").select("user_id,role").order("user_id").order("role")),
      allRows(() => admin.from("access_requests").select("id,user_id,role,status,organization_id,team_ids,requested_at").eq("status", "pending").order("id")),
      allRows(() => admin.from("parent_guardian_access").select("parent_user_id,athlete_user_id,status").eq("status", "active").order("parent_user_id").order("athlete_user_id")),
    ]);

    const orgById = new Map(organizations.map((o: any) => [o.id, o]));
    const teamById = new Map(teams.map((t: any) => [t.id, t]));
    const accountById = new Map<string, any>();
    const organizationMaps = new Map<string, Map<string, OrganizationAccess>>();
    const teamMaps = new Map<string, Map<string, TeamAccess>>();
    const addRole = (roles: string[], role: string) => { if (role && !roles.includes(role)) roles.push(role); };

    for (const p of profiles) {
      accountById.set(p.id, {
        ...p, organizations: [] as OrganizationAccess[], teams: [] as TeamAccess[],
        platform_roles: [] as string[], global_roles: [] as string[],
        pending_requests: [] as any[], linked_athletes: [] as any[],
      });
      organizationMaps.set(p.id, new Map());
      teamMaps.set(p.id, new Map());
    }
    function organizationFor(userId: string, organizationId: string): OrganizationAccess | null {
      const map = organizationMaps.get(userId);
      const org: any = orgById.get(organizationId);
      if (!map || !org) return null;
      if (!map.has(organizationId)) {
        map.set(organizationId, {
          id: org.id, name: org.name + (org.branch_name ? " · " + org.branch_name : ""),
          roles: [], grants: [], status: "active",
        });
      }
      return map.get(organizationId)!;
    }
    function teamFor(userId: string, teamId: string): TeamAccess | null {
      const map = teamMaps.get(userId);
      const team: any = teamById.get(teamId);
      if (!map || !team) return null;
      const org = organizationFor(userId, team.organization_id);
      if (!org) return null;
      if (!map.has(teamId)) {
        map.set(teamId, {
          id: team.id, name: team.name, organization_id: team.organization_id,
          organization_name: org.name, roles: [], archived: Boolean(team.archived_at),
        });
      }
      return map.get(teamId)!;
    }
    for (const m of orgMembers) {
      if (m.status !== "active") continue;
      const org = organizationFor(m.user_id, m.organization_id);
      if (org) addRole(org.roles, String(m.role));
    }
    for (const r of orgRoles) {
      const org = organizationFor(r.user_id, r.organization_id);
      if (org) { addRole(org.roles, r.role); addRole(org.grants, r.role); }
    }
    for (const r of teamRoles) {
      const team = teamFor(r.user_id, r.team_id);
      if (team) addRole(team.roles, r.role);
    }
    for (const r of teamMembers) {
      const team = teamFor(r.user_id, r.team_id);
      if (team) addRole(team.roles, "athlete");
    }
    for (const r of platformRoles) {
      const account = accountById.get(r.user_id);
      if (account) addRole(account.platform_roles, r.role);
    }
    for (const r of globalRoles) {
      const account = accountById.get(r.user_id);
      if (account) addRole(account.global_roles, r.role);
    }
    for (const r of pendingRequests) {
      const account = accountById.get(r.user_id);
      if (account) account.pending_requests.push(r);
    }
    for (const link of parentLinks) {
      const parent = accountById.get(link.parent_user_id);
      const athlete = accountById.get(link.athlete_user_id);
      if (parent && athlete) parent.linked_athletes.push({ id: athlete.id, name: athlete.full_name || athlete.email || "Athlete" });
    }
    for (const [userId, account] of accountById) {
      account.organizations = [...(organizationMaps.get(userId)?.values() || [])].sort((a, b) => a.name.localeCompare(b.name));
      account.teams = [...(teamMaps.get(userId)?.values() || [])].sort((a, b) => a.name.localeCompare(b.name));
      account.pending_requests.sort((a: any, b: any) => b.requested_at.localeCompare(a.requested_at));
    }
    return NextResponse.json({
      viewerId: actorId,
      accounts: [...accountById.values()],
      organizations: organizations.map((o: any) => ({ id: o.id, name: o.name + (o.branch_name ? " · " + o.branch_name : "") })),
      teams: teams.map((t: any) => ({ id: t.id, name: t.name, organization_id: t.organization_id, archived: Boolean(t.archived_at) })),
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Platform account directory failed:", error);
    return jsonError("Unable to load the account directory.", 500);
  }
}

export async function POST(req: NextRequest) {
  const ctx = await ownerContext();
  if (!ctx) return jsonError("Super Owner access required.", 403);
  const { admin, actorId } = ctx;
  try {
    const body = await req.json();
    const action = String(body?.action || "");
    const targetId = String(body?.userId || "");
    if (!uuid.test(targetId)) return jsonError("Select a valid account.");
    const { data: target, error: profileError } = await admin.from("profiles")
      .select("id,app_role").eq("id", targetId).maybeSingle();
    if (profileError) throw profileError;
    if (!target) return jsonError("Account not found.", 404);
    if (!["advisor", "admin"].includes(target.app_role)) {
      return jsonError("Staff permissions can only be assigned to Advisor or Admin accounts. Athlete and Parent access is managed through their dedicated workflows.", 409);
    }
    const now = new Date().toISOString();
    async function logChange(organizationId: string, metadata: Record<string, unknown>) {
      const { error } = await admin.from("audit_log").insert({
        organization_id: organizationId, actor_user_id: actorId,
        action: "platform_account_access_updated", entity_type: "profile",
        entity_id: targetId, metadata,
      });
      if (error) console.error("Account access audit failed:", error.message);
    }
    async function membership(organizationId: string) {
      const { data, error } = await admin.from("organization_members")
        .select("id,role,status").eq("organization_id", organizationId).eq("user_id", targetId).maybeSingle();
      if (error) throw error;
      if (data && !["admin", "advisor"].includes(data.role)) {
        throw new Error("This account has a non-staff organization membership. Review it before changing staff permissions.");
      }
      return data;
    }
    async function setMembership(organizationId: string, existing: any, role: "admin" | "advisor" | null) {
      if (role) {
        const values = { role, status: "active", organization_view_access: role === "admin", suspended_at: null, suspended_by: null };
        if (existing) {
          const { error } = await admin.from("organization_members").update(values).eq("id", existing.id);
          if (error) throw error;
        } else {
          const { error } = await admin.from("organization_members").insert({
            ...values, organization_id: organizationId, user_id: targetId, joined_at: now,
          });
          if (error) throw error;
        }
      } else if (existing && existing.status === "active") {
        const { error } = await admin.from("organization_members").update({
          status: "revoked", organization_view_access: false, suspended_at: now, suspended_by: actorId,
        }).eq("id", existing.id);
        if (error) throw error;
      }
    }
    if (action === "setOrganizationStaffRoles") {
      const orgId = String(body.organizationId || "");
      if (!uuid.test(orgId) || typeof body.advisor !== "boolean" || typeof body.admin !== "boolean") return jsonError("Select an organization and staff roles.");
      const { data: org, error: orgError } = await admin.from("organizations").select("id").eq("id", orgId).maybeSingle();
      if (orgError) throw orgError;
      if (!org) return jsonError("Organization not found.", 404);
      const existing = await membership(orgId);
      const { data: previousRoles, error: previousError } = await admin.from("organization_user_roles")
        .select("role,status").eq("organization_id", orgId).eq("user_id", targetId).in("role", ["admin", "advisor"]);
      if (previousError) throw previousError;
      const wasAdmin = existing?.status === "active" && existing.role === "admin";
      if (wasAdmin && !body.admin) {
        const { count, error: countError } = await admin.from("organization_members")
          .select("id", { count: "exact", head: true }).eq("organization_id", orgId).eq("role", "admin").eq("status", "active");
        if (countError) throw countError;
        if ((count || 0) <= 1) return jsonError("An organization must retain at least one active Admin.", 409);
      }
      // Preserve team-scoped staff access when organization-wide staff roles are removed.
      const { data: orgTeams, error: teamError } = await admin.from("teams").select("id").eq("organization_id", orgId);
      if (teamError) throw teamError;
      const ids = (orgTeams || []).map((t: any) => t.id);
      let hasTeamStaff = false;
      if (ids.length) {
        const { data, error } = await admin.from("team_user_roles").select("team_id")
          .eq("user_id", targetId).eq("status", "active").in("role", ["advisor", "admin"]).in("team_id", ids).limit(1);
        if (error) throw error;
        hasTeamStaff = Boolean(data?.length);
      }
      const desiredMembershipRole = body.admin ? "admin" : (body.advisor || hasTeamStaff ? "advisor" : null);
      // Activate the membership before granting scoped roles.
      if (desiredMembershipRole) await setMembership(orgId, existing, desiredMembershipRole);
      for (const role of ["advisor", "admin"] as const) {
        if (body[role]) {
          const { error } = await admin.from("organization_user_roles").upsert({
            organization_id: orgId, user_id: targetId, role, status: "active",
            granted_by: actorId, granted_at: now, revoked_at: null,
          }, { onConflict: "organization_id,user_id,role" });
          if (error) throw error;
          const { error: globalError } = await admin.from("user_roles")
            .upsert({ user_id: targetId, role }, { onConflict: "user_id,role" });
          if (globalError) throw globalError;
        } else {
          const { error } = await admin.from("organization_user_roles")
            .update({ status: "revoked", revoked_at: now })
            .eq("organization_id", orgId).eq("user_id", targetId).eq("role", role);
          if (error) throw error;
        }
      }
      if (!desiredMembershipRole) await setMembership(orgId, existing, null);
      await logChange(orgId, {
        scope: "organization", previousRoles: previousRoles || [],
        advisor: body.advisor, admin: body.admin,
      });
      return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
    }
    if (action === "setTeamStaffRole") {
      const teamId = String(body.teamId || "");
      const role = String(body.role || "");
      const enabled = body.enabled;
      if (!uuid.test(teamId) || !["advisor", "admin"].includes(role) || typeof enabled !== "boolean") {
        return jsonError("Choose a team, role and access setting.");
      }
      const { data: team, error: teamError } = await admin.from("teams")
        .select("id,organization_id,archived_at").eq("id", teamId).maybeSingle();
      if (teamError) throw teamError;
      if (!team || team.archived_at) return jsonError("Active team not found.", 404);
      const existing = await membership(team.organization_id);
      const { data: previous, error: previousError } = await admin.from("team_user_roles")
        .select("role,status").eq("team_id", teamId).eq("user_id", targetId).eq("role", role).maybeSingle();
      if (previousError) throw previousError;
      if (enabled) {
        if (!existing || existing.status !== "active") await setMembership(team.organization_id, existing, "advisor");
        const { error } = await admin.from("team_user_roles").upsert({
          team_id: teamId, user_id: targetId, role, status: "active",
          granted_by: actorId, granted_at: now, revoked_at: null,
        }, { onConflict: "team_id,user_id,role" });
        if (error) throw error;
        const { error: globalError } = await admin.from("user_roles")
          .upsert({ user_id: targetId, role }, { onConflict: "user_id,role" });
        if (globalError) throw globalError;
      } else {
        const { error } = await admin.from("team_user_roles").update({ status: "revoked", revoked_at: now })
          .eq("team_id", teamId).eq("user_id", targetId).eq("role", role);
        if (error) throw error;
        // Retain membership if any other staff access still exists in the organization.
        if (existing?.status === "active" && existing.role === "advisor") {
          const { data: orgRoles, error: orgRoleError } = await admin.from("organization_user_roles")
            .select("role").eq("organization_id", team.organization_id).eq("user_id", targetId)
            .eq("status", "active").in("role", ["advisor", "admin"]).limit(1);
          if (orgRoleError) throw orgRoleError;
          const { data: orgTeams, error: teamsError } = await admin.from("teams")
            .select("id").eq("organization_id", team.organization_id);
          if (teamsError) throw teamsError;
          const ids = (orgTeams || []).map((t: any) => t.id);
          const { data: otherTeamRoles, error: otherError } = ids.length
            ? await admin.from("team_user_roles").select("team_id").eq("user_id", targetId)
              .eq("status", "active").in("role", ["advisor", "admin"]).in("team_id", ids).limit(1)
            : { data: [], error: null };
          if (otherError) throw otherError;
          if (!orgRoles?.length && !otherTeamRoles?.length) await setMembership(team.organization_id, existing, null);
        }
      }
      await logChange(team.organization_id, {
        scope: "team", teamId, role, enabled, previous: previous || null,
      });
      return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
    }
    return jsonError("Unsupported account action.");
  } catch (error) {
    console.error("Platform account access update failed:", error);
    return jsonError(error instanceof Error ? error.message : "Unable to update account access.", 500);
  }
}
