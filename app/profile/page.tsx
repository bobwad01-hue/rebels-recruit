"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Sparkles, ChevronRight } from "lucide-react";
import AppShell from "@/components/AppShell";
import PlayerPhotoUpload from "@/components/PlayerPhotoUpload";
import PageHeader from "@/components/PageHeader";
import { PageFrame, StatePanel } from "@/components/ProductUI";
import { createClient } from "@/lib/supabase-browser";
import { DEFAULT_TIMEZONE, US_TIMEZONES } from "@/lib/us-timezones";

const SOFTBALL_POSITIONS = ["P", "C", "1B", "2B", "3B", "SS", "OF", "LF", "CF", "RF", "UTL"];
const organizationLabel = (m: any) => {
  const o = Array.isArray(m?.organizations) ? m.organizations[0] : m?.organizations;
  return [o?.name, o?.branch_name, [o?.city, o?.state].filter(Boolean).join(", ")]
    .filter(Boolean)
    .join(" · ");
};

export default function Profile() {
  const [name, setName] = useState("");
  const [userId, setUserId] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [classYear, setClassYear] = useState("");
  const [jerseyNumber, setJerseyNumber] = useState("");
  const [school, setSchool] = useState("");
  const [positions, setPositions] = useState<string[]>([]);
  const [gpa, setGpa] = useState("");
  const [homeCity, setHomeCity] = useState("");
  const [state, setState] = useState("");
  const [homeZip, setHomeZip] = useState("");
  const [majors, setMajors] = useState("");
  const [organizationId, setOrganizationId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [timezone, setTimezone] = useState(DEFAULT_TIMEZONE);
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [xTwitter, setXTwitter] = useState("");
  const [sportsRecruitsUrl, setSportsRecruitsUrl] = useState("");
  const [travelTeamCoachName, setTravelTeamCoachName] = useState("");
  const [travelTeamCoachPhone, setTravelTeamCoachPhone] = useState("");
  const [travelTeamCoachEmail, setTravelTeamCoachEmail] = useState("");
  const [highSchoolCity, setHighSchoolCity] = useState("");
  const [highSchoolState, setHighSchoolState] = useState("");
  const [highSchoolCoachName, setHighSchoolCoachName] = useState("");
  const [highSchoolCoachPhone, setHighSchoolCoachPhone] = useState("");
  const [highSchoolCoachEmail, setHighSchoolCoachEmail] = useState("");
  const [throws, setThrows] = useState("");
  const [bats, setBats] = useState("");
  const [slaps, setSlaps] = useState(false);
  const [ncaaNumber, setNcaaNumber] = useState("");

  useEffect(() => {
    (async () => {
      const c = createClient();
      const { data: { user }, error: authError } = await c.auth.getUser();
      if (authError || !user) {
        setLoadError("Your profile could not be loaded. Please try again.");
        setLoading(false);
        return;
      }
      setEmail(user.email || "");
      setUserId(user.id);
      const [profileResult, athleteResult, teamResponse, signatureResponse] = await Promise.all([
        c.from("profiles").select("full_name,phone,timezone,profile_completed_at,avatar_url").eq("id", user.id).single(),
        c.from("athlete_profiles").select("*").eq("user_id", user.id).maybeSingle(),
        fetch("/api/profile/team"),
        fetch("/api/profile/email-signature"),
      ]);
      if (profileResult.error || athleteResult.error || !teamResponse.ok || !signatureResponse.ok) {
        setLoadError("Your complete profile could not be loaded. No changes have been made. Please try again.");
        setLoading(false);
        return;
      }
      const p = profileResult.data;
      const a = athleteResult.data;
      const teamRes = (await teamResponse.json()) as { organizations?: any[]; teams?: any[]; currentOrganizationId?: string; currentTeamId?: string; error?: string };
      const sigRes = (await signatureResponse.json()) as { signature?: Record<string, any> };
      setName(p?.full_name || "");
      setAvatarUrl(p?.avatar_url || "");
      setPhone(p?.phone || "");
      setTimezone(p?.timezone || DEFAULT_TIMEZONE);
      setIsOnboarding(!p?.profile_completed_at);
      setClassYear(a?.class_year?.toString() || "");
      setJerseyNumber(a?.jersey_number?.toString() || "");
      setSchool(a?.school_name || "");
      setPositions(Array.isArray(a?.positions) ? a.positions : []);
      setGpa(a?.gpa?.toString() || "");
      setHomeCity(a?.home_city || "");
      setState(a?.primary_state || "");
      setHomeZip(a?.home_zip || "");
      setMajors((a?.interested_majors || []).join(", "));

      const availableOrganizations = (teamRes.organizations || []).filter((m: any) => m.status === "active");
      const availableTeams = teamRes.teams || [];
      setOrganizations(availableOrganizations);
      setTeams(availableTeams);
      const initialOrganizationId = teamRes.currentOrganizationId || (availableOrganizations.length === 1 ? availableOrganizations[0].organization_id : "");
      setOrganizationId(initialOrganizationId);
      const initialTeamOptions = availableTeams.filter((t: any) => t.organization_id === initialOrganizationId);
      setTeamId(teamRes.currentTeamId || (initialTeamOptions.length === 1 ? initialTeamOptions[0].id : ""));
      if (teamRes.error) setMsg(teamRes.error);

      const s = sigRes.signature || {};
      setXTwitter(s.xTwitter || "");
      setSportsRecruitsUrl(s.sportsRecruitsUrl || "");
      setTravelTeamCoachName(s.travelTeamCoachName || "");
      setTravelTeamCoachPhone(s.travelTeamCoachPhone || "");
      setTravelTeamCoachEmail(s.travelTeamCoachEmail || "");
      setHighSchoolCity(s.highSchoolCity || "");
      setHighSchoolState(s.highSchoolState || "");
      setHighSchoolCoachName(s.highSchoolCoachName || "");
      setHighSchoolCoachPhone(s.highSchoolCoachPhone || "");
      setHighSchoolCoachEmail(s.highSchoolCoachEmail || "");
      setNcaaNumber(s.ncaaNumber || "");
      const m = String(s.throwBat || "").match(/^([RL])\/([RL])/i);
      if (m) {
        setThrows(m[1].toUpperCase());
        setBats(m[2].toUpperCase());
        setSlaps(/slap/i.test(s.throwBat));
      }
      setLoading(false);
    })();
  }, []);

  const teamOptions = useMemo(() => teams.filter((t: any) => t.organization_id === organizationId), [teams, organizationId]);
  const selectedTeam = teams.find((t: any) => t.id === teamId);

  function chooseOrganization(nextOrganizationId: string) {
    setOrganizationId(nextOrganizationId);
    const nextTeams = teams.filter((t: any) => t.organization_id === nextOrganizationId);
    setTeamId(nextTeams.length === 1 ? nextTeams[0].id : "");
  }

  function togglePosition(p: string) {
    setPositions((v) => (v.includes(p) ? v.filter((x) => x !== p) : [...v, p]));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    if (!name.trim() || !phone.trim() || !classYear || !jerseyNumber.trim() || !school.trim() || !homeCity.trim() || !state.trim() || !homeZip.trim() || !positions.length || !timezone || !gpa || !majors.trim() || !organizationId || !teamId) {
      setMsg("Please complete every required profile field before continuing.");
      return;
    }
    setSaving(true);
    const c = createClient();
    const { data: { user } } = await c.auth.getUser();
    const completedAt = new Date().toISOString();
    const throwBat = throws && bats ? `${throws}/${bats}${bats === "L" && slaps ? " (Slap)" : ""}` : "";
    const [p, a, tr, sr] = await Promise.all([
      c.from("profiles").update({ full_name: name.trim(), phone: phone.trim(), timezone, profile_completed_at: completedAt }).eq("id", user?.id),
      c.from("athlete_profiles").upsert({ user_id: user?.id, class_year: Number(classYear), jersey_number: jerseyNumber.trim(), school_name: school.trim(), positions, gpa: Number(gpa), home_city: homeCity.trim(), primary_state: state.trim(), home_zip: homeZip.trim(), interested_majors: majors.split(",").map((x) => x.trim()).filter(Boolean) }, { onConflict: "user_id" }),
      fetch("/api/profile/team", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organizationId, teamId }) }),
      fetch("/api/profile/email-signature", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organizationId, xTwitter, sportsRecruitsUrl, travelTeamName: selectedTeam?.name || "", travelTeamCoachName, travelTeamCoachPhone, travelTeamCoachEmail, highSchoolCity, highSchoolState, highSchoolCoachName, highSchoolCoachPhone, highSchoolCoachEmail, throwBat, ncaaNumber }) }),
    ]);
    setSaving(false);
    let teamError = "";
    let signatureError = "";
    try { if (!tr.ok) teamError = (await tr.json()).error || "Could not save organization and team."; } catch {}
    try { if (!sr.ok) signatureError = (await sr.json()).error || "Could not save recruiting contact information."; } catch {}
    if (p.error || a.error || teamError || signatureError) {
      setMsg(p.error?.message || a.error?.message || teamError || signatureError || "Could not save profile.");
      return;
    }
    setMsg("Profile saved.");
    if (isOnboarding) location.href = "/onboarding";
  }

  return (
    <AppShell>
      <PageFrame size="5xl">
        <PageHeader title={isOnboarding ? "Set Up Your Profile" : "Profile"} subtitle={isOnboarding ? "Complete your athlete profile so Rebels Recruit can personalize your experience." : "Keep your athlete, softball, academic and recruiting-contact information current in one place."} />
        {!isOnboarding && <Link href="/fit-profile" className="rr-priority-card rr-interactive-card mb-5 p-4 flex items-center gap-3"><Sparkles size={21} className="text-red-600" /><div className="flex-1"><div className="rr-eyebrow">SCHOOL DISCOVERY</div><div className="font-black">School Preferences</div><div className="muted text-xs mt-0.5">Tell Rebels Recruit what matters to you so Find Schools and School Fit can work better.</div></div><ChevronRight size={18} /></Link>}
        {loading && <StatePanel title="Loading profile" description="Loading your saved profile information..." />}
        {loadError && <StatePanel title="Profile could not be loaded" description={loadError} tone="error" action={<button className="btn" onClick={() => location.reload()}>Try Again</button>} />}
        {!loading && !loadError && (
          <form onSubmit={save} className="space-y-5">
            <section className="card p-5 sm:p-6">
              <div className="mb-5"><h2 className="font-black text-lg">Player photo</h2><p className="muted text-sm mt-1">This headshot appears throughout Rebels Recruit, including Big Board and War Room.</p></div>
              {userId&&<div className="mb-6 pb-6 border-b"><PlayerPhotoUpload athleteId={userId} name={name||"Player"} initialUrl={avatarUrl} onSaved={setAvatarUrl}/></div>}
              <div className="mb-5"><h2 className="font-black text-lg">Profile essentials</h2><p className="muted text-sm mt-1">All fields below are required. These details drive personalization, filtering and your recruiting identity.</p></div>
              <div className="grid md:grid-cols-2 gap-4">
                <label><b className="text-sm">Full name *</b><input required className="input mt-1" value={name} onChange={(e) => setName(e.target.value)} /></label>
                <label><b className="text-sm">Phone number *</b><input required className="input mt-1" value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
                <label><b className="text-sm">Class year *</b><input required className="input mt-1" type="number" value={classYear} onChange={(e) => setClassYear(e.target.value)} /></label>
                <label><b className="text-sm">Jersey number *</b><input required className="input mt-1" value={jerseyNumber} onChange={(e) => setJerseyNumber(e.target.value.replace(/^#/, ""))} /></label>
                <label>
                  <b className="text-sm">Organization *</b>
                  <select required className="input mt-1" value={organizationId} onChange={(e) => chooseOrganization(e.target.value)}>
                    <option value="">Select organization</option>
                    {organizations.map((m: any) => <option key={m.organization_id} value={m.organization_id}>{organizationLabel(m)}</option>)}
                  </select>
                  <span className="muted text-xs mt-1 block">Choose the organization you already have access to. <Link href="/organizations" className="font-bold underline">Manage organization access</Link></span>
                </label>
                <label>
                  <b className="text-sm">Team *</b>
                  <select required className="input mt-1" value={teamId} onChange={(e) => setTeamId(e.target.value)} disabled={!organizationId || teamOptions.length === 0}>
                    <option value="">{!organizationId ? "Choose organization first" : teamOptions.length ? "Select team" : "No teams available"}</option>
                    {teamOptions.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  {organizationId && teamOptions.length === 0 && <span className="text-xs mt-1 block text-amber-700">No active teams are available for this organization. Manage organization access or ask an organization administrator to add you to a team.</span>}
                </label>
                <label><b className="text-sm">High school *</b><input required className="input mt-1" value={school} onChange={(e) => setSchool(e.target.value)} /></label>
                <label><b className="text-sm">Home city *</b><input required className="input mt-1" value={homeCity} onChange={(e) => setHomeCity(e.target.value)} /></label>
                <label><b className="text-sm">Home state *</b><input required className="input mt-1" value={state} onChange={(e) => setState(e.target.value)} /></label>
                <label><b className="text-sm">Home ZIP *</b><input required className="input mt-1" value={homeZip} onChange={(e) => setHomeZip(e.target.value.replace(/[^0-9-]/g, ""))} /></label>
                <div className="md:col-span-2"><b className="text-sm">Positions *</b><div className="flex flex-wrap gap-2 mt-2">{SOFTBALL_POSITIONS.map((p) => <button key={p} type="button" onClick={() => togglePosition(p)} aria-pressed={positions.includes(p)} className={`min-h-11 rounded-lg border px-3 py-2 text-sm font-bold ${positions.includes(p) ? "bg-slate-950 text-white" : "bg-white"}`}>{p}</button>)}</div></div>
                <label><b className="text-sm">Time zone *</b><select required className="input mt-1" value={timezone} onChange={(e) => setTimezone(e.target.value)}>{US_TIMEZONES.map((z) => <option key={z.value} value={z.value}>{z.label}</option>)}</select></label>
                <label><b className="text-sm">GPA *</b><input required className="input mt-1" value={gpa} onChange={(e) => setGpa(e.target.value)} /></label>
                <label className="md:col-span-2"><b className="text-sm">Academic interests / possible majors *</b><input required className="input mt-1" value={majors} onChange={(e) => setMajors(e.target.value)} /></label>
              </div>
            </section>
            {!isOnboarding && (
              <section className="card p-5 sm:p-6">
                <div className="mb-5"><h2 className="font-black text-lg">Recruiting contact & email profile</h2><p className="muted text-sm mt-1">Optional information used in recruiting emails and profile summaries.</p></div>
                <div className="grid md:grid-cols-2 gap-4">
                  <label><b className="text-sm">Email</b><input className="input mt-1 bg-slate-50" value={email} readOnly /></label>
                  <label><b className="text-sm">X / Twitter</b><input className="input mt-1" value={xTwitter} onChange={(e) => setXTwitter(e.target.value)} /></label>
                  <label className="md:col-span-2"><b className="text-sm">SportsRecruits profile</b><input className="input mt-1" value={sportsRecruitsUrl} onChange={(e) => setSportsRecruitsUrl(e.target.value)} /></label>
                  <label><b className="text-sm">Club/Travel Team Coach</b><input className="input mt-1" value={travelTeamCoachName} onChange={(e) => setTravelTeamCoachName(e.target.value)} /></label>
                  <label><b className="text-sm">Club/Travel Team Coach Phone</b><input className="input mt-1" value={travelTeamCoachPhone} onChange={(e) => setTravelTeamCoachPhone(e.target.value)} /></label>
                  <label><b className="text-sm">Club/Travel Team Coach Email</b><input className="input mt-1" type="email" value={travelTeamCoachEmail} onChange={(e) => setTravelTeamCoachEmail(e.target.value)} /></label>
                  <label><b className="text-sm">High School City</b><input className="input mt-1" value={highSchoolCity} onChange={(e) => setHighSchoolCity(e.target.value)} /></label>
                  <label><b className="text-sm">High School State</b><input className="input mt-1" value={highSchoolState} onChange={(e) => setHighSchoolState(e.target.value)} /></label>
                  <label><b className="text-sm">HS Coach</b><input className="input mt-1" value={highSchoolCoachName} onChange={(e) => setHighSchoolCoachName(e.target.value)} /></label>
                  <label><b className="text-sm">HS Coach Phone</b><input className="input mt-1" value={highSchoolCoachPhone} onChange={(e) => setHighSchoolCoachPhone(e.target.value)} /></label>
                  <label><b className="text-sm">HS Coach Email</b><input className="input mt-1" type="email" value={highSchoolCoachEmail} onChange={(e) => setHighSchoolCoachEmail(e.target.value)} /></label>
                  <label><b className="text-sm">Throws</b><select className="input mt-1" value={throws} onChange={(e) => setThrows(e.target.value)}><option value="">Select</option><option value="R">Right</option><option value="L">Left</option></select></label>
                  <label><b className="text-sm">Bats</b><select className="input mt-1" value={bats} onChange={(e) => setBats(e.target.value)}><option value="">Select</option><option value="R">Right</option><option value="L">Left</option></select>{bats === "L" && <span className="block mt-2 text-sm"><input type="checkbox" checked={slaps} onChange={(e) => setSlaps(e.target.checked)} /> Slap hitter</span>}</label>
                  <label><b className="text-sm">NCAA #</b><input className="input mt-1" value={ncaaNumber} onChange={(e) => setNcaaNumber(e.target.value)} /></label>
                </div>
              </section>
            )}
            {msg && <StatePanel title={msg === "Profile saved." ? "Saved" : "Profile needs attention"} description={msg} tone={msg === "Profile saved." ? "success" : "warning"} />}
            <button className="btn btn-red w-full sm:w-auto sm:min-w-56" disabled={saving}>{saving ? "Saving..." : isOnboarding ? "Save Profile & Continue" : "Save Profile"}</button>
            {isOnboarding && <p className="muted text-xs">Every field marked * is required before continuing.</p>}
          </form>
        )}
      </PageFrame>
    </AppShell>
  );
}
