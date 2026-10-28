"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

type Props = { relationshipId: string; athleteId: string; savedStep: string; readOnly?: boolean };

export default function SavedCoachNextStep({ relationshipId, athleteId, savedStep, readOnly = false }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(savedStep);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  async function update(next: string | null) {
    setSaving(true);
    setMessage("");
    try {
      const c = createClient();
      const { data: { user }, error: authError } = await c.auth.getUser();
      if (authError || !user || user.id !== athleteId) throw new Error("Only the athlete can change this saved next step.");
      const { data, error } = await c.from("athlete_coaches")
        .update({ next_step: next })
        .eq("id", relationshipId)
        .eq("athlete_user_id", user.id)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Unable to update this relationship. Please refresh and try again.");
      setEditing(false);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save your next step.");
    } finally {
      setSaving(false);
    }
  }
  if (readOnly) return null;
  return (
    <div className="mt-4 space-y-3" id="saved-next-step">
      {editing ? (
        <form onSubmit={(event) => { event.preventDefault(); if (draft.trim()) void update(draft.trim()); }} className="space-y-3">
          <label className="block text-sm font-bold" htmlFor="coach-next-step-edit">Edit next step</label>
          <textarea id="coach-next-step-edit" className="input w-full min-h-24" value={draft} maxLength={500} required disabled={saving} onChange={(event) => setDraft(event.target.value)} />
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="btn btn-red" disabled={saving || !draft.trim()}>{saving ? "Saving..." : "Save Next Step"}</button>
            <button type="button" className="btn" disabled={saving} onClick={() => { setDraft(savedStep); setEditing(false); setMessage(""); }}>Cancel</button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-red" disabled={saving} onClick={() => setEditing(true)}>Edit Next Step</button>
          <button type="button" className="btn" disabled={saving} onClick={() => { if (window.confirm("Mark this next step complete? RLTNL will clear the saved step and suggest what to do next.")) void update(null); }}>{saving ? "Updating..." : "Mark Complete"}</button>
        </div>
      )}
      {message && <p role="alert" className="text-sm text-red-700">{message}</p>}
    </div>
  );
}
