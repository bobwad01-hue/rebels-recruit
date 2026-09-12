"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Sparkles, ChevronRight } from "lucide-react";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import { PageFrame, StatePanel } from "@/components/ProductUI";
import { createClient } from "@/lib/supabase-browser";
import { DEFAULT_TIMEZONE, US_TIMEZONES } from "@/lib/us-timezones";
const SOFTBALL_POSITIONS = [
  "P",
  "C",
  "1B",
  "2B",
  "3B",
  "SS",
  "OF",
  "LF",
  "CF",
  "RF",
  "UTL",
];
const organizationLabel = (m: any) => {
  const o = Array.isArray(m?.organizations)
    ? m.organizations[0]
    : m?.organizations;
  return [
    o?.brand_name || o?.name,
    o?.branch_name,
    [o?.city, o?.state].filter(Boolean).join(", "),
  ]
    .filter(Boolean)
    .join(" · ");
};
export default function Profile() {
  const [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [phone, setPhone] = useState(""),
    [classYear, setClassYear] = useState(""),
    [jerseyNumber, setJerseyNumber] = useState(""),
    [school, setSchool] = useState(""),
    [positions, setPositions] = useState<string[]>([]),
    [gpa, setGpa] = useState(""),
    [state, setState] = useState(""),
    [homeZip, setHomeZip] = useState(""),
    [majors, setMajors] = useState(""),
    [organizationId, setOrganizationId] = useState(""),
    [organizationSearch, setOrganizationSearch] = useState(""),
    [teamId, setTeamId] = useState(""),
    [organizations, setOrganizations] = useState<any[]>([]),
    [teams, setTeams] = useState<any[]>([]),
    [timezone, setTimezone] = useState(DEFAULT_TIMEZONE),
    [isOnboarding, setIsOnboarding] = useState(false),
    [msg, setMsg] = useState(""),
    [saving, setSaving] = useState(false);
  const [xTwitter, setXTwitter] = useState(""),
    [sportsRecruitsUrl, setSportsRecruitsUrl] = useState(""),
    [travelTeamCoachName, setTravelTeamCoachName] = useState(""),
    [travelTeamCoachPhone, setTravelTeamCoachPhone] = useState(""),
    [highSchoolCity, setHighSchoolCity] = useState(""),
    [highSchoolState, setHighSchoolState] = useState(""),
    [highSchoolCoachName, setHighSchoolCoachName] = useState(""),
    [highSchoolCoachPhone, setHighSchoolCoachPhone] = useState(""),
    [throws, setThrows] = useState(""),
    [bats, setBats] = useState(""),
    [slaps, setSlaps] = useState(false),
    [ncaaNumber, setNcaaNumber] = useState("");
  useEffect(() => {
    (async () => {
      const c = createClient();
      const {
        data: { user },
      } = await c.auth.getUser();
      setEmail(user?.email || "");
      const [{ data: p }, { data: a }, teamResRaw, sigResRaw] =
        await Promise.all([
          c
            .from("profiles")
            .select("full_name,phone,timezone,profile_completed_at")
            .eq("id", user?.id)
            .single(),
          c
            .from("athlete_profiles")
            .select("*")
            .eq("user_id", user?.id)
            .maybeSingle(),
          fetch("/api/profile/team").then(async (r) => await r.json()),
          fetch("/api/profile/email-signature").then(async (r) =>
            r.ok ? await r.json() : {},
          ),
        ]);
      const teamRes = teamResRaw as {
        organizations?: any[];
        teams?: any[];
        currentOrganizationId?: string;
        currentTeamId?: string;
        error?: string;
      };
      const sigRes = sigResRaw as { signature?: Record<string, any> };
      setName(p?.full_name || "");
      setPhone(p?.phone || "");
      setTimezone(p?.timezone || DEFAULT_TIMEZONE);
      setIsOnboarding(!p?.profile_completed_at);
      setClassYear(a?.class_year?.toString() || "");
      setJerseyNumber(a?.jersey_number?.toString() || "");
      setSchool(a?.school_name || "");
      setPositions(Array.isArray(a?.positions) ? a.positions : []);
      setGpa(a?.gpa?.toString() || "");
      setState(a?.primary_state || "");
      setHomeZip(a?.home_zip || "");
      setMajors((a?.interested_majors || []).join(", "));
      const availableOrganizations = teamRes.organizations || [];
      setOrganizations(availableOrganizations);
      setTeams(teamRes.teams || []);
      setOrganizationId(teamRes.currentOrganizationId || "");
      setOrganizationSearch(
        organizationLabel(
          availableOrganizations.find(
            (m: any) => m.organization_id === teamRes.currentOrganizationId,
          ),
        ),
      );
      setTeamId(teamRes.currentTeamId || "");
      if (teamRes.error) setMsg(teamRes.error);
      const s = sigRes.signature || {};
      setXTwitter(s.xTwitter || "");
      setSportsRecruitsUrl(s.sportsRecruitsUrl || "");
      setTravelTeamCoachName(s.travelTeamCoachName || "");
      setTravelTeamCoachPhone(s.travelTeamCoachPhone || "");
      setHighSchoolCity(s.highSchoolCity || "");
      setHighSchoolState(s.highSchoolState || "");
      setHighSchoolCoachName(s.highSchoolCoachName || "");
      setHighSchoolCoachPhone(s.highSchoolCoachPhone || "");
      setNcaaNumber(s.ncaaNumber || "");
      const m = String(s.throwBat || "").match(/^([RL])\/([RL])/i);
      if (m) {
        setThrows(m[1].toUpperCase());
        setBats(m[2].toUpperCase());
        setSlaps(/slap/i.test(s.throwBat));
      }
    })();
  }, []);
  function togglePosition(p: string) {
    setPositions((v) => (v.includes(p) ? v.filter((x) => x !== p) : [...v, p]));
  }
  const teamOptions = teams.filter(
      (t: any) => t.organization_id === organizationId,
    ),
    selectedTeam = teams.find((t: any) => t.id === teamId);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    if (
      !name.trim() ||
      !phone.trim() ||
      !classYear ||
      !jerseyNumber.trim() ||
      !school.trim() ||
      !state.trim() ||
      !homeZip.trim() ||
      !positions.length ||
      !timezone ||
      !gpa ||
      !majors.trim() ||
      !organizationId ||
      !teamId
    ) {
      setMsg("Please complete every required profile field before continuing.");
      return;
    }
    setSaving(true);
    const c = createClient();
    const {
        data: { user },
      } = await c.auth.getUser(),
      completedAt = new Date().toISOString(),
      throwBat =
        throws && bats
          ? `${throws}/${bats}${bats === "L" && slaps ? " (Slap)" : ""}`
          : "";
    const [p, a, tr, sr] = await Promise.all([
      c
        .from("profiles")
        .update({
          full_name: name.trim(),
          phone: phone.trim(),
          timezone,
          profile_completed_at: completedAt,
        })
        .eq("id", user?.id),
      c.from("athlete_profiles").upsert(
        {
          user_id: user?.id,
          class_year: Number(classYear),
          jersey_number: jerseyNumber.trim(),
          school_name: school.trim(),
          positions,
          gpa: Number(gpa),
          primary_state: state.trim(),
          home_zip: homeZip.trim(),
          interested_majors: majors
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean),
        },
        { onConflict: "user_id" },
      ),
      fetch("/api/profile/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, teamId }),
      }),
      fetch("/api/profile/email-signature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          xTwitter,
          sportsRecruitsUrl,
          travelTeamName: selectedTeam?.name || "",
          travelTeamCoachName,
          travelTeamCoachPhone,
          highSchoolCity,
          highSchoolState,
          highSchoolCoachName,
          highSchoolCoachPhone,
          throwBat,
          ncaaNumber,
        }),
      }),
    ]);
    setSaving(false);
    let teamError = "",
      signatureError = "";
    try {
      if (!tr.ok)
        teamError =
          (await tr.json()).error || "Could not save organization and team.";
    } catch {}
    try {
      if (!sr.ok)
        signatureError =
          (await sr.json()).error ||
          "Could not save recruiting contact information.";
    } catch {}
    if (p.error || a.error || teamError || signatureError) {
      setMsg(
        p.error?.message ||
          a.error?.message ||
          teamError ||
          signatureError ||
          "Could not save profile.",
      );
      return;
    }
    setMsg("Profile saved.");
    if (isOnboarding) location.href = "/onboarding";
  }
  return (
    <AppShell>
      <PageFrame size="5xl">
        <PageHeader
          title={isOnboarding ? "Set Up Your Profile" : "Profile"}
          subtitle={
            isOnboarding
              ? "Complete your athlete profile so Rebels Recruit can personalize your experience."
              : "Keep your athlete, softball, academic and recruiting-contact information current in one place."
          }
        />
        {!isOnboarding && (
          <Link
            href="/fit-profile"
            className="rr-priority-card rr-interactive-card mb-5 p-4 flex items-center gap-3"
          >
            <Sparkles size={21} className="text-red-600" />
            <div className="flex-1">
              <div className="rr-eyebrow">SCHOOL DISCOVERY</div>
              <div className="font-black">School Preferences</div>
              <div className="muted text-xs mt-0.5">
                Tell Rebels Recruit what matters to you so Find Schools and
                School Fit can work better.
              </div>
            </div>
            <ChevronRight size={18} />
          </Link>
        )}
        <form onSubmit={save} className="space-y-5">
          <section className="card p-5 sm:p-6">
            <div className="mb-5">
              <h2 className="font-black text-lg">Profile essentials</h2>
              <p className="muted text-sm mt-1">
                All fields below are required. These details drive
                personalization, filtering and your recruiting identity.
              </p>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <label>
                <b className="text-sm">Full name *</b>
                <input
                  required
                  className="input mt-1"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label>
                <b className="text-sm">Phone number *</b>
                <input
                  required
                  className="input mt-1"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </label>
              <label>
                <b className="text-sm">Class year *</b>
                <input
                  required
                  className="input mt-1"
                  type="number"
                  value={classYear}
                  onChange={(e) => setClassYear(e.target.value)}
                />
              </label>
              <label>
                <b className="text-sm">Jersey number *</b>
                <input
                  required
                  className="input mt-1"
                  value={jerseyNumber}
                  onChange={(e) =>
                    setJerseyNumber(e.target.value.replace(/^#/, ""))
                  }
                />
              </label>
              <label>
                <b className="text-sm">Organization *</b>
                <input
                  required
                  list="organization-options"
                  className="input mt-1"
                  value={organizationSearch}
                  onChange={(e) => {
                    setOrganizationSearch(e.target.value);
                    const match = organizations.find(
                      (m: any) =>
                        organizationLabel(m) === e.target.value &&
                        m.status === "active",
                    );
                    setOrganizationId(match?.organization_id || "");
                    setTeamId("");
                  }}
                  placeholder="Search your organizations"
                />
                <datalist id="organization-options">
                  {organizations
                    .filter((m: any) => m.status === "active")
                    .map((m: any) => (
                      <option
                        key={m.organization_id}
                        value={organizationLabel(m)}
                      />
                    ))}
                </datalist>
                <span className="muted text-xs mt-1 block">
                  Each branch is private to its own owners and staff.{" "}
                  <Link href="/organizations" className="font-bold underline">
                    Manage organization access
                  </Link>
                </span>
              </label>
              <label>
                <b className="text-sm">Team *</b>
                <select
                  required
                  className="input mt-1"
                  value={teamId}
                  onChange={(e) => setTeamId(e.target.value)}
                  disabled={!organizationId}
                >
                  <option value="">
                    {organizationId
                      ? "Select team"
                      : "Choose organization first"}
                  </option>
                  {teamOptions.map((t: any) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <b className="text-sm">High school *</b>
                <input
                  required
                  className="input mt-1"
                  value={school}
                  onChange={(e) => setSchool(e.target.value)}
                />
              </label>
              <label>
                <b className="text-sm">Home state *</b>
                <input
                  required
                  className="input mt-1"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                />
              </label>
              <label>
                <b className="text-sm">Home ZIP *</b>
                <input
                  required
                  className="input mt-1"
                  value={homeZip}
                  onChange={(e) =>
                    setHomeZip(e.target.value.replace(/[^0-9-]/g, ""))
                  }
                />
              </label>
              <div className="md:col-span-2">
                <b className="text-sm">Positions *</b>
                <div className="flex flex-wrap gap-2 mt-2">
                  {SOFTBALL_POSITIONS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => togglePosition(p)}
                      aria-pressed={positions.includes(p)}
                      className={`min-h-11 rounded-lg border px-3 py-2 text-sm font-bold ${positions.includes(p) ? "bg-slate-950 text-white" : "bg-white"}`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <label>
                <b className="text-sm">Time zone *</b>
                <select
                  required
                  className="input mt-1"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                >
                  {US_TIMEZONES.map((z) => (
                    <option key={z.value} value={z.value}>
                      {z.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <b className="text-sm">GPA *</b>
                <input
                  required
                  className="input mt-1"
                  value={gpa}
                  onChange={(e) => setGpa(e.target.value)}
                />
              </label>
              <label className="md:col-span-2">
                <b className="text-sm">
                  Academic interests / possible majors *
                </b>
                <input
                  required
                  className="input mt-1"
                  value={majors}
                  onChange={(e) => setMajors(e.target.value)}
                />
              </label>
            </div>
          </section>
          {!isOnboarding && (
            <section className="card p-5 sm:p-6">
              <div className="mb-5">
                <h2 className="font-black text-lg">
                  Recruiting contact & email profile
                </h2>
                <p className="muted text-sm mt-1">
                  Optional information used in recruiting emails and profile
                  summaries.
                </p>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <label>
                  <b className="text-sm">Email</b>
                  <input
                    className="input mt-1 bg-slate-50"
                    value={email}
                    readOnly
                  />
                </label>
                <label>
                  <b className="text-sm">X / Twitter</b>
                  <input
                    className="input mt-1"
                    value={xTwitter}
                    onChange={(e) => setXTwitter(e.target.value)}
                  />
                </label>
                <label className="md:col-span-2">
                  <b className="text-sm">SportsRecruits profile</b>
                  <input
                    className="input mt-1"
                    value={sportsRecruitsUrl}
                    onChange={(e) => setSportsRecruitsUrl(e.target.value)}
                  />
                </label>
                <label>
                  <b className="text-sm">Team coach</b>
                  <input
                    className="input mt-1"
                    value={travelTeamCoachName}
                    onChange={(e) => setTravelTeamCoachName(e.target.value)}
                  />
                </label>
                <label>
                  <b className="text-sm">Coach phone</b>
                  <input
                    className="input mt-1"
                    value={travelTeamCoachPhone}
                    onChange={(e) => setTravelTeamCoachPhone(e.target.value)}
                  />
                </label>
                <label>
                  <b className="text-sm">High school city</b>
                  <input
                    className="input mt-1"
                    value={highSchoolCity}
                    onChange={(e) => setHighSchoolCity(e.target.value)}
                  />
                </label>
                <label>
                  <b className="text-sm">High school state</b>
                  <input
                    className="input mt-1"
                    value={highSchoolState}
                    onChange={(e) => setHighSchoolState(e.target.value)}
                  />
                </label>
                <label>
                  <b className="text-sm">High school coach</b>
                  <input
                    className="input mt-1"
                    value={highSchoolCoachName}
                    onChange={(e) => setHighSchoolCoachName(e.target.value)}
                  />
                </label>
                <label>
                  <b className="text-sm">Coach phone</b>
                  <input
                    className="input mt-1"
                    value={highSchoolCoachPhone}
                    onChange={(e) => setHighSchoolCoachPhone(e.target.value)}
                  />
                </label>
                <label>
                  <b className="text-sm">Throws</b>
                  <select
                    className="input mt-1"
                    value={throws}
                    onChange={(e) => setThrows(e.target.value)}
                  >
                    <option value="">Select</option>
                    <option value="R">Right</option>
                    <option value="L">Left</option>
                  </select>
                </label>
                <label>
                  <b className="text-sm">Bats</b>
                  <select
                    className="input mt-1"
                    value={bats}
                    onChange={(e) => setBats(e.target.value)}
                  >
                    <option value="">Select</option>
                    <option value="R">Right</option>
                    <option value="L">Left</option>
                  </select>
                  {bats === "L" && (
                    <span className="block mt-2 text-sm">
                      <input
                        type="checkbox"
                        checked={slaps}
                        onChange={(e) => setSlaps(e.target.checked)}
                      />{" "}
                      Slap hitter
                    </span>
                  )}
                </label>
                <label>
                  <b className="text-sm">NCAA #</b>
                  <input
                    className="input mt-1"
                    value={ncaaNumber}
                    onChange={(e) => setNcaaNumber(e.target.value)}
                  />
                </label>
              </div>
            </section>
          )}
          {msg && (
            <StatePanel
              title={
                msg === "Profile saved." ? "Saved" : "Profile needs attention"
              }
              description={msg}
              tone={msg === "Profile saved." ? "success" : "warning"}
            />
          )}
          <button
            className="btn btn-red w-full sm:w-auto sm:min-w-56"
            disabled={saving}
          >
            {saving
              ? "Saving..."
              : isOnboarding
                ? "Save Profile & Continue"
                : "Save Profile"}
          </button>
          {isOnboarding && (
            <p className="muted text-xs">
              Every field marked * is required before continuing.
            </p>
          )}
        </form>
      </PageFrame>
    </AppShell>
  );
}
