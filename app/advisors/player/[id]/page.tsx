'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, Clock3, MessageSquare } from 'lucide-react';
import { useParams } from 'next/navigation';
import AppShell from '@/components/AppShell';
import PageHeader from '@/components/PageHeader';
import AdvisorNoteForm from '@/components/AdvisorNoteForm';
import { createClient } from '@/lib/supabase-browser';
import {DEFAULT_TIMEZONE,formatInteractionDateTime} from '@/lib/us-timezones';

export default function AdvisorPlayer() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const c = createClient();
  const [player, setPlayer] = useState<any>(null);
  const [colleges, setColleges] = useState<any[]>([]);
  const [coaches, setCoaches] = useState<any[]>([]);
  const [interactions, setInteractions] = useState<any[]>([]);
  const [reminders, setReminders] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [social, setSocial] = useState<any>(null);
  const [timezone,setTimezone]=useState(DEFAULT_TIMEZONE);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    load();
  }, [id]);

  async function load() {
    const {data:{user}}=await c.auth.getUser();
    const [p, ap, ac, coachRows, ints, rems, ns, ts, sa, viewer] = await Promise.all([
      c.from('profiles').select('id,full_name,email').eq('id', id).single(),
      c.from('athlete_profiles').select('*').eq('user_id', id).single(),
      c.from('athlete_colleges').select('id,status,fit_rating,academic_fit,athletic_fit,location_fit,notes,colleges(id,name,state,city,division,conference)').eq('athlete_user_id', id),
      c.from('athlete_coaches').select('id,relationship_rating,last_contact_date,next_step,notes,colleges(name),college_coaches(first_name,last_name,title,email)').eq('athlete_user_id', id),
      c.from('interactions').select('id,type,note,date,created_at,initiated_by,follow_up_due_date,follow_up_completed_at,colleges(name),college_coaches(first_name,last_name)').eq('athlete_user_id', id).order('date', { ascending: false }).limit(20),
      c.from('reminders').select('id,title,due_date,status,colleges(name),college_coaches(first_name,last_name)').eq('athlete_user_id', id).order('due_date').limit(20),
      c.from('notes').select('id,content,visibility,created_at,author_user_id').eq('athlete_user_id', id).order('created_at', { ascending: false }).limit(20),
      c.from('advisor_tasks').select('id,title,description,due_date,status,assigned_to_user_id,created_at').eq('athlete_user_id', id).order('due_date'),
      c.from('social_accounts').select('provider,username,display_name,status,last_synced_at').eq('athlete_user_id', id).eq('provider', 'x').maybeSingle(),
      c.from('profiles').select('timezone').eq('id',user?.id).single(),
    ]);

    if (p.error || !p.data) {
      setError('You do not have access to this player yet. The player must accept your advisor invitation before their data is shared.');
      return;
    }

    setTimezone(viewer.data?.timezone||DEFAULT_TIMEZONE);
    setPlayer({ ...p.data, ...(ap.data || {}) });
    setColleges(ac.data || []);
    setCoaches(coachRows.data || []);
    setInteractions(ints.data || []);
    setReminders(rems.data || []);
    setNotes(ns.data || []);
    setTasks(ts.data || []);
    setSocial(sa.data || null);
  }

  if (error) {
    return (
      <AppShell>
        <div className="max-w-4xl mx-auto px-5 md:px-8 py-6">
          <Link href="/advisors" className="text-sm font-bold inline-flex items-center gap-2"><ArrowLeft size={15} /> Back to Advisor View</Link>
          <div className="card p-6 mt-6"><h1 className="font-black text-xl">Access not available</h1><p className="muted mt-2">{error}</p></div>
        </div>
      </AppShell>
    );
  }

  return <AppShell><div className="max-w-7xl mx-auto px-5 md:px-8 py-6"><Link href="/advisors" className="text-sm font-bold inline-flex items-center gap-2"><ArrowLeft size={15} /> Back to Advisor View</Link>{player&&<><PageHeader title={player.full_name||'Player'} subtitle={`${player.class_year||'Class year not set'} · ${player.school_name||'School not set'}${player.positions?.length?' · '+player.positions.join(' / '):''}`} action={<Link href={`/messages?to=${player.id}`} className="btn btn-red"><MessageSquare size={17}/> Message Player</Link>}/><div className="grid grid-cols-2 lg:grid-cols-6 gap-3"><div className="card p-4"><div className="muted text-xs">GPA</div><div className="font-black text-2xl mt-1">{player.gpa||'—'}</div></div><div className="card p-4"><div className="muted text-xs">Colleges</div><div className="font-black text-2xl mt-1">{colleges.length}</div></div><div className="card p-4"><div className="muted text-xs">Coaches</div><div className="font-black text-2xl mt-1">{coaches.length}</div></div><div className="card p-4"><div className="muted text-xs">Interactions</div><div className="font-black text-2xl mt-1">{interactions.length}</div></div><div className="card p-4"><div className="muted text-xs">Open Follow-ups</div><div className="font-black text-2xl mt-1">{reminders.filter(r=>r.status==='open').length}</div></div><div className="card p-4"><div className="muted text-xs">Open Tasks</div><div className="font-black text-2xl mt-1">{tasks.filter(t=>t.status==='open').length}</div></div></div><div className="grid lg:grid-cols-2 gap-6 mt-6"><section className="card p-5"><h2 className="font-black text-lg">Player Profile</h2><div className="grid md:grid-cols-2 gap-4 mt-4 text-sm"><div><div className="muted">Email</div><div className="font-bold mt-1">{player.email||'—'}</div></div><div><div className="muted">State</div><div className="font-bold mt-1">{player.primary_state||'—'}</div></div><div className="md:col-span-2"><div className="muted">Interested majors</div><div className="font-bold mt-1">{player.interested_majors?.join(', ')||'—'}</div></div><div className="md:col-span-2"><div className="muted">Bio</div><div className="mt-1">{player.bio||'No bio added.'}</div></div></div></section><section className="card p-5"><div className="flex items-center justify-between"><h2 className="font-black text-lg">Tasks</h2><CheckCircle2 size={19}/></div><div className="mt-4 space-y-3">{tasks.slice(0,8).map(t=><div key={t.id} className="border rounded-xl p-3"><div className="font-bold">{t.title}</div><div className="muted text-xs mt-1">{t.status} · {t.due_date||'No due date'}</div>{t.description&&<div className="text-sm mt-2">{t.description}</div>}</div>)}{!tasks.length&&<div className="muted py-5">No advisor tasks.</div>}</div></section></div><div className="grid lg:grid-cols-2 gap-6 mt-6"><section className="card p-5"><h2 className="font-black text-lg">College Pipeline</h2><div className="mt-4 space-y-3">{colleges.map(a=><div key={a.id} className="border rounded-xl p-4"><div className="flex justify-between gap-3"><div><div className="font-bold">{a.colleges?.name}</div><div className="muted text-xs mt-1">{[a.colleges?.division,a.colleges?.city,a.colleges?.state].filter(Boolean).join(' · ')}</div></div><span className="text-xs font-bold rounded-full bg-slate-100 px-2 py-1">{a.status}</span></div>{a.notes&&<p className="text-sm mt-2">{a.notes}</p>}</div>)}{!colleges.length&&<div className="muted py-5">No colleges added.</div>}</div></section><section className="card p-5"><h2 className="font-black text-lg">Coach Relationships</h2><div className="mt-4 space-y-3">{coaches.map(x=><div key={x.id} className="border rounded-xl p-4"><div className="font-bold">{x.college_coaches?.first_name} {x.college_coaches?.last_name}</div><div className="muted text-sm">{x.college_coaches?.title||'Coach'} · {x.colleges?.name||'College'}</div><div className="muted text-xs mt-2">Last contact: {x.last_contact_date||'—'} · Next step: {x.next_step||'—'}</div></div>)}{!coaches.length&&<div className="muted py-5">No coach relationships added.</div>}</div></section></div><div className="grid lg:grid-cols-3 gap-6 mt-6"><section className="card p-5 lg:col-span-2"><h2 className="font-black text-lg">Recent Activity</h2><div className="mt-4 space-y-3">{interactions.map(i=><div key={i.id} className="border rounded-xl p-4"><div className="flex items-center gap-2"><Clock3 size={16}/><div className="font-bold">{i.type}</div><div className="muted text-xs ml-auto">{formatInteractionDateTime(i.date,i.created_at,timezone)}</div></div><div className="muted text-sm mt-1">{i.colleges?.name||'College'}{i.college_coaches?` · ${i.college_coaches.first_name||''} ${i.college_coaches.last_name||''}`:''}</div>{i.note&&<p className="text-sm mt-2">{i.note}</p>}{i.follow_up_due_date&&<div className="text-xs mt-2">Follow-up: {i.follow_up_completed_at?'Completed':'Due '+i.follow_up_due_date}</div>}</div>)}{!interactions.length&&<div className="muted py-5">No interactions yet.</div>}</div></section><section className="card p-5"><h2 className="font-black text-lg">Follow-ups</h2><div className="mt-4 space-y-3">{reminders.map(r=><div key={r.id} className="border rounded-xl p-3"><div className="font-bold text-sm">{r.title}</div><div className="muted text-xs mt-1">{r.status} · {r.due_date}</div></div>)}{!reminders.length&&<div className="muted py-5">No reminders.</div>}</div></section></div><div className="grid lg:grid-cols-2 gap-6 mt-6"><section className="card p-5"><h2 className="font-black text-lg">Advisor Notes</h2><div className="mt-4 space-y-3">{notes.map(n=><div key={n.id} className="border rounded-xl p-3"><div className="text-sm">{n.content}</div><div className="muted text-xs mt-2">{n.visibility} · {new Date(n.created_at).toLocaleDateString()}</div></div>)}{!notes.length&&<div className="muted py-5">No notes yet.</div>}<AdvisorNoteForm athleteId={id} onSaved={load}/></div></section><section className="card p-5"><h2 className="font-black text-lg">Socials</h2>{social?<div className="mt-4 rounded-xl bg-slate-50 p-4"><div className="font-bold">{social.username?`@${social.username}`:social.display_name||'X account'}</div><div className="muted text-sm mt-1">{social.status} · Last synced {social.last_synced_at?new Date(social.last_synced_at).toLocaleString():'never'}</div></div>:<div className="muted py-5 mt-2">No X account connected.</div>}</section></div></>}</div></AppShell>;
}
