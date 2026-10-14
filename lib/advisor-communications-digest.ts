import { createAdminClient } from '@/lib/supabase-admin';
import { sendRLTNLEmail } from '@/lib/transactional-email';

// Called by the existing daily maintenance cron. Hobby has a limited number
// of cron slots, so this deliberately does not create another Vercel schedule.
export async function sendAdvisorCommunicationDigests() {
  const db = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: recipients, error } = await db.from('notification_preferences')
    .select('user_id,advisor_digest_sent_on').eq('advisor_daily_digest', true)
    .or('advisor_digest_sent_on.is.null,advisor_digest_sent_on.neq.' + today)
    .limit(30);
  if (error) throw new Error('Could not load Advisor digest preferences.');

  let sent = 0, skipped = 0, failed = 0;
  for (const pref of recipients || []) {
    try {
      // Re-check current active assignments at delivery time; revoked access
      // must never be included in a later digest.
      const { data: assignments, error: assignmentError } = await db.from('athlete_advisor_assignments')
        .select('athlete_user_id').eq('advisor_user_id', pref.user_id).eq('status', 'active').limit(500);
      if (assignmentError) throw assignmentError;
      const ids = [...new Set((assignments || []).map(a => a.athlete_user_id))];
      if (!ids.length) { skipped++; continue; }
      const [profile, sentCount, replyCount, actionCount] = await Promise.all([
        db.from('profiles').select('email').eq('id', pref.user_id).maybeSingle(),
        db.from('interactions').select('id', { count: 'exact', head: true })
          .in('athlete_user_id', ids).eq('type', 'Email Sent').eq('source', 'automatic').gte('created_at', cutoff),
        db.from('gmail_recruiting_messages').select('id', { count: 'exact', head: true })
          .in('athlete_user_id', ids).gte('received_at', cutoff),
        db.from('gmail_recruiting_messages').select('id', { count: 'exact', head: true })
          .in('athlete_user_id', ids).eq('action_required', true).gte('received_at', cutoff),
      ]);
      if (profile.error || sentCount.error || replyCount.error || actionCount.error) throw new Error('Digest data unavailable.');
      const sentEmails = sentCount.count || 0, replies = replyCount.count || 0, needsAction = actionCount.count || 0;
      if (!profile.data?.email || (!sentEmails && !replies)) { skipped++; continue; }
      const origin = process.env.NEXT_PUBLIC_SITE_URL || 'https://rltnl.com';
      const url = new URL('/advisors/communications', origin).toString();
      const html = '<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:auto;color:#111827">'
        + '<h2>RLTNL Recruiting | Your Advisor recap</h2>'
        + '<p>Here is the recruiting communication activity recorded for athletes currently assigned to you in the last 24 hours.</p>'
        + '<ul><li><b>' + sentEmails + '</b> player emails sent through RLTNL</li>'
        + '<li><b>' + replies + '</b> tracked coach emails received</li>'
        + '<li><b>' + needsAction + '</b> coach responses flagged for follow-through</li></ul>'
        + '<p>Review the conversations and help your athletes close the loop.</p>'
        + '<p><a href="' + url + '">Open Advisor Communications</a></p>'
        + '<p style="font-size:12px;color:#64748b">This summary does not include private message bodies. Manage digest preferences in Advisor Communications.</p></div>';
      await sendRLTNLEmail({ to: profile.data.email, subject: 'Your RLTNL Recruiting Advisor recap', html });
      const updated = await db.from('notification_preferences').update({ advisor_digest_sent_on: today })
        .eq('user_id', pref.user_id).eq('advisor_daily_digest', true);
      if (updated.error) throw new Error('Digest sent but delivery state could not be saved.');
      sent++;
    } catch (e) {
      failed++;
      console.error('[advisor-digest] Delivery failed', { userId: pref.user_id, message: e instanceof Error ? e.message : 'Unknown error' });
    }
  }
  return { eligible: (recipients || []).length, sent, skipped, failed };
}
