import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { sendRLTNLEmail } from '@/lib/transactional-email';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const fail = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });

const clean = (value: unknown) => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] || character);

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (origin) {
    try {
      if (new URL(origin).host !== new URL(request.url).host) return fail('Invalid request origin.', 403);
    } catch { return fail('Invalid request origin.', 403); }
  }
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') {
    return fail('Please submit the demo request form.');
  }
  const length = Number(request.headers.get('content-length') || '0');
  if (length > 12000) return fail('Request is too long.', 413);

  let body: Record<string, unknown>;
  try {
    const text = await request.text();
    if (text.length > 12000) return fail('Request is too long.', 413);
    body = JSON.parse(text);
    if (!body || typeof body !== 'object' || Array.isArray(body)) return fail('Invalid request.');
  } catch { return fail('Invalid request.'); }

  // Hidden field; respond normally without sending mail or writing spam.
  if (clean(body.website)) return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });

  const fullName = clean(body.fullName);
  const email = clean(body.email).toLowerCase();
  const organizationName = clean(body.organizationName);
  const organizationType = clean(body.organizationType);
  const roleTitle = clean(body.roleTitle);
  const teamCount = clean(body.teamCount);
  const message = typeof body.message === 'string' ? body.message.trim() : '';

  if (fullName.length < 2 || fullName.length > 100 ||
      email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      organizationName.length < 2 || organizationName.length > 150 ||
      !['travel_club', 'high_school', 'other'].includes(organizationType) ||
      roleTitle.length > 100 || (teamCount && !['1', '2-5', '6-10', '11+'].includes(teamCount)) ||
      message.length > 2000 || body.privacyAccepted !== true) {
    return fail('Please complete the required fields and accept the privacy notice.');
  }

  try {
    const admin = createAdminClient();
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count, error: limitError } = await admin.from('organization_demo_requests')
      .select('id', { count: 'exact', head: true }).eq('email', email).gte('created_at', since);
    if (limitError) throw limitError;
    if ((count || 0) >= 3) {
      return fail('We have already received your request. Please email us if you need to add anything.', 429);
    }

    const { data, error } = await admin.from('organization_demo_requests').insert({
      full_name: fullName, email, organization_name: organizationName,
      organization_type: organizationType, role_title: roleTitle || null,
      team_count: teamCount || null, message: message || null,
    }).select('id').single();
    if (error || !data) throw error || new Error('Could not save inquiry');

    // Durable DB storage is the source of truth. An email delivery failure must
    // never make a successfully saved request look like it was lost.
    try {
      const typeLabel = organizationType === 'travel_club' ? 'Travel / club' :
        organizationType === 'high_school' ? 'High school' : 'Other';
      const fields: [string, string][] = [
        ['Name', fullName], ['Email', email], ['Organization', organizationName],
        ['Organization type', typeLabel], ['Role', roleTitle || 'Not specified'],
        ['Number of teams', teamCount || 'Not specified'], ['Message', message || 'None'],
      ];
      const html = '<h2>New RLTNL Recruiting demo request</h2><table cellpadding="8" cellspacing="0">' +
        fields.map(([label, value]) => '<tr><td><strong>' + escapeHtml(label) +
          '</strong></td><td style="white-space:pre-wrap">' + escapeHtml(value) +
          '</td></tr>').join('') + '</table><p>Review all inquiries in the private RLTNL platform admin.</p>';
      await sendRLTNLEmail({
        to: process.env.RLTNL_DEMO_REQUEST_TO || 'bobwad01@gmail.com',
        subject: 'RLTNL demo request: ' + organizationName.slice(0, 80),
        html,
      });
      await admin.from('organization_demo_requests')
        .update({ notification_sent_at: new Date().toISOString() }).eq('id', data.id);
    } catch (notificationError) {
      console.error('Demo request saved, notification unavailable:', notificationError);
    }

    return NextResponse.json({ ok: true }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Demo request storage unavailable:', error);
    return fail('We could not save your request right now. Please email us directly.', 503);
  }
}
