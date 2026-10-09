import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const familyRoles = ["athlete", "parent"];
const staffRoles = ["admin", "advisor", "advisor_admin"];
const fail = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

function normalizeCode(value: string) {
  const raw = value.toUpperCase().replace(/[-\s]/g, "");
  return /^[A-HJ-NP-Z2-9]{10}$/.test(raw)
    ? `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8)}`
    : null;
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") || "";
  const code = req.nextUrl.searchParams.get("code") || "";
  if (!token && !code) return fail("Enter a team signup code or open a team invitation link.");
  const admin = createAdminClient();
  let query = admin.from("organization_join_links")
    .select("id,organization_id,team_id,role,token,signup_code,requires_approval,active,organization:organizations(name,branch_name),team:teams(name,age_group,archived_at)")
    .eq("active", true);
  if (token) {
    if (!uuid.test(token)) return fail("Invalid invitation link.");
    query = query.eq("token", token);
  } else {
    const normalized = normalizeCode(code);
    if (!normalized) return fail("Enter a valid Team Signup Code.");
    query = query.eq("role", "family").eq("signup_code", normalized);
  }
  const { data, error } = await query.maybeSingle();
  if (error) return fail("Could not check this invitation.", 500);
  if (!data || (data.team_id && (data.team as any)?.archived_at)) return fail("This team invitation is no longer active.", 404);
  return NextResponse.json({ ...data, team: data.team ? { name: (data.team as any).name, age_group: (data.team as any).age_group } : null });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail("Sign in or create an account first.", 401);
  const { token } = await req.json();
  if (!uuid.test(String(token || ""))) return fail("Invalid invitation link.");
  const admin = createAdminClient();
  const { data: link, error: linkError } = await admin.from("organization_join_links")
    .select("id,organization_id,team_id,role,requires_approval")
    .eq("token", String(token)).eq("active", true).maybeSingle();
  if (linkError) return fail("Could not verify invitation.", 500);
  if (!link) return fail("This team invitation is no longer active.", 404);
  if (link.team_id) {
    const { data: team, error: teamError } = await admin.from("teams")
      .select("id").eq("id", link.team_id).eq("organization_id", link.organization_id)
      .is("archived_at", null).maybeSingle();
    if (teamError || !team) return fail("This team is no longer available.", 404);
  }
  const { data: profile, error: profileError } = await admin.from("profiles")
    .select("app_role,profile_completed_at").eq("id", user.id).maybeSingle();
  if (profileError || !profile) return fail("Complete account registration before joining.", 403);
  const accountRole = String(profile.app_role || "");
  const isFamily = link.role === "family";
  const isStaff = staffRoles.includes(link.role);
  if (isFamily && (!link.team_id || !familyRoles.includes(accountRole))) {
    return fail("This team signup link is for Athlete and Parent/Guardian accounts only.", 403);
  }
  if (!isFamily && familyRoles.includes(link.role) && accountRole !== link.role) {
    return fail("This older invitation is for a different account type. Ask your team for the shared Team Signup Link.", 403);
  }
  if (isStaff && accountRole !== "advisor") {
    return fail("Advisor or Admin invitations require an Advisor account.", 403);
  }
  // A staff invitation can never grant elevated access merely by possession of its URL.
  if (isStaff || link.requires_approval) {
    const { error } = await admin.from("organization_join_requests").upsert({
      link_id: link.id, organization_id: link.organization_id, team_id: link.team_id,
      user_id: user.id, role: link.role, status: "pending", requested_at: new Date().toISOString(),
    }, { onConflict: "link_id,user_id" });
    if (error) return fail("Could not submit the staff access request.", 500);
    return NextResponse.json({ ok: true, pending: true });
  }

  const role = isFamily ? accountRole : link.role;
  if (!familyRoles.includes(role)) return fail("This invitation cannot grant that role.", 403);
  const { error: teamRoleError } = await admin.from("team_user_roles").upsert({
    team_id: link.team_id, user_id: user.id, role, status: "active",
    granted_at: new Date().toISOString(), revoked_at: null,
  }, { onConflict: "team_id,user_id,role" });
  if (teamRoleError) return fail("Could not add team membership.", 500);
  const { error: userRoleError } = await admin.from("user_roles")
    .upsert({ user_id: user.id, role }, { onConflict: "user_id,role" });
  if (userRoleError) return fail("Could not finish team membership.", 500);
  if (role === "athlete") {
    const { error: rosterError } = await admin.from("team_members")
      .upsert({ team_id: link.team_id, user_id: user.id }, { onConflict: "team_id,user_id" });
    if (rosterError) return fail("Could not add athlete to the team roster.", 500);
  }

  let next: string;
  if (role === "parent") {
    const connectPath = `/parent/connect?team=${encodeURIComponent(String(link.team_id))}`;
    next = profile.profile_completed_at
      ? connectPath
      : `/parent/profile?next=${encodeURIComponent(connectPath)}`;
  } else {
    next = profile.profile_completed_at ? "/dashboard" : "/profile";
  }
  return NextResponse.json({
    ok: true, pending: false, role, teamId: link.team_id,
    organizationId: link.organization_id, next,
  });
}
