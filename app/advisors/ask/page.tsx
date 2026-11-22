'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import AppShell from '@/components/AppShell';
import PageHeader from '@/components/PageHeader';
import type { AdvisorMessage } from '@/lib/advisor-communication-threads';

type Player = { id: string; name: string };
type Row = { athlete: string; school: string; coach: string; lastContact: string; lastOutreach: string | null; lastReply: string | null; count: number; athleteId: string; messageId: string; subject: string; summary: string | null };
const format = (value: string | null) => value ? new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Not recorded';
const dateValue = (value: string | null) => value ? Date.parse(value) || 0 : 0;

export default function AskRLTNLPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [messages, setMessages] = useState<AdvisorMessage[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [athlete, setAthlete] = useState('all');
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  useEffect(() => {
    let alive = true;
    fetch('/api/advisors/communications', { cache: 'no-store' })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not load recruiting communications.');
        if (alive) { setPlayers(data.players || []); setMessages(data.messages || []); setTruncated(!!data.truncated); }
      }).catch(e => { if (alive) setError(e instanceof Error ? e.message : 'Could not load recruiting communications.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const rows = useMemo(() => {
    const groups = new Map<string, AdvisorMessage[]>();
    for (const message of messages) {
      if (athlete !== 'all' && message.athleteId !== athlete) continue;
      const key = [message.athleteId, message.collegeId || message.schoolName, message.coachId || message.coachName].join('|');
      groups.set(key, [...(groups.get(key) || []), message]);
    }
    return [...groups.values()].map(group => {
      const sorted = [...group].sort((a, b) => dateValue(b.timestamp) - dateValue(a.timestamp));
      const latest = sorted[0];
      return {
        athlete: latest.athleteName, school: latest.schoolName, coach: latest.coachName,
        lastContact: latest.timestamp, lastOutreach: sorted.find(m => m.direction === 'sent')?.timestamp || null,
        lastReply: sorted.find(m => m.direction === 'received')?.timestamp || null,
        count: sorted.length, athleteId: latest.athleteId, messageId: latest.id,
        subject: latest.subject, summary: latest.summary,
      } satisfies Row;
    }).sort((a, b) => dateValue(b.lastContact) - dateValue(a.lastContact));
  }, [messages, athlete]);

  const result = useMemo(() => {
    const q = submitted.toLowerCase().trim();
    if (!q) return rows;
    const stop = new Set(['show','me','the','all','which','who','what','when','where','have','has','are','with','from','and','for','their','last','contact','date','dates','coach','coaches','school','schools','girls','players','athletes','talking','to','of','in','on','about','please','recruiting','communication','communications','history','summarize']);
    const terms = q.split(/[^a-z0-9]+/).filter(t => t.length > 2 && !stop.has(t));
    const days = q.match(/(?:last|past|within|in)\s+(\d{1,3})\s+days?/);
    const cutoff = days ? Date.now() - Number(days[1]) * 86400000 : null;
    const unanswered = /(?:no response|not responded|haven't responded|hasn't responded|without.*response|unanswered)/.test(q);
    return rows.filter(row => {
      if (terms.length && !terms.every(t => [row.athlete, row.school, row.coach, row.subject, row.summary || ''].join(' ').toLowerCase().includes(t))) return false;
      if (cutoff && dateValue(row.lastContact) < cutoff) return false;
      if (unanswered && !(row.lastOutreach && (!row.lastReply || dateValue(row.lastOutreach) > dateValue(row.lastReply)))) return false;
      return true;
    });
  }, [rows, submitted]);

  return <AppShell><main className="mx-auto max-w-7xl px-4 py-6 sm:px-5 md:px-8">
    <PageHeader eyebrow="RECRUITING INTELLIGENCE" title="Ask RLTNL" subtitle="Explore real recruiting conversations, last contact dates, and follow-through across your approved athletes." />
    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
      <strong>Read-only communications explorer.</strong> This first release uses existing athlete-approved Advisor communications. It is not yet an AI chat, and it does not include every school relationship, visit, or offer. No data is sent to an external AI service.
    </div>
    <div className="mt-5 rounded-2xl border bg-white p-4 sm:p-5">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
        <label className="text-sm font-semibold">Search recruiting details
          <form className="mt-2 flex gap-2" onSubmit={e => { e.preventDefault(); setSubmitted(query); }}>
            <input className="input min-w-0 flex-1" value={query} onChange={e => setQuery(e.target.value)} placeholder="e.g. Morningside, unanswered, last 30 days" />
            <button className="btn btn-red" type="submit">Explore</button>
          </form>
        </label>
        <label className="text-sm font-semibold">Athlete
          <select className="input mt-2 w-full" value={athlete} onChange={e => setAthlete(e.target.value)}>
            <option value="all">All approved athletes</option>
            {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {['Show all last contact dates', 'Unanswered coach emails', 'Last 30 days'].map(prompt => <button type="button" key={prompt} className="rounded-full border px-3 py-1.5 text-xs font-semibold hover:bg-slate-50" onClick={() => { setQuery(prompt); setSubmitted(prompt); }}>{prompt}</button>)}
        {submitted && <button type="button" className="text-xs font-semibold text-red-700 underline" onClick={() => { setQuery(''); setSubmitted(''); }}>Clear search</button>}
      </div>
    </div>
    {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {truncated && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Only the most recent recorded communications are loaded. These dates may not represent the complete recruiting history.</p>}
    <section className="mt-5 overflow-hidden rounded-2xl border bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b p-4"><h2 className="font-bold">Recorded coach conversations</h2><span className="text-xs text-slate-500">{loading ? 'Loading…' : result.length + ' athlete–school–coach relationships'}</span></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm">
        <thead className="bg-slate-50 text-xs text-slate-600"><tr>{['Athlete','School / Coach','Last contact','Last outreach','Last coach email','History'].map(h => <th key={h} className="px-4 py-3 font-bold">{h}</th>)}</tr></thead>
        <tbody className="divide-y">{result.map((r, i) => <tr key={r.athleteId + r.school + r.coach + i} className="align-top">
          <td className="px-4 py-3 font-semibold">{r.athlete}</td><td className="px-4 py-3"><div className="font-semibold">{r.school}</div><div className="text-xs text-slate-600">{r.coach}</div></td>
          <td className="px-4 py-3">{format(r.lastContact)}</td><td className="px-4 py-3">{format(r.lastOutreach)}</td><td className="px-4 py-3">{format(r.lastReply)}</td>
          <td className="px-4 py-3"><Link className="font-semibold text-red-700 underline" href={`/advisors/communications?player=${encodeURIComponent(r.athleteId)}&message=${encodeURIComponent(r.messageId)}`}>View {r.count} email{r.count === 1 ? '' : 's'}</Link></td>
        </tr>)}</tbody>
      </table></div>
      {!loading && !error && !result.length && <p className="p-6 text-sm text-slate-600">No recorded recruiting emails match this search. This does not mean the athlete has no recruiting relationships.</p>}
    </section>
    <p className="mt-3 text-xs text-slate-500">Last contact is the latest loaded sent or received email. Outreach is the latest sent email; coach email is the latest received email. Manually logged non-email interactions are not included. Dates are based on recorded timestamps, not predictions of coach interest.</p>
    <Link href="/advisors/communications" className="mt-5 inline-block text-sm font-bold text-red-700 underline">Open full Recruiting Conversations</Link>
  </main></AppShell>;
}
