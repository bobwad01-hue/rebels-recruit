"use client";

import Link from "next/link";
import { ShieldAlert, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase-browser";

export default function AccountSuspendedPage() {
  async function signOut() {
    await createClient().auth.signOut();
    window.location.assign("/login");
  }
  return <main className="min-h-screen bg-slate-50 px-4 py-16">
    <section className="mx-auto max-w-lg rounded-2xl border bg-white p-8 text-center shadow-sm">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-700">
        <ShieldAlert size={28}/>
      </div>
      <div className="rr-eyebrow mt-5">RLTNL RECRUITING</div>
      <h1 className="mt-2 text-2xl font-black text-slate-950">Account access suspended</h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        This account cannot access RLTNL Recruiting right now. Your account information
        has not been deleted. Contact your organization or RLTNL support if you believe
        this is a mistake.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <button type="button" className="btn btn-red" onClick={signOut}><LogOut size={16}/>Sign out</button>
        <Link href="/privacy" className="btn">Privacy information</Link>
      </div>
    </section>
  </main>;
}
