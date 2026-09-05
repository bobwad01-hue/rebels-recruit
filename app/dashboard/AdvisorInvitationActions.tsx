'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AdvisorInvitationActions({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<'active' | 'declined' | null>(null);
  const [error, setError] = useState('');

  async function respond(status: 'active' | 'declined') {
    setBusy(status);
    setError('');

    const client = supabase();
    const { data: { user } } = await client.auth.getUser();

    if (!user) {
      setError('Your session has expired. Please sign in again.');
      setBusy(null);
      return;
    }

    const { error: updateError } = await client
      .from('athlete_advisor_assignments')
      .update({ status, responded_at: new Date().toISOString() })
      .eq('id', id)
      .eq('athlete_user_id', user.id)
      .eq('status', 'pending');

    if (updateError) {
      setError(updateError.message || 'Unable to update this invitation.');
      setBusy(null);
      return;
    }

    router.refresh();
    setBusy(null);
  }

  return (
    <div className="flex gap-2">
      <button type="button" className="btn" onClick={() => respond('declined')} disabled={busy !== null}>
        {busy === 'declined' ? 'Declining...' : 'Decline'}
      </button>
      <button type="button" className="btn btn-red" onClick={() => respond('active')} disabled={busy !== null}>
        {busy === 'active' ? 'Accepting...' : 'Accept'}
      </button>
      {error && <div className="text-xs text-red-600 self-center max-w-xs">{error}</div>}
    </div>
  );
}
