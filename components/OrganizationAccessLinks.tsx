"use client";
import { useEffect, useState } from "react";
import { Check, Copy, ShieldCheck } from "lucide-react";

type Team = { id: string; name: string; age_group?: string | null; archived_at?: string | null };
type AccessLink = {
  id: string; team_id: string | null; role: "family" | "advisor";
  url: string; signup_code?: string | null; requires_approval: boolean;
};

export default function OrganizationAccessLinks({
  organizationId, teams, readOnly = false,
}: { organizationId: string; teams: Team[]; readOnly?: boolean }) {
  const [links, setLinks] = useState<AccessLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");

  async function load() {
    if (readOnly) return;
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/organization/setup", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "getJoinLinks", organizationId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not prepare team signup links.");
      setLinks(data.links || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not prepare team signup links.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { setLinks([]); setError(""); setCopied(""); if (!readOnly) void load(); }, [organizationId, readOnly]);

  async function copy(value: string, key: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      window.setTimeout(() => setCopied(current => current === key ? "" : current), 1600);
    } catch {
      setError("Copy failed. Please try again or copy the code manually.");
    }
  }

  return <section className="card p-5 sm:p-6 mt-5">
    <div className="rr-eyebrow">ACCESS & ONBOARDING</div>
    <h2 className="font-black text-lg">Team Signup Links & Codes</h2>
    <p className="muted text-sm mt-1">Each team has one reusable signup link and code for both Athletes and Parents/Guardians. The link opens signup with the team already selected. Existing members use their current account.</p>
    {error && <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</div>}
    {loading && !links.length && <div className="mt-5 rounded-xl border bg-slate-50 p-4 text-sm font-semibold text-slate-600">Loading team signup codes…</div>}
    {!readOnly && !!links.length && <div className="mt-5 space-y-3">
      {teams.filter(t => !t.archived_at).map(team => {
        const family = links.find(l => l.team_id === team.id && l.role === "family");
        const advisor = links.find(l => l.team_id === team.id && l.role === "advisor");
        return <div key={team.id} className="rounded-xl border p-4 space-y-3">
          <div><div className="font-black">{team.name}</div>{team.age_group && <div className="muted text-xs">{team.age_group}</div>}</div>
          <div className="rounded-lg bg-slate-50 border p-3">
            <div className="text-xs font-black uppercase tracking-wide text-slate-600">Athlete + Parent/Guardian Signup</div>
            <div className="font-mono font-black tracking-wider text-lg mt-1 select-all">{family?.signup_code || "Preparing code…"}</div>
            <div className="flex flex-wrap gap-2 mt-3">
              <button className="btn px-3 py-2 text-xs" disabled={!family} onClick={() => family && copy(family.url, family.id + ":url")}>
                {copied === family?.id + ":url" ? <Check size={14}/> : <Copy size={14}/>} Copy Signup Link
              </button>
              <button className="btn px-3 py-2 text-xs" disabled={!family?.signup_code} onClick={() => family?.signup_code && copy(family.signup_code, family.id + ":code")}>
                {copied === family?.id + ":code" ? <Check size={14}/> : <Copy size={14}/>} Copy Team Code
              </button>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="text-xs text-slate-600 flex items-start gap-2"><ShieldCheck size={15} className="shrink-0"/>Advisor invitations are separate and require Admin approval.</div>
            <button className="btn px-3 py-2 text-xs" disabled={!advisor} onClick={() => advisor && copy(advisor.url, advisor.id + ":advisor")}>
              {copied === advisor?.id + ":advisor" ? <Check size={14}/> : <Copy size={14}/>} Copy Advisor Link
            </button>
          </div>
        </div>;
      })}
    </div>}
    <div className="mt-5 rounded-xl border bg-slate-50 p-4 text-xs">
      <b>One team code. Two family roles. Private access stays protected.</b>
      <p className="muted mt-1">Parents can join the team and open Parent Home immediately. They select their athlete, who confirms the connection once before private recruiting information becomes visible. Athletes can revoke access at any time. Admin invitations are managed separately.</p>
    </div>
  </section>;
}
