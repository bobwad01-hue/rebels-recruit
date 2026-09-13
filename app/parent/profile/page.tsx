"use client";
import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import { createClient } from "@/lib/supabase-browser";
import { DEFAULT_TIMEZONE, US_TIMEZONES } from "@/lib/us-timezones";

export default function ParentProfile() {
  const [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [phone, setPhone] = useState(""),
    [timezone, setTimezone] = useState(DEFAULT_TIMEZONE),
    [isOnboarding, setIsOnboarding] = useState(false),
    [msg, setMsg] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      const c = createClient();
      const {
        data: { user },
        error: authError,
      } = await c.auth.getUser();
      if (authError || !user) {
        setError("Your profile could not be loaded. Please try again.");
        setLoading(false);
        return;
      }
      const { data: p, error: profileError } = await c
        .from("profiles")
        .select("full_name,email,phone,timezone,profile_completed_at")
        .eq("id", user.id)
        .single();
      if (profileError) {
        setError("Your profile could not be loaded. Please try again.");
        setLoading(false);
        return;
      }
      setName(p?.full_name || "");
      setEmail(p?.email || user.email || "");
      setPhone(p?.phone || "");
      setTimezone(p?.timezone || DEFAULT_TIMEZONE);
      setIsOnboarding(!p?.profile_completed_at);
      setLoading(false);
    })();
  }, []);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    setError("");
    const c = createClient();
    const {
      data: { user },
    } = await c.auth.getUser();
    if (!user) {
      setError("Please sign in again.");
      setBusy(false);
      return;
    }
    const cleanEmail = email.trim();
    if (!name.trim() || !cleanEmail || !phone.trim() || !timezone) {
      setError("Please complete all required fields before continuing.");
      setBusy(false);
      return;
    }
    if (cleanEmail !== user.email) {
      const { error: authError } = await c.auth.updateUser({
        email: cleanEmail,
      });
      if (authError) {
        setError(authError.message);
        setBusy(false);
        return;
      }
    }
    const { error: profileError } = await c
      .from("profiles")
      .update({
        full_name: name.trim(),
        email: cleanEmail,
        phone: phone.trim(),
        timezone,
        app_role: "parent",
        advisor_type: "Parent",
        profile_completed_at: new Date().toISOString(),
      })
      .eq("id", user.id);
    if (profileError) setError(profileError.message);
    else {
      setMsg("Profile saved.");
      if (isOnboarding) {
        location.href = "/parent";
        return;
      }
    }
    setBusy(false);
  }
  return (
    <AppShell>
      <div className="max-w-3xl mx-auto px-5 md:px-8 py-6">
        <PageHeader
          title={isOnboarding ? "Complete Your Parent Profile" : "My Profile"}
          subtitle={
            isOnboarding
              ? "Complete your profile, then connect to your athlete."
              : "Keep your parent or guardian information up to date."
          }
        />
        <div className="card p-6">
          {loading && <p className="muted text-sm">Loading profile...</p>}
          {error && !busy && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              {error}{" "}
              <button
                className="font-black underline"
                onClick={() => location.reload()}
              >
                Try again
              </button>
            </div>
          )}
          {!loading && (
            <form onSubmit={save} className="grid md:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-sm font-bold">Name *</span>
                <input
                  className="input mt-1"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </label>
              <label className="block">
                <span className="text-sm font-bold">Email address *</span>
                <input
                  className="input mt-1"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>
              <label className="block">
                <span className="text-sm font-bold">Phone number *</span>
                <input
                  className="input mt-1"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </label>
              <label className="block">
                <span className="text-sm font-bold">Time zone *</span>
                <select
                  className="input mt-1"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  required
                >
                  {US_TIMEZONES.map((z) => (
                    <option key={z.value} value={z.value}>
                      {z.label}
                    </option>
                  ))}
                </select>
              </label>
              {msg && (
                <div className="md:col-span-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm font-semibold text-green-800">
                  {msg}
                </div>
              )}
              {error && (
                <p className="md:col-span-2 text-sm text-red-600">{error}</p>
              )}
              <button disabled={busy} className="btn btn-red md:col-span-2">
                {busy
                  ? "Saving..."
                  : isOnboarding
                    ? "Save Profile & Continue"
                    : "Save Profile"}
              </button>
            </form>
          )}
        </div>
      </div>
    </AppShell>
  );
}
