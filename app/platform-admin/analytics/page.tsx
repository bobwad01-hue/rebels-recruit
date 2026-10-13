'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Activity, ArrowLeft, ArrowRight, CalendarDays, Users, UserRoundCheck, UserRoundX, RefreshCw } from 'lucide-react';
import AppShell from '@/components/AppShell';
import PageHeader from '@/components/PageHeader';

type Bucket = { name: string; total: number; active7: number; active30: number };
type Report = {
  trackingStarted: string;
  generatedAt: string;
  metrics: {
    totalAccounts: number; eligibleAccounts: number; dailyActive: number;
    weeklyActive: number; monthlyActive: number; newAccounts30: number;
    noActivityRecorded: number; dormant30: number; returning30: number;
    avgActiveDays30: number;
  };
  daily: { date: string; active: number | null }[];
  roles: Bucket[];
  organizations: Bucket[];
};

const fmt = (date: string) => new Date(date + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const percent = (part: number, whole: number) => whole ? Math.round(100 * part / whole) : 0;

function Stat({ label, value, detail, icon }: { label: string; value: string | number; detail: string; icon: React.ReactNode }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
    <div className="flex items-center gap-2 text-xs font-bold text-slate-500">{icon}<span>{label}</span></div>
    <div className="mt-3 text-3xl font-black tabular-nums text-slate-900">{value}</div>
    <div className="mt-1 text-xs leading-5 text-slate-500">{detail}</div>
  </div>;
}

function Breakdown({ title, subtitle, rows }: { title: string; subtitle: string; rows: Bucket[] }) {
  return <section className="card overflow-hidden">
    <div className="border-b p-5"><h2 className="text-lg font-black">{title}</h2><p className="mt-1 text-xs text-slate-500">{subtitle}</p></div>
    <div className="overflow-x-auto">
      <table className="w-full min-w-[460px] text-left text-sm">
        <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500"><tr>
          <th className="px-5 py-3">Group</th><th className="px-3 py-3 text-right">Accounts</th>
          <th className="px-3 py-3 text-right">7d active</th><th className="px-5 py-3 text-right">30d active</th>
        </tr></thead>
        <tbody className="divide-y">{rows.map(r => <tr key={r.name}>
          <td className="px-5 py-3 font-semibold">{r.name}</td>
          <td className="px-3 py-3 text-right tabular-nums">{r.total}</td>
          <td className="px-3 py-3 text-right tabular-nums">{r.active7}</td>
          <td className="px-5 py-3 text-right tabular-nums"><span className="font-bold">{r.active30}</span><span className="ml-1 text-xs text-slate-500">({percent(r.active30, r.total)}%)</span></td>
        </tr>)}</tbody>
      </table>
      {!rows.length && <p className="p-5 text-sm text-slate-500">No groups to display.</p>}
    </div>
  </section>;
}

export default function PlatformAnalyticsPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/platform/analytics', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to load analytics.');
      setReport(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load analytics.');
    } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  const max = useMemo(() => Math.max(1, ...(report?.daily.map(d => d.active || 0) || [])), [report]);
  const m = report?.metrics;

  return <AppShell><main className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
    <PageHeader eyebrow="SUPER OWNER · ANALYTICS" title="Platform Usage"
      subtitle="Understand account adoption, repeat visits and engagement across RLTNL Recruiting."
      action={<div className="flex flex-wrap gap-2"><button type="button" className="btn" onClick={() => void load()} disabled={loading}><RefreshCw size={15}/>{loading ? 'Refreshing…' : 'Refresh'}</button><Link href="/platform-admin/accounts" className="btn btn-red">All Accounts <ArrowRight size={15}/></Link><Link href="/platform-admin" className="btn"><ArrowLeft size={15}/>Platform Admin</Link></div>}/>
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}
    {loading && !report ? <div className="card p-8 text-sm text-slate-500">Loading usage analytics…</div> : m && report ? <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Active today" value={m.dailyActive} detail="Distinct accounts active today (UTC)" icon={<Activity size={17}/>}/>
        <Stat label="Active in 7 days" value={m.weeklyActive} detail={percent(m.weeklyActive, m.eligibleAccounts) + '% of enabled accounts'} icon={<Users size={17}/>}/>
        <Stat label="Active in 30 days" value={m.monthlyActive} detail={percent(m.monthlyActive, m.eligibleAccounts) + '% of enabled accounts'} icon={<UserRoundCheck size={17}/>}/>
        <Stat label="New accounts (30d)" value={m.newAccounts30} detail={m.totalAccounts + ' total accounts · ' + m.eligibleAccounts + ' enabled'} icon={<CalendarDays size={17}/>}/>
        <Stat label="Returning users (30d)" value={m.returning30} detail="Active on at least two different days" icon={<UserRoundCheck size={17}/>}/>
        <Stat label="Average active days" value={m.avgActiveDays30} detail="Per active user, over the last 30 days" icon={<CalendarDays size={17}/>}/>
        <Stat label="No activity recorded" value={m.noActivityRecorded} detail="Enabled accounts without a tracked visit" icon={<UserRoundX size={17}/>}/>
        <Stat label="Inactive for 30+ days" value={m.dormant30} detail="Previously tracked, but not active recently" icon={<UserRoundX size={17}/>}/>
      </div>

      <section className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="text-lg font-black">Daily active accounts</h2><p className="mt-1 text-xs text-slate-500">Distinct accounts with observed activity each UTC day. Last 30 days.</p></div>
          <div className="text-xs text-slate-500">Tracking since {fmt(report.trackingStarted)}</div>
        </div>
        <div className="mt-6 overflow-x-auto">
          <div className="flex h-44 min-w-[560px] items-end gap-1.5 border-b border-slate-200 pb-1" role="img" aria-label="Daily active accounts bar chart for the last 30 days">
            {report.daily.map((d, i) => <div key={d.date} className="group relative flex h-full min-w-0 flex-1 flex-col items-center justify-end" title={d.active === null ? fmt(d.date) + ': Not tracked' : fmt(d.date) + ': ' + d.active + ' active accounts'}>
              {d.active === null ? <div className="h-1 w-full rounded-t bg-slate-100"/> :
                <div className="w-full rounded-t bg-red-600 transition-all" style={{ height: d.active === 0 ? 3 : Math.max(7, (d.active / max) * 100) + '%' }}/>}
              {i % 5 === 0 && <span className="absolute -bottom-6 whitespace-nowrap text-[10px] text-slate-500">{fmt(d.date)}</span>}
            </div>)}
          </div>
          <div className="h-7"/>
        </div>
        <p className="mt-2 text-xs text-slate-500">Light gray indicates dates before activity tracking began. Zero is only shown for days after tracking began.</p>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <Breakdown title="Adoption by account type" subtitle="Based on primary account type; active means at least one tracked day." rows={report.roles}/>
        <Breakdown title="Adoption by organization" subtitle="Includes active parent connections; multi-organization accounts can appear in multiple rows." rows={report.organizations}/>
      </div>
      <section className="rounded-2xl border bg-slate-50 p-5 text-sm text-slate-600">
        <h2 className="font-black text-slate-900">How these numbers work</h2>
        <p className="mt-2">An active day means a signed-in person used RLTNL in a visible browser tab. Signals are limited to about one every five minutes. This is a measure of platform usage, <strong>not</strong> time spent, recruiting progress, emails sent or tasks completed.</p>
        <p className="mt-2">Tracking began on {fmt(report.trackingStarted)}. Earlier usage cannot be reconstructed, so early 7-day and 30-day totals are partial. Account activity is recorded without page URLs, message content or personal recruiting details.</p>
        <p className="mt-2">For individual last activity and active-day frequency, use <Link href="/platform-admin/accounts" className="font-bold text-red-700 underline">All Accounts</Link>.</p>
      </section>
    </> : null}
  </main></AppShell>;
}
