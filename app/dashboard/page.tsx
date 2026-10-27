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
  Mail,
  MessageCircle,
  ChevronRight,
  BookOpen,
  HeartHandshake,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import CoachEmailAlerts from "@/components/CoachEmailAlerts";
import PageHeader from "@/components/PageHeader";
import SmartNextMoves, {
  buildSmartNextMoves,
} from "@/components/SmartNextMoves";
import HomeTopTargets from "@/components/HomeTopTargets";
import QuickAddMenu from "@/components/QuickAddMenu";
import RecruitingQuickComposer from "@/components/RecruitingQuickComposer";
import AthleteFirstRun from "@/components/AthleteFirstRun";
import PendingParentApprovals, { type PendingParentRequest } from "@/components/PendingParentApprovals";
import ReminderStickyBoard from "@/components/ReminderStickyBoard";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import {
  DEFAULT_TIMEZONE,
  formatInteractionDateTime,
  getGreetingForTimezone,
} from "@/lib/us-timezones";
import { buildRelationshipInsights } from "@/lib/communication-intelligence";
import { buildRecruitingIntelligence } from "@/lib/recruiting-intelligence";
import RecruitingHealthScore from "@/components/RecruitingHealthScore";
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
    eventDebriefs,
    invitations,
    milestoneRows,
    fitProfile,
    athleteProfile,
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
        "id,athlete_user_id,coach_id,college_id,type,note,date,date_precision,date_year,date_month,created_at,initiated_by,source",
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
      .select("full_name,timezone,profile_completed_at")
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
      .order("due_date")
      .limit(20),
    supabase
      .from("athlete_events")
      .select(
        "id,status,events(id,name,type,date,location,college_id,colleges(id,name))",
      )
      .eq("athlete_user_id", uid),
    supabase
      .from("event_debriefs")
      .select("event_id")
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
    supabase.from("athlete_profiles").select("class_year").eq("user_id", uid).maybeSingle(),
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
    athleteProfile.error && "athlete profile",
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
    .map((r: any) => ({ ...one(r.events), rsvp: r.status }))
    .filter((r: any) => r.id);
  const advisorIds = [
    ...new Set((invitations.data || []).map((i: any) => i.advisor_user_id)),
  ];
  const { data: advisorProfiles, error: advisorProfilesError } =
    advisorIds.length
      ? await admin
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
  const {data: targetRankRows} = await admin.from("audit_log").select("entity_id,metadata,created_at").eq("actor_user_id", uid).eq("entity_type","athlete_college_target_rank").order("created_at",{ascending:false});
  const targetRelationshipRanks: Record<string,number> = {};
  for (const row of targetRankRows || []) { if (targetRelationshipRanks[row.entity_id] == null) { const rank=Number((row.metadata as any)?.rank); if(Number.isFinite(rank)&&rank>0) targetRelationshipRanks[row.entity_id]=rank; } }
  const {data: incomingSenderRows} = await admin.from("gmail_recruiting_messages")
    .select("interaction_id,extracted_data")
    .eq("athlete_user_id", uid)
    .order("received_at", {ascending:false}).limit(100);
  const senderByInteraction = new Map((incomingSenderRows || []).filter((row:any) => row.interaction_id).map((row:any) => [row.interaction_id, row.extracted_data]));
  const smartMoveInteractions = interactionRows.map((row:any) => ({...row, gmailSender: senderByInteraction.get(row.id) || null}));
  const smartMoves = buildSmartNextMoves({
    tasks: tasks.data || [],
    coaches: activeCoaches,
    colleges: activeColleges,
    events: eventRows,
    interactions: smartMoveInteractions,
    debriefEventIds: (eventDebriefs.data || []).map((x: any) => x.event_id),
    advisorRequests,
    targetRelationshipRanks,
  });
  const intelligence = buildRecruitingIntelligence({
    colleges: activeColleges,
    coaches: activeCoaches,
    interactions: interactionRows,
    reminders: reminders.data || [],
    tasks: tasks.data || [],
    events: eventRows,
    healthProfile: { classYear: athleteProfile.data?.class_year || null, profileComplete: !!profile.data?.profile_completed_at, fitComplete: !!fitProfile.data?.completed_at },
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
  const classYear=Number(athleteProfile.data?.class_year||0);const yearsAway=classYear?classYear-new Date().getFullYear():null;const recruitingStage=yearsAway===null?'build':yearsAway>=4?'explore':yearsAway===3?'build':yearsAway===2?'recruit':'decide';const stageCopy={explore:{label:'Explore',title:'Build your foundation',detail:'Focus on learning what you want in a college, exploring schools, and building your first relationships.'},build:{label:'Build',title:'Build your recruiting list',detail:'Keep refining your school list, learning programs, attending events, and starting coach relationships.'},recruit:{label:'Recruit',title:'Work your relationships',detail:'Consistent communication, follow-up, events, and clear next steps matter most right now.'},decide:{label:'Decide',title:'Know where you stand',detail:'Focus on active relationships, visits, offers, deadlines, and the decisions ahead.'}}[recruitingStage];const name = profile.data?.full_name?.split(" ")[0];
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
  // Parent requests are private to the signed-in athlete. Never surface them
  // when an organization owner is previewing another athlete's dashboard.
  let pendingParentRequests: PendingParentRequest[] = [];
  let parentRequestError = false;
  if (!preview.active) {
    const { data: requests, error: requestError } = await supabase
      .from("parent_guardian_access")
      .select("id,parent_user_id,relationship_type")
      .eq("athlete_user_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    parentRequestError = !!requestError;
    if (requests?.length) {
      const { data: parents, error: parentsError } = await supabase
        .from("profiles")
        .select("id,full_name,email")
        .in("id", requests.map(row => row.parent_user_id));
      if (parentsError) parentRequestError = true;
      const names = new Map((parents || []).map(parent => [parent.id, parent]));
      pendingParentRequests = requests.map(row => {
        const parent = names.get(row.parent_user_id);
        return {
          id: row.id,
          parentName: parent?.full_name || "Parent / Guardian",
          parentEmail: parent?.email || "Email unavailable",
          relationship: row.relationship_type === "guardian" ? "guardian" : "parent",
        };
      });
    }
  }
  return (
    <AppShell>
      <div className="w-full min-w-0 max-w-[1540px] mx-auto px-4 sm:px-5 md:px-7 py-5 sm:py-7">
        {sourceIssues.length > 0 && (
          <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
            Some information is temporarily unavailable:{" "}
            {sourceIssues.join(", ")}. Your Home is using the recruiting
            information that could be loaded.
          </div>
        )}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div><h1 className="text-[clamp(1.7rem,2.5vw,2.3rem)] font-extrabold tracking-tight text-[#101936]">{greeting}{name ? `, ${name}` : ""} <span aria-hidden="true">👋</span></h1>
          <p className="mt-1 text-sm sm:text-base text-slate-500">Keep building your relationships. Every step forward counts.</p></div>
          {!preview.active && <QuickAddMenu />}
        </div>
        {!preview.active && <CoachEmailAlerts variant="home" />}
        {parentRequestError && !preview.active && <div role="alert" className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">Parent / Guardian requests could not be loaded. <Link href="/manage-access" className="underline">Review them in Manage Access</Link>.</div>}
        {pendingParentRequests.length > 0 && <PendingParentApprovals requests={pendingParentRequests} />}
        {!preview.active && <AthleteFirstRun athleteId={uid} fitComplete={!!fitProfile.data?.completed_at} hasSchools={intelligence.activeSchools > 0} />}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4 mb-4">
          {[
            {label:"Next Steps",value:smartMoves.length,sub:"Your recruiting priorities",href:"/game-plan#next-moves",icon:CheckCircle2,tone:"rose"},
            {label:"Coach Relationships",value:activeCoaches.length,sub:"Connections you're building",href:"/connections",icon:Users,tone:"green"},
            {label:"Upcoming Events",value:eventRows.filter((e:any)=>e.date && String(e.date).slice(0,10)>=new Date().toISOString().slice(0,10)).length,sub:"On your recruiting calendar",href:"/events",icon:CalendarDays,tone:"blue"},
            {label:"My Schools",value:activeColleges.length,sub:"Schools on your list",href:"/connections",icon:School,tone:"purple"},
          ].map((metric)=>(
            <Link key={metric.label} href={ph(metric.href)} className="group flex min-w-0 items-start gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_5px_22px_rgba(15,23,42,0.035)] transition hover:-translate-y-0.5 hover:shadow-md sm:p-5">
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${metric.tone==="rose"?"bg-rose-50 text-red-600":metric.tone==="green"?"bg-emerald-50 text-emerald-600":metric.tone==="blue"?"bg-blue-50 text-blue-600":"bg-violet-50 text-violet-600"}`}><metric.icon size={22}/></span>
              <span className="min-w-0 flex-1"><span className="block text-3xl font-extrabold tracking-tight text-[#101936]">{metric.value}</span><span className="mt-0.5 block text-sm font-bold text-[#101936]">{metric.label}</span><span className="mt-1 block text-xs leading-relaxed text-slate-500">{metric.sub}</span></span>
              <ChevronRight size={16} className="mt-7 hidden shrink-0 text-slate-400 group-hover:text-red-600 sm:block"/>
            </Link>
          ))}
        </div>
        <div className="grid items-start gap-4 lg:grid-cols-12">
          <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_5px_22px_rgba(15,23,42,0.035)] sm:p-5 lg:col-span-5">
            <div className="mb-3 flex items-center justify-between gap-2 border-b border-slate-100 pb-4"><h2 className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-[#101936]"><CheckCircle2 size={21}/>Your Next Steps</h2><Link href={ph("/game-plan#next-moves")} className="text-xs font-bold text-blue-600 hover:underline">View all</Link></div>
            <div className="divide-y divide-slate-100">
              {smartMoves.slice(0,5).map((move:any,i:number)=><Link key={i} href={ph(move.href||"/game-plan#next-moves")} className="group flex items-center gap-3 py-3.5 hover:bg-slate-50/60">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${i===0?"bg-rose-50 text-red-600":"bg-blue-50 text-blue-600"}`}><Target size={19}/></span>
                <span className="min-w-0 flex-1"><span className="block text-sm font-bold text-[#101936]">{move.title}</span><span className="mt-1 block line-clamp-2 text-xs leading-relaxed text-slate-500">{move.detail}</span></span><ChevronRight size={16} className="shrink-0 text-slate-400 group-hover:text-red-600"/>
              </Link>)}
              {!smartMoves.length&&<div className="py-6 text-sm text-slate-500">You're all caught up. Explore schools or start a new coach conversation.</div>}
            </div>
          </section>
          <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_5px_22px_rgba(15,23,42,0.035)] sm:p-5 lg:col-span-4">
            <div className="mb-3 flex items-center justify-between gap-2 border-b border-slate-100 pb-4"><h2 className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-[#101936]"><MessageCircle size={21}/>Recent Coach Activity</h2><Link href={ph("/activity")} className="text-xs font-bold text-blue-600 hover:underline">View all</Link></div>
            <div className="divide-y divide-slate-100">
              {recent.slice(0,5).map((item:any,i:number)=>{const school=one(item.colleges)?.name||collegeMap.get(item.college_id)||"Recruiting activity";const coach=one(item.college_coaches);return <Link key={item.id||i} href={ph("/activity")} className="group flex items-center gap-3 py-3.5 hover:bg-slate-50/60">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-bold ${["bg-violet-100 text-violet-700","bg-sky-100 text-sky-700","bg-emerald-100 text-emerald-700","bg-amber-100 text-amber-700"][i%4]}`}>{String(school).slice(0,2).toUpperCase()}</span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-[#101936]">{school}</span><span className="block truncate text-xs text-slate-500">{coach?[coach.first_name,coach.last_name].filter(Boolean).join(" "):"Coach interaction"}</span><span className="mt-0.5 block truncate text-xs text-slate-500">{cleanDisplayNote(item.note)||item.type||"Recruiting update"}</span></span><span className="shrink-0 text-[11px] text-slate-400">{fmt(item.date||item.created_at)}</span>
              </Link>})}
              {!recent.length&&<p className="py-6 text-sm text-slate-500">Your coach conversations will appear here as you connect.</p>}
            </div>
          </section>
          <div className="space-y-4 lg:col-span-3">
            <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_5px_22px_rgba(15,23,42,0.035)] sm:p-5">
              <h2 className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-[#101936]"><TrendingUp size={20}/>My Recruiting Journey</h2>
              <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Your current focus</p>
              <div className="mt-1 text-lg font-extrabold text-[#101936]">{stageCopy.title}</div>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">{stageCopy.detail}</p>
              <div className="mt-4 flex flex-wrap gap-1.5">{RECRUITING_JOURNEY.map((stage)=><span key={stage} className="rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">{stage}: {stageCounts[stage]}</span>)}</div>
              <Link href={ph("/game-plan")} className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-blue-600">View Game Plan <ArrowRight size={13}/></Link>
            </section>
            <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_5px_22px_rgba(15,23,42,0.035)] sm:p-5">
              <div className="flex items-center justify-between gap-2"><h2 className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-[#101936]"><School size={20}/>My Schools</h2><Link href={ph("/connections")} className="text-xs font-bold text-blue-600">View all</Link></div>
              <div className="mt-3 divide-y divide-slate-100">{activeColleges.slice(0,5).map((row:any)=><Link key={row.id} href={ph("/connections")} className="flex items-center justify-between gap-2 py-2.5 text-sm hover:text-red-600"><span className="min-w-0 truncate font-semibold">{one(row.colleges)?.name||"School"}</span><span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">{normalizeJourneyStage(row.status)}</span></Link>)}{!activeColleges.length&&<p className="py-4 text-xs text-slate-500">Your school list starts here.</p>}</div>
            </section>
          </div>
          <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_5px_22px_rgba(15,23,42,0.035)] sm:p-5 lg:col-span-4">
            <div className="flex items-center justify-between gap-2"><h2 className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-[#101936]"><CalendarDays size={20}/>Upcoming Events</h2><Link href={ph("/events")} className="text-xs font-bold text-blue-600">View all</Link></div>
            <div className="mt-3 divide-y divide-slate-100">{eventRows.filter((e:any)=>e.date&&String(e.date).slice(0,10)>=new Date().toISOString().slice(0,10)).sort((a:any,b:any)=>String(a.date).localeCompare(String(b.date))).slice(0,3).map((event:any)=><Link key={event.id} href={ph("/events")} className="flex items-center gap-3 py-3"><span className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-rose-50 text-xs font-extrabold text-red-600">{fmt(event.date)}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{event.name}</span><span className="block truncate text-xs text-slate-500">{event.location||event.type||"Event"}</span></span><ChevronRight size={15} className="text-slate-400"/></Link>)}{!eventRows.some((e:any)=>e.date&&String(e.date).slice(0,10)>=new Date().toISOString().slice(0,10))&&<p className="py-5 text-sm text-slate-500">No upcoming events yet.</p>}</div>
          </section>
          <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_5px_22px_rgba(15,23,42,0.035)] sm:p-5 lg:col-span-5">
            <div className="flex items-center justify-between gap-2"><h2 className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-[#101936]"><Target size={20}/>Your Recruiting Progress</h2><Link href={ph("/health")} className="text-xs font-bold text-blue-600">View details</Link></div>
            <div className="mt-5 flex flex-wrap items-center gap-5"><RecruitingHealthScore score={intelligence.score} health={intelligence.health} size="sm"/><div className="min-w-0 flex-1"><div className="text-sm font-bold text-[#101936]">Keep building momentum</div><p className="mt-1 text-xs leading-relaxed text-slate-500">Your recruiting health reflects the relationships and follow-through you can influence. See what to work on next.</p></div></div>
            {!fitProfile.data?.completed_at&&<Link href={ph("/fit-profile")} className="mt-4 flex items-center justify-between rounded-xl bg-blue-50 p-3 text-xs font-semibold text-blue-800">Complete your College Fit Survey <ArrowRight size={15}/></Link>}
          </section>
          <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_5px_22px_rgba(15,23,42,0.035)] sm:p-5 lg:col-span-3">
            <h2 className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-[#101936]"><BookOpen size={20}/>Helpful Tools</h2>
            <div className="mt-3 divide-y divide-slate-100">
              <Link href={ph("/game-plan")} className="flex items-center justify-between py-3 text-sm font-semibold">Your Game Plan <ChevronRight size={15}/></Link>
              <Link href={ph("/fit-profile")} className="flex items-center justify-between py-3 text-sm font-semibold">Find your college fit <ChevronRight size={15}/></Link>
              <Link href={ph("/connections")} className="flex items-center justify-between py-3 text-sm font-semibold">Manage school relationships <ChevronRight size={15}/></Link>
            </div>
          </section>
        </div>
        <div className="mt-5 mb-6"><ReminderStickyBoard initial={reminders.data||[]} athleteId={uid} editable={!preview.active}/></div>
        <div id="home-email-composer" className="w-full min-w-0 mb-6">{preview.active
          ? <div className="card p-5 text-sm text-slate-600">Compose Email is unavailable in read-only preview.</div>
          : <RecruitingQuickComposer/>}</div>
        </div><div className="hidden xl:block sticky top-5"><ReminderStickyBoard initial={reminders.data || []} athleteId={uid} editable={!preview.active}/></div></div>
        <div className="xl:hidden card p-4 sm:p-5 mb-6"><ReminderStickyBoard initial={reminders.data || []} athleteId={uid} editable={!preview.active}/></div>
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
      <div className="rr-metric-value !text-2xl">{value}</div>
      <div className="rr-metric-label break-words mt-1">{label}</div>
    </Link>
  );
}
function Empty({ text }: { text: string }) {
  return <div className="py-6 text-center muted text-sm">{text}</div>;
}
