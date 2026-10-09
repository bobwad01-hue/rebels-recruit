"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, ArrowUpDown, Building2, Clock3, FilterX,
  Search, ShieldCheck, Users, X, RefreshCw, UserRoundCog, Mail, ChevronLeft, ChevronRight,
  Ban, RotateCcw, Trash2, ShieldAlert, AlertTriangle,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";

type OrgAccess = { id: string; name: string; roles: string[]; grants: string[]; status: string };
type TeamAccess = { id: string; name: string; organization_id: string; organization_name: string; roles: string[]; archived: boolean };
type PendingRequest = { id: string; role: string; status: string; organization_id: string | null; team_ids: string[]; requested_at: string };
type Account = {
  id: string; full_name: string | null; email: string | null; app_role: string;
  created_at: string | null; profile_completed_at: string | null;
  account_status: "active" | "suspended"; suspended_at: string | null; suspension_reason: string | null;
  advisor_account_type: string | null; commercial_status: string | null;
  organizations: OrgAccess[]; teams: TeamAccess[]; platform_roles: string[];
  global_roles: string[]; pending_requests: PendingRequest[];
  linked_athletes: { id: string; name: string }[];
};
type OrgOption = { id: string; name: string };
type TeamOption = { id: string; name: string; organization_id: string; archived: boolean };
type HistoryItem = { id: string; action: string; created_at: string; metadata: Record<string, any> | null };
type AuthDetails = { last_sign_in_at: string | null; email_confirmed_at: string | null; providers: string[] };
type LifecycleAction = "suspend" | "restore" | "delete";
const pageSize = 25;
const roleNames: Record<string, string> = {
  athlete: "Athlete", parent: "Parent / Guardian", advisor: "Advisor / Coach",
  admin: "Admin", super_owner: "Super Owner", team_admin: "Team Admin", org_admin: "Organization Admin",
};
const roleName = (role: string) => roleNames[role] || role.replaceAll("_", " ");
const dateLabel = (value: string | null | undefined) => value
  ? new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
  : "Unknown";
const nameOf = (a: Account) => a.full_name?.trim() || a.email || "Unnamed account";
const firstOrg = (a: Account) => a.organizations[0]?.name || "Independent";
const firstTeam = (a: Account) => a.teams[0]?.name || "No team";
const accessRole = (a: Account) => a.platform_roles.includes("super_owner") ? "Super Owner"
  : a.organizations.some(o => o.roles.includes("admin")) ? "Organization Admin"
  : a.teams.some(t => t.roles.includes("admin")) ? "Team Admin"
  : a.organizations.some(o => o.roles.includes("advisor")) || a.teams.some(t => t.roles.includes("advisor")) ? "Advisor"
  : roleName(a.app_role);
const normalized = (value: string) => value.toLocaleLowerCase().trim();

function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "red" | "green" | "amber" }) {
  const styles = {
    neutral: "border-slate-200 bg-slate-50 text-slate-600",
    red: "border-red-200 bg-red-50 text-red-700",
    green: "border-green-200 bg-green-50 text-green-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
  };
  return <span className={"inline-flex items-center rounded-lg border px-2 py-1 text-xs font-semibold " + styles[tone]}>{children}</span>;
}

export default function PlatformAccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [organizations, setOrganizations] = useState<OrgOption[]>([]);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("all");
  const [orgFilter, setOrgFilter] = useState("all");
  const [teamFilter, setTeamFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [accountFilter, setAccountFilter] = useState("all");
  const [commercialFilter, setCommercialFilter] = useState("all");
  const [sort, setSort] = useState("name_asc");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [authDetails, setAuthDetails] = useState<AuthDetails | null>(null);
  const [viewerId, setViewerId] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmAction, setConfirmAction] = useState<LifecycleAction | null>(null);
  const [confirmIdentity, setConfirmIdentity] = useState("");
  const [confirmDeleteText, setConfirmDeleteText] = useState("");
  const [lifecycleReason, setLifecycleReason] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [chosenOrgId, setChosenOrgId] = useState("");
  const [chosenTeamId, setChosenTeamId] = useState("");
  const [orgAdvisor, setOrgAdvisor] = useState(false);
  const [orgAdmin, setOrgAdmin] = useState(false);
  const [teamRole, setTeamRole] = useState("advisor");
  const [teamEnabled, setTeamEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/platform/accounts", { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Unable to load accounts.");
      setAccounts(d.accounts || []);
      setViewerId(d.viewerId || "");
      setOrganizations(d.organizations || []);
      setTeams(d.teams || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load accounts.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, []);

  const selected = useMemo(() => accounts.find(a => a.id === selectedId) || null, [accounts, selectedId]);
  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    setHistoryLoading(true);
    fetch("/api/platform/accounts?historyFor=" + encodeURIComponent(selectedId), { cache: "no-store" })
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error || "History unavailable."); return d; })
      .then(d => { if (active) { setHistory(d.history || []); setAuthDetails(d.authDetails || null); } })
      .catch(() => { if (active) { setHistory([]); setAuthDetails(null); } })
      .finally(() => { if (active) setHistoryLoading(false); });
    return () => { active = false; };
  }, [selectedId]);

  const teamOptions = useMemo(
    () => teams.filter(t => !t.archived && (orgFilter === "all" || t.organization_id === orgFilter))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [teams, orgFilter],
  );

  const filtered = useMemo(() => {
    const q = normalized(search);
    const rows = accounts.filter(a => {
      if (q && ![
        a.full_name || "", a.email || "", a.app_role,
        ...a.organizations.map(o => o.name), ...a.teams.map(t => t.name),
      ].some(value => normalized(value).includes(q))) return false;
      const activeRoles = new Set([
        a.app_role, ...a.platform_roles, ...a.organizations.flatMap(o => o.roles),
        ...a.teams.flatMap(t => t.roles),
      ]);
      if (role !== "all" && !activeRoles.has(role)) return false;
      if (orgFilter === "independent" && a.organizations.length) return false;
      if (orgFilter !== "all" && orgFilter !== "independent" && !a.organizations.some(o => o.id === orgFilter)) return false;
      if (teamFilter === "independent" && a.teams.length) return false;
      if (teamFilter !== "all" && teamFilter !== "independent" && !a.teams.some(t => t.id === teamFilter)) return false;
      if (statusFilter === "complete" && !a.profile_completed_at) return false;
      if (statusFilter === "incomplete" && a.profile_completed_at) return false;
      if (statusFilter === "pending" && !a.pending_requests.length) return false;
      if (accountFilter !== "all" && a.account_status !== accountFilter) return false;
      if (commercialFilter !== "all" && (a.commercial_status || "none") !== commercialFilter) return false;
      return true;
    });
    const compare = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: "base", numeric: true });
    const alpha = (a: Account, b: Account) => compare(nameOf(a), nameOf(b));
    rows.sort((a, b) => {
      switch (sort) {
        case "name_desc": return -alpha(a, b);
        case "email_asc": return compare(a.email || "", b.email || "") || alpha(a, b);
        case "role_asc": return compare(roleName(a.app_role), roleName(b.app_role)) || alpha(a, b);
        case "access_role_asc": return compare(accessRole(a), accessRole(b)) || alpha(a, b);
        case "organization_asc": return compare(a.organizations[0]?.name || "\uffff", b.organizations[0]?.name || "\uffff") || alpha(a, b);
        case "team_asc": return compare(a.teams[0]?.name || "\uffff", b.teams[0]?.name || "\uffff") || alpha(a, b);
        case "newest": return compare(b.created_at || "", a.created_at || "") || alpha(a, b);
        case "oldest": return compare(a.created_at || "", b.created_at || "") || alpha(a, b);
        case "incomplete_first": return Number(Boolean(a.profile_completed_at)) - Number(Boolean(b.profile_completed_at)) || alpha(a, b);
        default: return alpha(a, b);
      }
    });
    return rows;
  }, [accounts, search, role, orgFilter, teamFilter, statusFilter, accountFilter, commercialFilter, sort]);

  useEffect(() => { setPage(1); }, [search, role, orgFilter, teamFilter, statusFilter, accountFilter, commercialFilter, sort]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((Math.min(page, totalPages) - 1) * pageSize, Math.min(page, totalPages) * pageSize);
  const isFiltered = Boolean(search || role !== "all" || orgFilter !== "all" || teamFilter !== "all" || statusFilter !== "all" || accountFilter !== "all" || commercialFilter !== "all");
  const independentCount = accounts.filter(a => !a.organizations.length).length;
  const pendingCount = accounts.filter(a => a.pending_requests.length).length;

  function resetFilters() {
    setSearch(""); setRole("all"); setOrgFilter("all"); setTeamFilter("all");
    setStatusFilter("all"); setAccountFilter("all"); setCommercialFilter("all"); setSort("name_asc");
  }
  function chooseOrg(id: string, account: Account | null = selected) {
    setChosenOrgId(id);
    const grants = account?.organizations.find(o => o.id === id)?.grants || [];
    setOrgAdvisor(grants.includes("advisor"));
    setOrgAdmin(grants.includes("admin"));
  }
  function chooseTeam(id: string, nextRole = teamRole, account: Account | null = selected) {
    setChosenTeamId(id);
    setTeamRole(nextRole);
    setTeamEnabled(Boolean(account?.teams.find(t => t.id === id)?.roles.includes(nextRole)));
  }
  function openAccount(account: Account) {
    setSelectedId(account.id);
    setHistory([]);
    setAuthDetails(null);
    setConfirmAction(null);
    setActionMessage("");
    setActionError("");
    chooseOrg(account.organizations[0]?.id || organizations[0]?.id || "", account);
    chooseTeam(account.teams.find(t => !t.archived)?.id || teams.find(t => !t.archived)?.id || "", "advisor", account);
  }
  async function updateAccess(body: Record<string, unknown>, message: string) {
    if (!selected) return;
    setSaving(true); setActionError(""); setActionMessage("");
    try {
      const r = await fetch("/api/platform/accounts", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, userId: selected.id }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Unable to update access.");
      const refresh = await fetch("/api/platform/accounts", { cache: "no-store" });
      const refreshed = await refresh.json();
      if (!refresh.ok) throw new Error(refreshed.error || "Access saved but the directory could not refresh.");
      const nextAccounts: Account[] = refreshed.accounts || [];
      setAccounts(nextAccounts);
      setOrganizations(refreshed.organizations || []);
      setTeams(refreshed.teams || []);
      const updated = nextAccounts.find(a => a.id === selected.id);
      if (updated) {
        const grants = updated.organizations.find(o => o.id === chosenOrgId)?.grants || [];
        setOrgAdvisor(grants.includes("advisor"));
        setOrgAdmin(grants.includes("admin"));
        setTeamEnabled(Boolean(updated.teams.find(t => t.id === chosenTeamId)?.roles.includes(teamRole)));
      }
      setActionMessage(message);
      const historyResponse = await fetch("/api/platform/accounts?historyFor=" + encodeURIComponent(selected.id), { cache: "no-store" });
      if (historyResponse.ok) setHistory((await historyResponse.json()).history || []);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Unable to update access.");
    } finally {
      setSaving(false);
    }
  }
  function saveOrg() {
    if (!selected || !chosenOrgId) return;
    const grants = selected.organizations.find(o => o.id === chosenOrgId)?.grants || [];
    if (!orgAdmin && !orgAdvisor && grants.length && !window.confirm("Remove this account's organization-wide Advisor and Admin roles? Team-specific access will remain.")) return;
    void updateAccess({ action: "setOrganizationStaffRoles", organizationId: chosenOrgId, advisor: orgAdvisor, admin: orgAdmin }, "Organization roles saved.");
  }
  function saveTeam() {
    if (!selected || !chosenTeamId) return;
    const active = Boolean(selected.teams.find(t => t.id === chosenTeamId)?.roles.includes(teamRole));
    if (active && !teamEnabled && !window.confirm("Revoke this account's " + roleName(teamRole) + " access to this team?")) return;
    void updateAccess({ action: "setTeamStaffRole", teamId: chosenTeamId, role: teamRole, enabled: teamEnabled }, "Team access saved.");
  }

  const staffEditable = selected && ["advisor", "admin"].includes(selected.app_role);
  const protectedAccount = Boolean(selected && (selected.id === viewerId || selected.platform_roles.includes("super_owner")));
  const deleteIdentity = selected?.email || selected?.id || "";
  const accountOrg = selected?.organizations.find(o => o.id === chosenOrgId);
  const accountTeam = selected?.teams.find(t => t.id === chosenTeamId);

  return <AppShell>
    <main className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="PLATFORM ADMIN"
        title="Account Directory"
        subtitle="Find and manage RLTNL accounts across every organization, team and independent user."
        action={<Link href="/platform-admin" className="btn"><ArrowLeft size={16}/>Platform Admin</Link>}
      />
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={<Users size={18}/>} label="Total accounts" value={accounts.length}/>
        <Stat icon={<Building2 size={18}/>} label="Organization-affiliated" value={accounts.length - independentCount}/>
        <Stat icon={<Users size={18}/>} label="Organization-independent" value={independentCount}/>
        <Stat icon={<Clock3 size={18}/>} label="Accounts with pending requests" value={pendingCount}/>
      </div>
      <section className="card p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-lg font-black">Search & filter accounts</h2><p className="mt-1 text-xs text-slate-500">Roles include active organization/team assignments and platform access. Account type is shown separately.</p></div>
          <div className="flex gap-2">
            {isFiltered && <button type="button" className="btn text-xs" onClick={resetFilters}><FilterX size={15}/>Clear filters</button>}
            <button type="button" className="btn text-xs" disabled={loading} onClick={() => void load()}><RefreshCw size={15}/>Refresh</button>
          </div>
        </div>
        <label className="relative block">
          <span className="sr-only">Search accounts by name, email, organization or team</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
          <input className="input w-full pl-10" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, email, organization or team"/>
        </label>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <Field label="Role">
            <select className="input w-full" value={role} onChange={e => setRole(e.target.value)}>
              <option value="all">All roles</option>
              <option value="athlete">Athlete</option><option value="parent">Parent / Guardian</option>
              <option value="advisor">Advisor / Coach</option><option value="admin">Admin</option>
              <option value="super_owner">Super Owner</option>
            </select>
          </Field>
          <Field label="Organization">
            <select className="input w-full" value={orgFilter} onChange={e => { setOrgFilter(e.target.value); setTeamFilter("all"); }}>
              <option value="all">All organizations</option>
              <option value="independent">Independent / no organization</option>
              {organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </Field>
          <Field label="Team">
            <select className="input w-full" value={teamFilter} onChange={e => setTeamFilter(e.target.value)}>
              <option value="all">All teams</option>
              <option value="independent">Independent / no team</option>
              {teamOptions.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </Field>
          <Field label="Profile status">
            <select className="input w-full" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="all">All profiles</option><option value="complete">Complete</option>
              <option value="incomplete">Incomplete</option><option value="pending">Pending access request</option>
            </select>
          </Field>
          <Field label="Commercial status">
            <select className="input w-full" value={commercialFilter} onChange={e => setCommercialFilter(e.target.value)}>
              <option value="all">All commercial statuses</option>
              <option value="pending">Pending</option><option value="active">Active</option>
              <option value="not_required">Not required</option><option value="declined">Declined</option>
              <option value="none">Not specified</option>
            </select>
          </Field>
          <Field label="Sort by">
            <div className="relative">
              <ArrowUpDown size={15} className="pointer-events-none absolute right-9 top-1/2 -translate-y-1/2 text-slate-400"/>
              <select className="input w-full" value={sort} onChange={e => setSort(e.target.value)}>
                <option value="name_asc">Name A–Z</option><option value="name_desc">Name Z–A</option>
                <option value="email_asc">Email A–Z</option><option value="role_asc">Account type A–Z</option><option value="access_role_asc">Access role A–Z</option>
                <option value="organization_asc">Organization A–Z</option><option value="team_asc">Team A–Z</option>
                <option value="newest">Newest first</option><option value="oldest">Oldest first</option>
                <option value="incomplete_first">Incomplete profiles first</option>
              </select>
            </div>
          </Field>
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-4 sm:px-5">
          <div><h2 className="text-lg font-black">All accounts</h2><p className="text-xs text-slate-500">{loading ? "Loading…" : String(filtered.length) + " of " + String(accounts.length) + " accounts"}</p></div>
          <Badge>{isFiltered ? "Filtered results" : "Platform-wide"}</Badge>
        </div>
        {loading ? <div className="p-8 text-center text-sm text-slate-500">Loading accounts…</div> :
          !filtered.length ? <div className="p-10 text-center"><div className="font-bold">No accounts match these filters.</div><button className="btn mt-4" onClick={resetFilters}>Reset filters</button></div> :
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr><th className="px-5 py-3">Account</th><th className="px-4 py-3">Account type / roles</th><th className="px-4 py-3">Organization</th><th className="px-4 py-3">Team</th><th className="px-4 py-3">Joined</th><th className="px-4 py-3 text-right">Details</th></tr>
              </thead>
              <tbody className="divide-y">
                {visible.map(a => <tr key={a.id} className="hover:bg-slate-50/80">
                  <td className="px-5 py-4"><div className="font-bold text-slate-900">{nameOf(a)}</div><div className="mt-1 break-all text-xs text-slate-500">{a.email || "No email"}</div>{a.pending_requests.length > 0 && <div className="mt-2"><Badge tone="amber">{a.pending_requests.length} pending request{a.pending_requests.length === 1 ? "" : "s"}</Badge></div>}</td>
                  <td className="px-4 py-4"><div><Badge tone={a.app_role === "admin" ? "red" : "neutral"}>{roleName(a.app_role)}</Badge></div><div className="mt-1 flex max-w-52 flex-wrap gap-1">{a.platform_roles.includes("super_owner") && <Badge tone="red">Super Owner</Badge>}{a.organizations.some(o => o.roles.includes("admin")) && <Badge>Org Admin</Badge>}{a.teams.some(t => t.roles.includes("admin")) && <Badge>Team Admin</Badge>}{a.organizations.some(o => o.roles.includes("advisor")) && <Badge>Advisor</Badge>}</div></td>
                  <td className="px-4 py-4"><div className="max-w-48 font-medium">{firstOrg(a)}</div>{a.organizations.length > 1 && <div className="text-xs text-slate-500">+{a.organizations.length - 1} more</div>}</td>
                  <td className="px-4 py-4"><div className="max-w-48">{firstTeam(a)}</div>{a.teams.length > 1 && <div className="text-xs text-slate-500">+{a.teams.length - 1} more</div>}</td>
                  <td className="whitespace-nowrap px-4 py-4 text-xs text-slate-500">{dateLabel(a.created_at)}</td>
                  <td className="px-4 py-4 text-right"><button className="btn whitespace-nowrap text-xs" onClick={() => openAccount(a)}>View account</button></td>
                </tr>)}
              </tbody>
            </table>
          </div>}
        {!loading && filtered.length > pageSize && <div className="flex items-center justify-between border-t px-5 py-3 text-xs text-slate-600">
          <span>Page {Math.min(page, totalPages)} of {totalPages}</span>
          <div className="flex gap-2">
            <button className="btn p-2" disabled={page <= 1} aria-label="Previous page" onClick={() => setPage(p => Math.max(1, p - 1))}><ChevronLeft size={16}/></button>
            <button className="btn p-2" disabled={page >= totalPages} aria-label="Next page" onClick={() => setPage(p => Math.min(totalPages, p + 1))}><ChevronRight size={16}/></button>
          </div>
        </div>}
      </section>
      <p className="text-xs text-slate-500">Independent means no active organization or direct team assignment. Profile completion is not a measure of recent account activity. Legacy global role flags are displayed in account details, not treated as proof of current scoped access.</p>
    </main>

    {selected && <div className="fixed inset-0 z-[100] flex justify-end bg-slate-950/55" onMouseDown={e => { if (e.target === e.currentTarget && !saving) setSelectedId(""); }}>
      <aside role="dialog" aria-modal="true" aria-label={"Account details for " + nameOf(selected)} className="flex h-full w-full max-w-2xl flex-col overflow-hidden bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b bg-white px-5 py-5 sm:px-6">
          <div className="min-w-0"><div className="rr-eyebrow">PLATFORM ACCOUNT</div><h2 className="mt-1 break-words text-xl font-black">{nameOf(selected)}</h2><div className="mt-1 flex items-center gap-2 break-all text-sm text-slate-600"><Mail size={14}/>{selected.email || "No email"}</div></div>
          <button className="btn p-2" aria-label="Close account details" disabled={saving} onClick={() => setSelectedId("")}><X size={18}/></button>
        </div>
        <div className="flex-1 space-y-5 overflow-y-auto p-5 sm:p-6">
          {actionError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{actionError}</div>}
          {actionMessage && <div role="status" className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm font-semibold text-green-700">{actionMessage}</div>}
          <div className="grid grid-cols-2 gap-3">
            <Detail label="Account type"><Badge>{roleName(selected.app_role)}</Badge></Detail>
            <Detail label="Profile"><Badge tone={selected.profile_completed_at ? "green" : "amber"}>{selected.profile_completed_at ? "Complete" : "Incomplete"}</Badge></Detail>
            <Detail label="Joined">{dateLabel(selected.created_at)}</Detail>
            <Detail label="Commercial status">{selected.commercial_status?.replaceAll("_", " ") || "Not specified"}</Detail>
            {selected.advisor_account_type && <Detail label="Advisor type">{selected.advisor_account_type.replaceAll("_", " ")}</Detail>}
            {selected.platform_roles.length > 0 && <Detail label="Platform access"><Badge tone="red">{selected.platform_roles.map(roleName).join(", ")}</Badge></Detail>}
          </div>
          <section className="rounded-2xl border p-4">
            <h3 className="font-black">Organization access</h3>
            {selected.organizations.length ? <div className="mt-3 space-y-3">{selected.organizations.map(o => <div key={o.id} className="rounded-xl bg-slate-50 p-3"><div className="font-semibold">{o.name}</div><div className="mt-2 flex flex-wrap gap-1">{o.roles.map(r => <Badge key={r}>{roleName(r)}</Badge>)}{!o.roles.length && <Badge>Membership through team</Badge>}</div>{o.grants.length > 0 && <div className="mt-2 text-xs text-slate-500">Organization-wide grants: {o.grants.map(roleName).join(", ")}</div>}</div>)}</div> : <p className="mt-2 text-sm text-slate-500">Independent. No active organization affiliation.</p>}
          </section>
          <section className="rounded-2xl border p-4">
            <h3 className="font-black">Team access</h3>
            {selected.teams.length ? <div className="mt-3 space-y-2">{selected.teams.map(t => <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 p-3"><div><div className="font-semibold">{t.name}{t.archived ? " (Archived)" : ""}</div><div className="text-xs text-slate-500">{t.organization_name}</div></div><div className="flex flex-wrap gap-1">{t.roles.map(r => <Badge key={r}>{roleName(r)}</Badge>)}</div></div>)}</div> : <p className="mt-2 text-sm text-slate-500">No direct team assignment.</p>}
          </section>
          {selected.linked_athletes.length > 0 && <section className="rounded-2xl border p-4"><h3 className="font-black">Linked athletes</h3><div className="mt-2 text-sm text-slate-600">{selected.linked_athletes.map(a => a.name).join(", ")}</div></section>}
          <section className="rounded-2xl border p-4">
            <h3 className="font-black">Pending access requests</h3>
            {selected.pending_requests.length ? <div className="mt-3 space-y-2">{selected.pending_requests.map(r => <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-50 p-3 text-sm"><div><span className="font-semibold">{roleName(r.role)}</span><div className="text-xs text-slate-600">{organizations.find(o => o.id === r.organization_id)?.name || "Athlete connection"} · {r.team_ids.map(id => teams.find(t => t.id === id)?.name || "Team").join(", ") || "Organization-wide"}</div></div><span className="text-xs text-amber-800">{dateLabel(r.requested_at)}</span></div>)}</div> : <p className="mt-2 text-sm text-slate-500">No pending access requests.</p>}
          </section>
          {staffEditable ? <section className="rounded-2xl border border-slate-300 p-4">
            <div className="flex items-center gap-2"><UserRoundCog size={18}/><h3 className="font-black">Manage staff access</h3></div>
            <p className="mt-2 text-xs text-slate-600">Super Owner changes take effect immediately. Athlete and Parent relationships are managed in their own approval workflows.</p>
            <div className="mt-4 space-y-3 rounded-xl bg-slate-50 p-4">
              <h4 className="text-sm font-black">Organization-wide roles</h4>
              <Field label="Organization">
                <select className="input w-full" value={chosenOrgId} onChange={e => chooseOrg(e.target.value)}>
                  <option value="">Select an organization</option>
                  {organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </Field>
              {chosenOrgId && <><div className="flex flex-wrap gap-5">
                <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={orgAdvisor} onChange={e => setOrgAdvisor(e.target.checked)} className="h-4 w-4 accent-red-600"/>Advisor</label>
                <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={orgAdmin} onChange={e => setOrgAdmin(e.target.checked)} className="h-4 w-4 accent-red-600"/>Admin</label>
              </div><p className="text-xs text-slate-500">{accountOrg ? "Current organization-wide roles: " + (accountOrg.grants.map(roleName).join(", ") || "None") : "No current organization-wide roles."} Unchecking both removes organization-wide staff grants, but preserves separately assigned team roles.</p>
              <button className="btn btn-red" disabled={saving} onClick={saveOrg}><ShieldCheck size={15}/>{saving ? "Saving…" : "Save organization roles"}</button></>}
            </div>
            <div className="mt-3 space-y-3 rounded-xl bg-slate-50 p-4">
              <h4 className="text-sm font-black">Team-specific roles</h4>
              <Field label="Team">
                <select className="input w-full" value={chosenTeamId} onChange={e => chooseTeam(e.target.value)}>
                  <option value="">Select a team</option>
                  {teams.filter(t => !t.archived).map(t => <option key={t.id} value={t.id}>{t.name} · {organizations.find(o => o.id === t.organization_id)?.name || "Organization"}</option>)}
                </select>
              </Field>
              {chosenTeamId && <><Field label="Team role">
                <select className="input w-full" value={teamRole} onChange={e => chooseTeam(chosenTeamId, e.target.value)}>
                  <option value="advisor">Advisor</option><option value="admin">Team Admin</option>
                </select>
              </Field>
              <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={teamEnabled} onChange={e => setTeamEnabled(e.target.checked)} className="h-4 w-4 accent-red-600"/>Enable this team role</label>
              <p className="text-xs text-slate-500">Currently {accountTeam?.roles.includes(teamRole) ? "enabled" : "not assigned"}. Team roles do not automatically grant organization-wide Admin privileges.</p>
              <button className="btn btn-red" disabled={saving} onClick={saveTeam}><ShieldCheck size={15}/>{saving ? "Saving…" : "Save team role"}</button></>}
            </div>
          </section> : <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">This account is an Athlete or Parent. Staff-role editing is unavailable here to protect their separate access and consent workflows.</div>}
          <section className="rounded-2xl border p-4">
            <h3 className="font-black">Access history</h3>
            <p className="mt-1 text-xs text-slate-500">Recent changes made through the Platform Account Directory. Other historical actions may be recorded elsewhere.</p>
            {historyLoading ? <p className="mt-3 text-sm text-slate-500">Loading history…</p> : history.length ? <div className="mt-3 divide-y">{history.map(h => <div key={h.id} className="py-3 text-sm"><div className="font-semibold">Platform access updated</div><div className="mt-1 text-xs text-slate-600">{h.metadata?.scope === "team" ? "Team role: " + roleName(h.metadata?.role || "") + (h.metadata?.enabled ? " enabled" : " revoked") : "Organization roles updated"}</div><div className="mt-1 text-xs text-slate-400">{dateLabel(h.created_at)}</div></div>)}</div> : <p className="mt-3 text-sm text-slate-500">No account-directory access changes recorded yet.</p>}
          </section>
          <section className="rounded-2xl border p-4">
            <h3 className="font-black">Legacy global role flags</h3>
            <p className="mt-1 text-xs text-slate-500">These historical account-level flags may persist after scoped roles are revoked. Use the organization and team assignments above to review current access.</p>
            <div className="mt-2 flex flex-wrap gap-2">{selected.global_roles.length ? selected.global_roles.map(r => <Badge key={r}>{roleName(r)}</Badge>) : <span className="text-sm text-slate-500">None</span>}</div>
          </section>
        </div>
        <div className="flex justify-end border-t bg-white px-5 py-4"><button className="btn" disabled={saving} onClick={() => setSelectedId("")}>Close</button></div>
      </aside>
    </div>}
  </AppShell>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block min-w-0"><span className="mb-1.5 block text-xs font-bold text-slate-600">{label}</span>{children}</label>;
}
function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="rounded-xl bg-slate-50 p-3"><div className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</div><div className="mt-1 text-sm font-semibold capitalize">{children}</div></div>;
}
function Stat({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return <div className="rounded-2xl bg-slate-950 p-4 text-white sm:p-5"><div className="flex items-center gap-2 text-slate-400">{icon}<span className="text-[10px] font-black uppercase tracking-wider">{label}</span></div><div className="mt-2 text-2xl font-black tabular-nums">{value}</div></div>;
}
