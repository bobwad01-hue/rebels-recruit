'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Building2, Plus, RefreshCw } from 'lucide-react';
import AppShell from '@/components/AppShell';
import PageHeader from '@/components/PageHeader';

type Organization = {
  id: string;
  name: string;
  branch_name?: string | null;
  city?: string | null;
  state?: string | null;
  organization_type?: 'travel_club' | 'high_school' | null;
  teams?: Array<{ id: string; archived_at?: string | null }>;
};

const emptyForm = {
  name: '',
  branchName: '',
  city: '',
  state: '',
  organizationType: 'travel_club',
};

export default function PlatformOrganizationsPage() {
  const router = useRouter();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/organization/setup', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not load organizations.');
      if (!data.canCreate) {
        setAuthorized(false);
        setOrganizations([]);
        return;
      }
      setAuthorized(true);
      setOrganizations(data.organizations || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load organizations.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function createOrganization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !authorized) return;
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/organization/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', ...form }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not create organization.');
      if (!data.organization?.id) throw new Error('The organization was created, but its ID was not returned.');
      router.push('/organization/setup?organizationId=' + encodeURIComponent(data.organization.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create organization.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="PLATFORM ADMIN"
          title="Organizations"
          subtitle="Create and manage organizations across RLTNL Recruiting. Each organization has its own teams, staff and onboarding access."
          action={<Link href="/platform-admin" className="btn"><ArrowLeft size={16} /> Platform Home</Link>}
        />

        {error && <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}

        {loading ? (
          <div className="card mt-6 p-8">Loading organizations…</div>
        ) : !authorized ? (
          <div className="card mt-6 p-8">
            <h2 className="font-black">Super Owner access required</h2>
            <p className="muted mt-2 text-sm">Only the RLTNL Super Owner can create or manage organizations across the platform.</p>
          </div>
        ) : (
          <>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-600">{organizations.length} {organizations.length === 1 ? 'organization' : 'organizations'}</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn" onClick={() => void load()} disabled={saving}><RefreshCw size={16} /> Refresh</button>
                <button type="button" className="btn btn-red" onClick={() => setShowCreate(v => !v)} aria-expanded={showCreate}><Plus size={16} /> {showCreate ? 'Cancel' : 'New Organization'}</button>
              </div>
            </div>

            {showCreate && (
              <section className="card mt-4 p-5 sm:p-6" aria-label="Create organization">
                <div className="rr-eyebrow">PLATFORM SETUP</div>
                <h2 className="mt-1 text-xl font-black">Create Organization</h2>
                <p className="muted mt-1 text-sm">Create a separate organization first, then add its teams and generate team signup access.</p>
                <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={createOrganization}>
                  <label className="text-sm font-bold">Organization name *
                    <input className="input mt-1 w-full" value={form.name} onChange={e => setForm(v => ({ ...v, name: e.target.value }))} required placeholder="RLTNL Verification" />
                  </label>
                  <label className="text-sm font-bold">Branch <span className="font-normal text-slate-500">(optional)</span>
                    <input className="input mt-1 w-full" value={form.branchName} onChange={e => setForm(v => ({ ...v, branchName: e.target.value }))} />
                  </label>
                  <label className="text-sm font-bold">City *
                    <input className="input mt-1 w-full" value={form.city} onChange={e => setForm(v => ({ ...v, city: e.target.value }))} required />
                  </label>
                  <label className="text-sm font-bold">State *
                    <input className="input mt-1 w-full" value={form.state} onChange={e => setForm(v => ({ ...v, state: e.target.value.toUpperCase().slice(0, 2) }))} maxLength={2} required placeholder="MO" />
                  </label>
                  <label className="text-sm font-bold sm:col-span-2">Organization type *
                    <select className="input mt-1 w-full" value={form.organizationType} onChange={e => setForm(v => ({ ...v, organizationType: e.target.value }))} required>
                      <option value="travel_club">Travel / Club</option>
                      <option value="high_school">High School</option>
                    </select>
                  </label>
                  <div className="flex flex-wrap justify-end gap-2 sm:col-span-2">
                    <button type="button" className="btn" disabled={saving} onClick={() => setShowCreate(false)}>Cancel</button>
                    <button type="submit" className="btn btn-red" disabled={saving || !form.name.trim() || !form.city.trim() || form.state.trim().length !== 2 || !form.organizationType}>
                      <Plus size={16} /> {saving ? 'Creating…' : 'Create Organization'}
                    </button>
                  </div>
                </form>
              </section>
            )}

            <section className="mt-4 space-y-3" aria-label="All organizations">
              {organizations.map(org => (
                <div key={org.id} className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-100"><Building2 size={20} /></div>
                    <div className="min-w-0">
                      <h2 className="font-black">{org.name}{org.branch_name ? ' · ' + org.branch_name : ''}</h2>
                      <p className="muted mt-1 text-sm">
                        {[org.city, org.state].filter(Boolean).join(', ')} · {(org.teams || []).filter(t => !t.archived_at).length} active teams
                      </p>
                    </div>
                  </div>
                  <Link href={'/organization/setup?organizationId=' + encodeURIComponent(org.id)} className="btn shrink-0">
                    Manage Teams &amp; Staff <ArrowRight size={16} />
                  </Link>
                </div>
              ))}
              {!organizations.length && <div className="card p-8 text-center"><h2 className="font-black">No organizations yet</h2><p className="muted mt-2 text-sm">Select New Organization to create the first one.</p></div>}
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
