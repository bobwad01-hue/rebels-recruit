"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Download,
  Search,
  ShieldCheck,
} from "lucide-react";
import { createClient } from "@/lib/supabase-browser";
import {
  RECRUITING_JOURNEY,
  normalizeJourneyStage,
} from "@/lib/recruiting-journey";
import { cleanDisplayNote } from "@/lib/display-notes";
import CoachCoverageExplorer from "./CoachCoverageExplorer";

type Tab =
  | "overview"
  | "players"
  | "colleges"
  | "coaches"
  | "activity"
  | "advisors"
  | "accounts";
const one = (v: any) => (Array.isArray(v) ? v[0] : v);
const exactDate = (a: any) =>
  a?.date_precision === "exact" && a?.date ? String(a.date) : "";
const displayDate = (a: any) =>
  a?.date_precision === "exact" && a?.date
    ? String(a.date)
    : a?.date_precision === "month"
      ? "Month known"
      : a?.date_precision === "year"
        ? "Year known"
        : "Date unknown";

export default function OrganizationCommandCenter() {
  const c = createClient();
  const [me, setMe] = useState<any>(null),
    [members, setMembers] = useState<any[]>([]),
    [accountMembers, setAccountMembers] = useState<any[]>([]),
    [accountOrganizations, setAccountOrganizations] = useState<any[]>([]),
    [accountTeams, setAccountTeams] = useState<any[]>([]),
    [accountTeamMembers, setAccountTeamMembers] = useState<any[]>([]),
    [accountAthletes, setAccountAthletes] = useState<any[]>([]),
    [profiles, setProfiles] = useState<any[]>([]),
    [colleges, setColleges] = useState<any[]>([]),
    [coaches, setCoaches] = useState<any[]>([]),
    [activity, setActivity] = useState<any[]>([]),
    [tasks, setTasks] = useState<any[]>([]),
    [reminders, setReminders] = useState<any[]>([]),
    [tab, setTab] = useState<Tab>("overview"),
    [q, setQ] = useState(""),
    [playerFilter, setPlayerFilter] = useState(""),
    [collegeFilter, setCollegeFilter] = useState(""),
    [coachFilter, setCoachFilter] = useState(""),
    [typeFilter, setTypeFilter] = useState(""),
    [dateFrom, setDateFrom] = useState(""),
    [dateTo, setDateTo] = useState(""),
    [accountQ, setAccountQ] = useState(""),
    [accountOrganization, setAccountOrganization] = useState(""),
    [accountTeam, setAccountTeam] = useState(""),
    [accountAge, setAccountAge] = useState(""),
    [msg, setMsg] = useState(""),
    [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState(""),
    [partialWarning, setPartialWarning] = useState(""),
    [activityAvailable, setActivityAvailable] = useState(true);
  async function load() {
    setLoading(true);
    setLoadError("");
    setPartialWarning("");
    setActivityAvailable(true);
    const {
      data: { user },
      error: authError,
    } = await c.auth.getUser();
    if (authError) {
      setLoadError(
        "We could not verify your account. Refresh the page and try again.",
      );
      setLoading(false);
      return;
    }
    if (!user) {
      setLoading(false);
      return;
    }
    const membershipResult = await c
      .from("organization_members")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(20);
    if (membershipResult.error) {
      setLoadError(
        "Organization access could not be loaded. Refresh the page and try again.",
      );
      setLoading(false);
      return;
    }
    const membershipRows = membershipResult.data || [];
    const m =
      membershipRows.find((x: any) => ["owner", "admin"].includes(x.role)) ||
      membershipRows.find((x: any) => x.organization_view_access) ||
      membershipRows[0];
    setMe(m);
    if (!m) {
      setLoading(false);
      return;
    }
    const memberResult = await c
      .from("organization_members")
      .select("*")
      .eq("organization_id", m.organization_id);
    if (memberResult.error) {
      setLoadError(
        "The organization roster could not be loaded. Refresh the page and try again.",
      );
      setLoading(false);
      return;
    }
    const ms = memberResult.data || [];
    setMembers(ms);
    const managedOrganizationIds = membershipRows
      .filter((x: any) => ["owner", "admin"].includes(x.role))
      .map((x: any) => x.organization_id);
    const managedIds = managedOrganizationIds.length
      ? managedOrganizationIds
      : [m.organization_id];
    const [organizationResult, accountMemberResult, teamResult] =
      await Promise.all([
        c
          .from("organizations")
          .select("id,name,brand_name,branch_name,city,state")
          .in("id", managedIds)
          .order("name"),
        c
          .from("organization_members")
          .select("*")
          .in("organization_id", managedIds),
        c
          .from("teams")
          .select("id,organization_id,name,age_group,archived_at")
          .in("organization_id", managedIds)
          .is("archived_at", null)
          .order("name"),
      ]);
    const accountMs = accountMemberResult.data || ms;
    const teamRows = teamResult.data || [];
    setAccountMembers(accountMs);
    setAccountOrganizations(organizationResult.data || []);
    setAccountTeams(teamRows);
    const accountUserIds = [...new Set(accountMs.map((x: any) => x.user_id))];
    const accountAthleteIds = accountMs
      .filter((x: any) => x.role === "athlete")
      .map((x: any) => x.user_id);
    const [teamMemberResult, athleteResult] = await Promise.all([
      teamRows.length
        ? c
            .from("team_members")
            .select("team_id,user_id")
            .in(
              "team_id",
              teamRows.map((x: any) => x.id),
            )
        : Promise.resolve({ data: [] as any[], error: null }),
      accountAthleteIds.length
        ? c
            .from("athlete_profiles")
            .select("user_id,primary_organization_id,primary_team_id")
            .in("user_id", accountAthleteIds)
        : Promise.resolve({ data: [] as any[], error: null }),
    ]);
    setAccountTeamMembers(teamMemberResult.data || []);
    setAccountAthletes(athleteResult.data || []);
    const ids = accountUserIds.length
      ? accountUserIds
      : ms.map((x: any) => x.user_id);
    const profileResult = ids.length
      ? await c
          .from("profiles")
          .select("id,full_name,email,app_role,advisor_type,created_at")
          .in("id", ids)
      : { data: [] as any[], error: null };
    const warnings: string[] = [];
    if (
      organizationResult.error ||
      accountMemberResult.error ||
      teamResult.error
    )
      warnings.push("some account filters");
    if (teamMemberResult.error || athleteResult.error)
      warnings.push("some team assignments");
    if ((profileResult as any).error)
      warnings.push("some player and staff names");
    setProfiles((profileResult as any).data || []);
    const athleteIds = ms
      .filter((x: any) => x.role === "athlete" && x.status === "active")
      .map((x: any) => x.user_id);
    if (!athleteIds.length) {
      setColleges([]);
      setCoaches([]);
      setActivity([]);
      setTasks([]);
      setReminders([]);
      if (warnings.length)
        setPartialWarning(
          "Some information is temporarily unavailable: " +
            warnings.join(", ") +
            ".",
        );
      setLoading(false);
      return;
    }
    const [ac, co, ints, ts, rs] = await Promise.all([
      c
        .from("athlete_colleges")
        .select(
          "id,athlete_user_id,status,fit_rating,college_id,colleges(id,name,division,state,conference)",
        )
        .in("athlete_user_id", athleteIds),
      c
        .from("athlete_coaches")
        .select(
          "id,athlete_user_id,coach_id,college_id,last_contact_date,next_step,colleges(id,name),college_coaches(id,first_name,last_name,title,email)",
        )
        .in("athlete_user_id", athleteIds),
      c.rpc("get_staff_recruiting_activity", {
        target_organization_id: m.organization_id,
        max_rows: 2000,
      }),
      c
        .from("advisor_tasks")
        .select("id,athlete_user_id,created_by_user_id,status,due_date,title")
        .in("athlete_user_id", athleteIds),
      c
        .from("reminders")
        .select("id,athlete_user_id,status,due_date,title")
        .in("athlete_user_id", athleteIds),
    ]);
    const take = (result: any, label: string) => {
      if (result.error) {
        warnings.push(label);
        return [];
      }
      return result.data || [];
    };
    setColleges(take(ac, "school relationships"));
    setCoaches(take(co, "coach relationships"));
    if (ints.error) {
      setActivity([]);
      setActivityAvailable(false);
      warnings.push("recruiting activity");
    } else {
      const rows = ints.data || [];
      setActivity(rows);
      if (rows.length === 2000)
        warnings.push(
          "older recruiting activity beyond the 2,000 most recent records",
        );
    }
    setTasks(take(ts, "assigned Next Steps"));
    setReminders(take(rs, "follow-ups"));
    if (warnings.length)
      setPartialWarning(
        "Some information is temporarily unavailable: " +
          warnings.join(", ") +
          ". The command center is using the information that could be loaded.",
      );
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);
  const pm = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);
  const accountOrganizationMap = useMemo(
    () => new Map(accountOrganizations.map((o) => [o.id, o])),
    [accountOrganizations],
  );
  const accountTeamMap = useMemo(
    () => new Map(accountTeams.map((t) => [t.id, t])),
    [accountTeams],
  );
  const accountTeamsByUser = useMemo(() => {
    const result = new Map<string, Set<string>>();
    const add = (userId: string, teamId: string) => {
      if (!userId || !teamId) return;
      if (!result.has(userId)) result.set(userId, new Set());
      result.get(userId)!.add(teamId);
    };
    for (const row of accountTeamMembers) add(row.user_id, row.team_id);
    for (const row of accountAthletes) add(row.user_id, row.primary_team_id);
    return result;
  }, [accountTeamMembers, accountAthletes]);
  const filteredAccountTeams = accountTeams.filter(
    (team) =>
      !accountOrganization || team.organization_id === accountOrganization,
  );
  const filteredAccounts = useMemo(
    () =>
      accountMembers.filter((member) => {
        const profile: any = pm.get(member.user_id) || {};
        const organization: any = accountOrganizationMap.get(
          member.organization_id,
        );
        const teamIds = [...(accountTeamsByUser.get(member.user_id) || [])];
        const teams = teamIds
          .map((id) => accountTeamMap.get(id))
          .filter(
            (team: any) =>
              team && team.organization_id === member.organization_id,
          ) as any[];
        const organizationName = organization?.name || "Organization";
        const haystack = [
          profile.full_name,
          profile.email,
          member.role,
          member.status,
          organizationName,
          organization?.branch_name,
          ...teams.flatMap((team) => [team.name, team.age_group]),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return (
          (!accountQ || haystack.includes(accountQ.trim().toLowerCase())) &&
          (!accountOrganization ||
            member.organization_id === accountOrganization) &&
          (!accountTeam || teams.some((team) => team.id === accountTeam)) &&
          (!accountAge || teams.some((team) => team.age_group === accountAge))
        );
      }),
    [
      accountMembers,
      accountQ,
      accountOrganization,
      accountTeam,
      accountAge,
      accountOrganizationMap,
      accountTeamMap,
      accountTeamsByUser,
      pm,
    ],
  );
  const athletes = members.filter(
    (m) => m.role === "athlete" && m.status === "active",
  );
  const advisors = members.filter((m) =>
    ["advisor", "admin", "owner"].includes(m.role),
  );
  const today = new Date().toISOString().slice(0, 10);
  const lastByPlayer = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of activity) {
      const d = exactDate(a);
      if (!d) continue;
      const old = map.get(a.athlete_user_id);
      if (!old || d > old) map.set(a.athlete_user_id, d);
    }
    return map;
  }, [activity]);
  const stale = activityAvailable
    ? athletes.filter((a) => {
        const d = lastByPlayer.get(a.user_id);
        return (
          !d ||
          (Date.now() - new Date(`${d}T12:00:00`).getTime()) / 86400000 > 14
        );
      })
    : [];
  const overdue = reminders.filter(
    (r) =>
      ["open", "overdue"].includes(r.status) &&
      r.due_date &&
      r.due_date < today,
  );
  const openTasks = tasks.filter((t) => t.status !== "completed");
  const noCoach = athletes.filter(
    (a) => !coaches.some((c) => c.athlete_user_id === a.user_id),
  );
  const filteredActivity = useMemo(
    () =>
      activity.filter((a) => {
        const player = (pm.get(a.athlete_user_id) as any)?.full_name || "";
        const college = one(a.colleges)?.name || "";
        const ch = one(a.college_coaches);
        const coach = [ch?.first_name, ch?.last_name].filter(Boolean).join(" ");
        const hay =
          `${player} ${college} ${coach} ${a.type || ""} ${cleanDisplayNote(a.note) || ""}`.toLowerCase();
        const d = exactDate(a);
        return (
          (!q || hay.includes(q.toLowerCase())) &&
          (!playerFilter || a.athlete_user_id === playerFilter) &&
          (!collegeFilter || a.college_id === collegeFilter) &&
          (!coachFilter || a.coach_id === coachFilter) &&
          (!typeFilter || a.type === typeFilter) &&
          (!dateFrom || (!!d && d >= dateFrom)) &&
          (!dateTo || (!!d && d <= dateTo))
        );
      }),
    [
      activity,
      q,
      playerFilter,
      collegeFilter,
      coachFilter,
      typeFilter,
      dateFrom,
      dateTo,
      pm,
    ],
  );
  function csv(name: string, rows: any[]) {
    if (!rows.length) return;
    const keys = Object.keys(rows[0]);
    const esc = (v: any) => `"${String(v ?? "").replaceAll('"', '""')}"`;
    const text = [
      keys.join(","),
      ...rows.map((r) => keys.map((k) => esc(r[k])).join(",")),
    ].join("\n");
    const blob = new Blob([text], { type: "text/csv" }),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }
  async function orgAccess(userId: string, on: boolean) {
    setMsg("");
    const { error } = await c.rpc("set_organization_view_access", {
      target_user: userId,
      enabled: on,
    });
    setMsg(
      error
        ? error.message
        : `Organization access ${on ? "granted" : "removed"}.`,
    );
    if (!error) await load();
  }
  async function suspend(organizationId: string, userId: string, on: boolean) {
    setMsg("");
    const { error } = await c.rpc("set_organization_member_suspended", {
      target_user: userId,
      target_organization: organizationId,
      suspend: on,
    });
    setMsg(
      error ? error.message : on ? "Account suspended." : "Account restored.",
    );
    if (!error) await load();
  }
  async function remove(organizationId: string, userId: string, name: string) {
    if (
      !confirm(`Permanently delete ${name}'s account? This cannot be undone.`)
    )
      return;
    const { error } = await c.rpc("delete_organization_account", {
      target_user: userId,
      target_organization: organizationId,
    });
    setMsg(error ? error.message : "Account permanently deleted.");
    if (!error) await load();
  }
  if (loading)
    return (
      <div className="card p-10 text-center muted">Loading organization...</div>
    );
  if (loadError)
    return (
      <div role="alert" className="card p-6 border-red-200 bg-red-50">
        <div className="font-black">
          Organization information is temporarily unavailable
        </div>
        <p className="text-sm mt-2 text-red-700">{loadError}</p>
        <button className="btn mt-4" onClick={load}>
          Try Again
        </button>
      </div>
    );
  if (
    !me ||
    !(me.role === "owner" || me.role === "admin" || me.organization_view_access)
  )
    return (
      <div className="card p-8">
        <h2 className="font-black text-xl">Organization access required</h2>
        <p className="muted mt-2">
          Your organization Owner or Admin must grant Organization View access.
        </p>
      </div>
    );
  const superAdmin = ["owner", "admin"].includes(me.role);
  const tabs: Tab[] = superAdmin
    ? [
        "overview",
        "players",
        "colleges",
        "coaches",
        "activity",
        "advisors",
        "accounts",
      ]
    : ["overview", "players", "colleges", "coaches", "activity", "advisors"];
  const stageCount = (s: string) =>
    colleges.filter((x) => normalizeJourneyStage(x.status) === s).length;
  const metric = (label: string, value: any, dest: Tab) => (
    <button
      type="button"
      onClick={() => setTab(dest)}
      className="rr-metric-card p-3 sm:p-4 text-left group hover:border-slate-400 hover:bg-white transition"
    >
      <div className="flex justify-between gap-2">
        <div className="rr-metric-label">{label}</div>
        <ArrowRight size={14} className="opacity-40 group-hover:opacity-100" />
      </div>
      <div className="rr-metric-value">{value}</div>
    </button>
  );
  const tabLabel = (t: Tab) =>
    t === "colleges" ? "Schools" : t.charAt(0).toUpperCase() + t.slice(1);
  return (
    <>
      {partialWarning && (
        <div
          role="status"
          className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold"
        >
          {partialWarning}
        </div>
      )}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-5 -mx-1 px-1">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`min-h-11 sm:min-h-0 px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap ${tab === t ? "bg-slate-900 text-white" : "bg-white border hover:border-slate-400"}`}
          >
            {tabLabel(t)}
          </button>
        ))}
      </div>
      {msg && (
        <div className="mb-4 rounded-xl border bg-white p-3 text-sm font-semibold">
          {msg}
        </div>
      )}
      {tab === "overview" && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {metric("Players", athletes.length, "players")}
            {metric(
              "Schools",
              new Set(colleges.map((x) => x.college_id)).size,
              "colleges",
            )}
            {metric(
              "Coaches",
              new Set(coaches.map((x) => x.coach_id)).size,
              "coaches",
            )}
            {metric(
              "Recorded Activity",
              activityAvailable ? activity.length : "—",
              "activity",
            )}
            {metric("Open Next Steps", openTasks.length, "players")}
            {metric("Overdue", overdue.length, "players")}
            {metric(
              "Need Follow-Up",
              activityAvailable ? stale.length : "—",
              "players",
            )}
            {metric("Advisors / Staff", advisors.length, "advisors")}
            {metric("Commitments", stageCount("Committed"), "colleges")}
            {metric(
              "Open Follow-Ups",
              reminders.filter((x) =>
                ["open", "overdue", "snoozed"].includes(x.status),
              ).length,
              "players",
            )}
          </div>
          <div className="grid lg:grid-cols-2 gap-5 sm:gap-6 mt-6">
            <section className="card p-4 sm:p-5">
              <div className="rr-eyebrow">PRIORITY</div>
              <h2 className="rr-section-title flex items-center gap-2">
                <AlertTriangle size={20} />
                Where Staff Should Focus
              </h2>
              <p className="rr-section-subtitle">
                These are the clearest places where staff support may help. Open
                an item to review the player or work behind it before deciding
                what to do.
              </p>
              <div className="mt-4 space-y-2">
                <button
                  className="w-full text-left border rounded-xl p-3 hover:bg-slate-50 flex justify-between gap-3"
                  onClick={() => setTab("players")}
                >
                  <span>
                    <b>{stale.length}</b> players may need relationship
                    follow-up
                  </span>
                  <ArrowRight size={16} />
                </button>
                <Link
                  href="/advisors/tasks?status=overdue"
                  className="w-full border rounded-xl p-3 hover:bg-slate-50 flex justify-between gap-3"
                >
                  <span>
                    <b>{overdue.length}</b> overdue follow-ups
                  </span>
                  <ArrowRight size={16} />
                </Link>
                <button
                  className="w-full text-left border rounded-xl p-3 hover:bg-slate-50 flex justify-between gap-3"
                  onClick={() => setTab("players")}
                >
                  <span>
                    <b>{noCoach.length}</b> players have no coach relationships
                    yet
                  </span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </section>
            <section className="card p-4 sm:p-5">
              <div className="rr-eyebrow">RECRUITING JOURNEY</div>
              <h2 className="rr-section-title">Where Relationships Stand</h2>
              <p className="rr-section-subtitle">
                See how many school relationships are at each Journey stage.
                Open a stage to review the relationships behind it.
              </p>
              <div className="mt-4 space-y-2">
                {RECRUITING_JOURNEY.map((s) => (
                  <Link
                    href={`/advisors/colleges?stage=${encodeURIComponent(s)}`}
                    className="flex justify-between items-center text-sm rounded-lg px-2 py-1.5 hover:bg-slate-50 group"
                    key={s}
                  >
                    <span>{s}</span>
                    <span className="flex items-center gap-2">
                      <b>{stageCount(s)}</b>
                      <ArrowRight
                        size={13}
                        className="opacity-40 group-hover:opacity-100"
                      />
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          </div>
          <section className="card p-4 sm:p-5 mt-6">
            <div className="flex justify-between gap-3">
              <div>
                <div className="rr-eyebrow">RECENT</div>
                <h2 className="rr-section-title flex items-center gap-2">
                  <Activity size={20} />
                  Organization Activity
                </h2>
                <p className="rr-section-subtitle">
                  Recent recruiting activity recorded across your players.
                </p>
              </div>
              <button
                className="font-bold text-sm"
                onClick={() => setTab("activity")}
              >
                Review All Activity
              </button>
            </div>
            {activityAvailable ? (
              <ActivityRows rows={activity.slice(0, 12)} pm={pm} />
            ) : (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 mt-4 text-sm font-semibold">
                Recruiting activity is temporarily unavailable, so recent
                activity and follow-up signals are not being shown as zero.
              </div>
            )}
          </section>
        </>
      )}
      {tab === "players" && (
        <section className="card p-4 sm:p-5">
          <Header
            eyebrow="PLAYER SUPPORT"
            title="Players"
            onExport={() =>
              csv(
                "organization-players.csv",
                athletes.map((a) => {
                  const p: any = pm.get(a.user_id) || {};
                  return {
                    name: p.full_name,
                    email: p.email,
                    schools: colleges.filter(
                      (x) => x.athlete_user_id === a.user_id,
                    ).length,
                    coaches: coaches.filter(
                      (x) => x.athlete_user_id === a.user_id,
                    ).length,
                    recorded_activity: activity.filter(
                      (x) => x.athlete_user_id === a.user_id,
                    ).length,
                    last_recorded_activity: lastByPlayer.get(a.user_id) || "",
                  };
                }),
              )
            }
          />
          <p className="rr-section-subtitle mt-1">
            Open a player to understand their recruiting picture, what may need
            attention and where staff can help.
          </p>
          <div className="mt-4 divide-y">
            {athletes.map((a) => {
              const p: any = pm.get(a.user_id) || {};
              return (
                <Link
                  href={`/players/${a.user_id}`}
                  key={a.user_id}
                  className="block py-3 hover:bg-slate-50 px-2 -mx-2 rounded-lg"
                >
                  <div className="flex justify-between gap-3">
                    <div>
                      <b>{p.full_name || "Player"}</b>
                      <div className="muted text-xs mt-1">
                        {
                          colleges.filter(
                            (x) => x.athlete_user_id === a.user_id,
                          ).length
                        }{" "}
                        schools ·{" "}
                        {
                          coaches.filter((x) => x.athlete_user_id === a.user_id)
                            .length
                        }{" "}
                        coaches ·{" "}
                        {
                          activity.filter(
                            (x) => x.athlete_user_id === a.user_id,
                          ).length
                        }{" "}
                        recorded activities · Last recorded activity{" "}
                        {lastByPlayer.get(a.user_id) || "None"}
                      </div>
                    </div>
                    <ArrowRight size={16} />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
      {tab === "colleges" && (
        <RelationshipBreakdown
          kind="college"
          rows={colleges}
          activity={activity}
          pm={pm}
          csv={csv}
        />
      )}{" "}
      {tab === "coaches" && (
        <CoachCoverageExplorer
          rows={coaches}
          activity={activity}
          pm={pm}
          csv={csv}
        />
      )}
      {tab === "activity" && (
        <section className="card p-4 sm:p-5">
          <Header
            eyebrow="RECRUITING ACTIVITY"
            title="Organization Activity"
            onExport={() =>
              csv(
                "organization-activity.csv",
                filteredActivity.map((a) => ({
                  player: (pm.get(a.athlete_user_id) as any)?.full_name,
                  type: a.type,
                  school: one(a.colleges)?.name,
                  coach:
                    `${one(a.college_coaches)?.first_name || ""} ${one(a.college_coaches)?.last_name || ""}`.trim(),
                  date: displayDate(a),
                  note: cleanDisplayNote(a.note) || "",
                })),
              )
            }
          />
          <p className="rr-section-subtitle mt-1">
            Review what players have recorded across their school and coach
            relationships.
          </p>
          <div className="grid md:grid-cols-3 gap-2 mt-4">
            <input
              className="input"
              placeholder="Search player, school or coach"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <select
              className="input"
              value={playerFilter}
              onChange={(e) => setPlayerFilter(e.target.value)}
            >
              <option value="">All players</option>
              {athletes.map((a) => (
                <option value={a.user_id} key={a.user_id}>
                  {(pm.get(a.user_id) as any)?.full_name}
                </option>
              ))}
            </select>
            <select
              className="input"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="">All activity types</option>
              {[...new Set(activity.map((a) => a.type).filter(Boolean))].map(
                (x) => (
                  <option key={x}>{x}</option>
                ),
              )}
            </select>
            <select
              className="input"
              value={collegeFilter}
              onChange={(e) => setCollegeFilter(e.target.value)}
            >
              <option value="">All schools</option>
              {[
                ...new Map(
                  colleges.map((x) => [x.college_id, one(x.colleges)?.name]),
                ).entries(),
              ].map(([id, n]) => (
                <option value={id} key={id}>
                  {n}
                </option>
              ))}
            </select>
            <select
              className="input"
              value={coachFilter}
              onChange={(e) => setCoachFilter(e.target.value)}
            >
              <option value="">All coaches</option>
              {[
                ...new Map(
                  coaches.map((x) => {
                    const z = one(x.college_coaches);
                    return [
                      x.coach_id,
                      `${z?.first_name || ""} ${z?.last_name || ""}`.trim(),
                    ];
                  }),
                ).entries(),
              ].map(([id, n]) => (
                <option value={id} key={id}>
                  {n}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 min-w-0">
              <input
                type="date"
                aria-label="Activity start date"
                className="input min-w-0 w-full"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
              <input
                type="date"
                aria-label="Activity end date"
                className="input min-w-0 w-full"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              className="btn"
              onClick={() => {
                setQ("");
                setPlayerFilter("");
                setCollegeFilter("");
                setCoachFilter("");
                setTypeFilter("");
                setDateFrom("");
                setDateTo("");
              }}
            >
              Clear Filters
            </button>
          </div>
          <ActivityRows rows={filteredActivity} pm={pm} />
        </section>
      )}
      {tab === "advisors" && (
        <section className="card p-4 sm:p-5">
          <Header
            eyebrow="STAFF SUPPORT"
            title="Advisors & Staff"
            onExport={() =>
              csv(
                "organization-advisors.csv",
                advisors.map((a) => {
                  const p: any = pm.get(a.user_id) || {};
                  return {
                    name: p.full_name,
                    email: p.email,
                    role: a.role,
                    organization_view_access: a.organization_view_access
                      ? "Yes"
                      : "No",
                    status: a.status,
                  };
                }),
              )
            }
          />
          <p className="rr-section-subtitle mt-1">
            Review who can support players and who has organization-wide
            visibility.
          </p>
          <div className="mt-4 divide-y">
            {advisors.map((a) => {
              const p: any = pm.get(a.user_id) || {};
              return (
                <div
                  className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                  key={a.id}
                >
                  <div>
                    <b>{p.full_name || p.email}</b>
                    <div className="muted text-xs">
                      {a.role} · {a.status}
                    </div>
                  </div>
                  {superAdmin && !["owner", "admin"].includes(a.role) && (
                    <button
                      className="btn"
                      onClick={() =>
                        orgAccess(a.user_id, !a.organization_view_access)
                      }
                    >
                      {a.organization_view_access
                        ? "Remove Organization View"
                        : "Grant Organization View"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
      {tab === "accounts" && superAdmin && (
        <section className="card p-4 sm:p-5">
          <div className="rr-eyebrow">ADMINISTRATION</div>
          <h2 className="rr-section-title flex items-center gap-2">
            <ShieldCheck size={20} />
            Account Management
          </h2>
          <p className="rr-section-subtitle">
            Suspend, restore or permanently delete organization accounts. The
            only active Owner is protected.
          </p>
          <div className="rr-filter-bar mt-5">
            <label className="block min-w-0">
              <span className="text-xs font-bold text-slate-600">Search</span>
              <div className="relative mt-1">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  className="input pl-9"
                  placeholder="Name or email"
                  value={accountQ}
                  onChange={(event) => setAccountQ(event.target.value)}
                />
              </div>
            </label>
            <label className="block min-w-0">
              <span className="text-xs font-bold text-slate-600">
                Organization
              </span>
              <select
                className="input mt-1"
                value={accountOrganization}
                onChange={(event) => {
                  setAccountOrganization(event.target.value);
                  setAccountTeam("");
                }}
              >
                <option value="">Show all organizations</option>
                {accountOrganizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                    {organization.branch_name
                      ? ` · ${organization.branch_name}`
                      : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="block min-w-0">
              <span className="text-xs font-bold text-slate-600">Team</span>
              <select
                className="input mt-1"
                value={accountTeam}
                onChange={(event) => setAccountTeam(event.target.value)}
              >
                <option value="">Show all teams</option>
                {filteredAccountTeams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block min-w-0">
              <span className="text-xs font-bold text-slate-600">
                Age group
              </span>
              <select
                className="input mt-1"
                value={accountAge}
                onChange={(event) => setAccountAge(event.target.value)}
              >
                <option value="">Show all age groups</option>
                {["12U", "14U", "16U", "18U", "HS"].map((age) => (
                  <option key={age} value={age}>
                    {age}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm font-semibold text-slate-600">
              Showing {filteredAccounts.length} of {accountMembers.length}{" "}
              accounts
            </div>
            {(accountQ || accountOrganization || accountTeam || accountAge) && (
              <button
                className="btn py-2 text-xs"
                onClick={() => {
                  setAccountQ("");
                  setAccountOrganization("");
                  setAccountTeam("");
                  setAccountAge("");
                }}
              >
                Clear Filters
              </button>
            )}
          </div>
          <div className="mt-4 divide-y">
            {filteredAccounts.map((m) => {
              const p: any = pm.get(m.user_id) || {};
              const organization: any = accountOrganizationMap.get(
                m.organization_id,
              );
              const memberTeams = [...(accountTeamsByUser.get(m.user_id) || [])]
                .map((id) => accountTeamMap.get(id))
                .filter(
                  (team: any) =>
                    team && team.organization_id === m.organization_id,
                ) as any[];
              const activeOwnerCount = accountMembers.filter(
                (member) =>
                  member.organization_id === m.organization_id &&
                  member.role === "owner" &&
                  member.status === "active",
              ).length;
              const soleOwner =
                m.role === "owner" &&
                m.status === "active" &&
                activeOwnerCount === 1;
              return (
                <div
                  key={m.id}
                  className="py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                >
                  <div>
                    <b>{p.full_name || p.email || m.user_id}</b>
                    <div className="text-sm text-slate-600 break-all">
                      {p.email || "No email address on file"}
                    </div>
                    <div className="muted text-xs mt-1">
                      {m.role} · {m.status}
                      {soleOwner ? " · Protected Owner" : ""}
                    </div>
                    <div className="muted text-xs mt-1">
                      {organization?.name || "Organization not listed"}
                      {organization?.branch_name
                        ? ` · ${organization.branch_name}`
                        : ""}
                      {memberTeams.length
                        ? ` · ${memberTeams
                            .map((team) =>
                              [team.name, team.age_group]
                                .filter(Boolean)
                                .join(" · "),
                            )
                            .join(", ")}`
                        : " · No team assigned"}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {soleOwner ? (
                      <span className="text-xs font-bold px-3 py-2 rounded-lg bg-slate-100">
                        Protected
                      </span>
                    ) : (
                      <>
                        <button
                          className="btn"
                          onClick={() =>
                            suspend(
                              m.organization_id,
                              m.user_id,
                              m.status === "active",
                            )
                          }
                        >
                          {m.status === "suspended" ? "Restore" : "Suspend"}
                        </button>
                        <button
                          className="btn border-red-300 text-red-700"
                          onClick={() =>
                            remove(
                              m.organization_id,
                              m.user_id,
                              p.full_name || p.email || "this user",
                            )
                          }
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
            {!filteredAccounts.length && (
              <div className="py-10 text-center">
                <div className="font-black">
                  No accounts match these filters.
                </div>
                <p className="muted text-sm mt-1">
                  Clear a filter or try a different name or email address.
                </p>
              </div>
            )}
          </div>
        </section>
      )}
    </>
  );
}
function Header({
  eyebrow,
  title,
  onExport,
}: {
  eyebrow: string;
  title: string;
  onExport: () => void;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
      <div>
        <div className="rr-eyebrow">{eyebrow}</div>
        <h2 className="rr-section-title">{title}</h2>
      </div>
      <button className="btn self-start" onClick={onExport}>
        <Download size={16} />
        Export CSV
      </button>
    </div>
  );
}
function ActivityRows({ rows, pm }: { rows: any[]; pm: Map<any, any> }) {
  return (
    <div className="mt-4 divide-y">
      {rows.map((a) => {
        const p: any = pm.get(a.athlete_user_id) || {},
          co = one(a.colleges),
          ch = one(a.college_coaches);
        return (
          <div key={a.id} className="py-3">
            <div className="flex flex-wrap gap-x-2 gap-y-1 items-center">
              <Link
                className="font-black hover:text-red-700 hover:underline"
                href={`/players/${a.athlete_user_id}`}
              >
                {p.full_name || "Player"}
              </Link>
              <span className="muted">·</span>
              <span className="font-semibold">{a.type}</span>
              {co?.id && (
                <>
                  <span className="muted">·</span>
                  <Link
                    className="hover:text-red-700 hover:underline"
                    href={`/colleges/${co.id}?athlete=${a.athlete_user_id}`}
                  >
                    {co.name}
                  </Link>
                </>
              )}
              {ch?.id && (
                <>
                  <span className="muted">·</span>
                  <Link
                    className="hover:text-red-700 hover:underline"
                    href={`/coaches/${ch.id}?athlete=${a.athlete_user_id}`}
                  >
                    {ch.first_name} {ch.last_name}
                  </Link>
                </>
              )}
            </div>
            <div className="muted text-xs mt-1">
              {displayDate(a)}
              {cleanDisplayNote(a.note) ? ` · ${cleanDisplayNote(a.note)}` : ""}
            </div>
          </div>
        );
      })}
      {!rows.length && (
        <div className="rr-empty-state py-8">
          <div className="font-black">No activity matches this view.</div>
          <p>Change the filters to review other recruiting activity.</p>
        </div>
      )}
    </div>
  );
}
function RelationshipBreakdown({
  kind,
  rows,
  activity,
  pm,
  csv,
}: {
  kind: "college" | "coach";
  rows: any[];
  activity: any[];
  pm: Map<any, any>;
  csv: (n: string, r: any[]) => void;
}) {
  const groups = new Map<string, any>();
  for (const r of rows) {
    const rel = kind === "college" ? one(r.colleges) : one(r.college_coaches);
    const id = kind === "college" ? r.college_id : r.coach_id;
    if (!id) continue;
    const name =
      kind === "college"
        ? rel?.name
        : [rel?.first_name, rel?.last_name].filter(Boolean).join(" ");
    const g = groups.get(id) || {
      id,
      name: name || "Unknown",
      players: new Set<string>(),
      interactions: 0,
    };
    g.players.add(r.athlete_user_id);
    groups.set(id, g);
  }
  for (const a of activity) {
    const id = kind === "college" ? a.college_id : a.coach_id;
    if (id && groups.has(id)) groups.get(id).interactions++;
  }
  const arr = [...groups.values()].sort(
    (a, b) => b.players.size - a.players.size || a.name.localeCompare(b.name),
  );
  return (
    <section className="card p-4 sm:p-5">
      <Header
        eyebrow="RELATIONSHIP COVERAGE"
        title={kind === "college" ? "School Coverage" : "Coach Coverage"}
        onExport={() =>
          csv(
            `organization-${kind === "college" ? "schools" : "coaches"}.csv`,
            arr.map((x) => ({
              name: x.name,
              players: x.players.size,
              recorded_activity: x.interactions,
            })),
          )
        }
      />
      <p className="rr-section-subtitle mt-1">
        See how many players are connected to each{" "}
        {kind === "college" ? "school" : "coach"} and how much recruiting
        activity has been recorded.
      </p>
      <div className="mt-4 divide-y">
        {arr.map((g) => (
          <div className="py-3" key={g.id}>
            <div className="flex justify-between gap-3">
              <b>{g.name}</b>
              <span className="text-xs font-semibold">
                {g.players.size} players · {g.interactions} recorded activities
              </span>
            </div>
            <div className="text-sm mt-1">
              {[...g.players].map((id: any) => (
                <Link
                  key={id}
                  href={`/players/${id}`}
                  className="mr-2 hover:text-red-700 hover:underline"
                >
                  {pm.get(id)?.full_name || "Player"}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
