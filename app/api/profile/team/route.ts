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
    return NextResponse.json({ organizations, teams: teams || [], currentOrganizationId: athlete?.primary_organization_id || firstCurrent?.organization_id || active[0]?.organization_id || "", currentTeamId: athlete?.primary_team_id || firstCurrent?.id || "" });
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
    const { data: existingMember, error: existingMemberError } = await admin.from("organization_members").select("organization_id").eq("organization_id", organizationId).eq("user_id", user.id).eq("role", "athlete").maybeSingle();
    if (existingMemberError) throw new Error(existingMemberError.message);
    if (existingMember) {
      const { error } = await admin.from("organization_members").update({ status: "active" }).eq("organization_id", organizationId).eq("user_id", user.id).eq("role", "athlete");
      if (error) throw new Error(error.message);
    } else {
      const { error } = await admin.from("organization_members").insert({ organization_id: organizationId, user_id: user.id, role: "athlete", status: "active" });
      if (error) throw new Error(error.message);
    }
    const { data: orgTeams, error: orgTeamsError } = await admin.from("teams").select("id").eq("organization_id", organizationId);
    if (orgTeamsError) throw new Error(orgTeamsError.message);
    const orgTeamIds = (orgTeams || []).map((t: any) => t.id);
    if (orgTeamIds.length) await removeUserFromTeams(admin, user.id, orgTeamIds);
    await addUserToTeam(admin, user.id, team.id);
    const { error: profileError } = await admin.from("athlete_profiles").update({ primary_organization_id: organizationId, primary_team_id: teamId }).eq("user_id", user.id);
    if (profileError) throw new Error(profileError.message);
    return NextResponse.json({ ok: true, team: team.name, organizationId });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save organization and team." }, { status: 500 });
  }
}
