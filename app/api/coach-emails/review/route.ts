import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const emailId = typeof body?.emailId === 'string' ? body.emailId : '';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(emailId)) {
    return NextResponse.json({ error: 'Invalid email identifier.' }, { status: 400 });
  }

  // Gmail intelligence is read-only to clients. Review updates must go through
  // this authenticated, ownership-scoped server operation; do not broaden RLS.
  try {
    const admin = createAdminClient();
    const { data: email, error } = await admin
      .from('gmail_recruiting_messages')
      .update({ reviewed_at: new Date().toISOString() })
      .eq('id', emailId)
      .eq('athlete_user_id', user.id)
      .select('id')
      .maybeSingle();

    if (error) {
      console.error('[coach-emails/review] Review update failed:', {
        code: error.code,
        message: error.message,
      });
      return NextResponse.json(
        { error: 'Could not save review status. Please try again.' },
        { status: 500 }
      );
    }
    if (!email) {
      return NextResponse.json({ error: 'Coach email not found.' }, { status: 404 });
    }

    // The gmail_recruiting_alert_reviewed database trigger marks the matching
    // notification read whenever a message transitions to reviewed.
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[coach-emails/review] Unexpected failure:', error);
    return NextResponse.json(
      { error: 'Could not save review status. Please try again.' },
      { status: 500 }
    );
  }
}
