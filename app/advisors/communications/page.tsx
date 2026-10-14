'use client';

import Link from 'next/link';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowRight, Bell, CheckCircle2, ChevronDown, Clock3, Inbox, Mail, MessageCircleReply, RefreshCw, Search, ShieldCheck, Users } from 'lucide-react';
import AppShell from '@/components/AppShell';
import PageHeader from '@/components/PageHeader';
import { groupAdvisorCommunications } from '@/lib/advisor-communication-threads';
import type { AdvisorMessage } from '@/lib/advisor-communication-threads';

type Preferences = {
  advisor_coach_reply_alerts: boolean;
  advisor_email_sent_alerts: boolean;
  advisor_daily_digest: boolean;
};
type Player = { id: string; name: string };
const DEFAULTS: Preferences = {
  advisor_coach_reply_alerts: true, advisor_email_sent_alerts: false, advisor_daily_digest: false,
};
const when = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
};
const resolvedStates = new Set(['completed', 'closed', 'dismissed', 'done', 'no_action']);

export default function AdvisorCommunicationsPage() {
  return <Suspense fallback={<AppShell><div className="mx-auto max-w-7xl px-5 py-8 text-sm text-slate-600">Loading communications…</div></AppShell>}><Communications /></Suspense>;
}

function Communications() {
  const params = useSearchParams();
  const [players, setPlayers] = useState<Player[]>([]);
  const [messages, setMessages] = useState<AdvisorMessage[]>([]);
  const [preferences, setPreferences] = useState<Preferences>(DEFAULTS);
  const [player, setPlayer] = useState('all');
  const [direction, setDirection] = useState('all');
  const [range, setRange] = useState('90');
  const [needsOnly, setNeedsOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedThreadId, setSelectedThreadId] = useState('');
  const [selectedMessageId, setSelectedMessageId] = useState('');
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
      if (requestedMessage && (data.messages || []).some((m: AdvisorMessage) => m.id === requestedMessage)) {
        setSelectedMessageId(requestedMessage);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Communications could not be loaded.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [params]);

  useEffect(() => { void load(); }, [load]);

  const threads = useMemo(() => groupAdvisorCommunications(messages), [messages]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const cutoff = range === 'all' ? 0 : Date.now() - Number(range) * 86400000;
    return threads.filter(thread => {
      if (player !== 'all' && thread.athleteId !== player) return false;
      if (direction !== 'all' && !thread.messages.some(m => m.direction === direction)) return false;
      if (needsOnly && !thread.needsAttention) return false;
      if (cutoff && Date.parse(thread.lastActivity) < cutoff) return false;
      if (q && !thread.messages.some(m => [m.athleteName, m.coachName, m.schoolName, m.subject, m.summary, m.body]
        .some(value => String(value || '').toLowerCase().includes(q)))) return false;
      return true;
    });
  }, [threads, player, direction, needsOnly, range, search]);

  const requestedMessageId = params.get('message');
  const current = filtered.find(t => t.id === selectedThreadId)
    || filtered.find(t => t.messages.some(m => m.id === (selectedMessageId || requestedMessageId)))
    || filtered[0] || null;
  const expandedMessageId = current?.messages.some(m => m.id === selectedMessageId) ? selectedMessageId
    : current?.messages.some(m => m.id === requestedMessageId) ? requestedMessageId
    : current?.latest.id || '';
  const visibleMessages = filtered.flatMap(t => t.messages);
  const sent = visibleMessages.filter(m => m.direction === 'sent').length;
  const received = visibleMessages.filter(m => m.direction === 'received').length;
  const attention = filtered.filter(t => t.needsAttention).length;

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
      <PageHeader eyebrow="ADVISOR COMMUNICATIONS" title="Recruiting Conversations" subtitle="See who reached out, what coaches said, and where your players need your follow-through." />
      <button type="button" className="btn text-sm" disabled={refreshing || loading} onClick={() => void load(true)}><RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} /> Refresh</button>
    </div>
    <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
      <div className="flex items-start gap-2"><ShieldCheck size={18} className="mt-0.5 shrink-0 text-slate-600" /><p><b>Player-approved access only.</b> You see recruiting communications for athletes who have an active Advisor assignment with you. This is not access to their entire Gmail inbox. Athletes can revoke Advisor access from Support Team.</p></div>
    </div>
    {error && <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">{error} <button type="button" className="ml-2 underline" onClick={() => void load()}>Try again</button></div>}

    <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
      {[
        { label: 'Assigned players', value: players.length, icon: Users },
        { label: 'Emails sent', value: sent, icon: Mail },
        { label: 'Coach emails', value: received, icon: MessageCircleReply },
        { label: 'Follow-through flagged', value: attention, icon: Bell },
      ].map(item => <div key={item.label} className="rounded-2xl border bg-white p-4 shadow-sm"><div className="flex items-center justify-between gap-2 text-slate-500"><span className="text-xs font-bold">{item.label}</span><item.icon size={17} className="shrink-0" /></div><div className="mt-2 text-3xl font-black tabular-nums text-slate-950">{loading ? '—' : item.value}</div></div>)}
    </div>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
      <span>Sent and received are message counts. Follow-through is counted once per conversation, based on open RLTNL suggestions without a later sent reply. Review suggestions with the athlete.</span>
      <Link href="/advisors/access" className="shrink-0 font-bold text-red-700 hover:underline">Manage player assignments <ArrowRight size={13} className="inline" /></Link>
    </div>

    <div className="mt-6 rounded-2xl border bg-white p-4 sm:p-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1.6fr]">
        <label className="min-w-0 text-xs font-bold text-slate-700">Player
          <select className="input mt-1 w-full" value={player} onChange={e => { setPlayer(e.target.value); setSelectedThreadId(''); setSelectedMessageId(''); }}><option value="all">All assigned players</option>{players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        </label>
        <label className="min-w-0 text-xs font-bold text-slate-700">Communication
          <select className="input mt-1 w-full" value={direction} onChange={e => { setDirection(e.target.value); setSelectedThreadId(''); setSelectedMessageId(''); }}><option value="all">Sent and received</option><option value="sent">Includes sent email</option><option value="received">Includes coach email</option></select>
        </label>
        <label className="min-w-0 text-xs font-bold text-slate-700">When
          <select className="input mt-1 w-full" value={range} onChange={e => { setRange(e.target.value); setSelectedThreadId(''); setSelectedMessageId(''); }}><option value="30">Active in last 30 days</option><option value="90">Active in last 90 days</option><option value="all">All loaded history</option></select>
        </label>
        <label className="min-w-0 text-xs font-bold text-slate-700">Find a conversation
          <span className="mt-1 flex min-h-[42px] w-full items-center gap-2 rounded-[10px] border border-[#d0d5dd] bg-white px-3 focus-within:border-slate-400 focus-within:ring-2 focus-within:ring-slate-100">
            <Search size={17} className="shrink-0 text-slate-400" aria-hidden="true" />
            <input className="min-w-0 w-full flex-1 border-0 bg-transparent py-2 text-sm font-normal text-slate-900 outline-none placeholder:text-slate-400" value={search} onChange={e => { setSearch(e.target.value); setSelectedThreadId(''); setSelectedMessageId(''); }} placeholder="Player, school, coach, subject…" />
          </span>
        </label>
      </div>
      <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={needsOnly} onChange={e => { setNeedsOnly(e.target.checked); setSelectedThreadId(''); setSelectedMessageId(''); }} className="h-4 w-4 accent-red-700" /> Show only conversations with suggested follow-through</label>
    </div>

    {truncated && <p className="mt-3 text-xs font-semibold text-amber-800">Showing recent communications only. Older records remain saved in recruiting activity; older messages in a thread may be omitted.</p>}
    <div className="mt-5 grid items-start gap-4 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
      <section aria-label="Recruiting email conversations" className="min-w-0 overflow-hidden rounded-2xl border bg-white">
        <div className="flex items-center justify-between gap-2 border-b px-4 py-3"><h2 className="text-sm font-black">Recruiting conversations</h2><span className="text-xs text-slate-500">{filtered.length} threads · {visibleMessages.length} emails</span></div>
        {loading ? <div className="p-8 text-center text-sm text-slate-500">Loading recruiting communications…</div> : !players.length ? <div className="p-8 text-center"><Users className="mx-auto text-slate-400" size={30} /><h3 className="mt-3 font-black">No assigned players yet</h3><p className="mt-2 text-sm text-slate-600">Request Advisor access to the players you support. Each athlete must approve before their recruiting communications appear.</p><Link className="btn btn-red mt-4" href="/advisors/access">Request player access <ArrowRight size={15} /></Link></div> : !filtered.length ? <div className="p-8 text-center"><Inbox className="mx-auto text-slate-400" size={30} /><h3 className="mt-3 font-black">No conversations match</h3><p className="mt-2 text-sm text-slate-600">Try a broader date range or different filters. Only logged recruiting emails and matched Gmail coach replies appear here.</p></div> : <div className="max-h-[680px] divide-y overflow-y-auto">
          {filtered.map(thread => <button type="button" key={thread.id} onClick={() => { setSelectedThreadId(thread.id); setSelectedMessageId(thread.latest.id); }} aria-pressed={current?.id === thread.id} className={'w-full p-4 text-left transition hover:bg-slate-50 ' + (current?.id === thread.id ? 'bg-red-50/60' : '')}>
            <div className="flex flex-wrap items-center justify-between gap-2"><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase text-slate-700">{thread.messages.length} email{thread.messages.length === 1 ? '' : 's'} · {thread.sentCount} sent / {thread.receivedCount} received</span><span className="text-[11px] text-slate-500">{when(thread.lastActivity)}</span></div>
            <div className="mt-2 flex items-start justify-between gap-2"><div className="min-w-0"><p className="text-sm font-black text-slate-950">{thread.athleteName} <span className="font-medium text-slate-500">· {thread.schoolName}</span></p><p className="mt-0.5 text-xs text-slate-600">{thread.coachName}</p></div><ChevronDown size={16} className="shrink-0 -rotate-90 text-slate-400" /></div>
            <p className="mt-2 line-clamp-2 break-words text-sm font-semibold text-slate-900">{thread.subject}</p>
            {thread.latest.summary && <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">{thread.latest.summary}</p>}
            {thread.needsAttention && <span className="mt-2 inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-800"><Clock3 size={12} /> {thread.needsReview ? 'Needs athlete review' : 'Follow-through suggested'}</span>}
          </button>)}
        </div>}
      </section>

      <section aria-label="Selected recruiting conversation" className="min-w-0 rounded-2xl border bg-white p-4 sm:p-6 lg:sticky lg:top-4">
        {!current ? <div className="py-14 text-center text-sm text-slate-500">Select a conversation to review its details.</div> : <>
          <div className="flex flex-wrap items-center justify-between gap-2"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-700">{current.messages.length} messages in this conversation</span><span className="text-xs text-slate-500">Last activity {when(current.lastActivity)}</span></div>
          <h2 className="mt-4 break-words text-xl font-black text-slate-950">{current.subject}</h2>
          <dl className="mt-4 grid grid-cols-[70px_minmax(0,1fr)] gap-x-3 gap-y-2 border-b pb-5 text-sm"><dt className="text-slate-500">Player</dt><dd className="font-semibold">{current.athleteName}</dd><dt className="text-slate-500">Coach</dt><dd className="font-semibold">{current.coachName}</dd><dt className="text-slate-500">School</dt><dd className="font-semibold">{current.schoolName}</dd></dl>
          {current.needsAttention ? <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center gap-2 text-sm font-black text-amber-900"><Clock3 size={17} /> {current.needsReview ? 'Athlete review needed' : 'Suggested follow-through'}</div>
            <p className="mt-2 text-sm leading-6 text-amber-900">{current.suggestedNextAction || 'Review the coach response with the athlete and agree on the next step.'}</p>
            <p className="mt-2 text-xs text-amber-800">Suggested by RLTNL, not a confirmed overdue task. The athlete manages their coach email decisions and follow-up.</p>
          </div> : <div className="mt-5 flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700"><CheckCircle2 size={17} className="mt-0.5 shrink-0 text-slate-500" /><p>No unanswered coach email is currently flagged in this conversation. This does not necessarily mean every recruiting task is complete.</p></div>}
          <div className="mt-6">
            <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-black text-slate-900">Conversation history</h3><span className="text-xs text-slate-500">Oldest to newest · select an email to read</span></div>
            <div className="mt-3 space-y-3">
              {current.messages.map((m, index) => {
                const expanded = m.id === expandedMessageId;
                const resolved = resolvedStates.has((m.actionState || '').toLowerCase());
                const repliedLater = current.messages.some(reply => reply.direction === 'sent' && Date.parse(reply.timestamp) > Date.parse(m.timestamp));
                return <article key={m.id} className={'min-w-0 overflow-hidden rounded-xl border ' + (expanded ? 'border-slate-300 shadow-sm' : 'border-slate-200')}>
                  <button type="button" className="flex w-full items-start justify-between gap-3 p-3 text-left hover:bg-slate-50 sm:p-4" aria-expanded={expanded} onClick={() => setSelectedMessageId(expanded ? '' : m.id)}>
                    <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className={'rounded-full px-2 py-0.5 text-[10px] font-black uppercase ' + (m.direction === 'received' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-700')}>{m.direction === 'received' ? 'Coach email' : m.sentByAdvisor ? 'Advisor sent' : 'Player sent'}</span><span className="text-[11px] text-slate-500">#{index + 1} · {when(m.timestamp)}</span></div>
                      <p className="mt-2 break-words text-sm font-bold text-slate-900">{m.subject}</p>
                      <p className="mt-1 text-xs text-slate-600">From {m.direction === 'received' ? m.coachName : m.sentByAdvisor ? 'Advisor' : m.athleteName} · To {m.direction === 'received' ? m.athleteName : m.coachName}</p>
                    </div><ChevronDown size={18} className={'mt-1 shrink-0 text-slate-500 transition-transform ' + (expanded ? 'rotate-180' : '')} />
                  </button>
                  {expanded && <div className="border-t px-3 pb-4 pt-3 sm:px-4">
                    <dl className="grid grid-cols-[64px_minmax(0,1fr)] gap-x-3 gap-y-2 text-xs"><dt className="text-slate-500">From</dt><dd className="break-words font-semibold text-slate-800">{m.direction === 'received' ? m.coachName : m.sentByAdvisor ? 'Advisor' : m.athleteName}{m.direction === 'received' && m.senderEmail ? ' (' + m.senderEmail + ')' : ''}</dd><dt className="text-slate-500">To</dt><dd className="font-semibold text-slate-800">{m.direction === 'received' ? m.athleteName : m.coachName}</dd><dt className="text-slate-500">Source</dt><dd className="text-slate-700">{m.source === 'gmail' ? 'Connected Gmail' : m.source === 'rltnl' ? 'Sent through RLTNL' : 'Manually logged'}</dd></dl>
                    {m.direction === 'received' && m.actionRequired && !resolved && <div className={'mt-3 rounded-lg p-3 text-xs leading-5 ' + (repliedLater ? 'bg-slate-100 text-slate-700' : 'bg-amber-50 text-amber-900')}><b>{repliedLater ? 'A later email was sent · confirm any remaining next step' : m.reviewed ? 'Reviewed by athlete · suggested next step' : 'Awaiting athlete review'}</b><p>{m.nextAction || 'Review and decide the next step.'}</p></div>}
                    <h4 className="mt-4 text-[11px] font-black uppercase tracking-wide text-slate-500">{m.body ? 'Email message' : 'Recorded summary'}</h4>
                    {m.body ? <div className="mt-2 max-h-[430px] overflow-auto whitespace-pre-wrap break-words rounded-xl border bg-slate-50 p-4 text-sm leading-6 text-slate-800">{m.body}</div>
                      : <div className="mt-2 rounded-xl border bg-slate-50 p-4 text-sm leading-6 text-slate-700">{m.summary || 'No message text was recorded for this email.'}<p className="mt-3 text-xs text-slate-500">The full email body was not saved. This is a summary, not the original email.</p></div>}
                  </div>}
                </article>;
              })}
            </div>
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
