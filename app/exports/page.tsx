"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import { EmptyState, PageFrame, StatePanel } from "@/components/ProductUI";
import { createClient } from "@/lib/supabase-browser";
import { cleanDisplayNote } from "@/lib/display-notes";
import {
  RECRUITING_JOURNEY,
  normalizeJourneyStage,
} from "@/lib/recruiting-journey";
import {
  BarChart3,
  CalendarDays,
  CheckSquare,
  Download,
  Eye,
  FileSpreadsheet,
  Flag,
  Film,
  History,
  Network,
  School,
  Target,
  Users,
  X,
} from "lucide-react";

type Report = {
  id: string;
  title: string;
  description: string;
  ownerOnly?: boolean;
  multi?: boolean;
  icon: any;
};
type Sheet = { name: string; title: string; rows: Record<string, any>[] };
type Dataset =
  | "profiles"
  | "athleteProfiles"
  | "schools"
  | "coaches"
  | "interactions"
  | "reminders"
  | "tasks"
  | "events"
  | "videos"
  | "teams";
const INTERACTION_LIMIT = 10000;
const one = (v: any) => (Array.isArray(v) ? v[0] : v);
const today = () => new Date().toISOString().slice(0, 10);
const safe = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
const days = (d: any) =>
  d
    ? Math.max(
        0,
        Math.floor(
          (Date.now() -
            new Date(`${String(d).slice(0, 10)}T12:00:00`).getTime()) /
            86400000,
        ),
      )
    : "";
const REPORTS: Report[] = [
  {
    id: "weekly",
    title: "Advisor Weekly Report",
    description:
      "Players needing attention, overdue Next Steps, open tasks and recruiting priorities.",
    icon: CheckSquare,
  },
  {
    id: "players",
    title: "Player Recruiting Summary",
    description:
      "One row per player with Connections, Journey, Next Steps, events and recruiting activity.",
    icon: Users,
  },
  {
    id: "journey",
    title: "Recruiting Journey Report",
    description:
      "Current school-by-school stage, relationship activity and next step.",
    icon: Flag,
  },
  {
    id: "coaches",
    title: "Coach Relationships",
    description:
      "Coach network, contact information, relationship stage and last contact.",
    icon: Network,
  },
  {
    id: "communication",
    title: "Communication Activity",
    description:
      "Chronological recruiting interactions by player, school and coach.",
    icon: BarChart3,
  },
  {
    id: "next_moves",
    title: "Next Steps & Tasks",
    description:
      "Athlete reminders and advisor-assigned Next Steps in one action report.",
    icon: CheckSquare,
  },
  {
    id: "events",
    title: "Events & Attendance",
    description:
      "Camps, visits and recruiting events with Going / Not Going / Considering status.",
    icon: CalendarDays,
  },
  {
    id: "videos",
    title: "Recruiting Video Library",
    description: "Recruiting videos by player, category, provider and link.",
    icon: Film,
  },
  {
    id: "archived",
    title: "Archived / All-Time Relationships",
    description: "Stopped-pursuing schools with preserved recruiting history.",
    icon: History,
  },
  {
    id: "organization",
    title: "Organization Recruiting Overview",
    description:
      "Executive player-by-player view of recruiting progress and workload.",
    ownerOnly: true,
    icon: Users,
  },
  {
    id: "school_interest",
    title: "School Interest Report",
    description:
      "Schools attracting multiple organization players and their furthest stages.",
    ownerOnly: true,
    icon: School,
  },
  {
    id: "outcomes",
    title: "Recruiting Outcomes / Commitments",
    description: "Committed players and programs.",
    ownerOnly: true,
    icon: Target,
  },
  {
    id: "workbook",
    title: "Complete Organization Recruiting Report",
    description:
      "Multi-sheet workbook covering players, Connections, communication, Next Steps, events, videos and outcomes.",
    ownerOnly: true,
    multi: true,
    icon: FileSpreadsheet,
  },
];
const REPORT_DEPS: Record<string, Dataset[]> = {
  weekly: [
    "profiles",
    "athleteProfiles",
    "schools",
    "coaches",
    "interactions",
    "reminders",
    "tasks",
    "events",
  ],
  players: [
    "profiles",
    "athleteProfiles",
    "schools",
    "coaches",
    "interactions",
    "reminders",
    "tasks",
    "events",
  ],
  journey: ["profiles", "schools", "coaches", "interactions"],
  coaches: ["profiles", "schools", "coaches"],
  communication: ["profiles", "interactions"],
  next_moves: ["profiles", "reminders", "tasks"],
  events: ["profiles", "events"],
  videos: ["profiles", "videos"],
  archived: ["profiles", "schools"],
  organization: [
    "profiles",
    "athleteProfiles",
    "schools",
    "coaches",
    "interactions",
    "reminders",
    "tasks",
    "events",
  ],
  school_interest: ["profiles", "schools"],
  outcomes: ["profiles", "athleteProfiles", "schools"],
  workbook: [
    "profiles",
    "athleteProfiles",
    "schools",
    "coaches",
    "interactions",
    "reminders",
    "tasks",
    "events",
    "videos",
  ],
};

export default function Exports() {
  const c = createClient();
  const [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState(""),
    [busy, setBusy] = useState(""),
    [msg, setMsg] = useState(""),
    [role, setRole] = useState("advisor"),
    [orgName, setOrgName] = useState("Rebels");
  const [accessibleIds, setAccessibleIds] = useState<string[]>([]),
    [warnings, setWarnings] = useState<Partial<Record<Dataset, string>>>({});
  const [profiles, setProfiles] = useState<any[]>([]),
    [athleteProfiles, setAthleteProfiles] = useState<any[]>([]),
    [colleges, setColleges] = useState<any[]>([]),
    [coaches, setCoaches] = useState<any[]>([]),
    [interactions, setInteractions] = useState<any[]>([]),
    [interactionTotal, setInteractionTotal] = useState(0),
    [reminders, setReminders] = useState<any[]>([]),
    [tasks, setTasks] = useState<any[]>([]),
    [events, setEvents] = useState<any[]>([]),
    [videos, setVideos] = useState<any[]>([]),
    [teams, setTeams] = useState<any[]>([]),
    [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [teamFilter, setTeamFilter] = useState("all"),
    [playerFilter, setPlayerFilter] = useState("all"),
    [yearFilter, setYearFilter] = useState("all"),
    [divisionFilter, setDivisionFilter] = useState("all"),
    [stageFilter, setStageFilter] = useState("all"),
    [activityFilter, setActivityFilter] = useState("all"),
    [eventStatusFilter, setEventStatusFilter] = useState("all"),
    [scope, setScope] = useState<"current" | "all">("current"),
    [dateFrom, setDateFrom] = useState(""),
    [dateTo, setDateTo] = useState("");
  const [preview, setPreview] = useState<{
      report: Report;
      sheets: Sheet[];
    } | null>(null),
    [sheetIndex, setSheetIndex] = useState(0);

  async function load() {
    setLoading(true);
    setLoadError("");
    setWarnings({});
    setMsg("");
    try {
      const {
        data: { user },
        error: authError,
      } = await c.auth.getUser();
      if (authError) throw authError;
      if (!user) {
        setLoadError("Sign in to use Exports & Reports.");
        return;
      }
      const { data: membershipRows, error: memberError } = await c
        .from("organization_members")
        .select(
          "organization_id,role,organization_view_access,organizations(name)",
        )
        .eq("user_id", user.id)
        .eq("status", "active")
        .limit(10);
      if (memberError) throw memberError;
      const me =
        (membershipRows || []).find((m: any) =>
          ["owner", "admin", "advisor"].includes(m.role),
        ) || membershipRows?.[0];
      if (!me) {
        setLoadError(
          "We could not find an active organization membership for this account.",
        );
        return;
      }
      setRole(me.role);
      setOrgName(one(me.organizations)?.name || "Rebels");
      const [
        { data: members, error: membersError },
        { data: assign, error: assignError },
      ] = await Promise.all([
        c
          .from("organization_members")
          .select("user_id,role")
          .eq("organization_id", me.organization_id)
          .eq("status", "active"),
        c
          .from("athlete_advisor_assignments")
          .select("athlete_user_id")
          .eq("advisor_user_id", user.id)
          .eq("organization_id", me.organization_id)
          .eq("status", "active"),
      ]);
      if (membersError) throw membersError;
      if (assignError) throw assignError;
      const all = (members || [])
        .filter((m: any) => m.role === "athlete")
        .map((m: any) => String(m.user_id));
      const athleteIds = [
        ...new Set(
          me.role === "owner" ||
            me.role === "admin" ||
            me.organization_view_access
            ? all
            : (assign || []).map((a: any) => String(a.athlete_user_id)),
        ),
      ];
      setAccessibleIds(athleteIds);
      if (!athleteIds.length) {
        setProfiles([]);
        setAthleteProfiles([]);
        return;
      }
      const results = await Promise.all([
        c.from("profiles").select("id,full_name,email").in("id", athleteIds),
        c.from("athlete_profiles").select("*").in("user_id", athleteIds),
        c
          .from("athlete_colleges")
          .select(
            "id,athlete_user_id,college_id,status,archived_at,archived_reason,created_at,colleges(id,name,division,state,city,conference)",
          )
          .in("athlete_user_id", athleteIds),
        c
          .from("athlete_coaches")
          .select(
            "id,athlete_user_id,coach_id,college_id,next_step,last_contact_date,archived_at,college_coaches(id,first_name,last_name,title,email,phone),colleges(id,name,division)",
          )
          .in("athlete_user_id", athleteIds),
        c
          .from("interactions")
          .select(
            "id,athlete_user_id,college_id,coach_id,type,initiated_by,date,date_precision,date_year,date_month,note,created_at",
            { count: "exact" },
          )
          .in("athlete_user_id", athleteIds)
          .order("created_at", { ascending: false })
          .limit(INTERACTION_LIMIT),
        c
          .from("reminders")
          .select(
            "id,athlete_user_id,title,due_date,status,colleges(name),college_coaches(first_name,last_name)",
          )
          .in("athlete_user_id", athleteIds),
        c
          .from("advisor_tasks")
          .select(
            "id,athlete_user_id,title,description,due_date,status,created_at",
          )
          .in("athlete_user_id", athleteIds),
        c
          .from("athlete_events")
          .select(
            "athlete_user_id,status,notes,events(id,name,type,date,location,registration_url,colleges(name,division))",
          )
          .in("athlete_user_id", athleteIds),
        c
          .from("athlete_videos")
          .select(
            "id,athlete_user_id,title,category,provider,video_url,created_at",
          )
          .in("athlete_user_id", athleteIds),
      ]);
      const labels: Dataset[] = [
        "profiles",
        "athleteProfiles",
        "schools",
        "coaches",
        "interactions",
        "reminders",
        "tasks",
        "events",
        "videos",
      ];
      const nextWarnings: Partial<Record<Dataset, string>> = {};
      results.forEach((r: any, i) => {
        if (r.error)
          nextWarnings[labels[i]] =
            r.error.message || "Could not load this dataset.";
      });
      setWarnings(nextWarnings);
      const [r1, r2, r3, r4, r5, r6, r7, r8, r9] = results;
      setProfiles(r1.error ? [] : r1.data || []);
      setAthleteProfiles(r2.error ? [] : r2.data || []);
      setColleges(r3.error ? [] : r3.data || []);
      setCoaches(r4.error ? [] : r4.data || []);
      const schoolMap = new Map(
        (r3.error ? [] : r3.data || []).map((row: any) => [
          row.college_id,
          one(row.colleges),
        ]),
      );
      const coachMap = new Map(
        (r4.error ? [] : r4.data || []).map((row: any) => [
          row.coach_id,
          one(row.college_coaches),
        ]),
      );
      setInteractions(
        r5.error
          ? []
          : (r5.data || []).map((row: any) => ({
              ...row,
              colleges: schoolMap.get(row.college_id) || null,
              college_coaches: coachMap.get(row.coach_id) || null,
            })),
      );
      setInteractionTotal(r5.error ? 0 : r5.count || r5.data?.length || 0);
      setReminders(r6.error ? [] : r6.data || []);
      setTasks(r7.error ? [] : r7.data || []);
      setEvents(r8.error ? [] : r8.data || []);
      setVideos(r9.error ? [] : r9.data || []);
      try {
        const tr = await fetch("/api/profile/team/organization", {
          cache: "no-store",
        });
        if (tr.ok) {
          const td = await tr.json();
          setTeams(td.teams || []);
          setTeamMembers(td.members || []);
        } else
          setWarnings((w) => ({
            ...w,
            teams: "Team labels could not be loaded.",
          }));
      } catch {
        setWarnings((w) => ({
          ...w,
          teams: "Team labels could not be loaded.",
        }));
      }
    } catch (e: any) {
      console.error("Exports load failed", e);
      setLoadError(
        "The Report Center could not verify your organization access. Nothing has been changed. Try again, and contact support if the problem continues.",
      );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  const owner = role === "owner" || role === "admin";
  const pm = useMemo(
    () => new Map(profiles.map((p) => [String(p.id), p])),
    [profiles],
  );
  const am = useMemo(
    () => new Map(athleteProfiles.map((p) => [String(p.user_id), p])),
    [athleteProfiles],
  );
  const tm = useMemo(() => new Map(teams.map((t) => [t.id, t.name])), [teams]);
  const atm = useMemo(() => {
    const m = new Map<string, string>();
    teamMembers.forEach((x) =>
      m.set(String(x.athlete_user_id), tm.get(x.team_id) || ""),
    );
    return m;
  }, [teamMembers, tm]);
  const name = (id: string) =>
    pm.get(id)?.full_name || pm.get(id)?.email || `Player ${id.slice(0, 6)}`;
  const team = (id: string) => atm.get(id) || "Unassigned";
  const years = [
    ...new Set(
      athleteProfiles.map((a) => String(a.class_year || "")).filter(Boolean),
    ),
  ].sort();
  const divisions = [
    ...new Set(
      colleges
        .map((x) => String(one(x.colleges)?.division || ""))
        .filter(Boolean),
    ),
  ].sort();
  const activityTypes = [
    ...new Set(interactions.map((x) => String(x.type || "")).filter(Boolean)),
  ].sort();
  const ids = useMemo(
    () =>
      accessibleIds.filter(
        (id) =>
          (teamFilter === "all" || team(id) === teamFilter) &&
          (playerFilter === "all" || id === playerFilter) &&
          (yearFilter === "all" ||
            String(am.get(id)?.class_year || "") === yearFilter),
      ),
    [accessibleIds, teamFilter, playerFilter, yearFilter, atm, am],
  );
  const idset = new Set(ids);
  const inDate = (v: any) => {
    const d = String(v || "").slice(0, 10);
    if (!dateFrom && !dateTo) return true;
    if (!d) return false;
    return (!dateFrom || d >= dateFrom) && (!dateTo || d <= dateTo);
  };
  const interactionDate = (x: any) =>
    x.date_precision === "exact" && x.date
      ? String(x.date).slice(0, 10)
      : x.date_precision === "month" && x.date_year && x.date_month
        ? `${x.date_year}-${String(x.date_month).padStart(2, "0")}`
        : x.date_precision === "year" && x.date_year
          ? String(x.date_year)
          : "";
  const interactionInDate = (x: any) => {
    if (!dateFrom && !dateTo) return true;
    const precision = x.date_precision || "exact";
    if (precision === "unknown") return false;
    if (precision === "exact") return inDate(x.date);
    if (precision === "month") {
      const start = `${x.date_year}-${String(x.date_month).padStart(2, "0")}-01`,
        end = `${x.date_year}-${String(x.date_month).padStart(2, "0")}-31`;
      return (!dateFrom || end >= dateFrom) && (!dateTo || start <= dateTo);
    }
    if (precision === "year") {
      const start = `${x.date_year}-01-01`,
        end = `${x.date_year}-12-31`;
      return (!dateFrom || end >= dateFrom) && (!dateTo || start <= dateTo);
    }
    return false;
  };
  const schoolOK = (x: any) =>
    idset.has(String(x.athlete_user_id)) &&
    (scope === "all" || !x.archived_at) &&
    (divisionFilter === "all" ||
      String(one(x.colleges)?.division || "") === divisionFilter) &&
    (stageFilter === "all" || normalizeJourneyStage(x.status) === stageFilter);
  const missingProfileCount = accessibleIds.filter((id) => !am.has(id)).length;

  function playerRows() {
    return ids.map((id) => {
      const cs = colleges.filter(
          (x) => String(x.athlete_user_id) === id && !x.archived_at,
        ),
        cc = coaches.filter(
          (x) => String(x.athlete_user_id) === id && !x.archived_at,
        ),
        ii = interactions.filter(
          (x) =>
            String(x.athlete_user_id) === id &&
            x.date_precision === "exact" &&
            x.date,
        ),
        rr = reminders.filter(
          (x) => String(x.athlete_user_id) === id && x.status !== "completed",
        ),
        tt = tasks.filter(
          (x) => String(x.athlete_user_id) === id && x.status !== "completed",
        ),
        ee = events.filter(
          (x) =>
            String(x.athlete_user_id) === id && one(x.events)?.date >= today(),
        ),
        counts = Object.fromEntries(
          RECRUITING_JOURNEY.map((s) => [
            s,
            cs.filter((x) => normalizeJourneyStage(x.status) === s).length,
          ]),
        ),
        last = ii
          .map((x) => x.date)
          .sort()
          .reverse()[0];
      return {
        Player: name(id),
        Team: team(id),
        "Class Year": am.get(id)?.class_year || "",
        "Profile Status": am.has(id)
          ? "Complete record available"
          : "Recruiting profile not completed",
        "Active Schools": cs.length,
        "Coach Relationships": cc.length,
        "Target Schools": counts["Target School"],
        Engaged: counts["Engaged"],
        Interested: counts["Interested"],
        "Visit/Camp": counts["Visit/Camp"],
        Offers: counts["Offer"],
        Committed: counts["Committed"],
        "Open Reminders": rr.length,
        "Open Advisor Next Steps": tt.length,
        "Upcoming Events": ee.length,
        "Last Activity Date": last || "",
        "Days Since Activity": days(last),
      };
    });
  }
  function journeyRows() {
    return colleges.filter(schoolOK).map((x) => {
      const s = one(x.colleges) || {},
        ii = interactions.filter(
          (i) =>
            String(i.athlete_user_id) === String(x.athlete_user_id) &&
            i.college_id === x.college_id &&
            i.date_precision === "exact" &&
            i.date,
        ),
        last = ii
          .map((i) => i.date)
          .sort()
          .reverse()[0],
        next =
          coaches.find(
            (c) =>
              String(c.athlete_user_id) === String(x.athlete_user_id) &&
              c.college_id === x.college_id &&
              !c.archived_at,
          )?.next_step || "";
      return {
        Player: name(String(x.athlete_user_id)),
        Team: team(String(x.athlete_user_id)),
        School: s.name || "",
        Division: s.division || "",
        Conference: s.conference || "",
        State: s.state || "",
        "Journey Stage": normalizeJourneyStage(x.status),
        "Last Activity Date": last || "",
        "Days Since Activity": days(last),
        "Next Step": next,
        Archived: x.archived_at ? "Yes" : "No",
      };
    });
  }
  function coachRows() {
    return coaches
      .filter(
        (x) =>
          idset.has(String(x.athlete_user_id)) &&
          (scope === "all" || !x.archived_at) &&
          (divisionFilter === "all" ||
            String(one(x.colleges)?.division || "") === divisionFilter),
      )
      .map((x) => {
        const c = one(x.college_coaches) || {},
          s = one(x.colleges) || {},
          rel = colleges.find(
            (r) =>
              String(r.athlete_user_id) === String(x.athlete_user_id) &&
              r.college_id === x.college_id,
          );
        return {
          Player: name(String(x.athlete_user_id)),
          Team: team(String(x.athlete_user_id)),
          School: s.name || "",
          "Journey Stage": normalizeJourneyStage(rel?.status),
          Coach: `${c.first_name || ""} ${c.last_name || ""}`.trim(),
          Title: c.title || "",
          Email: c.email || "",
          Phone: c.phone || "",
          "Last Contact": x.last_contact_date || "",
          "Next Step": x.next_step || "",
        };
      });
  }
  function communicationRows() {
    return interactions
      .filter(
        (x) =>
          idset.has(String(x.athlete_user_id)) &&
          interactionInDate(x) &&
          (activityFilter === "all" || x.type === activityFilter) &&
          (divisionFilter === "all" ||
            String(one(x.colleges)?.division || "") === divisionFilter),
      )
      .map((x) => ({
        Date: interactionDate(x) || "Unknown",
        "Date Precision": x.date_precision || "exact",
        Player: name(String(x.athlete_user_id)),
        Team: team(String(x.athlete_user_id)),
        School: one(x.colleges)?.name || "",
        Coach:
          `${one(x.college_coaches)?.first_name || ""} ${one(x.college_coaches)?.last_name || ""}`.trim(),
        Type: x.type || "",
        "Initiated By": x.initiated_by || "",
        Notes: cleanDisplayNote(x.note),
      }));
  }
  function nextMoveRows() {
    const out: Record<string, any>[] = [];
    reminders
      .filter((x) => idset.has(String(x.athlete_user_id)) && inDate(x.due_date))
      .forEach((x) =>
        out.push({
          Player: name(String(x.athlete_user_id)),
          Team: team(String(x.athlete_user_id)),
          Source: "Athlete Reminder",
          "Next Step": x.title,
          Description: "",
          "Due Date": x.due_date || "",
          Status: x.status || "",
          School: one(x.colleges)?.name || "",
          Coach:
            `${one(x.college_coaches)?.first_name || ""} ${one(x.college_coaches)?.last_name || ""}`.trim(),
        }),
      );
    tasks
      .filter(
        (x) =>
          idset.has(String(x.athlete_user_id)) &&
          inDate(x.due_date || x.created_at),
      )
      .forEach((x) =>
        out.push({
          Player: name(String(x.athlete_user_id)),
          Team: team(String(x.athlete_user_id)),
          Source: "Advisor Next Step",
          "Next Step": x.title,
          Description: x.description || "",
          "Due Date": x.due_date || "",
          Status: x.status || "",
          School: "",
          Coach: "",
        }),
      );
    return out;
  }
  function eventRows() {
    return events
      .filter(
        (x) =>
          idset.has(String(x.athlete_user_id)) &&
          inDate(one(x.events)?.date) &&
          (eventStatusFilter === "all" || x.status === eventStatusFilter),
      )
      .map((x) => {
        const e = one(x.events) || {};
        return {
          Player: name(String(x.athlete_user_id)),
          Team: team(String(x.athlete_user_id)),
          Date: e.date || "",
          Event: e.name || "",
          Type: e.type || "",
          School: one(e.colleges)?.name || "",
          Location: e.location || "",
          Attendance: x.status || "Considering",
          Registration: e.registration_url || "",
          Notes: cleanDisplayNote(x.notes),
        };
      });
  }
  function videoRows() {
    return videos
      .filter(
        (x) => idset.has(String(x.athlete_user_id)) && inDate(x.created_at),
      )
      .map((x) => ({
        Player: name(String(x.athlete_user_id)),
        Team: team(String(x.athlete_user_id)),
        Added: String(x.created_at || "").slice(0, 10),
        Title: x.title || "",
        Category: x.category || "",
        Provider: x.provider || "",
        "Video URL": x.video_url || "",
      }));
  }
  function archivedRows() {
    return colleges
      .filter((x) => idset.has(String(x.athlete_user_id)) && x.archived_at)
      .map((x) => ({
        Player: name(String(x.athlete_user_id)),
        Team: team(String(x.athlete_user_id)),
        School: one(x.colleges)?.name || "",
        Division: one(x.colleges)?.division || "",
        "Stage at Archive": normalizeJourneyStage(x.status),
        "Archived Date": String(x.archived_at).slice(0, 10),
        Reason: cleanDisplayNote(x.archived_reason),
      }));
  }
  function schoolInterestRows() {
    const m = new Map<string, any>();
    colleges.filter(schoolOK).forEach((x) => {
      const s = one(x.colleges) || {},
        k = x.college_id || s.name,
        v = m.get(k) || {
          school: s.name,
          division: s.division,
          players: [],
          stages: [],
        };
      v.players.push(name(String(x.athlete_user_id)));
      v.stages.push(normalizeJourneyStage(x.status));
      m.set(k, v);
    });
    return [...m.values()]
      .map((v) => ({
        School: v.school,
        Division: v.division,
        "Players Pursuing": v.players.length,
        Players: v.players.join(", "),
        Stages: v.stages.join(", "),
      }))
      .sort(
        (a, b) => Number(b["Players Pursuing"]) - Number(a["Players Pursuing"]),
      );
  }
  function outcomeRows() {
    return colleges
      .filter(
        (x) =>
          idset.has(String(x.athlete_user_id)) &&
          normalizeJourneyStage(x.status) === "Committed",
      )
      .map((x) => ({
        Player: name(String(x.athlete_user_id)),
        Team: team(String(x.athlete_user_id)),
        "Class Year": am.get(String(x.athlete_user_id))?.class_year || "",
        School: one(x.colleges)?.name || "",
        Division: one(x.colleges)?.division || "",
      }));
  }
  function weeklyRows() {
    return playerRows().map((x) => ({
      ...x,
      "Suggested Focus":
        Number(x["Open Advisor Next Steps"]) + Number(x["Open Reminders"]) > 0
          ? "Complete open Next Steps"
          : x["Last Activity Date"] === "" ||
              Number(x["Days Since Activity"]) >= 14
            ? "Review relationships needing attention"
            : Number(x["Active Schools"]) === 0
              ? "Build Connections"
              : "Keep recruiting progress moving",
    }));
  }
  function sheets(k: string): Sheet[] {
    const oneSheet = (name: string, title: string, rows: any[]): Sheet[] => [
      { name, title, rows },
    ];
    if (k === "weekly")
      return oneSheet("Weekly", "Advisor Weekly Report", weeklyRows());
    if (k === "players" || k === "organization")
      return oneSheet(
        "Players",
        k === "organization"
          ? "Organization Recruiting Overview"
          : "Player Recruiting Summary",
        playerRows(),
      );
    if (k === "journey")
      return oneSheet(
        "Connections",
        "Recruiting Journey Report",
        journeyRows(),
      );
    if (k === "coaches")
      return oneSheet("Coaches", "Coach Relationships", coachRows());
    if (k === "communication")
      return oneSheet(
        "Communication",
        "Communication Activity",
        communicationRows(),
      );
    if (k === "next_moves")
      return oneSheet("Next Steps", "Next Steps & Tasks", nextMoveRows());
    if (k === "events")
      return oneSheet("Events", "Events & Attendance", eventRows());
    if (k === "videos")
      return oneSheet("Videos", "Recruiting Video Library", videoRows());
    if (k === "archived")
      return oneSheet(
        "Archived",
        "Archived / All-Time Relationships",
        archivedRows(),
      );
    if (k === "school_interest")
      return oneSheet(
        "School Interest",
        "School Interest Report",
        schoolInterestRows(),
      );
    if (k === "outcomes")
      return oneSheet(
        "Commitments",
        "Recruiting Outcomes / Commitments",
        outcomeRows(),
      );
    if (k === "workbook")
      return [
        ["Players", "Player Overview", playerRows()],
        ["Connections", "Connections & Journey", journeyRows()],
        ["Coaches", "Coach Relationships", coachRows()],
        ["Communication", "Communication Activity", communicationRows()],
        ["Next Steps", "Next Steps & Tasks", nextMoveRows()],
        ["Events", "Events & Attendance", eventRows()],
        ["Videos", "Recruiting Videos", videoRows()],
        ["Commitments", "Recruiting Outcomes", outcomeRows()],
      ].map(([name, title, rows]: any) => ({ name, title, rows }));
    return [];
  }
  function validateSheets(ss: Sheet[]) {
    if (!ss.length) throw new Error("This report has no sheets.");
    for (const s of ss) {
      if (!s.name || !s.title)
        throw new Error("A report sheet is missing its name or title.");
      if (s.rows.length) {
        const keys = Object.keys(s.rows[0]);
        if (!keys.length) throw new Error(`${s.title} has no columns.`);
        for (const row of s.rows) {
          for (const k of keys)
            if (!(k in row))
              throw new Error(`${s.title} contains inconsistent columns.`);
        }
      }
    }
  }
  function csv(filename: string, rows: any[]) {
    if (!rows.length) return;
    const keys = Object.keys(rows[0]),
      q = (v: any) => `"${String(v ?? "").replaceAll('"', '""')}"`,
      blob = new Blob(
        [
          "\ufeff" +
            [
              keys.map(q).join(","),
              ...rows.map((r) => keys.map((k) => q(r[k])).join(",")),
            ].join("\n"),
        ],
        { type: "text/csv;charset=utf-8" },
      ),
      a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 500);
  }
  const excelColumn = (n: number) => {
    let s = "";
    for (let x = n; x > 0; x = Math.floor((x - 1) / 26))
      s = String.fromCharCode(65 + ((x - 1) % 26)) + s;
    return s;
  };
  async function excel(kind: string, ss: Sheet[]) {
    const ExcelJS = (await import("exceljs-hardened")).default,
      wb = new ExcelJS.Workbook();
    wb.creator = "Rebels Recruit";
    ss.forEach((s) => {
      const h = s.rows.length ? Object.keys(s.rows[0]) : ["No data"],
        data = s.rows.length
          ? s.rows.map((r) => h.map((k) => r[k] ?? ""))
          : [["No matching data."]],
        ws = wb.addWorksheet(s.name.slice(0, 31));
      ws.addRow([s.title]);
      ws.addRow([`${orgName} | Generated ${new Date().toLocaleString()}`]);
      ws.addRow([]);
      ws.addRow(h);
      data.forEach((row) => ws.addRow(row));
      ws.columns = h.map((k) => ({
        width: Math.min(
          44,
          Math.max(
            12,
            k.length + 2,
            ...s.rows.slice(0, 50).map((r) => String(r[k] ?? "").length + 2),
          ),
        ),
      }));
      if (h.length) ws.autoFilter = `A4:${excelColumn(h.length)}4`;
      ws.views = [{ state: "frozen", ySplit: 4 }];
      ws.getRow(4).font = { bold: true };
    });
    const buffer = await wb.xlsx.writeBuffer(),
      blob = new Blob([buffer as BlobPart], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `rebels-recruit-${safe(REPORTS.find((r) => r.id === kind)?.title || kind)}-${today()}.xlsx`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 500);
  }
  const unavailable = (r: Report) => [
    ...new Set((REPORT_DEPS[r.id] || []).filter((d) => warnings[d])),
  ];
  async function run(kind: string, format: "xlsx" | "csv") {
    const report = REPORTS.find((r) => r.id === kind);
    if (!report) return;
    const missing = unavailable(report);
    if (missing.length) {
      setMsg(
        `This report is temporarily unavailable because ${missing.join(", ")} data could not be loaded. Other reports may still work.`,
      );
      return;
    }
    setBusy(`${kind}-${format}`);
    setMsg("");
    try {
      const ss = sheets(kind);
      validateSheets(ss);
      const count = ss.reduce((n, s) => n + s.rows.length, 0);
      if (!count) {
        setMsg("No matching data for this report and filter combination.");
        return;
      }
      if (format === "xlsx") await excel(kind, ss);
      else {
        if (report.multi)
          throw new Error(
            "The complete organization report is a multi-sheet Excel workbook. Download Excel for the full report.",
          );
        csv(`rebels-recruit-${safe(ss[0].name)}-${today()}.csv`, ss[0].rows);
      }
      setMsg("Report prepared successfully.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not generate report.");
    } finally {
      setBusy("");
    }
  }

  if (loading)
    return (
      <AppShell>
        <PageFrame size="6xl">
          <StatePanel
            title="Building your Report Center"
            description="We are gathering the recruiting data you are allowed to report on."
          />
        </PageFrame>
      </AppShell>
    );
  if (loadError)
    return (
      <AppShell>
        <PageFrame size="6xl">
          <StatePanel
            tone="error"
            title="Exports & Reports unavailable"
            description={loadError}
            action={
              <button className="btn" onClick={load}>
                Try Again
              </button>
            }
          />
        </PageFrame>
      </AppShell>
    );
  const visible = REPORTS.filter((r) => !r.ownerOnly || owner),
    active = preview?.sheets[sheetIndex] || preview?.sheets[0],
    headers = active?.rows.length ? Object.keys(active.rows[0]) : [];
  const reset = () => {
    setTeamFilter("all");
    setPlayerFilter("all");
    setYearFilter("all");
    setDivisionFilter("all");
    setStageFilter("all");
    setActivityFilter("all");
    setEventStatusFilter("all");
    setScope("current");
    setDateFrom("");
    setDateTo("");
  };

  return (
    <AppShell>
      <PageFrame size="6xl">
        <PageHeader
          title="Exports & Reports"
          subtitle={
            owner
              ? "Create recruiting reports across your organization."
              : "Create recruiting reports for the players you advise."
          }
        />
        {Object.keys(warnings).length > 0 && (
          <div className="mb-5">
            <StatePanel
              tone="warning"
              title="Some report data could not be loaded"
              description={`The Report Center is staying available. Affected data: ${Object.keys(
                warnings,
              )
                .map((x) =>
                  x === "athleteProfiles" ? "player profile details" : x,
                )
                .join(
                  ", ",
                )}. Reports that depend on those datasets are disabled until the data loads successfully.`}
              action={
                <button className="btn" onClick={load}>
                  Retry Data
                </button>
              }
            />
          </div>
        )}
        {interactionTotal > INTERACTION_LIMIT && (
          <div className="mb-5">
            <StatePanel
              tone="warning"
              title="Large communication history detected"
              description={`This browser session is limited to the latest ${INTERACTION_LIMIT.toLocaleString()} of ${interactionTotal.toLocaleString()} interactions so the Report Center stays responsive. Use player and date filters for working reports. All report rows preserve recorded date precision.`}
            />
          </div>
        )}
        {missingProfileCount > 0 && (
          <div className="mb-5">
            <StatePanel
              tone="warning"
              title="Some players have not completed their recruiting profile"
              description={`${missingProfileCount} accessible player${missingProfileCount === 1 ? " is" : "s are"} still included in organization reports, but profile-only fields such as class year may be blank.`}
            />
          </div>
        )}
        {!accessibleIds.length ? (
          <EmptyState
            title="No players are available to report on"
            description="When players are assigned to you or added to the organization, their recruiting reports will appear here."
          />
        ) : (
          <>
            <section className="card p-5 mb-6">
              <div className="flex items-center gap-2">
                <FileSpreadsheet size={19} />
                <h2 className="font-black text-lg">Report Filters</h2>
              </div>
              <p className="muted text-sm mt-1">
                Filters apply where relevant. Historical import metadata is
                removed from report-facing notes, and partial historical dates
                keep their recorded precision.
              </p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
                <Select
                  label="Team"
                  value={teamFilter}
                  set={setTeamFilter}
                  options={[
                    ["all", "All Teams"],
                    ...teams.map((t) => [t.name, t.name]),
                  ]}
                />
                <Select
                  label="Player"
                  value={playerFilter}
                  set={setPlayerFilter}
                  options={[
                    ["all", "All Players"],
                    ...accessibleIds.map((id) => [id, name(id)]),
                  ]}
                />
                <Select
                  label="Class Year"
                  value={yearFilter}
                  set={setYearFilter}
                  options={[
                    ["all", "All Class Years"],
                    ...years.map((x) => [x, x]),
                  ]}
                />
                <Select
                  label="Division"
                  value={divisionFilter}
                  set={setDivisionFilter}
                  options={[
                    ["all", "All Divisions"],
                    ...divisions.map((x) => [x, x]),
                  ]}
                />
                <Select
                  label="Journey Stage"
                  value={stageFilter}
                  set={setStageFilter}
                  options={[
                    ["all", "All Stages"],
                    ...RECRUITING_JOURNEY.map((x) => [x, x]),
                  ]}
                />
                <Select
                  label="Activity Type"
                  value={activityFilter}
                  set={setActivityFilter}
                  options={[
                    ["all", "All Activity Types"],
                    ...activityTypes.map((x) => [x, x]),
                  ]}
                />
                <Select
                  label="Event Attendance"
                  value={eventStatusFilter}
                  set={setEventStatusFilter}
                  options={[
                    ["all", "All Attendance"],
                    ["going", "Going"],
                    ["considering", "Considering"],
                    ["not_going", "Not Going"],
                  ]}
                />
                <Select
                  label="Relationship Scope"
                  value={scope}
                  set={(v) => setScope(v as any)}
                  options={[
                    ["current", "Current"],
                    ["all", "All-Time"],
                  ]}
                />
                <label className="text-sm font-bold">
                  From
                  <input
                    type="date"
                    className="input mt-1"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </label>
                <label className="text-sm font-bold">
                  Through
                  <input
                    type="date"
                    className="input mt-1"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </label>
                <div className="flex items-end">
                  <button className="btn w-full" onClick={reset}>
                    Reset Filters
                  </button>
                </div>
              </div>
            </section>
            {msg && (
              <div
                className="mb-5 rounded-xl border bg-white px-4 py-3 text-sm font-semibold"
                role="status"
              >
                {msg}
              </div>
            )}
            <div className="grid md:grid-cols-2 gap-4">
              {visible.map((r) => {
                const I = r.icon,
                  missing = unavailable(r),
                  blocked = missing.length > 0;
                return (
                  <section
                    key={r.id}
                    className={`card p-5 flex flex-col ${r.multi ? "md:col-span-2" : ""} ${blocked ? "opacity-75" : ""}`}
                  >
                    <div className="flex gap-3">
                      <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center">
                        <I size={20} />
                      </div>
                      <div>
                        <h3 className="font-black text-lg">{r.title}</h3>
                        <p className="muted text-sm mt-1">{r.description}</p>
                        {blocked && (
                          <p className="text-xs font-bold text-amber-700 mt-2">
                            Waiting on:{" "}
                            {missing
                              .map((x) =>
                                x === "athleteProfiles"
                                  ? "player profile details"
                                  : x,
                              )
                              .join(", ")}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="mt-5 flex gap-2 flex-wrap">
                      <button
                        className="btn"
                        disabled={blocked}
                        onClick={() => {
                          setSheetIndex(0);
                          setPreview({ report: r, sheets: sheets(r.id) });
                        }}
                      >
                        <Eye size={16} />
                        Preview Report
                      </button>
                      <button
                        className="btn btn-red"
                        disabled={!!busy || blocked}
                        onClick={() => run(r.id, "xlsx")}
                      >
                        <FileSpreadsheet size={16} />
                        {busy === `${r.id}-xlsx`
                          ? "Preparing..."
                          : "Download Excel"}
                      </button>
                      {!r.multi && (
                        <button
                          className="btn"
                          disabled={!!busy || blocked}
                          onClick={() => run(r.id, "csv")}
                        >
                          <Download size={16} />
                          {busy === `${r.id}-csv`
                            ? "Preparing..."
                            : "Download CSV"}
                        </button>
                      )}
                    </div>
                  </section>
                );
              })}
            </div>
          </>
        )}
      </PageFrame>
      {preview && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-3"
          onMouseDown={(e) => {
            if (e.currentTarget === e.target) setPreview(null);
          }}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-[96vw] h-[88vh] flex flex-col overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-label={`${preview.report.title} preview`}
          >
            <div className="px-5 py-4 border-b flex justify-between">
              <div>
                <h2 className="text-xl font-black">
                  {preview.report.title} Preview
                </h2>
                <p className="muted text-sm">
                  Current filters. Review the rows before downloading.
                </p>
              </div>
              <button
                onClick={() => setPreview(null)}
                aria-label="Close report preview"
                className="h-11 w-11 inline-flex items-center justify-center"
              >
                <X />
              </button>
            </div>
            {preview.sheets.length > 1 && (
              <div className="px-5 pt-3 flex gap-2 overflow-x-auto border-b">
                {preview.sheets.map((s, i) => (
                  <button
                    key={s.name}
                    className={`px-3 py-2 text-sm font-bold border-b-2 ${sheetIndex === i ? "border-red-600 text-red-700" : "border-transparent"}`}
                    onClick={() => setSheetIndex(i)}
                  >
                    {s.name} ({s.rows.length})
                  </button>
                ))}
              </div>
            )}
            <div className="px-5 py-3 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <b>{active?.title}</b>
                <div className="muted text-xs">
                  {active?.rows.length || 0} matching rows
                  {(active?.rows.length || 0) > 50 ? " | first 50 shown" : ""}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  className="btn btn-red"
                  disabled={!!busy}
                  onClick={() => run(preview.report.id, "xlsx")}
                >
                  Download Excel
                </button>
                {!preview.report.multi && (
                  <button
                    className="btn"
                    disabled={!!busy}
                    onClick={() => run(preview.report.id, "csv")}
                  >
                    Download CSV
                  </button>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-auto">
              {active?.rows.length ? (
                <table className="min-w-max w-full text-sm">
                  <thead className="sticky top-0 bg-slate-100">
                    <tr>
                      {headers.map((h) => (
                        <th
                          key={h}
                          className="text-left font-black px-4 py-3 border-b"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {active.rows.slice(0, 50).map((r, i) => (
                      <tr key={i} className="border-b">
                        {headers.map((h) => (
                          <td
                            key={h}
                            className="px-4 py-3 max-w-[360px] whitespace-pre-wrap"
                          >
                            {String(r[h] ?? "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-10 text-center muted">
                  No matching data for the current filters.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function Select({
  label,
  value,
  set,
  options,
}: {
  label: string;
  value: string;
  set: (v: string) => void;
  options: any[];
}) {
  return (
    <label className="text-sm font-bold">
      {label}
      <select
        className="input mt-1"
        value={value}
        onChange={(e) => set(e.target.value)}
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}
