"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Check, Clock3, UserRound } from "lucide-react";
import { PrimaryBrand } from "@/components/BrandLogo";

type Athlete = { id: string; full_name: string | null; connection: string | null };
type Team = { id: string; name: string; age_group?: string | null };
type TeamResponse = { team: Team; athletes: Athlete[] };

export default function ParentConnect() {
  const router = useRouter();
  const params = useSearchParams();
  const teamId = params.get("team") || "";
  const [data, setData] = useState<TeamResponse | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  useEffect(() => {
    let live = true;
    setLoading(true); setError(""); setData(null);
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

  async function request(athleteId: string) {
    setBusy(athleteId); setError("");
    try {
      const response = await fetch("/api/parent/connect", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, athleteId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not request connection.");
      // Parent Home is available immediately; recruiting data remains locked until confirmation.
      router.push("/parent");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not request connection.");
    } finally {
      setBusy("");
    }
  }

  return <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
    <div className="mx-auto w-full max-w-xl">
      <div className="card bg-white p-6 sm:p-8">
        <PrimaryBrand className="text-xl justify-center"/>
        <div className="mt-8 rr-eyebrow">PARENT SETUP</div>
        <h1 className="text-2xl font-black mt-1">{teamId ? "Connect to Your Athlete" : "Choose Your Team"}</h1>
        <p className="muted mt-2">{teamId
          ? <>Select your athlete{data?.team?.name ? <> on <strong>{data.team.name}</strong></> : null}. You can open Parent Home right away. Your athlete confirms the relationship once before private recruiting information is available.</>
          : "Select the team you joined with your Team Signup Code. Then choose your athlete."}</p>
        {error && <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</div>}
        {loading && <div className="mt-6 muted text-sm">Loading…</div>}
        {!loading && !teamId && <div className="mt-6 space-y-2">
          {teams.map(team => <Link key={team.id} href={"/parent/connect?team=" + encodeURIComponent(team.id)}
            className="block rounded-xl border p-4 hover:border-red-300 hover:bg-red-50">
            <span className="font-black">{team.name}</span>{team.age_group && <span className="text-sm muted ml-2">{team.age_group}</span>}
          </Link>)}
          {!teams.length && <div className="rounded-xl border p-5 text-center">
            <div className="font-black">No team membership yet</div>
            <p className="muted text-sm mt-1">Use your team's signup link or code to join, or request access using your athlete's email.</p>
            <Link href="/access-requests" className="btn mt-4">Request Access</Link>
          </div>}
        </div>}
        {!loading && data && <div className="mt-6 space-y-2">
          {data.athletes.map(a => {
            const connected = a.connection === "active";
            const pending = a.connection === "pending";
            return <div key={a.id} className="rounded-xl border p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-slate-100 grid place-items-center"><UserRound size={19}/></div>
              <div className="flex-1 min-w-0">
                <div className="font-black truncate">{a.full_name || "Athlete"}</div>
                {pending && <div className="text-xs font-semibold text-amber-700">Awaiting athlete confirmation</div>}
                {connected && <div className="text-xs font-semibold text-green-700">Connection confirmed</div>}
                {(a.connection === "revoked" || a.connection === "declined") &&
                  <div className="text-xs font-semibold text-slate-500">Previous connection {a.connection}</div>}
              </div>
              {connected
                ? <span className="inline-flex items-center gap-1 text-xs font-bold text-green-700"><Check size={14}/>Connected</span>
                : pending
                  ? <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700"><Clock3 size={14}/>Pending</span>
                  : <button className="btn btn-red px-3 py-2 text-xs" disabled={!!busy}
                      onClick={() => request(a.id)}>{busy === a.id ? "Sending…" : a.connection ? "Request Again" : "Connect"}</button>}
            </div>;
          })}
          {!data.athletes.length && <div className="rounded-xl border p-5 text-center">
            <div className="font-black">No athletes are available yet</div>
            <p className="muted text-sm mt-1">An organization Admin can confirm the team roster before you connect.</p>
          </div>}
        </div>}
        <div className="mt-6 border-t pt-5"><Link href="/parent" className="btn w-full text-center">Go to Parent Home</Link></div>
      </div>
    </div>
  </div>;
}
