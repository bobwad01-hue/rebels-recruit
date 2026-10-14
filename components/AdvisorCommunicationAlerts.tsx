'use client';

import Link from 'next/link';
import { Bell, ArrowRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase-browser';

type Alert = { id: string; title: string; body: string | null; url: string | null; created_at: string };
const kinds = ['advisor_coach_reply', 'advisor_email_sent'];

export default function AdvisorCommunicationAlerts({ compact = false }: { compact?: boolean }) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    const db = createClient();
    async function load() {
      const { data: { user } } = await db.auth.getUser();
      if (!user || !active) return;
      const [list, assignments] = await Promise.all([
        db.from('notifications').select('id,title,body,url,created_at,data')
          .eq('user_id', user.id).in('kind', kinds).is('read_at', null)
          .order('created_at', { ascending: false }).limit(250),
        db.from('athlete_advisor_assignments').select('athlete_user_id')
          .eq('advisor_user_id', user.id).eq('status', 'active'),
      ]);
      if (!active || list.error || assignments.error) return;
      // Revoked athletes must disappear from Advisor alerts too, even if the
      // notification was generated while the assignment was active.
      const allowed = new Set((assignments.data || []).map(a => String(a.athlete_user_id)));
      const visible = (list.data || []).filter(n => allowed.has(String((n.data as any)?.athlete_user_id || '')));
      setAlerts(visible.slice(0, 6));
      setCount(visible.length);
    }
    void load();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void load(); }, 60000);
    window.addEventListener('focus', load);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('focus', load); };
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => { if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', escape); };
  }, [open]);

  async function markRead(id: string) {
    const db = createClient();
    const { data: { user } } = await db.auth.getUser();
    if (!user) return;
    const { error } = await db.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id).eq('user_id', user.id);
    if (!error) { setAlerts(rows => rows.filter(row => row.id !== id)); setCount(n => Math.max(0, n - 1)); }
  }

  if (!count) return null;
  return <div className={'relative ' + (compact ? '' : 'mb-2')} ref={ref}>
    <button type="button" onClick={() => setOpen(v => !v)} aria-expanded={open} aria-label={count + ' unread Advisor communication alerts'} className={'relative inline-flex items-center gap-2 rounded-xl border bg-white font-bold text-slate-900 hover:bg-slate-50 ' + (compact ? 'h-11 w-11 justify-center' : 'w-full px-3 py-2.5 text-xs')}>
      <Bell size={18} /><span className={compact ? 'absolute -right-1 -top-1 rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] text-white' : 'rounded-full bg-red-600 px-2 py-0.5 text-[10px] text-white'}>{count > 99 ? '99+' : count}</span>{!compact && <span>Recruiting alerts</span>}
    </button>
    {open && <div className={'absolute z-50 w-[min(340px,calc(100vw-28px))] rounded-2xl border bg-white p-3 shadow-xl ' + (compact ? 'right-0 top-full mt-2' : 'left-0 top-full mt-2')}>
      <div className="flex items-center justify-between px-1 pb-2"><h2 className="text-sm font-black">Recruiting alerts</h2><Link href="/advisors/communications" onClick={() => setOpen(false)} className="text-xs font-bold text-red-700">View all <ArrowRight size={12} className="inline" /></Link></div>
      <div className="max-h-80 divide-y overflow-y-auto">
        {alerts.map(alert => <div key={alert.id} className="py-3"><Link href={alert.url?.startsWith('/advisors/communications') ? alert.url : '/advisors/communications'} onClick={() => { void markRead(alert.id); setOpen(false); }} className="block rounded-lg p-1 hover:bg-slate-50"><div className="text-xs font-black text-slate-950">{alert.title}</div><p className="mt-1 text-xs leading-5 text-slate-600">{alert.body}</p></Link></div>)}
      </div>
    </div>}
  </div>;
}
