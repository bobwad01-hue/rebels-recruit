import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  CalendarDays,
  School,
  Users,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Flag,
  Target,
  Clock3,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import SmartNextMoves, {
  buildSmartNextMoves,
} from "@/components/SmartNextMoves";
import HomeUpcomingEvents from "@/components/HomeUpcomingEvents";
import HomeTopTargets from "@/components/HomeTopTargets";
import QuickAddMenu from "@/components/QuickAddMenu";
import ReminderStickyBoard from "@/components/ReminderStickyBoard";
import WeeklyRecruitingMomentum from "@/components/WeeklyRecruitingMomentum";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import {
  DEFAULT_TIMEZONE,
  formatInteractionDateTime,
  getGreetingForTimezone,
} from "@/lib/us-timezones";
import { buildRelationshipInsights } from "@/lib/communication-intelligence";
import { buildRecruitingIntelligence } from "@/lib/recruiting-intelligence";
import {
  RECRUITING_JOURNEY,
  normalizeJourneyStage,
} from "@/lib/recruiting-journey";
import { cleanDisplayNote } from "@/lib/display-notes";
import { addPreviewToHref, resolveOwnerPreview } from "@/lib/owner-preview";
export const dynamic = "force-dynamic";
const one = (v: any) => (Array.isArray(v) ? v[0] : v);
const fmt = (d: any) =>
  d
    ? new Date(`${String(d).slice(0, 10)}T12:00:00`).toLocaleDateString(
        "en-US",
        { month: "short", day: "numeric" },
      )
    : "";
export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createClient();
  const admin = createAdminClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError)
    return (
      <AppShell>
        <div className="max-w-5xl mx-auto px-5 py-8">
          <div role="alert" className="card p-6 border-red-200 bg-red-50">
            <div className="font-black text-lg">Home could not be loaded</div>
            <p className="text-sm mt-2 text-red-700">
              We could not verify your account. Refresh the page and try again.
            </p>
          </div>
        </div>
      </AppShell>
    );
  if (!user)
    return (
      <AppShell>
        <div className="max-w-5xl mx-auto px-5 py-8">
          <div className="card p-6">
            <div className="font-black text-lg">
              Sign in to review your recruiting home
            </div>
            <p className="muted text-sm mt-2">
              Your recruiting snapshot is available after you sign in.
            </p>
          </div>
        </div>
      </AppShell>
    );
  const sp = await searchParams;
  const preview = user
    ? await resolveOwnerPreview(supabase, user.id, sp)
    : { active: false, role: null, athleteId: null };
  const uid =
    preview.active && preview.role === "athlete" && preview.athleteId
      ? preview.athleteId
      : user?.id;
  const ph = (href: string) => addPreviewToHref(href, preview);
  const [
    colleges,
    interactions,
    reminders,
    profile,
    coachRelationships,
    tasks,
    athleteEvents,
    invitations,
    milestoneRows,
    fitProfile,
  ] = await Promise.all([
    supabase
      .from("athlete_colleges")
      .select(
        "id,status,college_id,created_at,archived_at,colleges(id,name,division,state)",
      )
      .eq("athlete_user_id", uid),
    admin
      .from("interactions")
      .select(
        "id,athlete_user_id,coach_id,college_id,type,note,date,date_precision,date_year,date_month,created_at,initiated_by",
      )
      .eq("athlete_user_id", uid)
      .order("date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("reminders")
      .select(
        "id,title,note,due_date,status,coach_id,college_id,color,sort_order,reminder_kind,interaction_id,colleges(id,name),college_coaches(id,first_name,last_name)",
      )
      .eq("athlete_user_id", uid)
      .in("status", ["open", "snoozed"])
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(50),
    supabase
      .from("profiles")
      .select("full_name,timezone")
      .eq("id", uid)
      .single(),
    supabase
      .from("athlete_coaches")
      .select(
        "id,athlete_user_id,coach_id,college_id,last_contact_date,next_step,archived_at,colleges(id,name),college_coaches(id,first_name,last_name,title)",
      )
      .eq("athlete_user_id", uid),
    supabase
      .from("advisor_tasks")
      .select("id,title,description,due_date,status,created_at")
      .eq("athlete_user_id", uid)
      .neq("status", "completed")
      .order("due_date")
      .limit(20),
    supabase
      .from("athlete_events")
      .select(
        "id,status,events(id,name,type,date,location,college_id,colleges(id,name))",
      )
      .eq("athlete_user_id", uid),
    supabase
      .from("athlete_advisor_assignments")
      .select("id,advisor_user_id,relationship_type,invited_at,status")
      .eq("athlete_user_id", uid)
      .eq("status", "pending"),
    uid
      ? admin
          .from("audit_log")
          .select("entity_id,metadata,created_at")
          .eq("actor_user_id", uid)
          .eq("entity_type", "recruiting_journey")
          .order("created_at", { ascending: false })
          .limit(100)
      : (Promise.resolve({ data: [] }) as any),
    supabase.from("college_fit_profiles").select("completed_at").eq("user_id", uid).maybeSingle(),
  ]);
  const sourceIssues = [
    colleges.error && "school relationships",
    interactions.error && "recruiting activity",
    reminders.error && "reminders",
    profile.error && "profile details",
    coachRelationships.error && "coach relationships",
    tasks.error && "advisor-assigned Next Steps",
    athleteEvents.error && "events",
    invitations.error && "advisor requests",
    milestoneRows.error && "Journey milestones",
    fitProfile.error && "College Fit Survey",
  ].filter(Boolean) as string[];
  if (interactions.error)
    console.error(
      JSON.stringify({
        level: "error",
        message: "Dashboard recruiting activity query failed",
        route: "/dashboard",
        source: "interactions",
        code: interactions.error.code,
        error: interactions.error.message,
        details: interactions.error.details,
        hint: interactions.error.hint,
      }),
    );
  if ((interactions.data || []).length === 200)
    sourceIssues.push(
      "older recruiting activity beyond the 200 most recent records used for this snapshot",
    );
  const activeColleges = (colleges.data || []).filter(
      (x: any) => !x.archived_at,
    ),
    activeCoaches = (coachRelationships.data || []).filter(
      (x: any) => !x.archived_at,
    );
  const interactionCollegeMap = new Map(
    (colleges.data || []).map((row: any) => [
      row.college_id,
      one(row.colleges),
    ]),
  );
  const interactionCoachMap = new Map(
    (coachRelationships.data || []).map((row: any) => [
      row.coach_id,
      one(row.college_coaches),
    ]),
  );
  const interactionRows = (interactions.data || []).map((row: any) => ({
    ...row,
    colleges: interactionCollegeMap.get(row.college_id) || null,
    college_coaches: interactionCoachMap.get(row.coach_id) || null,
  }));
  const eventRows = (athleteEvents.data || [])
    .map((r: any) => one(r.events))
    .filter(Boolean);
  const advisorIds = [
    ...new Set((invitations.data || []).map((i: any) => i.advisor_user_id)),
  ];
  const { data: advisorProfiles, error: advisorProfilesError } =
    advisorIds.length
      ? await supabase
          .from("profiles")
          .select("id,full_name,email")
          .in("id", advisorIds)
      : { data: [], error: null };
  if (advisorProfilesError) sourceIssues.push("advisor names");
  const apm = new Map((advisorProfiles || []).map((p: any) => [p.id, p]));
  const advisorRequests = (invitations.data || []).map((i: any) => ({
    ...i,
    advisorName:
      (apm.get(i.advisor_user_id) as any)?.full_name ||
      (apm.get(i.advisor_user_id) as any)?.email,
  }));
  const smartMoves = buildSmartNextMoves({
    reminders: reminders.data || [],
    tasks: tasks.data || [],
    coaches: activeCoaches,
    colleges: activeColleges,
    events: eventRows,
    advisorRequests,
  });
  const intelligence = buildRecruitingIntelligence({
    colleges: activeColleges,
    coaches: activeCoaches,
    interactions: interactionRows,
    reminders: reminders.data || [],
    tasks: tasks.data || [],
    events: eventRows,
  });
  const insights = buildRelationshipInsights(
    activeCoaches,
    interactionRows,
  ).sort((a, b) => b.score - a.score);
  const needsFollowUp = insights.filter((r) => r.momentum === "Cooling" || (r.daysSinceContact !== 999 && r.daysSinceContact >= 14)).length;
  const stageCounts = Object.fromEntries(RECRUITING_JOURNEY.map((s) => [s, 0]));
  activeColleges.forEach((r: any) => {
    stageCounts[normalizeJourneyStage(r.status)]++;
  });
  const name = profile.data?.full_name?.split(" ")[0];
  const timezone = profile.data?.timezone || DEFAULT_TIMEZONE;
  const greeting = getGreetingForTimezone(timezone);
  const recent = interactionRows.slice(0, 6);
  const milestoneData = (milestoneRows.data || []).map((m: any) => ({
    ...m,
    stage: normalizeJourneyStage(m.metadata?.stage),
    date: m.metadata?.milestone_date || String(m.created_at).slice(0, 10),
    collegeId: m.metadata?.college_id,
    note: m.metadata?.note || "",
  }));
  const recentMilestones = milestoneData.slice(0, 4);
  const collegeMap = new Map(
    activeColleges.map((r: any) => [
      r.college_id,
      one(r.colleges)?.name || "School",
    ]),
  );
  return (
    <AppShell>
      <div className="w-full min-w-0 max-w-7xl mx-auto px-4 sm:px-5 md:px-8 py-5 sm:py-6">
        {sourceIssues.length > 0 && (
          <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
            Some information is temporarily unavailable:{" "}
            {sourceIssues.join(", ")}. Your Home is using the recruiting
            information that could be loaded.
          </div>
        )}
        <PageHeader
          title={`${greeting}${name ? `, ${name}` : ""}.`}
          subtitle="Here’s what matters today."
          action={preview.active ? undefined : <QuickAddMenu />}
        />
        <div className="grid xl:grid-cols-[minmax(0,1fr)_250px] gap-6 items-start"><div className="min-w-0">
        <section className="card w-full min-w-0 p-4 sm:p-5 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 min-w-0">
            <div className="min-w-0">
              <div className="rr-eyebrow">MY RECRUITING SNAPSHOT</div>
              <h2 className="text-xl sm:text-2xl font-black mt-1">
                Recruiting Snapshot
              </h2>
              <p className="muted text-sm mt-1">
                The numbers that help you see where things stand.
              </p>
            </div>
            <Link
              href={ph("/health")}
              className="rounded-xl border bg-slate-50 px-4 py-3 w-full min-w-0 lg:w-auto lg:min-w-[160px] block hover:bg-slate-100 transition-colors"
            >
              <div className="rr-metric-label">Recruiting Health</div>
              <div className="rr-metric-value !text-3xl">
                {intelligence.score}
              </div>
              <div className="text-sm font-black">{intelligence.health}</div>
              <div className="text-xs font-black mt-2 inline-flex items-center gap-1">
                See what affects it <ArrowRight size={12} />
              </div>
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 mt-5 min-w-0 rounded-xl border bg-slate-50/60 divide-x divide-y md:divide-y-0 overflow-hidden">
            <SnapshotMetric
              label="Active Schools"
              value={intelligence.activeSchools}
              href={ph("/connections")}
            />
            <SnapshotMetric
              label="Coach Relationships"
              value={intelligence.coachRelationships}
              href={ph("/connections")}
            />
            <SnapshotMetric
              label="Open Next Steps"
              value={intelligence.openNextMoves}
              href={ph("/game-plan#next-moves")}
            />
            <SnapshotMetric
              label="Upcoming Events"
              value={intelligence.upcomingEvents}
              href={ph("/events")}
            />
          </div>
          {intelligence.topPriority ? (
            <Link
              href={ph(
                intelligence.topPriority.href || "/game-plan#next-moves",
              )}
              className="mt-5 rr-priority-card p-4 sm:p-5 block rr-interactive-card min-w-0"
            >
              <div className="flex items-start gap-3 min-w-0">
                <div className="h-9 w-9 rounded-xl bg-white border border-red-200 flex items-center justify-center shrink-0">
                  <Target size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="rr-eyebrow !mb-1">DO THIS NEXT</div>
                  <div className="font-black text-lg mt-1">
                    {intelligence.topPriority.title}
                  </div>
                  <p className="text-sm mt-1">
                    {intelligence.topPriority.detail}
                  </p>
                  <div className="btn btn-red mt-4">
                    Do This Next <ArrowRight size={15} />
                  </div>
                </div>
              </div>
            </Link>
          ) : (
            <div className="mt-5 rounded-2xl border p-4">
              <div className="font-bold">
                Nothing urgent needs your attention right now.
              </div>
              <div className="muted text-sm mt-1">
                Keep working your current Next Steps and getting ready for
                upcoming opportunities.
              </div>
            </div>
          )}
        </section>
        {!fitProfile.data?.completed_at && (
          <section className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 sm:px-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3"><div className="flex-1 min-w-0">
              <div className="rr-eyebrow">COLLEGE FIT SURVEY</div><div className="font-black text-lg mt-1">Tell us what matters to you in a college.</div>
              <p className="text-sm text-slate-700 mt-1">Your answers help shape school discovery and other recommendations throughout your recruiting journey.</p>
            </div><Link href={ph("/fit-profile")} className="btn shrink-0">Complete College Fit Survey <ArrowRight size={15} /></Link></div>
          </section>
        )}
        </div><div className="hidden xl:block sticky top-5"><ReminderStickyBoard initial={reminders.data || []} athleteId={uid} editable={!preview.active}/></div></div><div className="xl:hidden card p-4 sm:p-5 mb-6"><ReminderStickyBoard initial={reminders.data || []} athleteId={uid} editable={!preview.active}/></div>
        <div className="mb-6 w-full min-w-0">
          <WeeklyRecruitingMomentum athleteId={preview.active ? uid : undefined} />
        </div>
        <div className="mt-6 w-full min-w-0">
          <HomeUpcomingEvents personalEvents={eventRows} />
        </div>
     </div>
    </AppShell>
  );
}
function SnapshotMetric({
  label,
  value,
  href,
}: {
  label: string;
  value: any;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="px-4 py-4 min-w-0 hover:bg-white transition-colors"
    >
      <div className="rr-metric-label break-words">{label}</div>
      <div className="rr-metric-value !text-xl">{value}</div>
      <div className="text-[11px] font-black mt-2">Review {label} →</div>
    </Link>
  );
}
function Empty({ text }: { text: string }) {
  return <div className="py-6 text-center muted text-sm">{text}</div>;
}
