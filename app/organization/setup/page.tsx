"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Archive,
  ArrowLeft,
  Check,
  Copy,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Settings2,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";

type Team = {
  id: string;
  name: string;
  age_group?: string | null;
  archived_at?: string | null;
};
type Organization = {
  id: string;
  name: string;
  branch_name?: string | null;
  city: string;
  state: string;
  join_code: string;
  teams: Team[];
};
const empty = { name: "", branchName: "", city: "", state: "" };
export default function OrganizationSetup() {
  const [organizations, setOrganizations] = useState<Organization[]>([]),
    [selected, setSelected] = useState(""),
    [form, setForm] = useState(empty),
    [teamName, setTeamName] = useState(""),
    [ageGroup, setAgeGroup] = useState(""),
    [creating, setCreating] = useState(false),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [copied, setCopied] = useState(false);
  async function load(preferred?: string) {
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/organization/setup", { cache: "no-store" }),
        d = await r.json();
      if (!r.ok)
        throw new Error(d.error || "Could not load organization setup.");
      const rows = d.organizations || [];
      setOrganizations(rows);
      const id = preferred || selected || rows[0]?.id || "";
      setSelected(id);
      const o = rows.find((x: Organization) => x.id === id);
      if (o)
        setForm({
          name: o.name,
          branchName: o.branch_name || "",
          city: o.city || "",
          state: o.state || "",
        });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not load organization setup.",
      );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);
  const org = organizations.find((o) => o.id === selected);
  function choose(id: string) {
    setCreating(false);
    setSelected(id);
    const o = organizations.find((x) => x.id === id);
    if (o)
      setForm({
        name: o.name,
        branchName: o.branch_name || "",
        city: o.city || "",
        state: o.state || "",
      });
    setError("");
    setMessage("");
  }
  async function act(body: any, success: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const r = await fetch("/api/organization/setup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
        d = await r.json();
      if (!r.ok)
        throw new Error(d.error || "Could not save organization setup.");
      setMessage(success);
      await load(d.organization?.id || selected);
      return d;
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not save organization setup.",
      );
      return null;
    } finally {
      setBusy(false);
    }
  }
  async function saveOrganization() {
    const d = await act(
      creating
        ? { action: "create", ...form }
        : { action: "update", organizationId: selected, ...form },
      creating
        ? "Organization created. Its private player join code is ready."
        : "Organization details saved.",
    );
    if (d?.organization) setCreating(false);
  }
  async function addTeam() {
    if (!teamName.trim()) return;
    const d = await act(
      { action: "addTeam", organizationId: selected, name: teamName, ageGroup },
      "Team added.",
    );
    if (d) {
      setTeamName("");
      setAgeGroup("");
    }
  }
  async function editTeam(team: Team) {
    const name = window.prompt("Team name", team.name);
    if (!name || name === team.name) return;
    await act(
      {
        action: "renameTeam",
        organizationId: selected,
        teamId: team.id,
        name,
        ageGroup: team.age_group || "",
      },
      "Team updated.",
    );
  }
  async function copy() {
    if (!org?.join_code) return;
    await navigator.clipboard?.writeText(org.join_code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }
  return (
    <AppShell>
      <div className="max-w-5xl mx-auto px-4 sm:px-5 md:px-8 py-6">
        <PageHeader
          eyebrow="OWNER SETTINGS"
          title="Organization Setup"
          subtitle="Manage each independent organization or branch, its private player join code and the teams inside it."
          action={
            <Link href="/organization" className="btn">
              <ArrowLeft size={16} />
              Organization
            </Link>
          }
        />
        {error && (
          <div
            role="alert"
            className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
          >
            {error}
          </div>
        )}
        {message && (
          <div className="mb-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-800">
            {message}
          </div>
        )}
        {loading ? (
          <div className="card p-8 text-center muted">
            Loading organization setup...
          </div>
        ) : !organizations.length && !creating ? (
          <div className="card p-6">
            <div className="font-black">Owner access required</div>
            <p className="muted text-sm mt-1">
              Only an active organization Owner can manage organization setup.
            </p>
          </div>
        ) : (
          <>
            <div className="card p-4 mb-5 flex flex-col sm:flex-row gap-3 sm:items-end">
              <label className="text-sm font-bold flex-1">
                Organization
                <select
                  className="input mt-1"
                  value={creating ? "new" : selected}
                  onChange={(e) =>
                    e.target.value === "new"
                      ? (setCreating(true),
                        setForm(empty),
                        setMessage(""),
                        setError(""))
                      : choose(e.target.value)
                  }
                >
                  {organizations.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                      {o.branch_name ? ` · ${o.branch_name}` : ""}
                    </option>
                  ))}
                  <option value="new">+ Create another organization</option>
                </select>
              </label>
            </div>
            <section className="card p-5 sm:p-6 mb-5">
              <div className="rr-eyebrow">ORGANIZATION IDENTITY</div>
              <h2 className="font-black text-lg">
                {creating ? "Create Organization" : "Organization Details"}
              </h2>
              <p className="muted text-sm mt-1">
                Use Branch only when needed. Organizations and branches never
                share player or staff access automatically.
              </p>
              <div className="grid sm:grid-cols-2 gap-4 mt-5">
                <label className="text-sm font-bold">
                  Organization *
                  <input
                    className="input mt-1"
                    value={form.name}
                    onChange={(e) =>
                      setForm((v) => ({ ...v, name: e.target.value }))
                    }
                    placeholder="KC Rebels"
                  />
                </label>
                <label className="text-sm font-bold">
                  Branch <span className="font-normal muted">(optional)</span>
                  <input
                    className="input mt-1"
                    value={form.branchName}
                    onChange={(e) =>
                      setForm((v) => ({ ...v, branchName: e.target.value }))
                    }
                    placeholder="Leave blank if not applicable"
                  />
                </label>
                <label className="text-sm font-bold">
                  City *
                  <input
                    className="input mt-1"
                    value={form.city}
                    onChange={(e) =>
                      setForm((v) => ({ ...v, city: e.target.value }))
                    }
                    placeholder="Spring Hill"
                  />
                </label>
                <label className="text-sm font-bold">
                  State *
                  <input
                    className="input mt-1"
                    value={form.state}
                    maxLength={2}
                    onChange={(e) =>
                      setForm((v) => ({
                        ...v,
                        state: e.target.value.toUpperCase(),
                      }))
                    }
                    placeholder="KS"
                  />
                </label>
              </div>
              <button
                className="btn btn-red mt-5"
                disabled={
                  busy ||
                  !form.name.trim() ||
                  !form.city.trim() ||
                  !form.state.trim()
                }
                onClick={saveOrganization}
              >
                <Save size={16} />
                {busy
                  ? "Saving..."
                  : creating
                    ? "Create Organization"
                    : "Save Details"}
              </button>
            </section>
            {!creating && org && (
              <>
                <section className="rr-priority-card p-5 sm:p-6 mb-5">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex-1">
                      <div className="rr-eyebrow">PLAYER ACCESS</div>
                      <h2 className="font-black text-lg">
                        Private Organization Code
                      </h2>
                      <div className="font-black text-2xl tracking-widest mt-3">
                        {org.join_code}
                      </div>
                      <p className="text-sm mt-2">
                        Players enter this code under Settings → Organizations.
                        It joins them only to {org.name}
                        {org.branch_name ? ` · ${org.branch_name}` : ""}.
                      </p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <button className="btn" onClick={copy}>
                        {copied ? <Check size={16} /> : <Copy size={16} />}{" "}
                        {copied ? "Copied" : "Copy Code"}
                      </button>
                      <button
                        className="btn"
                        disabled={busy}
                        onClick={() => {
                          if (
                            window.confirm(
                              "Generate a new code? The current code will stop working immediately.",
                            )
                          )
                            act(
                              {
                                action: "regenerateCode",
                                organizationId: selected,
                              },
                              "A new organization code was generated.",
                            );
                        }}
                      >
                        <RefreshCw size={16} />
                        New Code
                      </button>
                    </div>
                  </div>
                </section>
                <section className="card p-5 sm:p-6">
                  <div className="rr-eyebrow">ROSTER STRUCTURE</div>
                  <h2 className="font-black text-lg">Teams</h2>
                  <p className="muted text-sm mt-1">
                    Teams are visible only inside this organization. Team names
                    do not need to repeat the organization name.
                  </p>
                  <div className="grid sm:grid-cols-[1fr_160px_auto] gap-3 mt-5">
                    <input
                      className="input"
                      value={teamName}
                      onChange={(e) => setTeamName(e.target.value)}
                      placeholder="16 Regional Lickel"
                    />
                    <input
                      className="input"
                      value={ageGroup}
                      onChange={(e) => setAgeGroup(e.target.value)}
                      placeholder="Age group (optional)"
                    />
                    <button
                      className="btn btn-red"
                      disabled={busy || !teamName.trim()}
                      onClick={addTeam}
                    >
                      <Plus size={16} />
                      Add Team
                    </button>
                  </div>
                  <div className="space-y-2 mt-5">
                    {org.teams
                      .filter((t) => !t.archived_at)
                      .map((team) => (
                        <div
                          key={team.id}
                          className="rounded-xl border p-3 flex items-center gap-3"
                        >
                          <div className="flex-1">
                            <div className="font-bold">{team.name}</div>
                            {team.age_group && (
                              <div className="muted text-xs mt-0.5">
                                {team.age_group}
                              </div>
                            )}
                          </div>
                          <button
                            className="btn px-3 py-2 text-xs"
                            onClick={() => editTeam(team)}
                          >
                            <Settings2 size={14} />
                            Rename
                          </button>
                          <button
                            className="btn px-3 py-2 text-xs"
                            disabled={busy}
                            onClick={() =>
                              act(
                                {
                                  action: "archiveTeam",
                                  organizationId: selected,
                                  teamId: team.id,
                                },
                                "Team archived.",
                              )
                            }
                          >
                            <Archive size={14} />
                            Archive
                          </button>
                        </div>
                      ))}
                    {!org.teams.filter((t) => !t.archived_at).length && (
                      <div className="rr-empty-state">
                        <div className="font-black">No active teams</div>
                      </div>
                    )}
                  </div>
                  {org.teams.some((t) => t.archived_at) && (
                    <details className="mt-5">
                      <summary className="font-bold text-sm cursor-pointer">
                        Archived teams
                      </summary>
                      <div className="space-y-2 mt-3">
                        {org.teams
                          .filter((t) => t.archived_at)
                          .map((team) => (
                            <div
                              key={team.id}
                              className="rounded-xl border bg-slate-50 p-3 flex items-center"
                            >
                              <span className="font-bold flex-1">
                                {team.name}
                              </span>
                              <button
                                className="btn px-3 py-2 text-xs"
                                disabled={busy}
                                onClick={() =>
                                  act(
                                    {
                                      action: "restoreTeam",
                                      organizationId: selected,
                                      teamId: team.id,
                                    },
                                    "Team restored.",
                                  )
                                }
                              >
                                <RotateCcw size={14} />
                                Restore
                              </button>
                            </div>
                          ))}
                      </div>
                    </details>
                  )}
                </section>
              </>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
