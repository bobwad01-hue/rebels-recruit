import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
const noStore = { 'Cache-Control': 'private, no-store' };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const statuses = ['new','contacted','demo_scheduled','won','lost','closed'];

async function ownerAuthorized() {
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return null;
  const { data: owner } = await client.from('platform_roles').select('role')
    .eq('user_id', user.id).eq('role', 'super_owner').maybeSingle();
  return owner ? user : null;
}
const denied = () => NextResponse.json({ error: 'Super Owner access required.' }, { status: 403, headers: noStore });

export async function GET() {
  if (!await ownerAuthorized()) return denied();
  const admin = createAdminClient();
  const { data, error } = await admin.from('organization_demo_requests')
    .select('id,full_name,email,phone,preferred_contact,organization_name,organization_type,role_title,team_count,message,status,internal_notes,follow_up_at,alert_acknowledged_at,alert_dismissed_at,created_at,updated_at,notification_sent_at')
    .order('created_at', { ascending: false }).limit(200);
  if (error) return NextResponse.json({ error: 'Could not load demo inquiries.' }, { status: 500, headers: noStore });
  const ids = (data || []).map(row => row.id);
  const events = ids.length
    ? await admin.from('organization_demo_request_events').select('id,inquiry_id,event_type,summary,created_at')
      .in('inquiry_id', ids).order('created_at', { ascending: false }).limit(1500)
    : { data: [], error: null };
  if (events.error) return NextResponse.json({ error: 'Could not load inquiry history.' }, { status: 500, headers: noStore });
  const history = new Map<string, typeof events.data>();
  for (const event of events.data || []) {
    const list = history.get(event.inquiry_id) || [];
    list.push(event);
    history.set(event.inquiry_id, list);
  }
  return NextResponse.json({ inquiries: (data || []).map(row => ({ ...row, history: history.get(row.id) || [] })) }, { headers: noStore });
}

export async function PATCH(request: NextRequest) {
  const owner = await ownerAuthorized();
  if (!owner) return denied();
  let body: Record<string, unknown>;
  try {
    body = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid payload');
  } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400, headers: noStore }); }
  const id = typeof body.id === 'string' ? body.id : '';
  if (!uuid.test(id)) return NextResponse.json({ error: 'Invalid inquiry.' }, { status: 400, headers: noStore });
  const admin = createAdminClient();
  const { data: previous, error: readError } = await admin.from('organization_demo_requests')
    .select('id,status,internal_notes,follow_up_at,alert_acknowledged_at,alert_dismissed_at').eq('id', id).maybeSingle();
  if (readError || !previous) return NextResponse.json({ error: 'Inquiry not found.' }, { status: 404, headers: noStore });

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { updated_at: now, last_reviewed_by: owner.id };
  const events: { event_type: string; summary: string }[] = [];
  const action = typeof body.action === 'string' ? body.action : '';
  if (action && !['acknowledge','dismiss'].includes(action))
    return NextResponse.json({ error: 'Invalid action.' }, { status: 400, headers: noStore });
  if (action === 'acknowledge') {
    patch.alert_acknowledged_at = now;
    events.push({ event_type: 'acknowledged', summary: 'Platform alert acknowledged' });
  }
  if (action === 'dismiss') {
    patch.alert_dismissed_at = now;
    patch.alert_acknowledged_at = now;
    events.push({ event_type: 'dismissed', summary: 'Platform alert dismissed; inquiry retained in inbox' });
  }
  if (body.status !== undefined) {
    if (typeof body.status !== 'string' || !statuses.includes(body.status))
      return NextResponse.json({ error: 'Invalid inquiry status.' }, { status: 400, headers: noStore });
    if (body.status !== previous.status) {
      patch.status = body.status;
      patch.alert_acknowledged_at = now;
      if (['new','contacted','demo_scheduled'].includes(body.status)) patch.alert_dismissed_at = null;
      events.push({ event_type: 'status', summary: 'Status: ' + previous.status.replaceAll('_',' ') + ' → ' + body.status.replaceAll('_',' ') });
    }
  }
  if (body.internalNotes !== undefined) {
    if (typeof body.internalNotes !== 'string' || body.internalNotes.length > 6000)
      return NextResponse.json({ error: 'Internal notes must be 6000 characters or fewer.' }, { status: 400, headers: noStore });
    const notes = body.internalNotes.trim() || null;
    if (notes !== previous.internal_notes) {
      patch.internal_notes = notes;
      events.push({ event_type: 'notes', summary: notes ? 'Internal notes updated' : 'Internal notes cleared' });
    }
  }
  if (body.followUpAt !== undefined) {
    const value = body.followUpAt;
    if (value !== null && (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value)) || new Date(value).toISOString().slice(0,10) !== value))
      return NextResponse.json({ error: 'Enter a valid follow-up date.' }, { status: 400, headers: noStore });
    if (value !== previous.follow_up_at) {
      patch.follow_up_at = value;
      patch.alert_acknowledged_at = null;
      patch.alert_dismissed_at = null;
      events.push({ event_type: 'follow_up', summary: value ? 'Follow-up scheduled for ' + value : 'Follow-up date cleared' });
    }
  }
  if (!events.length) return NextResponse.json({ ok: true, inquiry: previous }, { headers: noStore });
  const { data, error } = await admin.from('organization_demo_requests').update(patch)
    .eq('id', id).select('id,status,internal_notes,follow_up_at,alert_acknowledged_at,alert_dismissed_at,updated_at').maybeSingle();
  if (error || !data) return NextResponse.json({ error: 'Could not update this inquiry.' }, { status: 500, headers: noStore });
  const { error: auditError } = await admin.from('organization_demo_request_events').insert(events.map(event => ({
    inquiry_id: id, actor_user_id: owner.id, ...event
  })));
  if (auditError) console.error('Demo inquiry audit event unavailable:', auditError);
  return NextResponse.json({ ok: true, inquiry: data }, { headers: noStore });
}
