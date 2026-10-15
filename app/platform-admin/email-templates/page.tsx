"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Save, Trash2, RotateCcw } from "lucide-react";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import { createClient } from "@/lib/supabase-browser";
import {
  EMAIL_STARTERS,
  mergeEmailStarters,
  type EmailStarter,
  type OpeningOption,
  type EmailTemplateRow,
} from "@/lib/recruiting-email-playbook";

type Editor = {
  id: string;
  label: string;
  purpose: string;
  guidance: string;
  ask: string;
  subjectTemplate: string;
  openings: OpeningOption[];
  sortOrder: number;
  isActive: boolean;
  requiresSchoolReason: boolean;
};

const builtinIds = new Set(EMAIL_STARTERS.map((item) => item.id));

function toEditor(template: EmailStarter): Editor {
  return {
    id: template.id,
    label: template.label,
    purpose: template.purpose,
    guidance: template.guidance,
    ask: template.ask,
    subjectTemplate: template.subjectTemplate || "",
    openings: template.openings.map((opening) => ({ ...opening })),
    sortOrder: template.sortOrder ?? 1000,
    isActive: template.isActive !== false,
    requiresSchoolReason: !!template.requiresSchoolReason,
  };
}

export default function EmailTemplateManager() {
  const c = createClient();
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [ownerId, setOwnerId] = useState("");
  const [templates, setTemplates] = useState<EmailStarter[]>([]);
  const [form, setForm] = useState<Editor | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function load(preferredId?: string) {
    const { data, error: loadError } = await c
      .from("recruiting_email_templates")
      .select("id,label,purpose,guidance,ask,subject_template,openings,full_signature,requires_school_reason,is_active,sort_order")
      .order("sort_order");
    if (loadError) {
      setError("Could not load the template library. " + loadError.message);
      return;
    }
    const all = mergeEmailStarters((data || []) as EmailTemplateRow[], true);
    setTemplates(all);
    const selected = all.find((item) => item.id === preferredId)
      || all.find((item) => item.id !== "custom");
    setForm(selected ? toEditor(selected) : null);
    setIsNew(false);
  }

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { user } } = await c.auth.getUser();
      if (!active) return;
      if (!user) { setDenied(true); setLoading(false); return; }
      const { data: owner } = await c.from("platform_roles")
        .select("role").eq("user_id", user.id).eq("role", "super_owner").maybeSingle();
      if (!active) return;
      if (!owner) { setDenied(true); setLoading(false); return; }
      setOwnerId(user.id);
      await load();
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  function selectTemplate(item: EmailStarter) {
    setForm(toEditor(item));
    setIsNew(false);
    setNotice("");
    setError("");
  }

  function createTemplate() {
    setForm({
      id: "template-" + crypto.randomUUID(),
      label: "",
      purpose: "Recruiting",
      guidance: "",
      ask: "",
      subjectTemplate: "",
      openings: [{ label: "Opening", text: "" }],
      sortOrder: 1000 + templates.length * 10,
      isActive: true,
      requiresSchoolReason: false,
    });
    setIsNew(true);
    setNotice("");
    setError("");
  }

  async function save(activeOverride?: boolean) {
    if (!form || !ownerId || busy) return;
    if (!form.label.trim()) { setError("Give this template a name."); return; }
    if (!form.openings.length || form.openings.some((o) => !o.label.trim())) {
      setError("Every opening needs a label."); return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    const payload = {
      id: form.id,
      label: form.label.trim(),
      purpose: form.purpose.trim() || "Recruiting",
      guidance: form.guidance.trim(),
      ask: form.ask,
      subject_template: form.subjectTemplate.trim() || null,
      openings: form.openings,
      full_signature: false,
      requires_school_reason: form.requiresSchoolReason,
      is_active: activeOverride ?? form.isActive,
      sort_order: form.sortOrder,
      created_by: ownerId,
      updated_by: ownerId,
      updated_at: new Date().toISOString(),
    };
    const { error: saveError } = await c.from("recruiting_email_templates")
      .upsert(payload, { onConflict: "id" });
    if (saveError) {
      setError("Could not save the template. " + saveError.message);
    } else {
      await load(form.id);
      setNotice(activeOverride === false ? "Template hidden from athletes." :
        activeOverride === true ? "Template restored for athletes." : "Template saved for athletes.");
    }
    setBusy(false);
  }

  async function removeTemplate() {
    if (!form || busy) return;
    if (builtinIds.has(form.id)) {
      if (window.confirm("Hide this built-in template from all athletes? You can restore it later.")) {
        await save(false);
      }
      return;
    }
    if (isNew) { setForm(null); setIsNew(false); return; }
    if (!window.confirm("Permanently delete this custom template for all athletes?")) return;
    setBusy(true);
    setError("");
    const { error: deleteError } = await c.from("recruiting_email_templates")
      .delete().eq("id", form.id);
    if (deleteError) setError("Could not delete the template. " + deleteError.message);
    else { await load(); setNotice("Custom template deleted."); }
    setBusy(false);
  }

  async function restoreDefault() {
    if (!form || !builtinIds.has(form.id) || busy) return;
    if (!window.confirm("Restore the original RLTNL wording for this built-in template?")) return;
    setBusy(true);
    setError("");
    const { error: resetError } = await c.from("recruiting_email_templates")
      .delete().eq("id", form.id);
    if (resetError) setError("Could not restore the template. " + resetError.message);
    else { await load(form.id); setNotice("Original template restored."); }
    setBusy(false);
  }

  function changeOpening(index: number, field: "label" | "text", value: string) {
    if (!form) return;
    setForm({ ...form, openings: form.openings.map((o, i) =>
      i === index ? { ...o, [field]: value } : o) });
  }

  const visible = templates.filter((item) => item.id !== "custom"
    && (item.label + " " + item.purpose).toLowerCase().includes(filter.toLowerCase()));

  return <AppShell>
    <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-6">
      <PageHeader eyebrow="PLATFORM ADMIN" title="Email Template Library"
        subtitle="Manage the recruiting email starters available to every athlete."
        action={<Link href="/platform-admin" className="btn"><ArrowLeft size={15} /> Platform Admin</Link>} />
      {loading ? <div className="card p-8 mt-6">Loading templates…</div>
      : denied ? <div className="card p-8 mt-6">Super Owner access required.</div>
      : <>
        <div className="mt-5 rounded-xl border bg-slate-50 p-4 text-sm text-slate-700">
          <b>Write My Own is always the default.</b> Athletes start with a blank email and may choose a starter when they want help.
          Changes to templates are available to all athletes without a new deployment. Existing saved drafts are not overwritten.
        </div>
        {error && <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
        {notice && <div role="status" className="mt-4 text-sm font-bold text-green-700">{notice}</div>}
        <div className="grid gap-5 lg:grid-cols-[290px_minmax(0,1fr)] mt-5 items-start">
          <section className="card p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-black">Templates</h2>
              <button type="button" className="btn btn-red text-xs" onClick={createTemplate} disabled={busy}>
                <Plus size={14} /> Add
              </button>
            </div>
            <input className="input mt-3 w-full" placeholder="Search templates" value={filter}
              onChange={(e) => setFilter(e.target.value)} />
            <div className="mt-3 space-y-1 max-h-[65vh] overflow-y-auto">
              <div className="rounded-lg border bg-slate-50 px-3 py-3 text-sm">
                <b>Write My Own</b><div className="text-xs text-slate-500 mt-1">Default · Always available</div>
              </div>
              {visible.map((item) => <button type="button" key={item.id} disabled={busy}
                onClick={() => selectTemplate(item)}
                className={`w-full rounded-lg border px-3 py-3 text-left text-sm hover:bg-slate-50 ${form?.id === item.id && !isNew ? "border-slate-950 bg-slate-50" : "bg-white"}`}>
                <div className="font-bold">{item.label}</div>
                <div className="text-xs text-slate-500 mt-1">{item.isActive === false ? "Hidden from athletes" : "Available to athletes"}
                  {builtinIds.has(item.id) ? " · Built-in" : " · Custom"}</div>
              </button>)}
              {!visible.length && <div className="text-sm text-slate-500 p-3">No matching templates.</div>}
            </div>
          </section>
          <section className="card p-4 sm:p-6">
            {!form ? <div className="text-sm text-slate-500">Select a template or add a new one.</div>
            : <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-black text-lg">{isNew ? "New Template" : "Edit Template"}</h2>
                  <p className="text-xs text-slate-500 mt-1">Athletes can personalize every starter before sending.</p>
                </div>
                <span className="text-xs text-slate-500">{builtinIds.has(form.id) ? "Built-in template" : "Custom template"}</span>
              </div>
              <div className="grid sm:grid-cols-2 gap-4 mt-5">
                <label className="block text-xs font-bold">Template Name
                  <input className="input mt-1 w-full" maxLength={100} value={form.label}
                    onChange={(e) => setForm({ ...form, label: e.target.value })} />
                </label>
                <label className="block text-xs font-bold">Email Purpose
                  <input className="input mt-1 w-full" value={form.purpose}
                    onChange={(e) => setForm({ ...form, purpose: e.target.value })} />
                </label>
              </div>
              <label className="block text-xs font-bold mt-4">Subject Topic (optional)
                <input className="input mt-1 w-full" placeholder="Leave blank to use the template name as the topic"
                  value={form.subjectTemplate} onChange={(e) => setForm({ ...form, subjectTemplate: e.target.value })} />
              </label>
              <p className="text-xs text-slate-500 mt-1">The topic appears first, followed automatically by the athlete’s name, graduation year, positions/batting style and GPA. You can personalize the topic with {"{{name}}"}, {"{{college}}"}, {"{{grad}}"}, {"{{positions}}"}, or {"{{travelTeam}}"}.</p>
              <label className="block text-xs font-bold mt-4">Guidance for the athlete
                <textarea className="input mt-1 w-full min-h-20" value={form.guidance}
                  onChange={(e) => setForm({ ...form, guidance: e.target.value })} />
              </label>
              <div className="mt-5 flex flex-wrap justify-between items-center gap-3">
                <h3 className="font-black">Opening Options</h3>
                <button className="btn text-xs" type="button" disabled={form.openings.length >= 8}
                  onClick={() => setForm({ ...form, openings: [...form.openings, { label: "New Opening", text: "" }] })}>
                  <Plus size={14} /> Add Opening
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-1">Each option gives athletes a different starting point. They can rewrite any of it.</p>
              <div className="space-y-3 mt-3">
                {form.openings.map((opening, index) => <div key={index} className="rounded-xl border bg-slate-50 p-3">
                  <div className="flex items-center gap-2">
                    <input className="input flex-1" aria-label={`Opening ${index + 1} name`} value={opening.label}
                      onChange={(e) => changeOpening(index, "label", e.target.value)} />
                    <button className="btn" type="button" title="Remove opening" disabled={form.openings.length <= 1}
                      onClick={() => setForm({ ...form, openings: form.openings.filter((_, i) => i !== index) })}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <textarea className="input mt-2 w-full min-h-32" aria-label={`Opening ${index + 1} body`}
                    value={opening.text} onChange={(e) => changeOpening(index, "text", e.target.value)} />
                </div>)}
              </div>
              <label className="block text-xs font-bold mt-4">Closing / Call to Action
                <textarea className="input mt-1 w-full min-h-24" value={form.ask}
                  onChange={(e) => setForm({ ...form, ask: e.target.value })} />
              </label>
              <div className="flex flex-wrap items-center gap-4 mt-4">
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <input type="checkbox" checked={form.requiresSchoolReason}
                    onChange={(e) => setForm({ ...form, requiresSchoolReason: e.target.checked })} />
                  Require a specific school reason
                </label>
                <label className="flex items-center gap-2 text-sm font-semibold">
                  Display Order
                  <input type="number" className="input w-24" value={form.sortOrder}
                    onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) || 0 })} />
                </label>
              </div>
              <div className="flex flex-wrap gap-2 mt-6 pt-5 border-t">
                <button className="btn btn-red" type="button" disabled={busy} onClick={() => save()}>
                  <Save size={15} /> {busy ? "Saving…" : "Save Template"}
                </button>
                {form.isActive === false && <button className="btn" type="button" disabled={busy} onClick={() => save(true)}>
                  Restore for Athletes
                </button>}
                <button className="btn" type="button" disabled={busy} onClick={removeTemplate}>
                  <Trash2 size={15} /> {builtinIds.has(form.id) ? "Hide Template" : "Delete Template"}
                </button>
                {builtinIds.has(form.id) && <button className="btn" type="button" disabled={busy} onClick={restoreDefault}>
                  <RotateCcw size={15} /> Restore Original
                </button>}
              </div>
              <p className="text-xs text-slate-500 mt-3">
                Hiding a built-in template is reversible. Deleting a custom template removes it from the shared library.
                Previously sent emails and existing drafts remain unchanged.
              </p>
            </>}
          </section>
        </div>
      </>}
    </div>
  </AppShell>;
}
