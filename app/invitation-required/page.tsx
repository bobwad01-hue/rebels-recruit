"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, KeyRound, LogOut, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase-browser";
import { PrimaryBrand } from "@/components/BrandLogo";

const uuid = /[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

export default function InvitationRequired() {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function connect(event: React.FormEvent) {
    event.preventDefault();
    if (!value.trim() || busy) return;
    setBusy(true); setError("");
    try {
      const match = value.trim().match(uuid);
      const url = match
        ? "/api/join?token=" + encodeURIComponent(match[0])
        : "/api/join?code=" + encodeURIComponent(value.trim());
      const response = await fetch(url, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Invitation not found.");
      if (!result.token) throw new Error("This invitation is missing its team link.");
      window.location.assign("/join/" + encodeURIComponent(result.token));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to verify invitation.");
      setBusy(false);
    }
  }

  async function signOut() {
    await createClient().auth.signOut();
    window.location.assign("/login");
  }

  return <main className="min-h-screen bg-slate-50 px-4 py-12 sm:py-20">
    <section className="mx-auto max-w-lg rounded-2xl border bg-white p-6 shadow-sm sm:p-9">
      <div className="flex justify-center"><PrimaryBrand className="h-10"/></div>
      <div className="mx-auto mt-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
        <KeyRound size={28}/>
      </div>
      <h1 className="mt-5 text-center text-2xl font-black text-slate-950">Team invitation required</h1>
      <p className="mt-3 text-center text-sm leading-6 text-slate-600">
        RLTNL Recruiting is currently available through participating organizations and teams.
        Individual subscriptions are not open yet. Your account cannot access recruiting tools
        until you join with an active invitation.
      </p>
      <form onSubmit={connect} className="mt-7 space-y-3">
        <label htmlFor="team-code" className="block text-sm font-bold text-slate-900">Team Signup Code or invitation link</label>
        <input id="team-code" className="input w-full" autoComplete="off"
          placeholder="Enter your team's code or link" value={value} onChange={e=>setValue(e.target.value)} />
        {error && <p role="alert" className="text-sm font-semibold text-red-700">{error}</p>}
        <button type="submit" className="btn btn-red w-full justify-center" disabled={busy||!value.trim()}>
          {busy ? "Checking invitation…" : "Join my team"} <ArrowRight size={16}/>
        </button>
      </form>
      <div className="mt-6 flex gap-3 rounded-xl border bg-slate-50 p-4 text-sm text-slate-600">
        <ShieldCheck size={19} className="shrink-0 text-slate-700"/>
        <p>If you requested Advisor or Admin access, your organization may need to approve it first. Ask your team Admin if you need an invitation or are waiting for approval.</p>
      </div>
      <div className="mt-6 flex justify-center gap-5 text-sm font-bold">
        <button type="button" onClick={signOut} className="inline-flex items-center gap-1.5 text-slate-600 hover:text-slate-950"><LogOut size={15}/> Sign out</button>
        <Link href="/privacy" className="text-slate-600 hover:text-slate-950">Privacy</Link>
      </div>
    </section>
  </main>;
}
