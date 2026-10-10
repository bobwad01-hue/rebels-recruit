import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

const USER_COLUMNS = ["athlete_user_id", "user_id", "member_user_id"] as const;
function missingColumn(error: any, column: string) {
  const m = String(error?.message || "").toLowerCase();
  return m.includes(`column team_members.${column} does not exist`) || m.includes(`could not find the '${column}' column`) || m.includes(`column "${column}" does not exist`);
}
async function listUserMemberships(admin: any, userId: string) {
  for (const column of USER_COLUMNS) {
    const res = await admin.from("team_members").select("team_id,teams(id,name,organization_id)").eq(column, userId);
    if (!res.error) return res.data || [];
    if (!missingColumn(res.error, column)) throw new Error(res.error.message);
  }
  throw new Error("Team membership user column is not available.");
}
async function removeUserFromTeams(admin: any, userId: string, teamIds: string[]) {
  for (const column of USER_COLUMNS) {
    const res = await admin.from("team_members").delete().eq(column, userId).in("team_id", teamIds);
    if (!res.error) return;
    if (!missingColumn(res.error, column)) throw new Error(res.error.message);
  }
  throw new Error("Team membership user column is not available.");
}
async function addUserToTeam(admin: any, userId: string, teamId: string) {
  for (const column of USER_COLUMNS) {
    const res = await admin.from("team_members").upsert({ team_id: teamId, [column]: userId }, { onConflict: `team_id,${column}` });
    if (!res.error) return;
    if (!missingColumn(res.error, column)) throw new Error(res.error.message);
  }
  throw new Error("Team membership user column is not available.");
}

export async function GET() {
  const c = await createClient();
  const { data: { user } } = await c.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const admin = createAdminClient();
  try {
    const { data: memberships, error: membershipError } = await admin.from("organization_members").select("organization_id,status,role,organizations(id,name,brand_name,branch_name,city,state)").eq("user_id", user.id).eq("role", "athlete").in("status", ["active", "pending"]).order("joined_at", { ascending: true });
    if (membershipError) throw new Error(membershipError.message);
    const { data: orgDirectory, error: orgError } = await admin.from("organizations").select("id,name,brand_name,branch_name,city,state").order("name");
    if (orgError) throw new Error(orgError.message);
    // Profile currently filters picker rows to status=active. These rows represent
    // selectable onboarding choices; actual membership is only created on POST/save.
    const organizations = (orgDirectory || []).map((org: any) => ({ organization_id: org.id, status: "active", role: "athlete", organizations: org }));
    const orgIds = (orgDirectory || []).map((org: any) => org.id);
    const { data: teams, error: teamError } = orgIds.length ? await admin.from("teams").select("id,name,organization_id,age_group").in("organization_id", orgIds).is("archived_at", null).order("name") : { data: [], error: null };
    if (teamError) throw new Error(teamError.message);
    const existing = await listUserMemberships(admin, user.id);
    const { data: athlete } = await admin.from("athlete_profiles").select("primary_organization_id,primary_team_id").eq("user_id", user.id).maybeSingle();
    const firstCurrent = (existing || []).map((r: any) => Array.isArray(r.teams) ? r.teams[0] : r.teams).find(Boolean);
    const active = (memberships || []).filter((m: any) => m.status === "active");
    // The shared team invitation grants active membership before profile setup.
    // The first-time profile flow must distinguish that from a manual access request.
    const { data: activeTeamRoles, error: activeTeamError } = await admin.from("team_user_roles")
      .select("team_id").eq("user_id", user.id).eq("role", "athlete").eq("status", "active").limit(1);
    if (activeTeamError) throw new Error(activeTeamError.message);
    return NextResponse.json({ organizations, teams: teams || [], currentOrganizationId: athlete?.primary_organization_id || firstCurrent?.organization_id || active[0]?.organization_id || "", currentTeamId: athlete?.primary_team_id || firstCurrent?.id || "", hasActiveTeamAccess: Boolean(activeTeamRoles?.length) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load organizations and teams." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const c = await createClient();
  const { data: { user } } = await c.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const organizationId = String(body?.organizationId || ""), teamId = String(body?.teamId || "");
  if (!organizationId || !teamId) return NextResponse.json({ error: "Please choose an organization and team." }, { status: 400 });
  const admin = createAdminClient();
  try {
    const { data: team, error: teamError } = await admin.from("teams").select("id,name,organization_id").eq("id", teamId).eq("organization_id", organizationId).is("archived_at", null).maybeSingle();
    if (teamError) throw new Error(teamError.message);
    if (!team) return NextResponse.json({ error: "Please choose a team from the selected organization." }, { status: 400 });
    // Selecting a team in the athlete profile is a request, not authorization.
    // Existing approved team members can update their primary team; others must be approved.
    const { data: existingTeam, error: existingError } = await admin.from("team_members")
      .select("team_id").eq("team_id", teamId).eq("user_id", user.id).maybeSingle();
    if (existingError) throw new Error(existingError.message);
    if (!existingTeam) {
      const { data: pending } = await admin.from("access_requests")
        .select("id").eq("user_id", user.id).eq("organization_id", organizationId)
        .eq("role", "athlete").eq("status", "pending").maybeSingle();
      const { error: requestError } = pending
        ? await admin.from("access_requests").update({ team_ids: [teamId], requested_at: new Date().toISOString() }).eq("id", pending.id)
        : await admin.from("access_requests").insert({ user_id: user.id, organization_id: organizationId, team_ids: [teamId], role: "athlete" });
      if (requestError) throw new Error(requestError.message);
      const { data: orgAdmins } = await admin.from("organization_members").select("user_id").eq("organization_id", organizationId).eq("role", "admin").eq("status", "active");
      const { data: teamAdmins } = await admin.from("team_user_roles").select("user_id").eq("team_id", teamId).eq("role", "admin").eq("status", "active");
      const ids = [...new Set([...(orgAdmins || []).map((r: any) => r.user_id), ...(teamAdmins || []).map((r: any) => r.user_id)])].filter(id => id !== user.id);
      if (ids.length) {
        const { data: profile } = await admin.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
        await admin.from("notifications").insert(ids.map(user_id => ({
          user_id, kind: "access_request", title: "Athlete team access requested",
          body: `${profile?.full_name || "An athlete"} requested to join ${team.name}.`,
          url: "/organization/setup", scheduled_for: new Date().toISOString(),
        })));
      }
      return NextResponse.json({ ok: true, pending: true, team: team.name, organizationId });
    }
    const { error: profileError } = await admin.from("athlete_profiles")
      .update({ primary_organization_id: organizationId, primary_team_id: teamId }).eq("user_id", user.id);
    if (profileError) throw new Error(profileError.message);
    return NextResponse.json({ ok: true, team: team.name, organizationId });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save organization and team." }, { status: 500 });
  }
}
