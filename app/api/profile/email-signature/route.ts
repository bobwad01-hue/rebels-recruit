import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

const ENTITY = "athlete_email_signature_profile";
const FIELDS = [
  "xTwitter",
  "sportsRecruitsUrl",
  "travelTeamName",
  "travelTeamCoachName",
  "travelTeamCoachPhone",
  "highSchoolCity",
  "highSchoolState",
  "highSchoolCoachName",
  "highSchoolCoachPhone",
  "throwBat",
  "ncaaNumber",
] as const;

export async function GET(req: NextRequest) {
  const c = await createClient();
  const {
    data: { user },
  } = await c.auth.getUser();
  if (!user)
    return NextResponse.json(
      { error: "Please sign in again." },
      { status: 401 },
    );
  const athleteUserId = String(
    req.nextUrl.searchParams.get("athlete") || user.id,
  );
  if (athleteUserId !== user.id) {
    const { data: allowed } = await c.rpc("can_access_athlete", {
      target_athlete_id: athleteUserId,
    });
    if (!allowed)
      return NextResponse.json(
        { error: "You do not have access to this athlete." },
        { status: 403 },
      );
  }
  const admin = createAdminClient();
  const [{ data: log }, { data: profile }, { data: athlete }] =
    await Promise.all([
      admin
        .from("audit_log")
        .select("metadata,created_at")
        .eq("actor_user_id", athleteUserId)
        .eq("entity_type", ENTITY)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from("profiles")
        .select("full_name,email,phone")
        .eq("id", athleteUserId)
        .maybeSingle(),
      admin
        .from("athlete_profiles")
        .select("*")
        .eq("user_id", athleteUserId)
        .maybeSingle(),
    ]);
  return NextResponse.json({
    signature: (log?.metadata as any) || {},
    profile: profile || {},
    athlete: athlete || {},
  });
}

export async function POST(req: NextRequest) {
  const c = await createClient();
  const {
    data: { user },
  } = await c.auth.getUser();
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
  const metadata: any = {};
  for (const key of FIELDS) {
    const value = String(body?.[key] || "").trim();
    if (value) metadata[key] = value;
  }
  const admin = createAdminClient();
  const requestedOrganizationId = String(body?.organizationId || "");
  const memberQuery = admin
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .eq("role", "athlete");
  const { data: member } = requestedOrganizationId
    ? await memberQuery
        .eq("organization_id", requestedOrganizationId)
        .maybeSingle()
    : await memberQuery.limit(1).maybeSingle();
  const { error } = await admin
    .from("audit_log")
    .insert({
      organization_id: member?.organization_id || null,
      actor_user_id: user.id,
      action: "email_signature_profile_saved",
      entity_type: ENTITY,
      entity_id: user.id,
      metadata,
    });
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, signature: metadata });
}
