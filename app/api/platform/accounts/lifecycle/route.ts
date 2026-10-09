import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fail = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });

// Lifecycle actions are intentionally separate from scoped staff-role editing.
// Neither the browser nor an organization Admin can call these as a privileged user.
export async function POST(req: NextRequest) {
  const client = await createClient();
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) return fail("Sign in required.", 401);
  const admin = createAdminClient();
  const { data: owner, error: ownerError } = await admin.from("platform_roles")
    .select("user_id").eq("user_id", user.id).eq("role", "super_owner").maybeSingle();
  if (ownerError || !owner) return fail("Super Owner access required.", 403);

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return fail("Invalid request."); }
  const action = String(body.action || "");
  const targetId = String(body.userId || "");
  if (!["suspend", "restore", "delete"].includes(action) || !uuid.test(targetId)) {
    return fail("Choose a valid account and action.");
  }
  if (targetId === user.id) return fail("You cannot suspend or delete your own account.", 403);

  const { data: target, error: profileError } = await admin.from("profiles")
    .select("id,full_name,email,app_role,account_status")
    .eq("id", targetId).maybeSingle();
  if (profileError) return fail("Unable to verify the account.", 500);
  if (!target) return fail("Account not found.", 404);

  const { data: platformRole, error: platformError } = await admin.from("platform_roles")
    .select("user_id").eq("user_id", targetId).eq("role", "super_owner").maybeSingle();
  if (platformError) return fail("Unable to verify platform permissions.", 500);
  if (platformRole) return fail("Super Owner accounts are protected. Transfer platform ownership first.", 403);

  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";
  const now = new Date().toISOString();

  async function audit(actionName: string, metadata: Record<string, unknown>) {
    const { error } = await admin.from("audit_log").insert({
      actor_user_id: user!.id, action: actionName,
      entity_type: "profile", entity_id: targetId, metadata,
    });
    if (error) console.error("Platform account lifecycle audit failed:", error.message);
  }

  // Prevent an organization from losing its last active Admin/Owner.
  if (action === "suspend" || action === "delete") {
    const { data: adminMemberships, error: membershipsError } = await admin
      .from("organization_members").select("organization_id")
      .eq("user_id", targetId).eq("status", "active").in("role", ["owner", "admin"]);
    if (membershipsError) return fail("Unable to check organization administration.", 500);
    for (const membership of adminMemberships || []) {
      const { data: otherAdmins, error: othersError } = await admin.from("organization_members")
        .select("user_id").eq("organization_id", membership.organization_id)
        .eq("status", "active").in("role", ["owner", "admin"]).neq("user_id", targetId);
      if (othersError) return fail("Unable to check organization administration.", 500);
      const otherIds = [...new Set((otherAdmins || []).map(a => a.user_id))];
      const { data: activeOthers, error: activeError } = otherIds.length
        ? await admin.from("profiles").select("id").in("id", otherIds).eq("account_status", "active").limit(1)
        : { data: [], error: null };
      if (activeError) return fail("Unable to check organization administration.", 500);
      if (!activeOthers?.length) return fail(
        "This is the organization's last active Admin/Owner. Assign another active Admin before suspending or deleting this account.", 409,
      );
    }
  }

  if (action === "delete") {
    const { data: authRecord, error: lookupError } = await admin.auth.admin.getUserById(targetId);
    if (lookupError || !authRecord.user) return fail("Authentication account not found.", 404);
    const identity = (authRecord.user.email || target.email || targetId).trim();
    if (body.confirmText !== "DELETE" ||
        String(body.confirmIdentity || "").trim().toLowerCase() !== identity.toLowerCase()) {
      return fail("Enter DELETE and the exact account email to confirm permanent deletion.");
    }
    // Hard delete removes auth and cascades user-owned recruiting data. FK restrictions
    // may prevent deletion when historical or shared organization records must survive.
    const { error: deletionError } = await admin.auth.admin.deleteUser(targetId);
    if (deletionError) {
      console.error("Platform account deletion blocked:", deletionError.message);
      return fail(
        "Permanent deletion was blocked by linked account records. Suspend the account or transfer its dependent records before deleting.", 409,
      );
    }
    await audit("platform_account_deleted", {
      previousStatus: target.account_status, accountEmail: identity,
      accountRole: target.app_role, reason: reason || null,
    });
    return NextResponse.json({ ok: true, deleted: true }, { headers: { "Cache-Control": "no-store" } });
  }

  const suspended = target.account_status === "suspended";
  if ((action === "suspend" && suspended) || (action === "restore" && !suspended)) {
    return NextResponse.json({ ok: true, unchanged: true }, { headers: { "Cache-Control": "no-store" } });
  }

  // Block future sign-ins and refreshes at the Auth layer, and existing sessions
  // at the app layer (middleware reads profiles.account_status).
  const banDuration = action === "suspend" ? "876000h" : "none";
  const rollbackBan = action === "suspend" ? "none" : "876000h";
  const { error: authUpdateError } = await admin.auth.admin.updateUserById(targetId, { ban_duration: banDuration });
  if (authUpdateError) {
    console.error("Platform account Auth update failed:", authUpdateError.message);
    return fail("Unable to update sign-in access. No account status change was saved.", 500);
  }

  const next = action === "suspend"
    ? { account_status: "suspended", suspended_at: now, suspended_by: user.id, suspension_reason: reason || null }
    : { account_status: "active", suspended_at: null, suspended_by: null, suspension_reason: null };
  const { error: updateError } = await admin.from("profiles")
    .update(next).eq("id", targetId).eq("account_status", target.account_status);
  if (updateError) {
    console.error("Platform account status update failed:", updateError.message);
    const { error: rollbackError } = await admin.auth.admin.updateUserById(targetId, { ban_duration: rollbackBan });
    if (rollbackError) console.error("Account Auth rollback failed:", rollbackError.message);
    return fail("Account status could not be saved. Check account status before retrying.", 500);
  }
  await audit(action === "suspend" ? "platform_account_suspended" : "platform_account_restored", {
    previousStatus: target.account_status, newStatus: next.account_status,
    reason: reason || null,
  });
  return NextResponse.json({ ok: true, status: next.account_status }, { headers: { "Cache-Control": "no-store" } });
}
