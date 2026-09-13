"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import { EmptyState, PageFrame, StatePanel } from "@/components/ProductUI";
import { createClient } from "@/lib/supabase-browser";
function money(v: any) {
  return v == null
    ? "—"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(v);
}
export default function Compare() {
  const c = createClient();
  const [schools, setSchools] = useState<any[]>([]),
    [selected, setSelected] = useState<string[]>([]),
    [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState("");
  useEffect(() => {
    load();
  }, []);
  async function load() {
    setLoading(true);
    setLoadError("");
    const {
      data: { user },
      error: authError,
    } = await c.auth.getUser();
    if (authError) {
      setLoadError("Your account could not be verified. Please try again.");
      setLoading(false);
      return;
    }
    if (!user) {
      setLoadError("Sign in to compare schools.");
      setLoading(false);
      return;
    }
    const { data, error } = await c
      .from("athlete_colleges")
      .select(
        "status,colleges(id,name,city,state,division,conference,college_enrichment(*),college_majors(cip_title))",
      )
      .eq("athlete_user_id", user.id)
      .is("archived_at", null);
    if (error) {
      console.error("School comparison load failed", error);
      setLoadError(
        "Your schools could not be loaded. Nothing has been changed.",
      );
      setLoading(false);
      return;
    }
    setSchools(
      (data || [])
        .map((x: any) => ({ ...x.colleges, journey: x.status }))
        .filter(Boolean),
    );
    setLoading(false);
  }
  const rows = useMemo(
    () => schools.filter((s) => selected.includes(s.id)),
    [schools, selected],
  );
  function toggle(id: string) {
    setSelected((v) =>
      v.includes(id)
        ? v.filter((x) => x !== id)
        : v.length < 4
          ? [...v, id]
          : v,
    );
  }
  return (
    <AppShell>
      <PageFrame>
        <PageHeader
          title="Compare Schools"
          subtitle="Compare up to four active Connections side by side so the differences that matter are easier to see."
          action={
            <Link href="/connections" className="btn w-full sm:w-auto">
              Back to Connections
            </Link>
          }
        />
        {loadError ? (
          <StatePanel
            tone="error"
            title="School comparison could not be loaded"
            description={loadError}
            action={
              <button className="btn" onClick={load}>
                Try Again
              </button>
            }
          />
        ) : loading ? (
          <StatePanel
            title="Loading your schools"
            description="We’re gathering the active Connections available for comparison."
          />
        ) : schools.length === 0 ? (
          <EmptyState
            title="No schools to compare yet"
            description="Add schools to Connections first. Once they are there, you can compare fit details without re-entering anything."
            href="/discover"
            actionLabel="Find schools"
          />
        ) : (
          <>
            <section className="card p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div>
                  <h2 className="font-black text-lg">Choose schools</h2>
                  <p className="muted text-sm mt-1">
                    Select 2–4 schools. You can swap schools in and out without
                    losing anything.
                  </p>
                </div>
                <div className="pill self-start">
                  {selected.length} of 4 selected
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-4">
                {schools.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => toggle(s.id)}
                    aria-pressed={selected.includes(s.id)}
                    className={`min-h-11 rounded-full border px-3 py-2 text-sm font-bold transition ${selected.includes(s.id) ? "bg-slate-950 text-white border-slate-950" : "bg-white hover:border-slate-400"}`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </section>
            {rows.length < 2 ? (
              <div className="mt-5">
                <EmptyState
                  title="Select at least two schools"
                  description="Pick two schools above to reveal the comparison table. Add up to four when you want a broader view."
                />
              </div>
            ) : (
              <section className="card overflow-hidden mt-5">
                <div className="p-4 sm:p-5 border-b">
                  <h2 className="font-black text-lg">
                    Side-by-side comparison
                  </h2>
                  <p className="muted text-sm mt-1">
                    Use this as a decision aid, then open a school for its full
                    relationship context.
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-[850px] w-full border-separate border-spacing-0">
                    <thead>
                      <tr>
                        <th className="text-left p-3 border-b bg-slate-50">
                          Compare
                        </th>
                        {rows.map((s) => (
                          <th
                            key={s.id}
                            className="text-left p-3 border-b text-base bg-slate-50"
                          >
                            <Link
                              href={`/colleges/${s.id}`}
                              className="rr-entity-link"
                            >
                              {s.name}
                            </Link>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        [
                          "Location",
                          (s: any) =>
                            [s.city, s.state].filter(Boolean).join(", ") || "—",
                        ],
                        ["Division", (s: any) => s.division || "—"],
                        ["Journey", (s: any) => s.journey || "Researching"],
                        [
                          "Enrollment",
                          (s: any) =>
                            s.college_enrichment?.undergraduate_enrollment?.toLocaleString() ||
                            s.college_enrichment?.enrollment_total?.toLocaleString() ||
                            "—",
                        ],
                        [
                          "Campus setting",
                          (s: any) =>
                            s.college_enrichment?.campus_setting || "—",
                        ],
                        [
                          "In-state total cost",
                          (s: any) =>
                            money(s.college_enrichment?.total_cost_in_state),
                        ],
                        [
                          "Out-of-state total cost",
                          (s: any) =>
                            money(
                              s.college_enrichment?.total_cost_out_of_state,
                            ),
                        ],
                        [
                          "Room & board",
                          (s: any) => money(s.college_enrichment?.room_board),
                        ],
                        [
                          "Religious affiliation",
                          (s: any) =>
                            s.college_enrichment?.religious_affiliation ||
                            "None / not reported",
                        ],
                        [
                          "Weather",
                          (s: any) =>
                            (s.college_enrichment?.climate_profile || []).join(
                              ", ",
                            ) || "—",
                        ],
                        [
                          "Majors available",
                          (s: any) =>
                            (s.college_majors || [])
                              .slice(0, 8)
                              .map((m: any) => m.cip_title)
                              .join(", ") || "Data pending",
                        ],
                      ].map(([label, get]: any) => (
                        <tr key={label}>
                          <td className="p-3 border-b font-bold text-sm bg-slate-50">
                            {label}
                          </td>
                          {rows.map((s) => (
                            <td
                              key={s.id}
                              className="p-3 border-b text-sm align-top"
                            >
                              {get(s)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )}
      </PageFrame>
    </AppShell>
  );
}
