/**
 * Single source of truth for Parent / Guardian relationships.
 * All entry points (email request, team invite, and athlete confirmation) use
 * parent_guardian_access, which also powers the athlete's permissions UI.
 */
type ParentStatus = "pending" | "active" | "declined" | "revoked";

async function notify(admin: any, userId: string, title: string, body: string, url: string) {
  const { error } = await admin.from("notifications").insert({
    user_id: userId,
    title,
    body,
    url,
    kind: "access_request",
    scheduled_for: new Date().toISOString(),
  });
  if (error) console.error("Parent access notification failed:", error.message);
}

export async function requestParentConnection(
  admin: any,
  parentUserId: string,
  athleteUserId: string,
): Promise<{ status: "pending" | "active"; changed: boolean }> {
  if (parentUserId === athleteUserId) throw new Error("You cannot request access to your own account.");

  const { data: athlete, error: athleteError } = await admin
    .from("profiles")
    .select("id")
    .eq("id", athleteUserId)
    .eq("app_role", "athlete")
    .maybeSingle();
  if (athleteError) throw athleteError;
  if (!athlete) throw new Error("Athlete account not found.");

  const { data: existing, error: lookupError } = await admin
    .from("parent_guardian_access")
    .select("id,status")
    .eq("parent_user_id", parentUserId)
    .eq("athlete_user_id", athleteUserId)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (existing?.status === "active") return { status: "active", changed: false };
  if (existing?.status === "pending") return { status: "pending", changed: false };

  if (existing) {
    const { data, error } = await admin
      .from("parent_guardian_access")
      .update({ status: "pending", updated_at: new Date().toISOString() })
      .eq("id", existing.id)
      .eq("status", existing.status)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("This connection changed. Refresh and try again.");
  } else {
    const { error } = await admin.from("parent_guardian_access").insert({
      athlete_user_id: athleteUserId,
      parent_user_id: parentUserId,
      status: "pending",
    });
    if (error) throw error;
  }

  const { data: parent } = await admin.from("profiles").select("full_name,email").eq("id", parentUserId).maybeSingle();
  await notify(
    admin,
    athleteUserId,
    "Parent / Guardian connection confirmation",
    `${parent?.full_name || parent?.email || "A parent or guardian"} wants to connect to your recruiting profile. Confirm the relationship or decline it. No private information is shared until you confirm.`,
    "/manage-access",
  );
  return { status: "pending", changed: true };
}

export async function setParentConnectionStatus(
  admin: any,
  athleteUserId: string,
  connectionId: string,
  nextStatus: Exclude<ParentStatus, "pending">,
  pendingOnly = false,
): Promise<{ status: ParentStatus; changed: boolean } | null> {
  const { data: existing, error: lookupError } = await admin
    .from("parent_guardian_access")
    .select("id,athlete_user_id,parent_user_id,status")
    .eq("id", connectionId)
    .eq("athlete_user_id", athleteUserId)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (!existing || (pendingOnly && existing.status !== "pending")) return null;
  if (existing.status === nextStatus) return { status: nextStatus, changed: false };

  const { data, error } = await admin
    .from("parent_guardian_access")
    .update({ status: nextStatus, updated_at: new Date().toISOString() })
    .eq("id", connectionId)
    .eq("athlete_user_id", athleteUserId)
    .eq("status", existing.status)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("This connection changed. Refresh and try again.");

  const message = {
    active: ["Parent connection confirmed", "Your athlete confirmed or restored your Parent / Guardian connection. You can now see the recruiting information they allow."],
    declined: ["Parent connection declined", "Your athlete did not confirm the Parent / Guardian connection."],
    revoked: ["Parent access revoked", "Your athlete revoked your Parent / Guardian access."],
  }[nextStatus];
  await notify(admin, existing.parent_user_id, message[0], message[1], "/parent");
  return { status: nextStatus, changed: true };
}
