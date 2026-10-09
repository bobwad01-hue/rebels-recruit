"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
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
  Pencil,
  GripVertical,
  X,
  ShieldCheck,
  UserCog,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import OrganizationAccessLinks from "@/components/OrganizationAccessLinks";
import AccessReviewQueue from "@/components/AccessReviewQueue";

type Team = {
  id: string;
  name: string;
  age_group?: string | null;
  archived_at?: string | null;
  sort_order?: number | null;
};
type Organization = {
  id: string;
  name: string;
  branch_name?: string | null;
  city: string;
  state: string;
  join_code: string;
  organization_type?: "travel_club" | "high_school" | null;
  teams: Team[];
  roster?: any[];
  staff?: any[];
  staffInvites?: any[];
};
const empty = { name: "", branchName: "", city: "", state: "", organizationType: "" };
export default function OrganizationSetup() {
  const params=useSearchParams();const previewReadOnly=!!params.get("previewRole");
  const [organizations, setOrganizations] = useState<Organization[]>([]),
    [canCreate,setCanCreate]=useState(false),
    [selected, setSelected] = useState(""),
    [form, setForm] = useState(empty),
    [teamName, setTeamName] = useState(""),
    [ageGroup, setAgeGroup] = useState(""),
    [creating, setCreating] = useState(false),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [copied, setCopied] = useState(false),
    [teamEdit, setTeamEdit] = useState<Team | null>(null),
    [teamEditName, setTeamEditName] = useState(""),
    [teamEditAgeGroup, setTeamEditAgeGroup] = useState(""),
    [staffLinks,setStaffLinks]=useState<any[]>([]),[staffLinksLoading,setStaffLinksLoading]=useState(false),[staffCopied,setStaffCopied]=useState(""),
    [confirmAction, setConfirmAction] = useState<null | { type: "code" | "archive"; team?: Team }>(null),
    [manageTeam,setManageTeam]=useState<Team|null>(null),[teamPanel,setTeamPanel]=useState<"people"|"access">("people"),[staffOpen,setStaffOpen]=useState(false),[orgEditOpen,setOrgEditOpen]=useState(false),[dragTeamId,setDragTeamId]=useState("");
  async function load(preferred?: string) {
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/organization/setup", { cache: "no-store" }),
        d = await r.json();
      if (!r.ok)
        throw new Error(d.error || "Could not load organization setup.");
      const rows = d.organizations || [];
      setOrganizations(rows);setCanCreate(Boolean(d.canCreate));
      const id = preferred || selected || rows[0]?.id || "";
      setSelected(id);
      const o = rows.find((x: Organization) => x.id === id);
      if (o)
        setForm({
          name: o.name,
          branchName: o.branch_name || "",
          city: o.city || "",
          state: o.state || "",
          organizationType: o.organization_type || "",
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
        organizationType: o.organization_type || "",
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
  function inferredAge(name:string) {
    const m=name.trim().match(/^(1[0-9]|[8-9])(?:u|\b)/i);
    return m ? `${m[1]}U` : "";
  }
  async function reorderTeams(fromId:string,toId:string) {
    if(!org||fromId===toId) return;
    const active=org.teams.filter(t=>!t.archived_at);
    const from=active.findIndex(t=>t.id===fromId),to=active.findIndex(t=>t.id===toId);
    if(from<0||to<0)return;
    const next=[...active], [moved]=next.splice(from,1);next.splice(to,0,moved);
    setOrganizations(prev=>prev.map(o=>o.id===org.id?{...o,teams:[...next,...o.teams.filter(t=>t.archived_at)]}:o));
    await act({action:"reorderTeams",organizationId:selected,teamIds:next.map(t=>t.id)},"Team order saved.");
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
  function editTeam(team: Team) {
    setTeamEdit(team);
    setTeamEditName(team.name);
    setTeamEditAgeGroup(team.age_group || "");
  }
  async function saveTeamEdit() {
    if (!teamEdit || !teamEditName.trim()) return;
    if (teamEditName.trim() === teamEdit.name && teamEditAgeGroup.trim() === (teamEdit.age_group || "")) {
      setTeamEdit(null);
      return;
    }
    const d = await act(
      {
        action: "renameTeam",
        organizationId: selected,
        teamId: teamEdit.id,
        name: teamEditName.trim(),
        ageGroup: teamEditAgeGroup.trim(),
      },
      "Team updated.",
    );
    if (d) setTeamEdit(null);
  }
  async function runConfirmedAction() {
    if (!confirmAction || !org) return;
    if (confirmAction.type === "code") {
      const d = await act({ action: "regenerateCode", organizationId: selected }, "A new organization code was generated.");
      if (d) setConfirmAction(null);
      return;
    }
    if (confirmAction.team) {
      const d = await act({ action: "archiveTeam", organizationId: selected, teamId: confirmAction.team.id }, "Team archived.");
      if (d) setConfirmAction(null);
    }
  }
  useEffect(() => {
    if (!teamEdit && !confirmAction) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) {
        setTeamEdit(null);
        setConfirmAction(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [teamEdit, confirmAction, busy]);
  async function loadStaffLinks() {
    if(!selected||previewReadOnly)return;
    setStaffLinksLoading(true);setError("");
    try{const r=await fetch("/api/organization/setup",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"getJoinLinks",organizationId:selected})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Could not load staff access links.");setStaffLinks((d.links||[]).filter((x:any)=>!x.team_id&&["advisor","admin","advisor_admin"].includes(x.role)))}
    catch(e){setError(e instanceof Error?e.message:"Could not load staff access links.")}
    finally{setStaffLinksLoading(false)}
  }
  useEffect(()=>{if(staffOpen&&!staffLinks.length)loadStaffLinks()},[staffOpen,selected]);
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
          eyebrow={canCreate?"PLATFORM SETUP":"ADMIN SETTINGS"}
          title="Teams & Staff"
          subtitle="Manage organization details, team rosters, onboarding links and staff roles in one place."
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
            Loading organization management...
          </div>
        ) : !organizations.length && !creating ? (
          <div className="card p-6">
            <div className="font-black">Admin access required</div><p className="muted text-sm mt-1">You need active Admin access to manage an organization.</p>
          </div>
        ) : (
          <>
            {org&&<section className="card p-5 sm:p-6 mb-5"><div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"><div><div className="rr-eyebrow">ORGANIZATION</div><h2 className="text-2xl font-black">{org.name}{org.branch_name?` · ${org.branch_name}`:""}</h2><p className="muted text-sm mt-1">{[org.city,org.state].filter(Boolean).join(", ")}</p></div><div className="flex gap-2"><button className="btn" onClick={()=>setOrgEditOpen(true)} disabled={previewReadOnly}><Settings2 size={15}/>Edit Organization</button><button className="btn" onClick={()=>setStaffOpen(true)}><UserCog size={15}/>Manage Admins & Staff</button></div></div></section>}
            {org && <AccessReviewQueue organizationId={org.id} teams={org.teams || []} readOnly={previewReadOnly} />}
            {!creating && org && (
              <>
                <section className="card p-5 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3"><div><div className="rr-eyebrow">TEAMS</div><h2 className="font-black text-lg">Teams & Access</h2><p className="muted text-sm mt-1">Manage each team's roster, parent links, advisors and onboarding from one place.</p></div></div>
                  <div className="grid lg:grid-cols-[1fr_160px_auto] gap-3 mt-5"><input className="input" value={teamName} onChange={e=>{const v=e.target.value;setTeamName(v);if(!ageGroup)setAgeGroup(inferredAge(v))}} placeholder="New team name"/><input className="input" value={ageGroup} onChange={e=>setAgeGroup(e.target.value)} placeholder="Age group (optional)"/><button className="btn btn-red" disabled={busy||!teamName.trim()} onClick={addTeam}><Plus size={16}/>Add Team</button></div>
                  <div className="space-y-3 mt-5">{org.teams.filter(t=>!t.archived_at).map(team=>{const roster=(org.roster||[]).find((r:any)=>r.teamId===team.id)?.members||[];const athletes=roster.filter((m:any)=>m.role==="athlete").length,parents=roster.filter((m:any)=>m.role==="parent").length,advisors=roster.filter((m:any)=>m.role==="advisor").length;return <div key={team.id} draggable={!previewReadOnly} onDragStart={()=>setDragTeamId(team.id)} onDragEnd={()=>setDragTeamId("")} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const from=dragTeamId;setDragTeamId("");if(from)reorderTeams(from,team.id)}} className={`rounded-2xl border p-4 transition ${dragTeamId===team.id?"opacity-50":""}`}><div className="flex flex-col lg:flex-row lg:items-center gap-4">{!previewReadOnly&&<div className="hidden lg:flex cursor-grab text-slate-400" title="Drag to reorder"><GripVertical size={18}/></div>}<div className="flex-1"><div className="flex items-center gap-2"><div className="font-black text-base">{team.name}</div>{!previewReadOnly&&<button type="button" className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-800" aria-label={`Edit ${team.name}`} title="Edit team" onClick={()=>editTeam(team)}><Pencil size={14}/></button>}</div><div className="muted text-xs mt-1">{team.age_group||"No age group"} · {athletes} Athletes · {parents} Parents · {advisors} Advisors</div></div><div className="flex flex-wrap gap-2"><button className="btn px-3 py-2 text-xs" onClick={()=>{setManageTeam(team);setTeamPanel("people")}}><UserCog size={14}/>Manage People</button><button className="btn px-3 py-2 text-xs" onClick={()=>{setManageTeam(team);setTeamPanel("access")}}><Copy size={14}/>Access & Invite</button><button className="btn px-3 py-2 text-xs" disabled={busy} onClick={()=>setConfirmAction({type:"archive",team})}><Archive size={14}/>Archive</button></div></div></div>})}</div>
                  {org.teams.some(t=>t.archived_at)&&<details className="mt-5"><summary className="font-bold text-sm cursor-pointer">Archived teams</summary><div className="space-y-2 mt-3">{org.teams.filter(t=>t.archived_at).map(team=><div key={team.id} className="rounded-xl border bg-slate-50 p-3 flex items-center"><span className="font-bold flex-1">{team.name}</span><button className="btn px-3 py-2 text-xs" disabled={busy} onClick={()=>act({action:"restoreTeam",organizationId:selected,teamId:team.id},"Team restored.")}><RotateCcw size={14}/>Restore</button></div>)}</div></details>}
                </section>
              </>
            )}
          </>
        )}
      </div>
      {orgEditOpen&&org&&<div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/55 p-4" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)setOrgEditOpen(false)}}><div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"><div className="flex justify-between gap-3"><div><div className="rr-eyebrow">ORGANIZATION</div><h2 className="text-xl font-black">Edit Organization Details</h2></div><button className="btn p-2" onClick={()=>setOrgEditOpen(false)}><X size={16}/></button></div><div className="grid sm:grid-cols-2 gap-4 mt-5"><label className="text-sm font-bold">Organization *<input className="input mt-1" value={form.name} onChange={e=>setForm(v=>({...v,name:e.target.value}))}/></label><label className="text-sm font-bold">Branch <span className="font-normal muted">(optional)</span><input className="input mt-1" value={form.branchName} onChange={e=>setForm(v=>({...v,branchName:e.target.value}))}/></label><label className="text-sm font-bold">City *<input className="input mt-1" value={form.city} onChange={e=>setForm(v=>({...v,city:e.target.value}))}/></label><label className="text-sm font-bold">State *<input className="input mt-1" maxLength={2} value={form.state} onChange={e=>setForm(v=>({...v,state:e.target.value.toUpperCase()}))}/></label><label className="text-sm font-bold sm:col-span-2">Organization type *<select className="input mt-1" value={form.organizationType} onChange={e=>setForm(v=>({...v,organizationType:e.target.value}))}><option value="">Choose organization type</option><option value="travel_club">Travel / Club</option><option value="high_school">High School</option></select><span className="block font-normal muted text-xs mt-1">Used to organize teams intelligently. You can still drag teams into any order you prefer.</span></label></div><div className="flex justify-end gap-2 mt-6"><button className="btn" onClick={()=>setOrgEditOpen(false)}>Cancel</button><button className="btn btn-red" disabled={busy||!form.name.trim()||!form.city.trim()||!form.state.trim()||!form.organizationType} onClick={async()=>{await saveOrganization();setOrgEditOpen(false)}}><Save size={15}/>Save Details</button></div></div></div>}
      {manageTeam&&org&&<div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/55 p-4" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)setManageTeam(null)}}><div className="w-full max-w-4xl max-h-[88vh] overflow-y-auto rounded-2xl bg-white shadow-2xl"><div className="sticky top-0 bg-white border-b p-5 flex justify-between gap-3 z-10"><div><div className="rr-eyebrow">{manageTeam.age_group||"TEAM"}</div><h2 className="text-xl font-black">{manageTeam.name}</h2><div className="flex gap-2 mt-3"><button className={`btn ${teamPanel==="people"?"bg-slate-900 text-white":""}`} onClick={()=>setTeamPanel("people")}>People</button><button className={`btn ${teamPanel==="access"?"bg-slate-900 text-white":""}`} onClick={()=>setTeamPanel("access")}>Access & Invite</button></div></div><button className="btn p-2 h-fit" onClick={()=>setManageTeam(null)}><X size={16}/></button></div><div className="p-5">{teamPanel==="access"?<OrganizationAccessLinks organizationId={selected} teams={[manageTeam]} readOnly={previewReadOnly}/>:<div><p className="muted text-sm mb-4">Athletes, Parents and Advisors with access to this team. Parent access shows the athlete relationship behind it.</p><div className="divide-y rounded-xl border">{(()=>{const roster=(org.roster||[]).find((r:any)=>r.teamId===manageTeam.id)?.members||[];return roster.length?roster.map((m:any,i:number)=><div key={m.userId+"-"+m.role+"-"+i} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3"><div className="flex-1"><div className="font-bold">{m.profile?.full_name||m.profile?.email||"RLTNL user"}</div><div className="text-xs text-slate-500">{m.role.charAt(0).toUpperCase()+m.role.slice(1)}{m.profile?.email?<> · <span className="font-medium text-slate-600">{m.profile.email}</span></>:null}{m.role==="parent"&&m.linkedAthletes?.length?<> · <b>Linked to {m.linkedAthletes.map((a:any)=>a.name).join(", ")}</b></>:null}</div></div>{!previewReadOnly&&<div className="flex gap-2"><button className="btn px-3 py-2 text-xs" onClick={()=>act({action:"setTeamAccess",organizationId:selected,teamId:manageTeam.id,userId:m.userId,mode:"suspend",scope:"team"},"Team access suspended.")}>Suspend</button><button className="btn px-3 py-2 text-xs text-red-700" onClick={()=>act({action:"setTeamAccess",organizationId:selected,teamId:manageTeam.id,userId:m.userId,mode:"remove",scope:"team"},"Team access removed.")}>Remove</button></div>}</div>):<div className="p-5 muted text-sm">No people have joined this team yet.</div>})()}</div></div>}</div></div></div>}
      {staffOpen&&org&&<div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/55 p-4" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)setStaffOpen(false)}}><div className="w-full max-w-4xl max-h-[88vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"><div className="flex justify-between gap-3"><div><div className="rr-eyebrow">ORGANIZATION ACCESS</div><h2 className="text-xl font-black">Admins & Staff</h2><p className="muted text-sm mt-1">Use reusable access links to add organization staff, then manage each person's role below.</p></div><button className="btn p-2 h-fit" onClick={()=>setStaffOpen(false)}><X size={16}/></button></div>{!previewReadOnly&&<div className="rounded-xl border bg-slate-50 p-4 mt-5"><div className="font-black text-sm">Staff Access Links</div><p className="muted text-xs mt-1">Use these role-based links to invite new staff.</p>{staffLinksLoading&&!staffLinks.length?<div className="mt-4 text-xs font-semibold text-slate-500">Loading staff access links...</div>:<div className="grid sm:grid-cols-3 gap-2 mt-4">{[["advisor","Advisor"],["admin","Admin"],["advisor_admin","Advisor + Admin"]].map(([role,label])=>{const l=staffLinks.find((x:any)=>x.role===role);return <button key={role} className="btn justify-center py-3" disabled={!l} onClick={async()=>{await navigator.clipboard.writeText(l.url);setStaffCopied(role);window.setTimeout(()=>setStaffCopied(""),1500)}}>{staffCopied===role?<Check size={15}/>:<Copy size={15}/>} {staffCopied===role?"Copied":label+" Link"}</button>})}</div>}</div>}<div className="space-y-3 mt-5">{(org.staff||[]).map((member:any)=><div key={member.user_id} className="rounded-xl border p-4"><div className="flex flex-col sm:flex-row sm:items-center gap-3"><div className="h-10 w-10 shrink-0 rounded-xl bg-slate-100 grid place-items-center">{member.roles?.includes("admin")?<ShieldCheck size={18}/>:<UserCog size={18}/>}</div><div className="min-w-0 flex-1"><div className="font-bold truncate">{member.profile?.full_name||member.profile?.email||"Staff member"}</div><div className="muted text-xs truncate">{member.profile?.email||""}</div></div><div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:w-auto w-full"><select className="input py-2 text-xs sm:w-44 w-full" value={member.roles?.includes("admin")&&member.roles?.includes("advisor")?"both":member.roles?.includes("admin")?"admin":"advisor"} onChange={e=>{const v=e.target.value;act({action:"setStaffRoles",organizationId:selected,userId:member.user_id,admin:v==="admin"||v==="both",advisor:v==="advisor"||v==="both"},"Staff roles updated.")}}><option value="advisor">Advisor</option><option value="admin">Admin</option><option value="both">Advisor + Admin</option></select>{!previewReadOnly&&<button className="btn px-3 py-2 text-xs shrink-0" onClick={()=>act({action:"removeStaff",organizationId:selected,userId:member.user_id},"Staff access removed.")}>Remove</button>}</div></div></div>)}</div></div></div>}
            {(teamEdit || confirmAction) && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/55 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) { setTeamEdit(null); setConfirmAction(null); } }}>
          <div role="dialog" aria-modal="true" aria-labelledby="setup-modal-title" className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="rr-eyebrow">{teamEdit ? "EDIT TEAM" : "CONFIRM CHANGE"}</div>
                <h2 id="setup-modal-title" className="mt-1 text-xl font-black">
                  {teamEdit ? "Edit team" : confirmAction?.type === "code" ? "Generate a new organization code?" : "Archive this team?"}
                </h2>
              </div>
              <button type="button" className="btn p-2" aria-label="Close" disabled={busy} onClick={() => { setTeamEdit(null); setConfirmAction(null); }}><X size={16}/></button>
            </div>
            {teamEdit ? (
              <>
                <div className="grid sm:grid-cols-2 gap-4 mt-5">
                  <label className="block text-sm font-bold">Team name
                    <input autoFocus className="input mt-1" value={teamEditName} onChange={(e)=>setTeamEditName(e.target.value)} onKeyDown={(e)=>{if(e.key==="Enter") saveTeamEdit();}} />
                  </label>
                  <label className="block text-sm font-bold">Age group <span className="font-normal muted">(optional)</span>
                    <input className="input mt-1" value={teamEditAgeGroup} onChange={(e)=>setTeamEditAgeGroup(e.target.value)} onKeyDown={(e)=>{if(e.key==="Enter") saveTeamEdit();}} placeholder="e.g. 16U" />
                  </label>
                </div>
                <p className="muted text-sm mt-3">Update the team name or age group. Player history and access stay connected.</p>
              </>
            ) : confirmAction?.type === "code" ? (
              <p className="mt-4 text-sm">Generate a new private join code for <b>{org?.name}{org?.branch_name ? ` · ${org.branch_name}` : ""}</b>? The current code will stop working immediately.</p>
            ) : (
              <p className="mt-4 text-sm">Archive <b>{confirmAction?.team?.name}</b> from <b>{org?.name}{org?.branch_name ? ` · ${org.branch_name}` : ""}</b>? Players and history stay saved, but the team will no longer be active.</p>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <button className="btn" disabled={busy} onClick={() => { setTeamEdit(null); setConfirmAction(null); }}>Cancel</button>
              <button className={confirmAction?.type === "archive" ? "btn btn-red" : "btn bg-slate-900 text-white"} disabled={busy || (!!teamEdit && !teamEditName.trim())} onClick={teamEdit ? saveTeamEdit : runConfirmedAction}>
                {busy ? "Working..." : teamEdit ? "Save Changes" : confirmAction?.type === "code" ? "Generate New Code" : "Archive Team"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
