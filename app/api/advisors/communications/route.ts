import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import type { AdvisorMessage } from '@/lib/advisor-communication-threads';

export const dynamic = 'force-dynamic';
const DEFAULTS = {
  advisor_coach_reply_alerts: true,
  advisor_email_sent_alerts: false,
  advisor_daily_digest: false,
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function viewer() {
  const db = await createClient();
  const { data: { user }, error } = await db.auth.getUser();
  return { db, user: error ? null : user };
}

// Advisor Communications deliberately uses active *athlete-approved assignments*,
// not organization membership or the broader can_access_athlete() permission.
// An Admin view or platform owner preview must not expose private email bodies.
export async function GET() {
  const { db, user } = await viewer();
  if (!user) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });
  const { data: assignments, error: assignmentError } = await db
    .from('athlete_advisor_assignments')
    .select('athlete_user_id')
    .eq('advisor_user_id', user.id).eq('status', 'active').limit(500);
  if (assignmentError) return NextResponse.json({ error: 'Advisor access could not be verified.' }, { status: 500 });
  const ids = [...new Set((assignments || []).map(a => String(a.athlete_user_id)).filter(id => UUID.test(id)))];
  const { data: pref, error: prefError } = await db.from('notification_preferences')
    .select('advisor_coach_reply_alerts,advisor_email_sent_alerts,advisor_daily_digest')
    .eq('user_id', user.id).maybeSingle();
  if (prefError) return NextResponse.json({ error: 'Notification preferences could not be loaded.' }, { status: 500 });
  const preferences = { ...DEFAULTS, ...(pref || {}) };
  if (!ids.length) return NextResponse.json({ players: [], messages: [], preferences, truncated: false });

  const [pr, ir, gr] = await Promise.all([
    db.from('profiles').select('id,full_name').in('id', ids),
    db.from('interactions')
      .select('id,athlete_user_id,actor_user_id,coach_id,college_id,type,date,created_at,source,email_subject,email_content,note,initiated_by,gmail_thread_id,gmail_message_id,gmail_sender_email')
      .in('athlete_user_id', ids).in('type', ['Email Sent', 'Email Received'])
      .order('created_at', { ascending: false }).limit(350),
    db.from('gmail_recruiting_messages')
      .select('id,interaction_id,athlete_user_id,coach_id,college_id,received_at,subject,summary,action_required,next_action,action_state,action_decision,reviewed_at,recruiting_intent,gmail_thread_id,gmail_message_id')
      .in('athlete_user_id', ids).order('received_at', { ascending: false }).limit(350),
  ]);
  if (pr.error || ir.error || gr.error) {
    return NextResponse.json({ error: 'Recruiting communications could not be loaded. Please try again.' }, { status: 500 });
  }

  const coachIds = [...new Set([...(ir.data || []), ...(gr.data || [])].map(x => x.coach_id).filter(Boolean))];
  const collegeIds = [...new Set([...(ir.data || []), ...(gr.data || [])].map(x => x.college_id).filter(Boolean))];
  const [coachesResult, collegesResult] = await Promise.all([
    coachIds.length ? db.from('college_coaches').select('id,first_name,last_name').in('id', coachIds) : Promise.resolve({ data: [], error: null }),
    collegeIds.length ? db.from('colleges').select('id,name').in('id', collegeIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (coachesResult.error || collegesResult.error) return NextResponse.json({ error: 'Coach and school details could not be loaded.' }, { status: 500 });

  const names = new Map((pr.data || []).map(p => [p.id, p.full_name || 'Athlete']));
  const coachNames = new Map((coachesResult.data || []).map(c => [c.id, [c.first_name, c.last_name].filter(Boolean).join(' ') || 'College coach']));
  const schoolNames = new Map((collegesResult.data || []).map(c => [c.id, c.name || 'College program']));
  const gmailByInteraction = new Map((gr.data || []).filter(g => g.interaction_id).map(g => [g.interaction_id, g]));
  const linked = new Set<string>();

  const messages: AdvisorMessage[] = (ir.data || []).map(i => {
    const g = gmailByInteraction.get(i.id);
    if (g) linked.add(g.id);
    const incoming = i.type === 'Email Received';
    const body = (i.email_content || '').slice(0, 20000);
    return {
      id: i.id, athleteId: i.athlete_user_id, athleteName: names.get(i.athlete_user_id) || 'Athlete',
      coachId: i.coach_id || g?.coach_id || null, collegeId: i.college_id || g?.college_id || null,
      coachName: coachNames.get(i.coach_id || g?.coach_id || '') || 'College coach', schoolName: schoolNames.get(i.college_id || g?.college_id || '') || 'College program',
      direction: incoming ? 'received' : 'sent', sentByAdvisor: !incoming && (i.initiated_by === 'Advisor' || (!!i.actor_user_id && i.actor_user_id !== i.athlete_user_id)),
      subject: i.email_subject || g?.subject || (incoming ? 'Coach email' : 'Recruiting email'),
      body: body || null, summary: g?.summary || i.note || null,
      timestamp: g?.received_at || i.created_at || i.date,
      tracked: i.source === 'automatic',
      actionRequired: incoming && !!g?.action_required, actionState: g?.action_state || null,
      actionDecision: g?.action_decision || null, nextAction: g?.next_action || null,
      reviewed: !!g?.reviewed_at,
      gmailThreadId: g?.gmail_thread_id || i.gmail_thread_id || null,
      gmailMessageId: g?.gmail_message_id || i.gmail_message_id || null,
      senderEmail: incoming ? i.gmail_sender_email || null : null,
      source: incoming ? (g || i.gmail_message_id ? 'gmail' : 'manual') : (i.source === 'automatic' ? 'rltnl' : 'manual'),
    };
  });

  // Gmail records can be linked to an older manually logged interaction. If the
  // interaction fell outside the activity limit, show a summary-only entry.
  const linkedGmailIds = new Set((ir.data || []).map(i => i.gmail_message_id).filter(Boolean));
  for (const g of gr.data || []) {
    if (linked.has(g.id) || (g.gmail_message_id && linkedGmailIds.has(g.gmail_message_id))) continue;
    messages.push({
      id: g.id, athleteId: g.athlete_user_id, athleteName: names.get(g.athlete_user_id) || 'Athlete',
      coachId: g.coach_id || null, collegeId: g.college_id || null,
      coachName: coachNames.get(g.coach_id) || 'College coach', schoolName: schoolNames.get(g.college_id) || 'College program',
      direction: 'received', sentByAdvisor: false, subject: g.subject || 'Coach email',
      body: null, summary: g.summary || null, timestamp: g.received_at,
      tracked: true, actionRequired: !!g.action_required,
      actionState: g.action_state || null, actionDecision: g.action_decision || null,
      nextAction: g.next_action || null, reviewed: !!g.reviewed_at, source: 'gmail',
      gmailThreadId: g.gmail_thread_id || null, gmailMessageId: g.gmail_message_id || null,
      senderEmail: null,
    });
  }
  messages.sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
  return NextResponse.json({
    players: ids.map(id => ({ id, name: names.get(id) || 'Athlete' })).sort((a, b) => a.name.localeCompare(b.name)),
    messages: messages.slice(0, 500), preferences,
    truncated: (ir.data || []).length === 350 || (gr.data || []).length === 350 || messages.length > 500,
  }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function PATCH(request: NextRequest) {
  const { db, user } = await viewer();
  if (!user) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });
  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return NextResponse.json({ error: 'Invalid notification preferences.' }, { status: 400 });
  }
  const allowed = Object.keys(DEFAULTS);
  const keys = Object.keys(payload);
  if (!keys.length || keys.some(key => !allowed.includes(key)) || keys.some(key => typeof payload[key] !== 'boolean')) {
    return NextResponse.json({ error: 'Invalid notification preferences.' }, { status: 400 });
  }
  const { data, error } = await db.from('notification_preferences')
    .upsert({ user_id: user.id, ...payload, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    .select('advisor_coach_reply_alerts,advisor_email_sent_alerts,advisor_daily_digest').single();
  if (error) return NextResponse.json({ error: 'Could not save your preferences.' }, { status: 500 });
  return NextResponse.json({ preferences: { ...DEFAULTS, ...data } });
}
