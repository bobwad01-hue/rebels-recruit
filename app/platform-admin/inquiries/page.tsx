'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, Mail, RefreshCw } from 'lucide-react';
import AppShell from '@/components/AppShell';
import PageHeader from '@/components/PageHeader';

type Inquiry = {
  id: string; full_name: string; email: string; organization_name: string;
  organization_type: string; role_title: string | null; team_count: string | null;
  message: string | null; status: string; created_at: string;
  notification_sent_at: string | null;
};
const statuses = ['new','contacted','closed'];
export default function DemoInquiries() {
  const [items, setItems] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState('');
  const [filter, setFilter] = useState('all');
  async function load() {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/platform/demo-inquiries', { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to load inquiries.');
      setItems(body.inquiries || []);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load inquiries.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  const filtered = useMemo(() => filter === 'all' ? items : items.filter(item => item.status === filter), [items, filter]);
  async function update(id: string, status: string) {
    setSaving(id); setError('');
    try {
      const response = await fetch('/api/platform/demo-inquiries', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to update inquiry.');
      setItems(current => current.map(item => item.id === id ? { ...item, status } : item));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to update inquiry.'); }
    finally { setSaving(''); }
  }
  return <AppShell><div className="mx-auto max-w-6xl px-5 py-7 md:px-8">
    <Link href="/platform-admin" className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-red-700"><ArrowLeft size={15}/> Platform Admin</Link>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <PageHeader eyebrow="PLATFORM ADMIN · COMMERCIAL" title="Demo Inquiries" subtitle="Requests from organizations interested in RLTNL Recruiting. Only Super Owners can view these details."/>
      <button type="button" className="btn" onClick={() => void load()} disabled={loading}><RefreshCw size={16}/> Refresh</button>
    </div>
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap gap-2">{['all',...statuses].map(status => <button key={status} type="button"
        className={filter === status ? 'btn btn-red text-xs capitalize' : 'btn text-xs capitalize'}
        onClick={() => setFilter(status)}>{status === 'all' ? 'All' : status} ({status === 'all' ? items.length : items.filter(item => item.status === status).length})</button>)}</div>
    </div>
    {error && <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">{error}</div>}
    {loading ? <div className="card mt-6 p-8 text-sm text-slate-600">Loading demo inquiries…</div> :
      filtered.length === 0 ? <div className="card mt-6 p-8 text-sm text-slate-600">No inquiries in this view yet.</div> :
      <div className="mt-6 grid gap-4">{filtered.map(item => <article key={item.id} className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-black">{item.organization_name}</h2><span className="pill capitalize">{item.status}</span></div>
            <p className="mt-1 text-sm text-slate-600">{item.organization_type === 'travel_club' ? 'Travel / club' : item.organization_type === 'high_school' ? 'High school' : 'Other'}{item.team_count ? ' · ' + item.team_count + ' teams' : ''}</p>
            <p className="mt-1 text-xs text-slate-500">Received {new Date(item.created_at).toLocaleString()}</p></div>
          <label className="text-xs font-bold text-slate-600">Status
            <select className="input mt-1 block min-w-[145px]" value={item.status} disabled={saving === item.id}
              onChange={event => void update(item.id, event.target.value)}>{statuses.map(status => <option key={status} value={status}>{status[0].toUpperCase() + status.slice(1)}</option>)}</select>
          </label>
        </div>
        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <p><span className="font-bold">Contact:</span> {item.full_name}{item.role_title ? ' · ' + item.role_title : ''}</p>
          <a className="inline-flex items-center gap-1.5 font-semibold text-red-700 hover:underline" href={'mailto:' + item.email}><Mail size={15}/>{item.email}<ArrowUpRight size={13}/></a>
        </div>
        {item.message && <p className="mt-4 whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">{item.message}</p>}
        {!item.notification_sent_at && <p className="mt-3 text-xs text-amber-800">Email notification not confirmed. The inquiry is saved here.</p>}
      </article>)}</div>}
  </div></AppShell>;
}
