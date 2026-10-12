'use client';

import Link from 'next/link';
import { CheckCircle2, Mail, MessageSquareReply, ArrowUpRight } from 'lucide-react';
import { useEffect, useState } from 'react';

type Email = {
  id: string;
  subject: string | null;
  received_at: string;
  summary: string | null;
  reviewed_at: string | null;
  interaction_id: string | null;
  recruiting_intent: string | null;
};

export default function CoachEmailReview({
  email, coachId, coachName, collegeName,
}: {
  email: Email;
  coachId: string;
  coachName: string;
  collegeName: string;
}) {
  const [reviewed, setReviewed] = useState(Boolean(email.reviewed_at));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setReviewed(Boolean(email.reviewed_at));
    setError('');
  }, [email.id, email.reviewed_at]);

  useEffect(() => {
    const onReply = (event: Event) => {
      if ((event as CustomEvent<{ emailId?: string }>).detail?.emailId === email.id) setReviewed(true);
    };
    window.addEventListener('rltnl:coach-emails-updated', onReply);
    return () => window.removeEventListener('rltnl:coach-emails-updated', onReply);
  }, [email.id]);

  async function markReviewed() {
    if (busy || reviewed) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/coach-emails/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailId: email.id }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || 'Could not save review status.');
      }
      setReviewed(true);
      window.dispatchEvent(new Event('rltnl:coach-emails-updated'));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save review status.');
    } finally {
      setBusy(false);
    }
  }

  const replyHref = '/coaches/' + encodeURIComponent(coachId) + '?action=recruiting-reply&replyEmail=' + encodeURIComponent(email.id)
    + (email.interaction_id ? '&interaction=' + encodeURIComponent(email.interaction_id) : '')
    + '&intent=' + encodeURIComponent(email.recruiting_intent || 'coach_response');

  return (
    <section id="coach-email-review" aria-label="Incoming coach email" className={'mt-5 scroll-mt-24 rounded-2xl border bg-white p-4 shadow-sm sm:p-5 ' + (reviewed ? 'border-slate-200' : 'border-red-200')}>
      <div className="flex items-start gap-3">
        <div className={'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ' + (reviewed ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700')}>
          {reviewed ? <CheckCircle2 size={19} /> : <Mail size={19} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-slate-600">Coach email</span>
            <span aria-live="polite" className={'rounded-full px-2.5 py-1 text-[11px] font-black ' + (reviewed ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700')}>
              {reviewed ? 'Reviewed' : 'Needs review'}
            </span>
          </div>
          <h2 className="mt-1 break-words text-base font-black sm:text-lg">{email.subject || 'New recruiting email'}</h2>
          <p className="mt-1 text-xs font-medium text-slate-500">
            {coachName} · {collegeName} · {new Date(email.received_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
          </p>
          {email.summary && <p className="mt-3 break-words text-sm text-slate-700">{email.summary}</p>}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {email.interaction_id && <Link href={'/activity/' + email.interaction_id} className="btn text-sm">View details <ArrowUpRight size={15} /></Link>}
            <Link href={replyHref} className="btn text-sm"><MessageSquareReply size={15} /> Reply in thread</Link>
            {!reviewed && <button type="button" className="btn btn-red text-sm" onClick={markReviewed} disabled={busy}>
              <CheckCircle2 size={15} /> {busy ? 'Saving…' : 'Mark reviewed'}
            </button>}
          </div>
          {error && <p role="alert" className="mt-3 text-sm font-semibold text-red-700">{error}</p>}
          {!reviewed && <p className="mt-3 text-xs text-slate-500">Marking this reviewed clears the alert. Replying also marks it reviewed automatically.</p>}
        </div>
      </div>
    </section>
  );
}
