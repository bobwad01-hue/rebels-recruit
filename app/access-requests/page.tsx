"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock3, UserRoundCheck, XCircle, Building2, ArrowRight } from "lucide-react";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import { createClient } from "@/lib/supabase-browser";

type Team = { id: string; name: string; age_group?: string | null };
type Org = { id: string; name: string; branch_name?: string | null; city?: string; state?: string; teams: Team[] };
type Request = { id: string; organization_id: string | null; team_ids: string[]; role: string; status: string; requested_at: string; athlete_name?: string | null };
const titles: Record<string,string> = { athlete: "Athlete", parent: "Parent / Guardian", advisor: "Advisor / Coach", team_admin: "Team Admin", org_admin: "Organization Admin" };
export default function AccessRequests() {
  const [accountRole, setAccountRole] = useState("athlete");
  const initialRoleLoaded = useRef(false);
  const [requestedRole, setRequestedRole] = useState("athlete");
  const [organizations, setOrganizations] = useState<Org[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [orgId, setOrgId] = useState("");
  const [teams, setTeams] = useState<string[]>([]);
  const [athleteEmail, setAthleteEmail] = useState("");
  const [incoming, setIncoming] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const selectedOrg = useMemo(() => organizations.find(o => o.id === orgId), [organizations,orgId]);
  async function load() {
    setLoading(true);setError("");
    try {
      const c = createClient();
      const { data: { user } } = await c.auth.getUser();
      if (!user) throw new Error("Please sign in.");
      const [profile, mine, athlete] = await Promise.all([
        c.from("profiles").select("app_role").eq("id",user.id).single(),
        fetch("/api/access-requests?view=mine",{cache:"no-store"}).then(r=>r.json().then(d=>({ok:r.ok,...d}))),
        fetch("/api/access-requests?view=athlete",{cache:"no-store"}).then(r=>r.json().then(d=>({ok:r.ok,...d}))),
      ]);
      if (!mine.ok) throw new Error(mine.error || "Unable to load access requests.");
      const role = profile.data?.app_role || "athlete";
      setAccountRole(role);
      if (!initialRoleLoaded.current) {
        setRequestedRole(role === "advisor" ? "advisor" : role);
        initialRoleLoaded.current = true;
      }
      setOrganizations(mine.organizations || []);setRequests(mine.requests || []);
      setIncoming(athlete.ok ? athlete.requests || [] : []);
      setOrgId(previous => previous || mine.organizations?.[0]?.id || "");
    } catch(e) { setError(e instanceof Error ? e.message : "Unable to load requests."); }
    finally { setLoading(false); }
  }
  useEffect(()=>{load()},[]);
  async function post(body: any, success: string) {
    setBusy(true);setError("");setMessage("");
    try {
      const r = await fetch("/api/access-requests",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
      const d = await r.json();if(!r.ok)throw new Error(d.error||"Unable to update request.");
      setMessage(success);
      if (body.action === "submit" && body.role === "parent") setAthleteEmail("");
      await load();
    }catch(e){setError(e instanceof Error?e.message:"Unable to update request.")}
    finally{setBusy(false)}
  }
  function toggleTeam(id:string){setTeams(current=>current.includes(id)?current.filter(x=>x!==id):[...current,id])}
  const requestName = (r:Request) => r.role === "parent" ? (r.athlete_name || "Athlete connection") : (organizations.find(o=>o.id===r.organization_id)?.name || "Organization");
  return <AppShell><main className="max-w-4xl mx-auto px-4 sm:px-6 py-7 space-y-5">
    <PageHeader eyebrow="YOUR RLTNL COMMUNITY" title="Organization & Athlete Access" subtitle="Join an organization, request team access, or connect with your athlete. You can use RLTNL while your request is reviewed." />
    {error && <div role="alert" className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm font-semibold text-red-700">{error}</div>}
    {message && <div role="status" className="rounded-xl bg-green-50 border border-green-200 p-4 text-sm font-semibold text-green-800">{message}</div>}
    {loading ? <div className="card p-6 text-sm text-slate-500">Loading your access…</div> : <>
      {accountRole === "athlete" && incoming.length > 0 && <section className="card p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2"><UserRoundCheck size={20}/><h2 className="text-lg font-black">Confirm Parent / Guardian Connections</h2><span className="rounded-full bg-red-100 text-red-700 text-xs font-bold px-2 py-1">{incoming.length}</span></div>
        <p className="text-sm text-slate-600">Confirm the parent or guardian relationship once before private recruiting information is shared. You can revoke access later.</p>
        {incoming.map(r=><div key={r.id} className="rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div><div className="font-bold">{r.profile?.full_name||"Parent / Guardian"}</div><div className="text-sm text-slate-500">{r.profile?.email}</div></div><div className="flex gap-2"><button className="btn" disabled={busy} onClick={()=>post({action:"review",requestId:r.id,decision:"declined"},"Connection declined.")}>Not My Parent/Guardian</button><button className="btn btn-red" disabled={busy} onClick={()=>post({action:"review",requestId:r.id,decision:"approved"},"Parent connection confirmed.")}>Confirm Connection</button></div></div>)}
      </section>}
      <section className="card p-5 sm:p-6 space-y-4">
        <div><h2 className="text-lg font-black">Request access</h2><p className="text-sm text-slate-600 mt-1">Have an invitation link? Open it to join directly. Otherwise, submit a request below.</p></div>
        {accountRole==="parent" ? <>
          <label className="block text-sm font-bold" htmlFor="athlete-email">Your athlete's RLTNL account email</label>
          <input id="athlete-email" className="input w-full" type="email" autoComplete="off" value={athleteEmail} onChange={e=>setAthleteEmail(e.target.value)} placeholder="athlete@example.com"/>
          <p className="text-xs text-slate-500">Your athlete confirms the relationship once before private recruiting information becomes visible. Joining their team alone does not grant access to their recruiting data.</p>
        </> : <>
          <label className="block text-sm font-bold" htmlFor="requested-role">Request type</label>
          <select id="requested-role" className="input w-full" value={requestedRole} onChange={e=>{setRequestedRole(e.target.value);setTeams([])}}>
            {accountRole==="athlete" ? <option value="athlete">Athlete</option> : <><option value="advisor">Advisor / Coach</option><option value="team_admin">Team Admin (organization approval required)</option><option value="org_admin">Organization Admin (verified approval required)</option></>}
          </select>
          <label className="block text-sm font-bold" htmlFor="organization">Organization</label>
          <select id="organization" className="input w-full" value={orgId} onChange={e=>{setOrgId(e.target.value);setTeams([])}}>
            <option value="">Choose an organization</option>
            {organizations.map(o=><option key={o.id} value={o.id}>{o.name}{o.branch_name?` · ${o.branch_name}`:""}{o.city?` (${o.city}, ${o.state})`:""}</option>)}
          </select>
          {requestedRole !== "org_admin" && <fieldset className="rounded-xl border p-4"><legend className="px-2 text-sm font-bold">Team(s) requesting access to</legend>
            <div className="space-y-2">{(selectedOrg?.teams||[]).map(t=><label key={t.id} className="flex items-center gap-3 text-sm cursor-pointer"><input type="checkbox" checked={teams.includes(t.id)} onChange={()=>toggleTeam(t.id)} className="h-4 w-4 accent-red-600"/><span>{t.name}</span></label>)}</div>
            {!selectedOrg?.teams?.length && <p className="text-sm text-slate-500">No active teams found for this organization.</p>}
          </fieldset>}
          <p className="text-xs text-slate-500">{requestedRole==="org_admin"?"Organization Admin requests require an existing authorized administrator or RLTNL platform owner to approve.":requestedRole==="team_admin"?"Only an Organization Admin can grant Team Admin privileges.":"An authorized team or organization administrator will review your request."}</p>
        </>}
        <button className="btn btn-red" disabled={busy||(accountRole==="parent"?!athleteEmail.trim():!orgId||(requestedRole!=="org_admin"&&!teams.length))} onClick={()=>post(accountRole==="parent"?{action:"submit",role:"parent",athleteEmail}:{action:"submit",role:requestedRole,organizationId:orgId,teamIds:teams},"Your request was submitted.")}>{busy?"Working…":"Submit Access Request"} <ArrowRight size={15}/></button>
      </section>
      <section className="card p-5 sm:p-6 space-y-3">
        <h2 className="text-lg font-black">Your requests</h2>
        {!requests.length ? <p className="text-sm text-slate-500">No access requests yet.</p> : requests.map(r=><div key={r.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border p-4">
          <div className="min-w-0"><div className="font-bold">{requestName(r)}</div><div className="text-xs text-slate-500 mt-1">{titles[r.role]||r.role} · {new Date(r.requested_at).toLocaleDateString()}</div></div>
          <div className="flex items-center gap-3"><span className={`text-xs font-bold inline-flex items-center gap-1 ${r.status==="approved"?"text-green-700":r.status==="pending"?"text-amber-700":"text-slate-500"}`}>{r.status==="approved"?<CheckCircle2 size={15}/>:r.status==="pending"?<Clock3 size={15}/>:<XCircle size={15}/>} {r.status.charAt(0).toUpperCase()+r.status.slice(1)}</span>{r.status==="pending"&&<button className="btn text-xs" disabled={busy} onClick={()=>post({action:"cancel",requestId:r.id},"Request cancelled.")}>Cancel</button>}</div>
        </div>)}
        <p className="text-xs text-slate-500">Approved access is applied to your account automatically. Refresh your dashboard after approval.</p>
      </section>
      <div className="text-sm"><Link className="font-bold text-red-700 hover:underline" href={accountRole==="parent"?"/parent":accountRole==="advisor"?"/advisors":"/dashboard"}>Return to dashboard →</Link></div>
    </>}
  </main></AppShell>;
}
