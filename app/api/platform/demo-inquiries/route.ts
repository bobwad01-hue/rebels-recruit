import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
const noStore = { 'Cache-Control': 'private, no-store' };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function ownerAuthorized() {
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return false;
  const { data: owner } = await client.from('platform_roles').select('role')
    .eq('user_id', user.id).eq('role', 'super_owner').maybeSingle();
  return !!owner;
}
export async function GET() {
  if (!await ownerAuthorized()) return NextResponse.json({ error: 'Super Owner access required.' }, { status: 403, headers: noStore });
  const admin = createAdminClient();
  const { data, error } = await admin.from('organization_demo_requests')
    .select('id,full_name,email,organization_name,organization_type,role_title,team_count,message,status,created_at,notification_sent_at')
    .order('created_at', { ascending: false }).limit(200);
  if (error) return NextResponse.json({ error: 'Could not load demo inquiries.' }, { status: 500, headers: noStore });
  return NextResponse.json({ inquiries: data || [] }, { headers: noStore });
}
export async function PATCH(request: NextRequest) {
  if (!await ownerAuthorized()) return NextResponse.json({ error: 'Super Owner access required.' }, { status: 403, headers: noStore });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400, headers: noStore }); }
  const id = String(body.id || '');
  const status = String(body.status || '');
  if (!uuid.test(id) || !['new','contacted','closed'].includes(status)) {
    return NextResponse.json({ error: 'Invalid inquiry or status.' }, { status: 400, headers: noStore });
  }
  const admin = createAdminClient();
  const { data, error } = await admin.from('organization_demo_requests')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id).select('id,status').maybeSingle();
  if (error || !data) return NextResponse.json({ error: 'Could not update this inquiry.' }, { status: 500, headers: noStore });
  return NextResponse.json({ ok: true, inquiry: data }, { headers: noStore });
}
