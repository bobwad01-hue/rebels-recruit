'use client';

import Link from 'next/link';
import { ArrowRight, Bell, CheckCircle2, ChevronRight, Clock3, Inbox, Mail, MessageSquareReply } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase-browser';

type CoachEmail = {
  id: string;
  coach_id: string;
  subject: string | null;
  summary: string | null;
  received_at: string;
  reviewed_at: string | null;
  interaction_id: string | null;
  recruiting_intent: string | null;
  extracted_data?: {senderName?:string;senderEmail?:string}|null;
  college_coaches?: { first_name?: string; last_name?: string } | null;
  colleges?: { name?: string } | null;
};
type Variant = 'bell' | 'home' | 'inbox';

function sender(email: CoachEmail) {
  return email.extracted_data?.senderName || email.extracted_data?.senderEmail || 'Sender not verified';
}
function school(email: CoachEmail) {
  return email.colleges?.name || 'College program';
}
function received(email: CoachEmail) {
  return new Date(email.received_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
function detailsUrl(email: CoachEmail) {
  return '/coaches/' + encodeURIComponent(email.coach_id) + '?email=' + encodeURIComponent(email.id);
}
function replyUrl(email: CoachEmail) {
  return '/coaches/' + encodeURIComponent(email.coach_id) + '?action=recruiting-reply&replyEmail=' + encodeURIComponent(email.id)
    + (email.interaction_id ? '&interaction=' + encodeURIComponent(email.interaction_id) : '')
    + '&intent=' + encodeURIComponent(email.recruiting_intent || 'coach_response');
}

const fields = 'id,coach_id,subject,summary,received_at,reviewed_at,interaction_id,recruiting_intent,extracted_data,college_coaches(first_name,last_name),colleges(name)';

export default function CoachEmailAlerts({ variant = 'bell', compact = false }: { variant?: Variant; compact?: boolean }) {
  const [items, setItems] = useState<CoachEmail[]>([]);
  const [reviewedItems, setReviewedItems] = useState<CoachEmail[]>([]);
  const [count, setCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'pending' | 'reviewed'>('pending');
  const popoverRef = useRef<HTMLDivElement>(null);
  const senderBackfillAttempted = useRef(false);

  useEffect(() => {
    let active = true;
    const client = createClient();
    async function load() {
      const { data: { user } } = await client.auth.getUser();
      if (!active) return;
      if (!user) { setLoaded(true); return; }

      const [pendingCount, pending, reviewed] = await Promise.all([
        client.from('gmail_recruiting_messages').select('id', { count: 'exact', head: true })
          .eq('athlete_user_id', user.id).is('reviewed_at', null),
        client.from('gmail_recruiting_messages').select(fields)
          .eq('athlete_user_id', user.id).is('reviewed_at', null)
          .order('received_at', { ascending: false }).limit(variant === 'inbox' ? 100 : 6),
        variant === 'inbox'
          ? client.from('gmail_recruiting_messages').select(fields)
              .eq('athlete_user_id', user.id).not('reviewed_at', 'is', null)
              .order('reviewed_at', { ascending: false }).limit(30)
          : Promise.resolve({ data: [] as CoachEmail[], error: null }),
      ]);
      if (!active) return;
      if (pendingCount.error || pending.error || reviewed.error) {
        setError(true);
      } else {
        setItems((pending.data || []) as unknown as CoachEmail[]);
        setReviewedItems((reviewed.data || []) as unknown as CoachEmail[]);
        setCount(pendingCount.count || 0);
        setError(false);
        if (!senderBackfillAttempted.current && (pending.data || []).some(message => !message.extracted_data?.senderEmail)) {
          senderBackfillAttempted.current = true;
          void fetch('/api/google/gmail/sync', { method: 'POST', cache: 'no-store' })
            .then(response => { if (response.ok && active) void load(); })
            .catch(() => {});
        }
      }
      setLoaded(true);
    }
    void load();
    const refresh = () => { void load(); };
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, 60000);
    window.addEventListener('focus', refresh);
    window.addEventListener('rltnl:coach-emails-updated', refresh);
    window.addEventListener('rebels:data-changed', refresh);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('rltnl:coach-emails-updated', refresh);
      window.removeEventListener('rebels:data-changed', refresh);
    };
  }, [variant]);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) setOpen(false);
    };
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeEscape);
    };
  }, [open]);

  if (variant === 'home') {
    if (!loaded || error || !count || !items.length) return null;
    const first = items[0];
    return (
      <section aria-label="Coach emails needing review" className="mb-6 rounded-2xl border border-red-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-700">
              <Mail size={20} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-red-700">Incoming coach email</span>
                <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-red-700">{count} to review</span>
              </div>
              <h2 className="mt-1 text-base font-black text-slate-950 sm:text-lg">
                {sender(first)} <span className="font-medium text-slate-500">· {school(first)}</span>
              </h2>
              {first.extracted_data?.senderEmail && <p className="mt-0.5 text-xs text-slate-500">From: {first.extracted_data.senderEmail}</p>}
              <p className="mt-1 truncate text-sm text-slate-600">{first.subject || 'New recruiting email'}</p>
              {count > 1 && <p className="mt-1 text-xs text-slate-500">Plus {count - 1} more {count === 2 ? 'message' : 'messages'} waiting for review.</p>}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
            <Link href={detailsUrl(first)} className="btn btn-red text-sm">
              Review email <ArrowRight size={16} />
            </Link>
            {count > 1 && <Link href="/coach-emails" className="btn text-sm">View all</Link>}
          </div>
        </div>
      </section>
    );
  }

  if (variant === 'inbox') {
    const activeItems = tab === 'pending' ? items : reviewedItems;
    return (
      <div className="space-y-5">
        <div className="flex flex-col gap-4 rounded-2xl border bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-700"><Inbox size={23} /></div>
            <div>
              <div className="text-xs font-black uppercase tracking-wider text-red-700">Your recruiting conversations</div>
              <h2 className="mt-1 text-xl font-black text-slate-950">Stay on top of every coach reply</h2>
              <p className="mt-1 max-w-xl text-sm text-slate-600">Review new messages, reply in the original Gmail conversation, and keep your recruiting relationships moving.</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3">
            <span className="text-3xl font-black tabular-nums text-red-700">{loaded && !error ? count : '—'}</span>
            <span className="text-xs font-bold leading-4 text-red-800">To<br />review</span>
          </div>
        </div>
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
          <section className="min-w-0">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div role="tablist" aria-label="Coach email review status" className="inline-flex max-w-full rounded-xl border bg-white p-1">
                <button type="button" role="tab" aria-selected={tab === 'pending'} onClick={() => setTab('pending')}
                  className={'rounded-lg px-3 py-2 text-sm font-bold transition-colors sm:px-4 ' + (tab === 'pending' ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-slate-50')}>
                  Needs review {loaded && !error && <span className="ml-1 tabular-nums">{count}</span>}
                </button>
                <button type="button" role="tab" aria-selected={tab === 'reviewed'} onClick={() => setTab('reviewed')}
                  className={'rounded-lg px-3 py-2 text-sm font-bold transition-colors sm:px-4 ' + (tab === 'reviewed' ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-slate-50')}>
                  Reviewed
                </button>
              </div>
              <span className="text-xs text-slate-500">Synced with your connected Gmail</span>
            </div>
            {!loaded ? (
              <div className="card p-8 text-center text-sm text-slate-600" role="status">Loading coach emails…</div>
            ) : error ? (
              <div className="card p-8 text-center" role="alert">
                <p className="font-bold">Coach emails could not be loaded.</p>
                <button type="button" className="btn mt-3 text-sm" onClick={() => window.dispatchEvent(new Event('rltnl:coach-emails-updated'))}>Try again</button>
              </div>
            ) : activeItems.length === 0 ? (
              <div className="card px-6 py-12 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 text-slate-500">
                  <CheckCircle2 size={26} />
                </div>
                <h3 className="mt-4 text-lg font-black">{tab === 'pending' ? 'All caught up' : 'No reviewed emails yet'}</h3>
                <p className="mx-auto mt-2 max-w-sm text-sm text-slate-600">
                  {tab === 'pending' ? 'No incoming coach emails need your attention right now. New replies will appear here.' : 'After you review or reply to a coach email, you can find it here.'}
                </p>
                {tab === 'pending' && reviewedItems.length > 0 &&
                  <button type="button" onClick={() => setTab('reviewed')} className="btn mt-5 text-sm">See reviewed emails <ArrowRight size={15} /></button>}
              </div>
            ) : (
              <div className="space-y-3" role="tabpanel">
                {activeItems.map((email) => (
                  <article key={email.id} className="card p-4 transition-shadow hover:shadow-md sm:p-5">
                    <div className="flex items-start gap-3">
                      <div className={'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ' + (tab === 'pending' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700')}>
                        {tab === 'pending' ? <Mail size={19} /> : <CheckCircle2 size={19} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="text-base font-black">{sender(email)}</h3>
                          <span className={'rounded-full px-2.5 py-1 text-[11px] font-black ' + (tab === 'pending' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700')}>
                            {tab === 'pending' ? 'Needs review' : 'Reviewed'}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs font-semibold text-slate-500">{school(email)} · {received(email)}</p>
                        {email.extracted_data?.senderEmail && <p className="mt-1 text-xs text-slate-500 break-all">From: {email.extracted_data.senderEmail}</p>}
                        <p className="mt-3 break-words text-sm font-bold text-slate-900">{email.subject || 'New recruiting email'}</p>
                        {email.summary && <p className="mt-1 line-clamp-2 break-words text-sm text-slate-600">{email.summary}</p>}
                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          <Link href={detailsUrl(email)} className={tab === 'pending' ? 'btn btn-red text-sm' : 'btn text-sm'}>
                            {tab === 'pending' ? 'Review email' : 'View conversation'} <ArrowRight size={15} />
                          </Link>
                          <Link href={replyUrl(email)} className="btn text-sm">
                            <MessageSquareReply size={15} /> Reply in thread
                          </Link>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
                {tab === 'reviewed' && reviewedItems.length >= 30 && <p className="text-xs text-slate-500">Showing the 30 most recently reviewed emails.</p>}
              </div>
            )}
          </section>
          <aside className="card p-5 lg:sticky lg:top-5" aria-label="How coach email reviews work">
            <h3 className="text-base font-black">Keep the conversation moving</h3>
            <p className="mt-2 text-sm text-slate-600">RLTNL helps you turn a coach's email into a clear next step.</p>
            <div className="mt-5 space-y-5">
              <div className="flex items-start gap-3"><Mail size={17} className="mt-0.5 shrink-0 text-red-700" /><div><div className="text-sm font-bold">1. Review</div><p className="mt-1 text-xs leading-5 text-slate-600">Read the message and mark it reviewed when you're done.</p></div></div>
              <div className="flex items-start gap-3"><MessageSquareReply size={17} className="mt-0.5 shrink-0 text-red-700" /><div><div className="text-sm font-bold">2. Reply</div><p className="mt-1 text-xs leading-5 text-slate-600">Respond in the existing Gmail thread. Sending a reply also marks the message reviewed.</p></div></div>
              <div className="flex items-start gap-3"><Clock3 size={17} className="mt-0.5 shrink-0 text-red-700" /><div><div className="text-sm font-bold">3. Follow through</div><p className="mt-1 text-xs leading-5 text-slate-600">Track the conversation and any next actions in the coach relationship.</p></div></div>
            </div>
            <p className="mt-5 border-t pt-4 text-xs leading-5 text-slate-500">RLTNL review status is separate from Gmail's read status. Only tracked college coach communications appear here.</p>
          </aside>
        </div>
      </div>
    );
  }

  return (
    <div ref={popoverRef} className="relative">
      <button type="button" aria-label={'Coach email alerts, ' + count + ' to review'} aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={'relative flex items-center gap-2 rounded-xl border bg-white p-3 text-sm font-bold transition-colors hover:bg-slate-50 ' + (compact ? 'h-11 w-11 justify-center' : 'w-full')}>
        <Bell size={19} />
        {!compact && 'Coach Emails'}
        {count > 0 && <span className={'rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-black text-white ' + (compact ? 'absolute -right-1 -top-1' : 'ml-auto')}>{count > 99 ? '99+' : count}</span>}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-[85] mt-2 max-h-[70vh] w-[min(88vw,350px)] overflow-y-auto rounded-2xl border bg-white p-3 shadow-xl lg:left-0 lg:right-auto">
          <div className="flex items-center justify-between gap-2 px-1 pb-3">
            <div className="font-black">Coach email alerts</div>
            {count > 0 && <span className="rounded-full bg-red-50 px-2 py-1 text-xs font-bold text-red-700">{count} new</span>}
          </div>
          {error ? <p className="p-2 text-sm text-red-700">Could not load alerts.</p>
            : !loaded ? <p className="p-2 text-sm text-slate-600">Loading…</p>
            : count === 0 ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">You're all caught up. No emails need review.</p>
            : <div className="space-y-2">{items.slice(0, 5).map((email) =>
                <Link key={email.id} href={detailsUrl(email)} onClick={() => setOpen(false)}
                  className="block rounded-xl border p-3 transition-colors hover:border-red-200 hover:bg-red-50">
                  <div className="font-black text-sm">{sender(email)}</div>
                  <div className="mt-0.5 text-xs text-slate-500">{school(email)} · {received(email)}</div>
                  <div className="mt-2 line-clamp-2 break-words text-xs text-slate-700">{email.subject || 'New recruiting email'}</div>
                  <div className="mt-2 flex items-center gap-1 text-xs font-bold text-red-700">Review email <ChevronRight size={14} /></div>
                </Link>)}</div>}
          <Link href="/coach-emails" onClick={() => setOpen(false)} className="btn btn-red mt-3 w-full justify-center text-sm">
            Open Coach Emails <ArrowRight size={15} />
          </Link>
        </div>
      )}
    </div>
  );
}
