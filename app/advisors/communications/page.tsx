'use client';

import Link from 'next/link';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowRight, Bell, CheckCircle2, ChevronRight, Clock3, Inbox, Mail, MessageCircleReply, RefreshCw, Search, ShieldCheck, Users } from 'lucide-react';
import AppShell from '@/components/AppShell';
import PageHeader from '@/components/PageHeader';

type Preferences = {
  advisor_coach_reply_alerts: boolean;
  advisor_email_sent_alerts: boolean;
  advisor_daily_digest: boolean;
};
type Player = { id: string; name: string };
type Message = {
  id: string; athleteId: string; athleteName: string; coachName: string; schoolName: string;
  direction: 'sent' | 'received'; sentByAdvisor: boolean; subject: string; body: string | null; summary: string | null;
  timestamp: string; tracked: boolean; needsAttention: boolean; nextAction: string | null;
  reviewed: boolean; source: 'gmail' | 'rltnl' | 'manual';
};
const DEFAULTS: Preferences = {
  advisor_coach_reply_alerts: true, advisor_email_sent_alerts: false, advisor_daily_digest: false,
};
const when = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
};

export default function AdvisorCommunicationsPage() {
  return <Suspense fallback={<AppShell><div className="mx-auto max-w-7xl px-5 py-8 text-sm text-slate-600">Loading communications…</div></AppShell>}><Communications /></Suspense>;
}

function Communications() {
  const params = useSearchParams();
  const [players, setPlayers] = useState<Player[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [preferences, setPreferences] = useState<Preferences>(DEFAULTS);
  const [player, setPlayer] = useState('all');
  const [direction, setDirection] = useState('all');
  const [range, setRange] = useState('90');
  const [needsOnly, setNeedsOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [truncated, setTruncated] = useState(false);
  const [saving, setSaving] = useState('');
  const [saved, setSaved] = useState('');
  const [showPreferences, setShowPreferences] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/advisors/communications', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Communications could not be loaded.');
      setPlayers(data.players || []);
      setMessages(data.messages || []);
      setPreferences(data.preferences || DEFAULTS);
      setTruncated(!!data.truncated);
      const requestedPlayer = params.get('player');
      if (requestedPlayer && (data.players || []).some((p: Player) => p.id === requestedPlayer)) setPlayer(requestedPlayer);
      const requestedMessage = params.get('message');
      setSelected(current => (data.messages || []).some((m: Message) => m.id === (requestedMessage || current)) ? (requestedMessage || current) : '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Communications could not be loaded.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [params]);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const cutoff = range === 'all' ? 0 : Date.now() - Number(range) * 86400000;
    return messages.filter(m => {
      if (player !== 'all' && m.athleteId !== player) return false;
      if (direction !== 'all' && m.direction !== direction) return false;
      if (needsOnly && !m.needsAttention) return false;
      if (cutoff && new Date(m.timestamp).getTime() < cutoff) return false;
      if (q && ![m.athleteName, m.coachName, m.schoolName, m.subject, m.summary].some(v => String(v || '').toLowerCase().includes(q))) return false;
      return true;
    });
  }, [messages, player, direction, needsOnly, range, search]);
  const current = filtered.find(m => m.id === selected) || filtered[0] || null;
  const sent = filtered.filter(m => m.direction === 'sent').length;
  const received = filtered.filter(m => m.direction === 'received').length;
  const attention = filtered.filter(m => m.needsAttention).length;

  async function updatePreference(key: keyof Preferences, value: boolean) {
    setSaving(key); setSaved('');
    try {
      const response = await fetch('/api/advisors/communications', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not save preference.');
      setPreferences(data.preferences);
      setSaved('Notification preferences saved.');
    } catch (e) {
      setSaved(e instanceof Error ? e.message : 'Could not save preference.');
    } finally { setSaving(''); }
  }

  return <AppShell><div className="mx-auto max-w-7xl px-4 py-6 sm:px-5 md:px-8">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <PageHeader eyebrow="ADVISOR COMMUNICATIONS" title="The conversations behind the recruiting" subtitle="See who reached out, what coaches said, and where your players need your follow-through." />
      <button type="button" className="btn text-sm" disabled={refreshing || loading} onClick={() => void load(true)}><RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} /> Refresh</button>
    </div>
    <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
      <div className="flex items-start gap-2"><ShieldCheck size={18} className="mt-0.5 shrink-0 text-slate-600" /><p><b>Player-approved access only.</b> You see recruiting communications for athletes who have an active Advisor assignment with you. This is not access to their entire Gmail inbox. Athletes can revoke Advisor access from Support Team.</p></div>
    </div>
    {error && <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">{error} <button className="ml-2 underline" onClick={() => void load()}>Try again</button></div>}
    <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
      {[
        { label: 'Assigned players', value: players.length, icon: Users },
        { label: 'Emails sent', value: sent, icon: Mail },
        { label: 'Coach emails', value: received, icon: MessageCircleReply },
        { label: 'Need follow-through', value: attention, icon: Bell },
      ].map(item => <div key={item.label} className="rounded-2xl border bg-white p-4 shadow-sm"><div className="flex items-center justify-between text-slate-500"><span className="text-xs font-bold">{item.label}</span><item.icon size={17} /></div><div className="mt-2 text-3xl font-black tabular-nums text-slate-950">{loading ? '—' : item.value}</div></div>)}
    </div>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
      <span>Counts reflect the filters below and the most recent loaded communications, not a lifetime total.</span>
      <Link href="/advisors/access" className="font-bold text-red-700 hover:underline">Manage player assignments <ArrowRight size={13} className="inline" /></Link>
    </div>

    <div className="mt-6 rounded-2xl border bg-white p-4 sm:p-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1.6fr]">
        <label className="text-xs font-bold text-slate-700">Player
          <select className="input mt-1 w-full" value={player} onChange={e => { setPlayer(e.target.value); setSelected(''); }}><option value="all">All assigned players</option>{players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        </label>
        <label className="text-xs font-bold text-slate-700">Communication
          <select className="input mt-1 w-full" value={direction} onChange={e => { setDirection(e.target.value); setSelected(''); }}><option value="all">Sent and received</option><option value="sent">Player emails sent</option><option value="received">Coach emails received</option></select>
        </label>
        <label className="text-xs font-bold text-slate-700">When
          <select className="input mt-1 w-full" value={range} onChange={e => { setRange(e.target.value); setSelected(''); }}><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="all">All loaded history</option></select>
        </label>
        <label className="text-xs font-bold text-slate-700">Find a conversation
          <span className="relative mt-1 block"><Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input className="input w-full pl-10" value={search} onChange={e => { setSearch(e.target.value); setSelected(''); }} placeholder="Player, school, coach, subject…" /></span>
        </label>
      </div>
      <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={needsOnly} onChange={e => { setNeedsOnly(e.target.checked); setSelected(''); }} className="h-4 w-4 accent-red-700" /> Show only conversations needing follow-through</label>
    </div>

    {truncated && <p className="mt-3 text-xs font-semibold text-amber-800">Showing recent communications only. Older records remain saved in the recruiting activity history.</p>}
    <div className="mt-5 grid items-start gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.15fr)]">
      <section aria-label="Recruiting email conversations" className="min-w-0 overflow-hidden rounded-2xl border bg-white">
        <div className="flex items-center justify-between border-b px-4 py-3"><h2 className="text-sm font-black">Recruiting conversations</h2><span className="text-xs text-slate-500">{filtered.length} shown</span></div>
        {loading ? <div className="p-8 text-center text-sm text-slate-500">Loading recruiting communications…</div> : !players.length ? <div className="p-8 text-center"><Users className="mx-auto text-slate-400" size={30} /><h3 className="mt-3 font-black">No assigned players yet</h3><p className="mt-2 text-sm text-slate-600">Request Advisor access to the players you support. Each athlete must approve before their recruiting communications appear.</p><Link className="btn btn-red mt-4" href="/advisors/access">Request player access <ArrowRight size={15} /></Link></div> : !filtered.length ? <div className="p-8 text-center"><Inbox className="mx-auto text-slate-400" size={30} /><h3 className="mt-3 font-black">No conversations match</h3><p className="mt-2 text-sm text-slate-600">Try a broader date range or different filters. Only logged recruiting emails and matched Gmail coach replies appear here.</p></div> : <div className="max-h-[680px] overflow-y-auto divide-y">
          {filtered.map(m => <button type="button" key={m.id} onClick={() => setSelected(m.id)} aria-pressed={current?.id === m.id} className={'w-full p-4 text-left transition hover:bg-slate-50 ' + (current?.id === m.id ? 'bg-red-50/60' : '')}>
            <div className="flex items-center justify-between gap-2"><span className={'rounded-full px-2 py-0.5 text-[10px] font-black uppercase ' + (m.direction === 'received' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-700')}>{m.direction === 'received' ? 'Coach replied' : m.sentByAdvisor ? 'Advisor sent' : 'Player sent'}</span><span className="text-[11px] text-slate-500">{when(m.timestamp)}</span></div>
            <div className="mt-2 flex items-start justify-between gap-2"><div className="min-w-0"><p className="text-sm font-black text-slate-950">{m.athleteName} <span className="font-medium text-slate-500">· {m.schoolName}</span></p><p className="mt-0.5 text-xs text-slate-600">{m.coachName}</p></div><ChevronRight size={16} className="shrink-0 text-slate-400" /></div>
            <p className="mt-2 truncate text-sm font-semibold text-slate-900">{m.subject}</p>
            {m.summary && <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">{m.summary}</p>}
            {m.needsAttention && <span className="mt-2 inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-800"><Clock3 size={12} /> Follow-through needed</span>}
          </button>)}
        </div>}
      </section>

      <section aria-label="Selected recruiting email" className="min-w-0 rounded-2xl border bg-white p-4 sm:p-6 lg:sticky lg:top-4">
        {!current ? <div className="py-14 text-center text-sm text-slate-500">Select a conversation to review its details.</div> : <>
          <div className="flex flex-wrap items-center justify-between gap-2"><span className={'rounded-full px-2.5 py-1 text-[11px] font-black ' + (current.direction === 'received' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-700')}>{current.direction === 'received' ? 'Received from college coach' : current.sentByAdvisor ? 'Sent by Advisor' : 'Sent by athlete'}</span><span className="text-xs text-slate-500">{when(current.timestamp)}</span></div>
          <h2 className="mt-4 break-words text-xl font-black text-slate-950">{current.subject}</h2>
          <dl className="mt-4 grid grid-cols-[85px_minmax(0,1fr)] gap-x-3 gap-y-2 border-b pb-5 text-sm"><dt className="text-slate-500">Player</dt><dd className="font-semibold">{current.athleteName}</dd><dt className="text-slate-500">Coach</dt><dd className="font-semibold">{current.coachName}</dd><dt className="text-slate-500">School</dt><dd className="font-semibold">{current.schoolName}</dd><dt className="text-slate-500">Recorded</dt><dd>{current.source === 'gmail' ? 'Connected Gmail' : current.source === 'rltnl' ? 'Sent through RLTNL' : 'Manually logged'}</dd></dl>
          {current.needsAttention && <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4"><div className="flex items-center gap-2 text-sm font-black text-amber-900"><Clock3 size={17} /> Coach response needs follow-through</div><p className="mt-1 text-sm text-amber-900">{current.nextAction || 'Review the coach response and decide the next step with the athlete.'}</p></div>}
          <div className="mt-5"><h3 className="text-xs font-black uppercase tracking-wide text-slate-500">{current.body ? 'Message content' : 'Recorded summary'}</h3>
            {current.body ? <div className="mt-3 max-h-[400px] overflow-auto whitespace-pre-wrap break-words rounded-xl border bg-slate-50 p-4 text-sm leading-6 text-slate-800">{current.body}</div> : <div className="mt-3 rounded-xl border bg-slate-50 p-4 text-sm leading-6 text-slate-700">{current.summary || 'No message text was recorded for this activity.'}<p className="mt-3 text-xs text-slate-500">The full email body was not saved for this record. This summary is not a copy of the original email.</p></div>}
          </div>
          <div className="mt-5 flex flex-wrap gap-2"><Link className="btn btn-red text-sm" href={'/players/' + encodeURIComponent(current.athleteId)}>Open Player 360 <ArrowRight size={15} /></Link><Link className="btn text-sm" href={'/advisors/activity?player=' + encodeURIComponent(current.athleteId)}>View activity</Link></div>
        </>}
      </section>
    </div>

    <section className="mt-6 rounded-2xl border bg-white p-4 sm:p-5">
      <button type="button" className="flex w-full items-center justify-between gap-3 text-left" aria-expanded={showPreferences} onClick={() => setShowPreferences(v => !v)}><span className="flex items-center gap-2 text-base font-black"><Bell size={18} /> Advisor communication alerts</span><span className="text-xs font-semibold text-red-700">{showPreferences ? 'Hide settings' : 'Manage alerts'}</span></button>
      <p className="mt-2 text-sm text-slate-600">Stay informed without requiring players to BCC you on every email. These settings apply only to athletes currently assigned to you.</p>
      {showPreferences && <div className="mt-4 grid gap-3 md:grid-cols-3">
        {[
          { key: 'advisor_coach_reply_alerts' as const, title: 'Meaningful coach replies', description: 'In-app / push alerts when a coach response needs action.' },
          { key: 'advisor_email_sent_alerts' as const, title: 'Player emails sent', description: 'In-app / push alerts for emails players send through RLTNL.' },
          { key: 'advisor_daily_digest' as const, title: 'Daily email summary', description: 'One email with recent communication counts and a link back to RLTNL, when activity exists.' },
        ].map(option => <label key={option.key} className="flex cursor-pointer items-start gap-3 rounded-xl border p-4"><input type="checkbox" className="mt-1 h-4 w-4 accent-red-700" checked={preferences[option.key]} disabled={!!saving} onChange={e => void updatePreference(option.key, e.target.checked)} /><span><span className="block text-sm font-black">{option.title}</span><span className="mt-1 block text-xs leading-5 text-slate-600">{option.description}</span></span></label>)}
      </div>}
      {saved && <p role="status" className="mt-3 text-xs font-semibold text-slate-700">{saved}</p>}
      <p className="mt-3 text-xs text-slate-500">Alerts are for tracked recruiting activity, not all personal email. Daily summaries require email delivery to be configured. The athlete remains responsible for replying to coaches.</p>
    </section>
    <div className="mt-5 flex items-start gap-2 text-xs text-slate-500"><CheckCircle2 size={16} className="shrink-0" /><p>RLTNL only shows emails recorded in recruiting activity or matched from connected Gmail. Untracked emails sent outside the platform may not appear here. Keep your existing BCC process during the transition if needed.</p></div>
  </div></AppShell>;
}
