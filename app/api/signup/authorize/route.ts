import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const fail = (message: string, status = 400) => NextResponse.json(
  { error: message }, { status, headers: { "Cache-Control": "no-store" } },
);

// Only needed for new Google accounts. Supabase OAuth does not attach a team
// invitation token to auth.users metadata before the user is created.
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return fail("Enter your invitation and Google account email."); }

  const email = String(body.email || "").trim().toLowerCase();
  const token = String(body.joinToken || "").trim();
  const role = String(body.role || "");
  if (email.length > 254 || !emailPattern.test(email) || !uuid.test(token) ||
      !["athlete", "parent", "advisor"].includes(role)) {
    return fail("Enter a valid invitation and the email address of your Google account.");
  }

  const admin = createAdminClient();
  const { data: link, error: linkError } = await admin.from("organization_join_links")
    .select("id,role,team_id,active,team:teams(id,archived_at)")
    .eq("token", token).eq("active", true).maybeSingle();
  if (linkError) return fail("Unable to verify this invitation.", 500);
  if (!link || (link.team_id && (!(link.team as any)?.id || (link.team as any)?.archived_at))) {
    return fail("This invitation is no longer active.", 404);
  }
  const permitted =
    (link.role === "family" && Boolean(link.team_id) && ["athlete", "parent"].includes(role)) ||
    (["athlete", "parent"].includes(link.role) && link.role === role) ||
    (["advisor", "admin", "advisor_admin"].includes(link.role) && role === "advisor");
  if (!permitted) return fail("This invitation does not allow that account type.", 403);

  const { error: grantError } = await admin.from("signup_authorizations").upsert({
    email, join_link_id: link.id, requested_role: role,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  }, { onConflict: "email,join_link_id" });
  if (grantError) {
    console.error("Signup authorization failed:", grantError.message);
    return fail("Could not prepare your invitation. Please try again.", 500);
  }
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
