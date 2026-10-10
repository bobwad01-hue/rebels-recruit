import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

// Only return the signed-in parent's own pending requests and team-visible labels.
export async function GET() {
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const admin = createAdminClient();
  const { data: requests, error } = await admin.from("parent_guardian_access")
    .select("athlete_user_id,relationship_type")
    .eq("parent_user_id", user.id).eq("status", "pending");
  if (error) return NextResponse.json({ error: "Could not load pending connections." }, { status: 500 });
  const ids = [...new Set((requests || []).map((r: any) => r.athlete_user_id))];
  if (!ids.length) return NextResponse.json({ pending: [] });
  const { data: profiles } = await admin.from("profiles").select("id,full_name").in("id", ids);
  const { data: memberships } = await admin.from("team_members").select("user_id,team_id").in("user_id", ids);
  const { data: parentTeams } = await admin.from("team_user_roles")
    .select("team_id").eq("user_id", user.id).eq("role", "parent").eq("status", "active");
  const permitted = new Set((parentTeams || []).map((r: any) => r.team_id));
  const visibleMemberships = (memberships || []).filter((m: any) => permitted.has(m.team_id));
  const teamIds = [...new Set(visibleMemberships.map((m: any) => m.team_id))];
  const { data: teams } = teamIds.length
    ? await admin.from("teams").select("id,name").in("id", teamIds)
    : { data: [] };
  const names = new Map((profiles || []).map((p: any) => [p.id, p.full_name]));
  const teamNames = new Map((teams || []).map((t: any) => [t.id, t.name]));
  return NextResponse.json({ pending: (requests || []).filter((r: any) =>
    visibleMemberships.some((m: any) => m.user_id === r.athlete_user_id)
  ).map((r: any) => ({
    athleteId: r.athlete_user_id,
    athleteName: names.get(r.athlete_user_id) || "Athlete",
    teamName: teamNames.get(visibleMemberships.find((m: any) => m.user_id === r.athlete_user_id)?.team_id) || "Your team",
    relationship: r.relationship_type === "guardian" ? "Legal Guardian" : "Parent",
  })) });
}
