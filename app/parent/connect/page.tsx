"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Clock3, Search, ShieldCheck, UserRound, Users } from "lucide-react";
import { PrimaryBrand } from "@/components/BrandLogo";

type Athlete = { id: string; full_name: string | null; connection: string | null };
type Team = { id: string; name: string; age_group?: string | null };
type TeamResponse = { team: Team; athletes: Athlete[] };
type Relationship = "parent" | "guardian";

export default function ParentConnect() {
  const router = useRouter();
  const params = useSearchParams();
  const teamId = params.get("team") || "";
  const [data, setData] = useState<TeamResponse | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string>("");
  const [step, setStep] = useState<1 | 2>(1);
  const [relationship, setRelationship] = useState<Relationship>("parent");

  useEffect(() => {
    let live = true;
    setLoading(true); setError(""); setData(null); setSelected(""); setStep(1); setSearch("");
    (async () => {
      try {
        const response = await fetch("/api/parent/connect" + (teamId ? "?team=" + encodeURIComponent(teamId) : ""), { cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not load your team.");
        if (!live) return;
        if (teamId) setData(result);
        else {
          const available = (result.teams || []) as Team[];
          setTeams(available);
          if (available.length === 1) router.replace("/parent/connect?team=" + encodeURIComponent(available[0].id));
        }
      } catch (e) {
        if (live) setError(e instanceof Error ? e.message : "Could not load your team.");
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => { live = false; };
  }, [teamId, router]);

  const athletes = useMemo(() => (data?.athletes || []).filter(a => (a.full_name || "Athlete").toLowerCase().includes(search.trim().toLowerCase())).sort((a, b) => (a.full_name || "").localeCompare(b.full_name || "")), [data, search]);
  const chosen = data?.athletes.find(a => a.id === selected);
  const blocked = chosen?.connection === "revoked" || chosen?.connection === "declined";

  async function connect() {
    if (!chosen || busy || blocked || chosen.connection === "pending" || chosen.connection === "active") return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/parent/connect", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, athleteId: chosen.id, relationship }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not connect to your athlete.");
      router.push("/parent");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not connect to your athlete.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
    <div className="mx-auto w-full max-w-xl">
      <div className="card bg-white p-6 sm:p-8">
        <PrimaryBrand className="text-xl justify-center"/>
        <div className="mt-8 flex items-center justify-between gap-3">
          <div className="rr-eyebrow">PARENT SETUP</div>
          {!!teamId && <span className="text-xs font-semibold text-slate-500">Step {step} of 2</span>}
        </div>
        <h1 className="text-2xl font-black mt-1">{!teamId ? "Choose Your Team" : step === 1 ? "Connect to Your Athlete" : "Confirm Your Connection"}</h1>
        <p className="muted mt-2">{!teamId ? "Choose a team you joined using its signup link or code." : step === 1
          ? <>You joined <strong>{data?.team?.name || "your team"}</strong>. Select your athlete to connect your accounts.</>
          : "Confirm who you're connecting with and your relationship to them."}</p>
        {error && <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</div>}
        {loading && <div className="mt-6 muted text-sm">Loading…</div>}
        {!loading && !teamId && <div className="mt-6 space-y-2">
          {teams.map(team => <Link key={team.id} href={"/parent/connect?team=" + encodeURIComponent(team.id)} className="block rounded-xl border p-4 hover:border-red-300 hover:bg-red-50">
            <span className="font-black">{team.name}</span>{team.age_group && <span className="text-sm muted ml-2">{team.age_group}</span>}
          </Link>)}
          {!teams.length && <div className="rounded-xl border p-5 text-center">
            <div className="font-black">No team membership yet</div>
            <p className="muted text-sm mt-1">Use your team's signup link or code to join first.</p>
            <Link href="/access-requests" className="btn mt-4">Request Team Access</Link>
          </div>}
        </div>}
        {!loading && data && step === 1 && <div className="mt-6 space-y-4">
          <div className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-sm font-bold"><Users size={18}/>{data.team.name}</div>
          <label className="block text-sm font-semibold" htmlFor="athlete-search">Find your athlete</label>
          <div className="relative">
            <Search size={18} className="pointer-events-none absolute left-3 top-3.5 text-slate-400"/>
            <input id="athlete-search" className="input w-full pl-10" placeholder="Search athlete name…" value={search} onChange={e => setSearch(e.target.value)}/>
          </div>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {athletes.map(a => <label key={a.id} className={`flex items-center gap-3 rounded-xl border p-4 cursor-pointer ${selected === a.id ? "border-red-500 bg-red-50" : "hover:border-slate-300"}`}>
              <input type="radio" name="athlete" value={a.id} checked={selected === a.id} onChange={() => setSelected(a.id)} className="accent-red-600"/>
              <span className="h-9 w-9 rounded-full bg-slate-100 grid place-items-center shrink-0"><UserRound size={18}/></span>
              <span className="min-w-0 flex-1"><span className="block font-black truncate">{a.full_name || "Athlete"}</span>
                {a.connection === "pending" && <span className="text-xs text-amber-700">Awaiting confirmation</span>}
                {a.connection === "active" && <span className="text-xs text-green-700">Already connected</span>}
                {(a.connection === "revoked" || a.connection === "declined") && <span className="text-xs text-slate-500">Connection {a.connection}. Only the athlete can restore access.</span>}
              </span>
              {a.connection === "active" && <Check size={17} className="text-green-600"/>}
              {a.connection === "pending" && <Clock3 size={17} className="text-amber-600"/>}
            </label>)}
            {!athletes.length && <p className="muted text-sm rounded-xl border p-4">{search ? "No matching athletes on this team." : "No athletes are available yet. Ask your team administrator to check the roster."}</p>}
          </div>
          <button className="btn btn-red w-full justify-center" disabled={!chosen || busy} onClick={() => chosen?.connection === "active" || chosen?.connection === "pending" ? router.push("/parent") : setStep(2)}>
            {chosen?.connection === "active" ? "Go to Parent Dashboard" : chosen?.connection === "pending" ? "View Pending Connection" : "Continue"} <ArrowRight size={16}/>
          </button>
        </div>}
        {!loading && data && step === 2 && chosen && <div className="mt-6 space-y-5">
          <div className="flex items-center gap-3 rounded-xl border p-4"><span className="h-12 w-12 rounded-full bg-slate-100 grid place-items-center"><UserRound size={21}/></span>
            <div><div className="font-black">{chosen.full_name || "Athlete"}</div><div className="muted text-sm">{data.team.name}</div></div>
          </div>
          <fieldset className="space-y-2"><legend className="font-bold text-sm mb-2">Your relationship to this athlete</legend>
            {([["parent","Parent"],["guardian","Legal Guardian"]] as const).map(([value,label]) =>
              <label key={value} className="flex items-center gap-3 rounded-xl border p-3 cursor-pointer">
                <input type="radio" name="relationship" checked={relationship === value} onChange={() => setRelationship(value)} className="accent-red-600"/><span className="font-semibold text-sm">{label}</span>
              </label>)}
          </fieldset>
          <div className="rounded-xl bg-slate-50 p-4">
            <div className="flex items-center gap-2 font-black text-sm"><ShieldCheck size={18}/> Your athlete's privacy matters</div>
            <p className="text-sm text-slate-600 mt-2">You can use your Parent dashboard immediately. Your athlete will receive a one-time request to confirm your relationship. Private recruiting information stays protected until they confirm. They can change permissions or revoke access later.</p>
          </div>
          {blocked && <p className="text-sm text-amber-700 font-semibold">This athlete previously declined or revoked this connection. Only the athlete can restore access.</p>}
          <div className="flex flex-col-reverse sm:flex-row gap-2">
            <button className="btn flex-1 justify-center" disabled={busy} onClick={() => setStep(1)}><ArrowLeft size={16}/> Back</button>
            <button className="btn btn-red flex-1 justify-center" disabled={busy || blocked} onClick={connect}>{busy ? "Connecting…" : "Connect to " + (chosen.full_name?.split(" ")[0] || "Athlete")} <ArrowRight size={16}/></button>
          </div>
        </div>}
        <div className="mt-6 border-t pt-5"><Link href="/parent" className="btn w-full text-center">Go to Parent Dashboard</Link></div>
      </div>
    </div>
  </div>;
}
