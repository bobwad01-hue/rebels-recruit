"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Check, Clock3, UserRound } from "lucide-react";
import { PrimaryBrand } from "@/components/BrandLogo";

type Athlete = { id: string; full_name: string | null; connection: string | null };
type TeamResponse = { team: { name: string }; athletes: Athlete[] };

export default function ParentConnect() {
  const router = useRouter();
  const params = useSearchParams();
  const teamId = params.get("team") || "";
  const [data, setData] = useState<TeamResponse | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  async function load() {
    setError("");
    try {
      const response = await fetch("/api/parent/connect?team=" + encodeURIComponent(teamId), { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not load athletes.");
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load athletes.");
    }
  }

  useEffect(() => {
    if (teamId) void load();
    else router.replace("/parent");
  }, [teamId, router]);

  async function request(athleteId: string) {
    setBusy(athleteId);
    setError("");
    try {
      const response = await fetch("/api/parent/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, athleteId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not request connection.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not request connection.");
    } finally {
      setBusy("");
    }
  }

  if (!teamId) return <div className="min-h-screen bg-slate-50 grid place-items-center p-6">
    <div className="card bg-white p-6 text-center muted">Opening Parent Home to connect with your athlete…</div>
  </div>;

  return <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
    <div className="mx-auto w-full max-w-xl">
      <div className="card bg-white p-6 sm:p-8">
        <PrimaryBrand className="text-xl justify-center"/>
        <div className="mt-8 rr-eyebrow">PARENT SETUP</div>
        <h1 className="text-2xl font-black mt-1">Connect to Your Athlete</h1>
        <p className="muted mt-2">
          {data?.team?.name
            ? <>Select your athlete on <strong>{data.team.name}</strong>. They'll approve the connection before you can see their recruiting information.</>
            : <>Choose the athlete you support.</>}
        </p>
        {error && <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</div>}
        {!data && !error && <div className="mt-6 muted text-sm">Loading team athletes...</div>}
        {data && <div className="mt-6 space-y-2">
          {data.athletes.map(a => {
            const connected = a.connection === "active";
            const pending = a.connection === "pending";
            return <div key={a.id} className="rounded-xl border p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-slate-100 grid place-items-center"><UserRound size={19}/></div>
              <div className="flex-1 min-w-0">
                <div className="font-black truncate">{a.full_name || "Athlete"}</div>
                {pending && <div className="text-xs font-semibold text-amber-700">Awaiting athlete approval</div>}
                {connected && <div className="text-xs font-semibold text-green-700">Access approved</div>}
                {(a.connection === "revoked" || a.connection === "declined") &&
                  <div className="text-xs font-semibold text-slate-500">Previous request {a.connection}</div>}
              </div>
              {connected
                ? <span className="inline-flex items-center gap-1 text-xs font-bold text-green-700"><Check size={14}/>Connected</span>
                : pending
                  ? <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700"><Clock3 size={14}/>Requested</span>
                  : <button className="btn btn-red px-3 py-2 text-xs" disabled={!!busy}
                      onClick={() => request(a.id)}>{busy === a.id ? "Sending..." : a.connection ? "Request Again" : "Request Connection"}</button>}
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
