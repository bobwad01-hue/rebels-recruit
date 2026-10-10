"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ShieldCheck, Users, X } from "lucide-react";

export type PendingParentRequest = {
  id: string;
  parentName: string;
  parentEmail: string;
  relationship: "parent" | "guardian";
};

export default function PendingParentApprovals({ requests }: { requests: PendingParentRequest[] }) {
  const [pending, setPending] = useState(requests);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function decide(id: string, status: "active" | "declined") {
    if (busy) return;
    setBusy(id);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/access-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "family_status", requestId: id, status }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not update this request.");
      setPending(previous => previous.filter(row => row.id !== id));
      setSuccess(status === "active" ? "Parent / Guardian access confirmed." : "Connection request declined.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update this request. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  if (!pending.length) return null;

  return <section aria-label="Parent or Guardian connection requests" className="mb-6 rounded-2xl border-2 border-amber-300 bg-amber-50/80 p-4 sm:p-5">
    {pending.length > 0 && <>
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-800"><Users size={20}/></div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-black uppercase tracking-wide text-amber-800">Action needed · {pending.length} pending</div>
          <h2 className="mt-1 text-lg font-black text-slate-900">Confirm your Parent / Guardian {pending.length === 1 ? "connection" : "connections"}</h2>
          <p className="mt-1 text-sm text-slate-700">Someone has asked to view your recruiting information. Only confirm someone you recognize as your parent or legal guardian. Until you confirm, they cannot see your private information.</p>
        </div>
      </div>
      <div className="mt-4 space-y-3">
        {pending.map(request => <div key={request.id} className="rounded-xl border border-amber-200 bg-white p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="min-w-0">
              <div className="font-black break-words">{request.parentName}</div>
              <div className="text-sm text-slate-600 break-all">{request.parentEmail}</div>
              <div className="text-xs font-semibold text-slate-500 mt-1">{request.relationship === "guardian" ? "Legal Guardian" : "Parent"} · Waiting for your confirmation</div>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <button type="button" className="btn btn-red" disabled={!!busy} onClick={() => decide(request.id, "active")}>
                <Check size={16}/> {busy === request.id ? "Saving…" : "Confirm"}
              </button>
              <button type="button" className="btn" disabled={!!busy} onClick={() => decide(request.id, "declined")}>
                <X size={16}/> Not My Parent / Guardian
              </button>
            </div>
          </div>
        </div>)}
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs text-amber-900">
        <ShieldCheck size={15} className="shrink-0"/>
        <span>You can adjust permissions or revoke access anytime in <Link className="font-bold underline" href="/manage-access">Manage Access</Link>.</span>
      </div>
    </>}
    {error && <div role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</div>}
    {success && <div role="status" className="mt-3 rounded-lg bg-white p-3 text-sm font-semibold text-green-800">{success}</div>}
  </section>;
}
