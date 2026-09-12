import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

function code() {
  return randomBytes(5).toString("hex").toUpperCase();
}
async function viewer() {
  const c = await createClient();
  const {
    data: { user },
  } = await c.auth.getUser();
  if (!user) return null;
  return user;
}
async function owned(admin: any, userId: string, organizationId?: string) {
  let q = admin
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .eq("role", "owner")
    .eq("status", "active");
  if (organizationId) q = q.eq("organization_id", organizationId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data || [];
}
async function uniqueCode(admin: any) {
  for (let i = 0; i < 5; i++) {
    const joinCode = code();
    const { data } = await admin
      .from("organizations")
      .select("id")
      .eq("join_code", joinCode)
      .maybeSingle();
    if (!data) return joinCode;
  }
  throw new Error("Could not generate a unique organization code. Try again.");
}

export async function GET() {
  const user = await viewer();
  if (!user)
    return NextResponse.json(
      { error: "Please sign in again." },
      { status: 401 },
    );
  const admin = createAdminClient();
  try {
    const memberships = await owned(admin, user.id);
    const ids = memberships.map((m: any) => m.organization_id);
    if (!ids.length) return NextResponse.json({ organizations: [] });
    const { data: organizations, error } = await admin
      .from("organizations")
      .select(
        "id,name,branch_name,city,state,join_code,teams(id,name,age_group,archived_at)",
      )
      .in("id", ids)
      .order("name");
    if (error) throw new Error(error.message);
    return NextResponse.json({
      organizations: (organizations || []).map((o: any) => ({
        ...o,
        teams: (o.teams || []).sort((a: any, b: any) =>
          String(a.name).localeCompare(String(b.name)),
        ),
      })),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not load organization setup.",
      },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const user = await viewer();
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
  const action = String(body?.action || ""),
    admin = createAdminClient();
  try {
    if (action === "create") {
      const existing = await owned(admin, user.id);
      if (!existing.length)
        return NextResponse.json(
          {
            error:
              "Only an existing organization Owner can create another organization.",
          },
          { status: 403 },
        );
      const name = String(body.name || "").trim(),
        branchName = String(body.branchName || "").trim() || null,
        city = String(body.city || "").trim(),
        state = String(body.state || "")
          .trim()
          .toUpperCase();
      if (!name || !city || !state)
        return NextResponse.json(
          { error: "Organization, city and state are required." },
          { status: 400 },
        );
      const joinCode = await uniqueCode(admin);
      const { data: organization, error } = await admin
        .from("organizations")
        .insert({
          name,
          branch_name: branchName,
          city,
          state,
          join_code: joinCode,
        })
        .select("id,name,branch_name,city,state,join_code")
        .single();
      if (error) throw new Error(error.message);
      const { error: memberError } = await admin
        .from("organization_members")
        .insert({
          organization_id: organization.id,
          user_id: user.id,
          role: "owner",
          status: "active",
          joined_at: new Date().toISOString(),
        });
      if (memberError) throw new Error(memberError.message);
      return NextResponse.json({ ok: true, organization });
    }
    const organizationId = String(body.organizationId || "");
    if (
      !organizationId ||
      !(await owned(admin, user.id, organizationId)).length
    )
      return NextResponse.json(
        { error: "Owner access is required for this organization." },
        { status: 403 },
      );
    if (action === "update") {
      const name = String(body.name || "").trim(),
        branchName = String(body.branchName || "").trim() || null,
        city = String(body.city || "").trim(),
        state = String(body.state || "")
          .trim()
          .toUpperCase();
      if (!name || !city || !state)
        return NextResponse.json(
          { error: "Organization, city and state are required." },
          { status: 400 },
        );
      const { error } = await admin
        .from("organizations")
        .update({ name, branch_name: branchName, city, state })
        .eq("id", organizationId);
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true });
    }
    if (action === "regenerateCode") {
      const joinCode = await uniqueCode(admin);
      const { error } = await admin
        .from("organizations")
        .update({ join_code: joinCode })
        .eq("id", organizationId);
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true, joinCode });
    }
    if (action === "addTeam") {
      const name = String(body.name || "").trim(),
        ageGroup = String(body.ageGroup || "").trim() || null;
      if (!name)
        return NextResponse.json(
          { error: "Team name is required." },
          { status: 400 },
        );
      const { error } = await admin
        .from("teams")
        .insert({ organization_id: organizationId, name, age_group: ageGroup });
      if (error)
        throw new Error(
          error.code === "23505"
            ? "That team already exists in this organization."
            : error.message,
        );
      return NextResponse.json({ ok: true });
    }
    if (action === "renameTeam") {
      const teamId = String(body.teamId || ""),
        name = String(body.name || "").trim(),
        ageGroup = String(body.ageGroup || "").trim() || null;
      if (!teamId || !name)
        return NextResponse.json(
          { error: "Team and name are required." },
          { status: 400 },
        );
      const { error } = await admin
        .from("teams")
        .update({ name, age_group: ageGroup })
        .eq("id", teamId)
        .eq("organization_id", organizationId);
      if (error)
        throw new Error(
          error.code === "23505"
            ? "That team already exists in this organization."
            : error.message,
        );
      return NextResponse.json({ ok: true });
    }
    if (action === "archiveTeam") {
      const teamId = String(body.teamId || "");
      const { count } = await admin
        .from("team_members")
        .select("*", { count: "exact", head: true })
        .eq("team_id", teamId);
      if (count)
        return NextResponse.json(
          { error: "Move players to another team before archiving this team." },
          { status: 400 },
        );
      const { error } = await admin
        .from("teams")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", teamId)
        .eq("organization_id", organizationId);
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true });
    }
    if (action === "restoreTeam") {
      const teamId = String(body.teamId || "");
      const { error } = await admin
        .from("teams")
        .update({ archived_at: null })
        .eq("id", teamId)
        .eq("organization_id", organizationId);
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json(
      { error: "Unsupported organization action." },
      { status: 400 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not update organization setup.",
      },
      { status: 500 },
    );
  }
}
