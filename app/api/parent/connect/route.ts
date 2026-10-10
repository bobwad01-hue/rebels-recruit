import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { requestParentConnection } from "@/lib/parent-access";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fail = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

async function currentUser() {
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  return user;
}

async function hasParentTeamAccess(admin: any, teamId: string, userId: string) {
  const { data, error } = await admin.from("team_user_roles")
    .select("team_id")
    .eq("team_id", teamId).eq("user_id", userId)
    .eq("role", "parent").eq("status", "active").maybeSingle();
  if (error) throw error;
  return !!data;
}

export async function GET(req: NextRequest) {
  const user = await currentUser();
  if (!user) return fail("Please sign in.", 401);
  const teamId = req.nextUrl.searchParams.get("team") || "";
  if (teamId && !uuid.test(teamId)) return fail("Choose a valid team.");
  const admin = createAdminClient();
  try {
    if (!teamId) {
      const { data: roles, error: roleError } = await admin.from("team_user_roles")
        .select("team_id").eq("user_id", user.id).eq("role", "parent").eq("status", "active");
      if (roleError) throw roleError;
      const ids = [...new Set((roles || []).map((r: any) => String(r.team_id)))];
      const { data: teams, error: teamError } = ids.length
        ? await admin.from("teams").select("id,name,age_group").in("id", ids).is("archived_at", null)
        : { data: [], error: null };
      if (teamError) throw teamError;
      return NextResponse.json({ teams: teams || [] });
    }
    if (!(await hasParentTeamAccess(admin, teamId, user.id))) return fail("Parent access to this team is required.", 403);
    const { data: team, error: teamError } = await admin.from("teams")
      .select("id,name,age_group,organization_id").eq("id", teamId).maybeSingle();
    if (teamError) throw teamError;
    if (!team) return fail("Team not found.", 404);

    // team_members is the canonical athlete roster populated by athlete joins.
    // Older team_user_roles(athlete) entries are not required to be present.
    const { data: memberships, error: memberError } = await admin.from("team_members")
      .select("user_id").eq("team_id", teamId);
    if (memberError) throw memberError;
    const ids = [...new Set((memberships || []).map((m: any) => m.user_id))];
    const { data: profiles, error: profileError } = ids.length
      ? await admin.from("profiles").select("id,full_name").in("id", ids).eq("app_role", "athlete")
      : { data: [], error: null };
    if (profileError) throw profileError;
    const athleteIds = (profiles || []).map((p: any) => p.id);
    // Jersey numbers are team-visible identifiers, not private recruiting details.
    const { data: athleteProfiles, error: jerseyError } = athleteIds.length
      ? await admin.from("athlete_profiles").select("user_id,jersey_number").in("user_id", athleteIds)
      : { data: [], error: null };
    if (jerseyError) throw jerseyError;
    const jerseyById = new Map((athleteProfiles || []).map((a: any) => [a.user_id, a.jersey_number]));
    const { data: connections, error: connectionError } = athleteIds.length
      ? await admin.from("parent_guardian_access").select("athlete_user_id,status")
          .eq("parent_user_id", user.id).in("athlete_user_id", athleteIds)
      : { data: [], error: null };
    if (connectionError) throw connectionError;
    const byAthlete = new Map((connections || []).map((r: any) => [r.athlete_user_id, r.status]));
    return NextResponse.json({
      team,
      athletes: (profiles || []).map((p: any) => ({
        id: p.id, full_name: p.full_name, jersey_number: jerseyById.get(p.id) ?? null, connection: byAthlete.get(p.id) || null,
      })),
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Could not load team athletes.", 500);
  }
}

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return fail("Please sign in.", 401);
  const { teamId, athleteId, relationship } = await req.json();
  if (relationship !== "parent" && relationship !== "guardian") return fail("Select Parent or Legal Guardian.");
  if (!uuid.test(String(teamId || "")) || !uuid.test(String(athleteId || ""))) return fail("Choose a valid athlete and team.");
  const admin = createAdminClient();
  try {
    if (!(await hasParentTeamAccess(admin, String(teamId), user.id))) return fail("Parent access to this team is required.", 403);
    const { data: membership, error: memberError } = await admin.from("team_members")
      .select("user_id").eq("team_id", String(teamId)).eq("user_id", String(athleteId)).maybeSingle();
    if (memberError) throw memberError;
    if (!membership) return fail("That athlete is not available for this Parent connection.", 403);
    const result = await requestParentConnection(admin, user.id, String(athleteId), relationship);
    return NextResponse.json({ ok: true, status: result.status });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Could not request connection.", 500);
  }
}
