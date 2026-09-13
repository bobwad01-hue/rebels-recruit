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
        "id,title,due_date,status,coach_id,college_id,colleges(id,name),college_coaches(id,first_name,last_name)",
      )
      .eq("athlete_user_id", uid)
      .in("status", ["open", "snoozed"])
      .order("due_date")
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
  const today = new Date().toISOString().slice(0, 10);
  const personalUpcoming = eventRows.filter(
    (e: any) =>
      e.date >= today &&
      e.date <= new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  );
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
  const offers = stageCounts["Offer"] || 0,
    committed = stageCounts["Committed"] || 0;
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
          subtitle="Here is your recruiting picture and what deserves your attention next."
          action={preview.active ? undefined : <QuickAddMenu />}
        />
        <section className="card w-full min-w-0 p-4 sm:p-5 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 min-w-0">
            <div className="min-w-0">
              <div className="rr-eyebrow">MY RECRUITING SNAPSHOT</div>
              <h2 className="text-xl sm:text-2xl font-black mt-1">
                Where you stand right now
              </h2>
              <p className="muted text-sm mt-1">
                Your current schools, coach relationships, recruiting activity,
                Next Steps and events all work together to keep this view
                current.
              </p>
            </div>
            <Link
              href={ph("/health")}
              className="rr-metric-card rr-interactive-card px-4 py-3 w-full min-w-0 lg:w-auto lg:min-w-[160px] block"
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5 min-w-0">
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
                    Go to this Next Step <ArrowRight size={15} />
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
          {intelligence.signals.length > 1 && (
            <div className="grid md:grid-cols-2 gap-3 mt-4 min-w-0">
              {intelligence.signals.slice(1, 3).map((s) => (
                <Link
                  key={s.id}
                  href={ph(s.href || "/game-plan")}
                  className="border rounded-xl p-3 hover:bg-slate-50 rr-interactive-card min-w-0"
                >
                  <div className="font-bold text-sm">{s.title}</div>
                  <div className="muted text-xs mt-1">{s.detail}</div>
                  <div className="text-xs font-black mt-2">Review this →</div>
                </Link>
              ))}
            </div>
          )}
          <div className="mt-4 text-xs muted flex items-start gap-1.5 min-w-0">
            <Clock3 size={13} className="shrink-0 mt-0.5" />
            <span>
              This snapshot updates as your recruiting activity and decisions
              change.
            </span>
          </div>
        </section>
        <div className="mb-6 w-full min-w-0">
          <WeeklyRecruitingMomentum
            athleteId={preview.active ? uid : undefined}
          />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 min-w-0">
          <Metric
            icon={<School size={18} />}
            label="Current Schools"
            value={activeColleges.length}
            detail="schools you are currently pursuing"
            href={ph("/connections")}
          />
          <Metric
            icon={<Users size={18} />}
            label="Active Coaches"
            value={activeCoaches.length}
            detail="coach relationships you are tracking"
            href={ph("/connections")}
          />
          <Metric
            icon={<Flag size={18} />}
            label={
              committed
                ? "Committed"
                : offers
                  ? "Active Offers"
                  : "Journey Progress"
            }
            value={
              committed ||
              offers ||
              stageCounts["Interested"] ||
              stageCounts["Engaged"] ||
              0
            }
            detail={
              committed
                ? "commitment recorded"
                : offers
                  ? "schools at Offer"
                  : "schools moving forward"
            }
            href={ph("/journey")}
          />
          <Metric
            icon={<CalendarDays size={18} />}
            label="My Added Events"
            value={personalUpcoming.length}
            detail="coming up in the next 30 days"
            href={ph("/events")}
          />
        </div>
        <div className="grid lg:grid-cols-3 gap-5 sm:gap-6 mt-6 min-w-0">
          <section className="card w-full min-w-0 p-4 sm:p-5 lg:col-span-2">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 min-w-0">
              <div className="min-w-0">
                <div className="rr-eyebrow">NEXT STEPS</div>
                <h2 className="font-black text-lg flex items-center gap-2">
                  <Sparkles size={19} className="shrink-0" />
                  What needs your attention
                </h2>
                <p className="muted text-sm mt-1">
                  Your reminders, advisor-assigned Next Steps and the most
                  useful recruiting actions to take next.
                </p>
              </div>
              <Link
                href={ph("/game-plan#next-moves")}
                className="text-sm font-bold whitespace-nowrap self-start"
              >
                Review All Next Steps →
              </Link>
            </div>
            <div className="mt-4 min-w-0">
              <SmartNextMoves
                moves={smartMoves.slice(0, 5)}
                hrefTransform={ph}
              />
            </div>
          </section>
          <section className="card w-full min-w-0 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3 min-w-0">
              <div className="min-w-0">
                <div className="rr-eyebrow">RECRUITING JOURNEY</div>
                <h2 className="font-black text-lg">
                  Where relationships stand
                </h2>
                <p className="muted text-sm">
                  {activeColleges.length} current schools
                </p>
              </div>
              <Flag size={19} className="shrink-0" />
            </div>
            <div className="mt-4 space-y-2">
              {RECRUITING_JOURNEY.filter((s) => stageCounts[s] > 0).map((s) => (
                <Link
                  href={ph("/journey")}
                  key={s}
                  className="flex items-center justify-between border rounded-xl px-3 py-2.5 hover:border-slate-400 rr-interactive-card"
                >
                  <span className="text-sm font-semibold">{s}</span>
                  <span className="flex items-center gap-2">
                    <b>{stageCounts[s]}</b>
                    <ArrowRight size={13} />
                  </span>
                </Link>
              ))}
              {!activeColleges.length && (
                <Empty text="Add schools to start your Recruiting Journey." />
              )}
            </div>
            <HomeTopTargets athleteId={preview.active ? uid : undefined} />
            <Link
              href={ph("/journey")}
              className="inline-flex items-center gap-1 text-sm font-bold mt-4"
            >
              Review Recruiting Journey <ArrowRight size={15} />
            </Link>
          </section>
        </div>
        {recentMilestones.length > 0 && (
          <section className="card w-full min-w-0 p-4 sm:p-5 mt-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 min-w-0">
              <div className="min-w-0">
                <div className="rr-eyebrow">PROGRESS</div>
                <h2 className="font-black text-lg flex items-center gap-2">
                  <Flag size={19} className="shrink-0" />
                  Recent Journey Milestones
                </h2>
                <p className="muted text-sm">
                  The latest movement in your recruiting relationships and
                  events.
                </p>
              </div>
              <Link
                href={ph("/journey")}
                className="text-sm font-bold whitespace-nowrap self-start"
              >
                Review Journey
              </Link>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4 min-w-0">
              {recentMilestones.map((m: any) => (
                <Link
                  href={ph(
                    m.collegeId ? `/colleges/${m.collegeId}` : "/journey",
                  )}
                  key={`${m.entity_id}-${m.date}-${m.stage}`}
                  className="border rounded-xl p-3 rr-interactive-card min-w-0"
                >
                  <div className="font-black text-sm">{m.stage}</div>
                  <div className="text-sm mt-1">
                    {collegeMap.get(m.collegeId) ||
                      m.note ||
                      "Recruiting milestone"}
                  </div>
                  <div className="muted text-xs mt-1">{fmt(m.date)}</div>
                  {m.note && collegeMap.get(m.collegeId) && (
                    <div className="muted text-xs mt-2 line-clamp-2">
                      {m.note}
                    </div>
                  )}
                  <div className="text-xs font-black mt-2">Review school →</div>
                </Link>
              ))}
            </div>
          </section>
        )}
        <div className="grid lg:grid-cols-2 gap-5 sm:gap-6 mt-6 min-w-0">
          <section className="card w-full min-w-0 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3 min-w-0">
              <div className="min-w-0">
                <div className="rr-eyebrow">RELATIONSHIPS</div>
                <h2 className="font-black text-lg">Coach Relationships</h2>
                <p className="muted text-sm">
                  Your strongest current coach relationships and which ones may
                  need a follow-up.
                </p>
              </div>
              <TrendingUp size={19} className="shrink-0" />
            </div>
            <div className="mt-4 divide-y min-w-0">
              {insights.slice(0, 5).map((r) => (
                <Link
                  key={r.id}
                  href={ph(
                    r.coachId ? `/coaches/${r.coachId}` : "/connections",
                  )}
                  className="py-3 flex items-center gap-3 min-w-0"
                >
                  <div className="flex-1 min-w-0">
                    <b className="text-sm">{r.coach}</b>
                    <div className="muted text-xs break-words">
                      {r.college} ·{" "}
                      {r.daysSinceContact === 999
                        ? "No contact recorded yet"
                        : `${r.daysSinceContact}d since contact`}
                    </div>
                  </div>
                  <span className="status-pill shrink-0">
                    {r.momentum === "Rising" ? (
                      <span className="inline-flex gap-1">
                        <TrendingUp size={13} />
                        Getting stronger
                      </span>
                    ) : r.momentum === "Cooling" ? (
                      <span className="inline-flex gap-1">
                        <TrendingDown size={13} />
                        Needs follow-up
                      </span>
                    ) : (
                      "Steady"
                    )}
                  </span>
                  <ArrowRight size={13} className="shrink-0" />
                </Link>
              ))}
              {!insights.length && (
                <Empty text="Log coach interactions to see how your relationships are developing." />
              )}
            </div>
          </section>
          <HomeUpcomingEvents personalEvents={eventRows} />
        </div>
        <section className="card w-full min-w-0 p-4 sm:p-5 mt-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 min-w-0">
            <div className="min-w-0">
              <div className="rr-eyebrow">RECENT ACTIVITY</div>
              <h2 className="font-black text-lg">What has happened recently</h2>
              <p className="muted text-sm">
                Your latest recruiting activity, including coach relationships,
                events and recruiting videos.
              </p>
            </div>
            <Link
              href={ph("/journey")}
              className="text-sm font-bold self-start"
            >
              Review Full Journey
            </Link>
          </div>
          <div className="mt-4 grid md:grid-cols-2 gap-3 min-w-0">
            {recent.map((i: any) => {
              const school = one(i.colleges)?.name;
              const displayNote = cleanDisplayNote(i.note);
              return (
                <Link
                  key={i.id}
                  href={ph(`/activity/${i.id}`)}
                  className="border rounded-xl p-4 flex gap-3 hover:bg-slate-50 rr-interactive-card min-w-0"
                >
                  <CheckCircle2 size={17} className="shrink-0" />
                  <div className="min-w-0">
                    <b className="text-sm">{i.type}</b>
                    <div className="muted text-xs mt-1 break-words">
                      {school || "General recruiting"} ·{" "}
                      {formatInteractionDateTime(
                        i.date,
                        i.created_at,
                        timezone,
                        i.date_precision,
                        i.date_year,
                        i.date_month,
                      )}
                    </div>
                    {displayNote && (
                      <div className="text-xs text-slate-600 mt-2 line-clamp-2">
                        {displayNote}
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
            {!recent.length && (
              <Empty text="Your recruiting timeline starts here." />
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
function Metric({
  icon,
  label,
  value,
  detail,
  href,
}: {
  icon: any;
  label: string;
  value: any;
  detail: string;
  href: string;
}) {
  return (
    <Link href={href} className="card p-3 sm:p-4 min-w-0 rr-interactive-card">
      <div className="flex items-center justify-between gap-2">
        <span className="muted text-xs min-w-0">{label}</span>
        {icon}
      </div>
      <div className="font-black text-2xl mt-2">{value}</div>
      <div className="muted text-xs mt-1">{detail}</div>
      <div className="text-xs font-black mt-2">Review {label} →</div>
    </Link>
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
      className="rr-metric-card rr-interactive-card px-3 py-3 min-w-0"
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
