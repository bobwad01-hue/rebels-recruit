'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';

// An activity signal is not a recruiting action or a session-duration estimate.
// We record at most once per five minutes, only while the tab is visible and
// the person has interacted recently. The database verifies auth.uid() itself.
const MIN_INTERVAL = 5 * 60 * 1000;
const RECENT_INTERACTION = 10 * 60 * 1000;
const publicPaths = new Set([
  '/', '/login', '/signup', '/privacy', '/terms', '/forgot-password',
  '/reset-password', '/invitation-required', '/account-suspended', '/legal/accept',
]);

export default function PlatformActivityTracker() {
  const pathname = usePathname();
  const lastSent = useRef(0);

  useEffect(() => {
    if (!pathname || publicPaths.has(pathname) ||
        pathname.startsWith('/auth/') || pathname.startsWith('/join/')) return;

    let lastInteraction = Date.now();
    let sending = false;
    const markInteraction = () => { lastInteraction = Date.now(); };
    const ping = async () => {
      const now = Date.now();
      if (document.visibilityState !== 'visible' ||
          now - lastInteraction > RECENT_INTERACTION ||
          now - lastSent.current < MIN_INTERVAL || sending) return;
      sending = true;
      lastSent.current = now;
      try {
        const { error } = await createClient().rpc('record_platform_activity');
        if (error) lastSent.current = 0;
      } catch {
        lastSent.current = 0;
      } finally {
        sending = false;
      }
    };

    void ping();
    const onVisible = () => { if (document.visibilityState === 'visible') { markInteraction(); void ping(); } };
    const interval = window.setInterval(() => { void ping(); }, 60 * 1000);
    window.addEventListener('pointerdown', markInteraction, { passive: true });
    window.addEventListener('keydown', markInteraction);
    window.addEventListener('scroll', markInteraction, { passive: true });
    window.addEventListener('touchstart', markInteraction, { passive: true });
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('pointerdown', markInteraction);
      window.removeEventListener('keydown', markInteraction);
      window.removeEventListener('scroll', markInteraction);
      window.removeEventListener('touchstart', markInteraction);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [pathname]);

  return null;
}
