"use client";
import { useEffect, useState } from "react";
import { Check, Clock3, ShieldCheck, X } from "lucide-react";
type Request = { id: string; user_id: string; role: string; team_ids: string[]; requested_at: string; profile?: { full_name?: string; email?: string } | null };
const labels: Record<string,string> = { athlete: "Athlete", advisor: "Advisor / Coach", team_admin: "Team Admin", org_admin: "Organization Admin" };
export default function AccessReviewQueue({ organizationId, teams, readOnly = false }: { organizationId: string; teams: { id: string; name: string }[]; readOnly?: boolean }) {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function load() {
    if (!organizationId) return;
    setLoading(true);setError("");
    try {
      const r = await fetch(`/api/access-requests?view=review&organizationId=${encodeURIComponent(organizationId)}`, { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Unable to load requests.");
      setRequests(d.requests || []);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load requests."); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [organizationId]);
  async function review(requestId: string, decision: "approved" | "declined") {
    setBusy(requestId);setError("");setMessage("");
    try {
      const r = await fetch("/api/access-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "review", requestId, decision }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Unable to review request.");
      setMessage(decision === "approved" ? "Access approved." : "Request declined.");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to review request."); }
    finally { setBusy(""); }
  }
  return <section className="card p-5 sm:p-6 mt-5" id="access-requests">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><div className="rr-eyebrow">ORGANIZATION ACCESS</div><h2 className="text-lg font-black flex items-center gap-2">Access Requests {!loading && requests.length>0 && <span className="rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-xs">{requests.length}</span>}</h2><p className="text-sm text-slate-600 mt-1">Review new athlete, coach, and administrator requests. Approval only grants the selected scope.</p></div><button className="btn text-xs" onClick={load} disabled={loading}>Refresh</button></div>
    {error && <p role="alert" className="mt-3 text-sm font-semibold text-red-700">{error}</p>}
    {message && <p role="status" className="mt-3 text-sm font-semibold text-green-700">{message}</p>}
    {loading ? <p className="mt-4 text-sm text-slate-500">Loading requests…</p> : !requests.length ? <div className="rounded-xl bg-slate-50 border border-dashed p-5 mt-4 text-sm text-slate-500 text-center">No pending access requests.</div> : <div className="space-y-3 mt-4">{requests.map(r=><div key={r.id} className="rounded-xl border p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
      <div className="min-w-0"><div className="font-bold">{r.profile?.full_name || "RLTNL member"}</div><div className="text-xs text-slate-500 mt-1">{r.profile?.email || ""}</div><div className="flex flex-wrap gap-2 mt-2"><span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold">{labels[r.role]||r.role}</span>{r.team_ids.map(id=><span key={id} className="rounded-md border px-2 py-1 text-xs">{teams.find(t=>t.id===id)?.name||"Team"}</span>)}</div><div className="text-xs text-slate-400 mt-2 inline-flex items-center gap-1"><Clock3 size={12}/>{new Date(r.requested_at).toLocaleDateString()}</div></div>
      {!readOnly && <div className="flex gap-2 shrink-0"><button className="btn" disabled={!!busy} onClick={()=>review(r.id,"declined")}><X size={15}/>Decline</button><button className="btn btn-red" disabled={!!busy} onClick={()=>review(r.id,"approved")}><Check size={15}/>Approve</button></div>}
    </div>)}</div>}
  </section>;
}
