import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { createClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user)
    return NextResponse.json(
      { error: "Your session could not be verified. Please sign in again." },
      { status: 401 },
    );

  const admin = createAdminClient();
  let athleteUserId = user.id;
  const url = new URL(request.url);
  const previewRole = url.searchParams.get("previewRole");
  const previewAthlete = url.searchParams.get("previewAthlete");
  if (previewRole === "athlete" && previewAthlete) {
    const [{ data: platform }, { data: athleteRole }] = await Promise.all([
      admin.from("platform_roles").select("role").eq("user_id", user.id).eq("role", "super_owner").maybeSingle(),
      admin.from("user_roles").select("user_id").eq("user_id", previewAthlete).eq("role", "athlete").maybeSingle(),
    ]);
    if (platform && athleteRole) athleteUserId = previewAthlete;
  }
  const [activityResult, profileResult, relationshipResult, gmailResult] = await Promise.all(
    [
      admin
        .from("interactions")
        .select(
          "id,type,date,date_precision,date_year,date_month,created_at,note,initiated_by,source,email_subject,email_type,email_content,follow_up_due_date,follow_up_completed_at,college_id,coach_id",
        )
        .eq("athlete_user_id", athleteUserId)
        .order("date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(500),
      admin.from("profiles").select("timezone").eq("id", athleteUserId).maybeSingle(),
      admin
        .from("athlete_colleges")
        .select("college_id,status,archived_at")
        .eq("athlete_user_id", athleteUserId),
      admin.from("gmail_recruiting_messages").select("interaction_id,recruiting_intent,summary,action_required,next_action,action_due_date,subject,received_at,extracted_data,action_state,action_decision,action_updated_at").eq("athlete_user_id", athleteUserId),
    ],
  );

  const initialError =
    activityResult.error || profileResult.error || relationshipResult.error || gmailResult.error;
  if (initialError) {
    console.error(
      JSON.stringify({
        level: "error",
        message: "Journey data query failed",
        route: "/api/journey",
        code: initialError.code,
        error: initialError.message,
        details: initialError.details,
        hint: initialError.hint,
      }),
    );
    return NextResponse.json(
      { error: "Journey information is temporarily unavailable." },
      { status: 500 },
    );
  }

  const activity = activityResult.data || [];
  const gmailMap = new Map((gmailResult.data || []).filter(row=>row.interaction_id).map(row=>[row.interaction_id,row]));
  const relationships = relationshipResult.data || [];
  const collegeIds = [
    ...new Set(
      [...activity, ...relationships]
        .map((row) => row.college_id)
        .filter(Boolean),
    ),
  ] as string[];
  const coachIds = [
    ...new Set(activity.map((row) => row.coach_id).filter(Boolean)),
  ] as string[];
  const [collegeResult, coachResult] = await Promise.all([
    collegeIds.length
      ? admin.from("colleges").select("id,name").in("id", collegeIds)
      : Promise.resolve({ data: [], error: null }),
    coachIds.length
      ? admin
          .from("college_coaches")
          .select("id,first_name,last_name")
          .in("id", coachIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const relatedError = collegeResult.error || coachResult.error;
  if (relatedError) {
    console.error(
      JSON.stringify({
        level: "error",
        message: "Journey relationship query failed",
        route: "/api/journey",
        code: relatedError.code,
        error: relatedError.message,
        details: relatedError.details,
        hint: relatedError.hint,
      }),
    );
    return NextResponse.json(
      { error: "Journey information is temporarily unavailable." },
      { status: 500 },
    );
  }

  const collegeMap = new Map(
    (collegeResult.data || []).map((row) => [row.id, row]),
  );
  const coachMap = new Map(
    (coachResult.data || []).map((row) => [row.id, row]),
  );
  return NextResponse.json(
    {
      activities: activity.map((row) => ({
        ...row,
        colleges: row.college_id
          ? collegeMap.get(row.college_id) || null
          : null,
        gmail_intelligence: gmailMap.get(row.id) || null,
        gmail_received_at: gmailMap.get(row.id)?.received_at || null,
        college_coaches: row.coach_id
          ? coachMap.get(row.coach_id) || null
          : null,
      })),
      relationships: relationships.map((row) => ({
        ...row,
        colleges: collegeMap.get(row.college_id) || null,
      })),
      timezone: profileResult.data?.timezone || null,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
