import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { requestParentConnection, setParentConnectionStatus } from "@/lib/parent-access";

const roles = ["athlete", "parent", "advisor", "team_admin", "org_admin"] as const;
type Role = (typeof roles)[number];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fail = (message: string, status = 400) => NextResponse.json({ error: message }, { status });
const unique = (values: string[]) => [...new Set(values)];

async function session() {
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  return user;
}
async function permissions(admin: any, userId: string, orgId: string) {
  const [{ data: owner }, { data: orgAdmin }, { data: teams }] = await Promise.all([
    admin.from("platform_roles").select("role").eq("user_id", userId).eq("role", "super_owner").maybeSingle(),
    admin.from("organization_members").select("id").eq("user_id", userId).eq("organization_id", orgId).eq("role", "admin").eq("status", "active").maybeSingle(),
    admin.from("teams").select("id").eq("organization_id", orgId).is("archived_at", null),
  ]);
  const ids = (teams || []).map((t: any) => t.id);
  const { data: teamAdmins } = ids.length
    ? await admin.from("team_user_roles").select("team_id").eq("user_id", userId).eq("role", "admin").eq("status", "active").in("team_id", ids)
    : { data: [] };
  return { organizationAdmin: !!owner || !!orgAdmin, teamIds: (teamAdmins || []).map((t: any) => t.team_id) as string[] };
}
async function notify(admin: any, ids: string[], title: string, body: string, url: string) {
  if (!ids.length) return;
  const recipients = unique(ids);
  const { error } = await admin.from("notifications").insert(recipients.map(user_id => ({
    user_id, title, body, url, kind: "access_request", scheduled_for: new Date().toISOString(),
  })));
  if (error) console.error("Access request notification failed:", error.message);
}
async function reviewers(admin: any, organizationId: string, teamIds: string[], role: Role) {
  const { data: admins } = await admin.from("organization_members").select("user_id").eq("organization_id", organizationId).eq("role", "admin").eq("status", "active");
  const ids = (admins || []).map((m: any) => m.user_id);
  if (role !== "team_admin" && role !== "org_admin" && teamIds.length) {
    const { data: teamAdmins } = await admin.from("team_user_roles").select("user_id").eq("role", "admin").eq("status", "active").in("team_id", teamIds);
    ids.push(...(teamAdmins || []).map((m: any) => m.user_id));
  }
  if (role === "org_admin" || ids.length === 0) {
    const { data: owners } = await admin.from("platform_roles").select("user_id").eq("role", "super_owner");
    ids.push(...(owners || []).map((m: any) => m.user_id));
  }
  return unique(ids);
}
async function label(admin: any, userId: string) {
  const { data } = await admin.from("profiles").select("full_name,email").eq("id", userId).maybeSingle();
  return data?.full_name || data?.email || "An RLTNL member";
}
async function ensureOrgMembership(admin: any, orgId: string, userId: string, role: "athlete" | "advisor") {
  const { data: existing, error: lookupError } = await admin.from("organization_members").select("id,role,status").eq("organization_id", orgId).eq("user_id", userId).maybeSingle();
  if (lookupError) throw lookupError;
  if (!existing) {
    const { error } = await admin.from("organization_members").insert({ organization_id: orgId, user_id: userId, role, status: "active", organization_view_access: false, joined_at: new Date().toISOString() });
    if (error) throw error;
  } else if (existing.role === role && existing.status !== "active") {
    const { error } = await admin.from("organization_members").update({ status: "active", joined_at: new Date().toISOString() }).eq("id", existing.id);
    if (error) throw error;
  }
}
async function grant(admin: any, request: any, reviewerId: string) {
  const { user_id, organization_id, team_ids, athlete_user_id, role } = request;
  if (role === "parent") {
    const { data: existing } = await admin.from("parent_guardian_access").select("id").eq("athlete_user_id", athlete_user_id).eq("parent_user_id", user_id).maybeSingle();
    if (existing) {
      const { error } = await admin.from("parent_guardian_access").update({ status: "active", updated_at: new Date().toISOString() }).eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await admin.from("parent_guardian_access").insert({ athlete_user_id, parent_user_id: user_id, status: "active" });
      if (error) throw error;
    }
    return;
  }
  const orgRole = role === "athlete" ? "athlete" : "advisor";
  if (role === "athlete" || role === "advisor") await ensureOrgMembership(admin, organization_id, user_id, orgRole);
  if (["advisor","team_admin","org_admin"].includes(role)) {
    const { error } = await admin.from("profiles").update({ advisor_account_type: "organization", commercial_status: "not_required" }).eq("id", user_id);
    if (error) throw error;
  }
  if (role === "org_admin") {
    const { data: existing } = await admin.from("organization_members").select("id").eq("organization_id", organization_id).eq("user_id", user_id).maybeSingle();
    if (existing) {
      const { error } = await admin.from("organization_members").update({ role: "admin", status: "active", organization_view_access: true }).eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await admin.from("organization_members").insert({ organization_id, user_id, role: "admin", status: "active", organization_view_access: true, joined_at: new Date().toISOString() });
      if (error) throw error;
    }
  }
  const accessRole = role === "team_admin" || role === "org_admin" ? "admin" : role;
  if (role === "org_admin") {
    const { error } = await admin.from("organization_user_roles").upsert({ organization_id, user_id, role: "admin", status: "active", granted_by: reviewerId, revoked_at: null }, { onConflict: "organization_id,user_id,role" });
    if (error) throw error;
  } else if (role !== "athlete") {
    for (const teamId of team_ids) {
      const { error } = await admin.from("team_user_roles").upsert({ team_id: teamId, user_id, role: accessRole, status: "active", granted_by: reviewerId, revoked_at: null }, { onConflict: "team_id,user_id,role" });
      if (error) throw error;
    }
  } else {
    for (const teamId of team_ids) {
      const { error } = await admin.from("team_members").upsert({ team_id: teamId, user_id }, { onConflict: "team_id,user_id" });
      if (error) throw error;
      // Keep the legacy team role table in sync for existing team-based views.
      const { error: roleError } = await admin.from("team_user_roles").upsert({
        team_id: teamId, user_id, role: "athlete", status: "active",
        granted_by: reviewerId, revoked_at: null,
      }, { onConflict: "team_id,user_id,role" });
      if (roleError) throw roleError;
    }
  }
  if (role === "athlete" && team_ids.length) {
    const { data: athlete } = await admin.from("athlete_profiles").select("primary_team_id").eq("user_id", user_id).maybeSingle();
    if (!athlete?.primary_team_id) {
      const { error } = await admin.from("athlete_profiles").update({ primary_organization_id: organization_id, primary_team_id: team_ids[0] }).eq("user_id", user_id);
      if (error) throw error;
    }
  }
  const { error: roleError } = await admin.from("user_roles").upsert({ user_id, role: accessRole }, { onConflict: "user_id,role" });
  if (roleError) throw roleError;
}
export async function GET(req: NextRequest) {
  const user = await session();
  if (!user) return fail("Sign in to manage access.", 401);
  const admin = createAdminClient();
  const view = req.nextUrl.searchParams.get("view") || "mine";
  try {
    if (view === "mine") {
      const [
        { data: organizations, error: orgError },
        { data: accessRequests, error: requestError },
        { data: parentConnections, error: parentError },
      ] = await Promise.all([
        admin.from("organizations").select("id,name,branch_name,city,state,teams(id,name,age_group,archived_at)").order("name"),
        admin.from("access_requests").select("id,organization_id,team_ids,athlete_user_id,role,status,requested_at,reviewed_at").eq("user_id", user.id).order("requested_at", { ascending: false }).limit(50),
        admin.from("parent_guardian_access").select("id,athlete_user_id,status,created_at,updated_at").eq("parent_user_id", user.id),
      ]);
      if (orgError || requestError || parentError) throw orgError || requestError || parentError;
      // Parent requests live in parent_guardian_access, not access_requests.
      // This is the same record the athlete uses to approve and set permissions.
      const parentRequests = (parentConnections || []).map((p: any) => ({
        id: p.id,
        organization_id: null,
        team_ids: [],
        athlete_user_id: p.athlete_user_id,
        role: "parent",
        status: p.status === "active" ? "approved" : p.status,
        requested_at: p.updated_at || p.created_at,
        reviewed_at: null,
      }));
      const requests = [
        ...(accessRequests || []).filter((r: any) => r.role !== "parent"),
        ...parentRequests,
      ].sort((a: any, b: any) => String(b.requested_at).localeCompare(String(a.requested_at))).slice(0, 50);
      const athleteIds = unique(requests.map((r: any) => r.athlete_user_id).filter(Boolean));
      const { data: athletes } = athleteIds.length ? await admin.from("profiles").select("id,full_name").in("id", athleteIds) : { data: [] };
      const athleteNames = new Map((athletes || []).map((p: any) => [p.id, p.full_name]));
      return NextResponse.json({
        organizations: (organizations || []).map((o: any) => ({ ...o, teams: (o.teams || []).filter((t: any) => !t.archived_at) })),
        requests: requests.map((r: any) => ({ ...r, athlete_name: athleteNames.get(r.athlete_user_id) || null })),
      });
    }
    if (view === "review") {
      const orgId = req.nextUrl.searchParams.get("organizationId") || "";
      if (!uuid.test(orgId)) return fail("Select an organization.");
      const scope = await permissions(admin, user.id, orgId);
      if (!scope.organizationAdmin && !scope.teamIds.length) return fail("Admin access required.", 403);
      const { data, error } = await admin.from("access_requests").select("id,user_id,organization_id,team_ids,role,status,requested_at").eq("organization_id", orgId).eq("status", "pending").order("requested_at");
      if (error) throw error;
      const requests = (data || []).filter((r: any) => scope.organizationAdmin || (["athlete","advisor"].includes(r.role) && r.team_ids.length && r.team_ids.every((id: string) => scope.teamIds.includes(id))));
      const userIds = unique(requests.map((r: any) => r.user_id));
      const { data: profiles } = userIds.length ? await admin.from("profiles").select("id,full_name,email").in("id", userIds) : { data: [] };
      const byId = new Map((profiles || []).map((p: any) => [p.id, p]));
      return NextResponse.json({ requests: requests.map((r: any) => ({ ...r, profile: byId.get(r.user_id) || null })), organizationAdmin: scope.organizationAdmin });
    }
    if (view === "athlete") {
      const { data, error } = await admin.from("parent_guardian_access")
        .select("id,parent_user_id,status,created_at")
        .eq("athlete_user_id", user.id).eq("status", "pending").order("created_at");
      if (error) throw error;
      const ids = unique((data || []).map((r: any) => r.parent_user_id));
      const { data: profiles } = ids.length ? await admin.from("profiles").select("id,full_name,email").in("id", ids) : { data: [] };
      const byId = new Map((profiles || []).map((p: any) => [p.id, p]));
      return NextResponse.json({
        requests: (data || []).map((r: any) => ({
          id: r.id, user_id: r.parent_user_id, role: "parent", status: r.status,
          requested_at: r.created_at, profile: byId.get(r.parent_user_id) || null,
        })),
      });
    }
    return fail("Unknown view.");
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to load access requests.", 500);
  }
}
export async function POST(req: NextRequest) {
  const user = await session();
  if (!user) return fail("Sign in to manage access.", 401);
  const admin = createAdminClient();
  try {
    const body = await req.json();
    const action = String(body?.action || "submit");
    if (action === "submit") {
      const role = String(body.role || "") as Role;
      if (!roles.includes(role)) return fail("Choose an account role.");
      const { data: profile } = await admin.from("profiles").select("app_role").eq("id", user.id).maybeSingle();
      if ((role === "athlete" && profile?.app_role !== "athlete") ||
          (role === "parent" && profile?.app_role !== "parent") ||
          (["advisor","team_admin","org_admin"].includes(role) && profile?.app_role !== "advisor")) {
        return fail("The requested access does not match your account type.");
      }
      let orgId: string | null = null;
      let teamIds: string[] = [];
      if (role === "parent") {
        const athleteEmail = String(body.athleteEmail || "").trim().toLowerCase();
        if (!athleteEmail || athleteEmail.length > 254 || !athleteEmail.includes("@")) return fail("Enter your athlete's account email.");
        const { data: athlete } = await admin.from("profiles").select("id").ilike("email", athleteEmail).eq("app_role", "athlete").maybeSingle();
        if (!athlete || athlete.id === user.id) return fail("We couldn't send this request. Confirm the athlete's RLTNL account email.");
        const result = await requestParentConnection(admin, user.id, athlete.id);
        if (result.status === "active") return fail("You already have access to this athlete.");
        return NextResponse.json({ ok: true, pending: true, alreadyPending: !result.changed });
      } else {
        orgId = String(body.organizationId || "");
        if (!uuid.test(orgId)) return fail("Select an organization.");
        const { data: org } = await admin.from("organizations").select("id,name").eq("id", orgId).maybeSingle();
        if (!org) return fail("Organization not found.", 404);
        teamIds = unique((Array.isArray(body.teamIds) ? body.teamIds : []).map(String));
        if (teamIds.length > 20 || teamIds.some(id => !uuid.test(id))) return fail("Choose valid teams.");
        if (role !== "org_admin" && !teamIds.length) return fail("Select at least one team.");
        if (role === "org_admin" && teamIds.length) return fail("Organization Admin access is organization-wide.");
        if (teamIds.length) {
          const { data: teams, error } = await admin.from("teams").select("id").eq("organization_id", orgId).is("archived_at", null).in("id", teamIds);
          if (error || (teams || []).length !== teamIds.length) return fail("One or more teams are not part of that organization.");
        }
        if (role === "athlete") {
          const { data: current } = await admin.from("team_members").select("team_id").eq("user_id", user.id).in("team_id", teamIds);
          if ((current || []).length === teamIds.length) return fail("You already belong to the selected team(s).");
        }
      }
      let existingQuery = admin.from("access_requests").select("id").eq("user_id", user.id).eq("role", role).eq("status", "pending");
      existingQuery = existingQuery.eq("organization_id", orgId!);
      const { data: existing } = await existingQuery.maybeSingle();
      if (existing) {
        const { error } = await admin.from("access_requests").update({ team_ids: teamIds, requested_at: new Date().toISOString() }).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await admin.from("access_requests").insert({ user_id: user.id, organization_id: orgId, athlete_user_id: null, team_ids: teamIds, role });
        if (error) throw error;
      }
      const name = await label(admin, user.id);
      const recipients = await reviewers(admin, orgId!, teamIds, role);
      await notify(admin, recipients.filter(id => id !== user.id), "New access request", `${name} requested ${role.replaceAll("_", " ")} access.`, "/organization/setup");
      return NextResponse.json({ ok: true, pending: true });
    }
    if (action === "cancel") {
      const requestId = String(body.requestId || "");
      if (!uuid.test(requestId)) return fail("Invalid request.");
      const { data: parentRequest, error: parentLookupError } = await admin.from("parent_guardian_access")
        .select("id").eq("id", requestId).eq("parent_user_id", user.id).eq("status", "pending").maybeSingle();
      if (parentLookupError) throw parentLookupError;
      if (parentRequest) {
        const { data, error } = await admin.from("parent_guardian_access")
          .update({ status: "revoked", updated_at: new Date().toISOString() })
          .eq("id", requestId).eq("parent_user_id", user.id).eq("status", "pending").select("id").maybeSingle();
        if (error) throw error;
        return data ? NextResponse.json({ ok: true }) : fail("Pending request not found.", 404);
      }
      const { data, error } = await admin.from("access_requests").update({ status: "cancelled" }).eq("id", requestId).eq("user_id", user.id).eq("status", "pending").select("id").maybeSingle();
      if (error) throw error;
      return data ? NextResponse.json({ ok: true }) : fail("Pending request not found.", 404);
    }
    if (action === "family_status") {
      const requestId = String(body.requestId || "");
      const nextStatus = String(body.status || "");
      if (!uuid.test(requestId) || !["active", "declined", "revoked"].includes(nextStatus)) return fail("Invalid family access change.");
      const result = await setParentConnectionStatus(admin, user.id, requestId, nextStatus as "active" | "declined" | "revoked");
      return result ? NextResponse.json({ ok: true, status: result.status }) : fail("Family connection not found.", 404);
    }
    if (action === "review") {
      const requestId = String(body.requestId || "");
      const decision = String(body.decision || "");
      if (!uuid.test(requestId) || !["approved","declined"].includes(decision)) return fail("Invalid review.");
      const { data: parentRequest, error: parentLookupError } = await admin.from("parent_guardian_access")
        .select("id,athlete_user_id").eq("id", requestId).eq("status", "pending").maybeSingle();
      if (parentLookupError) throw parentLookupError;
      if (parentRequest) {
        if (parentRequest.athlete_user_id !== user.id) return fail("Only the athlete can approve parent access.", 403);
        const result = await setParentConnectionStatus(admin, user.id, requestId, decision === "approved" ? "active" : "declined", true);
        return result ? NextResponse.json({ ok: true }) : fail("Pending request not found.", 404);
      }
      const { data: request, error } = await admin.from("access_requests").select("*").eq("id", requestId).eq("status", "pending").maybeSingle();
      if (error) throw error;
      if (!request) return fail("Pending request not found.", 404);
      if (request.role === "parent") {
        if (request.athlete_user_id !== user.id) return fail("Only the athlete can approve parent access.", 403);
      } else {
        const scope = await permissions(admin, user.id, request.organization_id);
        const permitted = scope.organizationAdmin || (["athlete","advisor"].includes(request.role) && request.team_ids.length > 0 && request.team_ids.every((id: string) => scope.teamIds.includes(id)));
        if (!permitted) return fail("You cannot approve this role or team.", 403);
      }
      if (request.user_id === user.id) return fail("You cannot approve your own request.", 403);
      if (decision === "approved") await grant(admin, request, user.id);
      const { error: updateError } = await admin.from("access_requests").update({ status: decision, reviewed_by: user.id, reviewed_at: new Date().toISOString() }).eq("id", request.id).eq("status", "pending");
      if (updateError) throw updateError;
      await notify(admin, [request.user_id], decision === "approved" ? "Access approved" : "Access request declined", decision === "approved" ? "Your RLTNL access request was approved. You can now open your dashboard." : "Your access request was declined. You can submit a new request if needed.", "/access-requests");
      return NextResponse.json({ ok: true });
    }
    return fail("Unknown action.");
  } catch (error) {
    console.error("Access request failed:", error);
    return fail(error instanceof Error ? error.message : "Unable to process request.", 500);
  }
}
