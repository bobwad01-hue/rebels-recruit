'use client';

import { useEffect } from 'react';

type MetricName = 'LCP' | 'INP' | 'CLS';

const budgets: Record<MetricName, number> = {
  LCP: 2500,
  INP: 200,
  CLS: 0.1,
};

export default function WebVitalsMonitor() {
  useEffect(() => {
    let route = location.pathname;
    let cls = 0;
    let lcp = 0;
    let inp = 0;
    let sent = false;
    const observers: PerformanceObserver[] = [];

    const reset = () => {
      route = location.pathname;
      cls = 0;
      lcp = 0;
      inp = 0;
      sent = false;
    };

    const send = (metric: MetricName, value: number) => {
      if (!Number.isFinite(value) || value < 0) return;
      const budget = budgets[metric];
      const payload = {
        type: 'web-vital',
        metric,
        value,
        budget,
        overBudget: value > budget,
        route,
        ts: new Date().toISOString(),
      };

      try {
        if (
          navigator.sendBeacon(
            '/api/telemetry/vitals',
            new Blob([JSON.stringify(payload)], { type: 'application/json' }),
          )
        ) {
          return;
        }
      } catch {}

      fetch('/api/telemetry/vitals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => {});
    };

    const flush = () => {
      if (sent) return;
      sent = true;
      if (lcp > 0) send('LCP', lcp);
      send('CLS', cls);
      if (inp > 0) send('INP', inp);
    };

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    const onPageHide = () => flush();
    const onRoute = () => {
      if (location.pathname === route) return;
      flush();
      reset();
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('popstate', onRoute);

    const originalPush = history.pushState;
    const originalReplace = history.replaceState;

    history.pushState = function pushState(
      data: any,
      unused: string,
      url?: string | URL | null,
    ) {
      originalPush.call(history, data, unused, url);
      queueMicrotask(onRoute);
    };

    history.replaceState = function replaceState(
      data: any,
      unused: string,
      url?: string | URL | null,
    ) {
      originalReplace.call(history, data, unused, url);
      queueMicrotask(onRoute);
    };

    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as any[]) {
          if (!entry.hadRecentInput) cls += Number(entry.value) || 0;
        }
      });
      observer.observe({ type: 'layout-shift', buffered: true } as any);
      observers.push(observer);
    } catch {}

    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const entry = entries[entries.length - 1] as any;
        if (entry) lcp = Math.max(lcp, Number(entry.startTime) || 0);
      });
      observer.observe({ type: 'largest-contentful-paint', buffered: true } as any);
      observers.push(observer);
    } catch {}

    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as any[]) {
          inp = Math.max(inp, Number(entry.duration) || 0);
        }
      });
      observer.observe({ type: 'event', buffered: true, durationThreshold: 40 } as any);
      observers.push(observer);
    } catch {}

    return () => {
      flush();
      observers.forEach((observer) => observer.disconnect());
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('popstate', onRoute);
      history.pushState = originalPush;
      history.replaceState = originalReplace;
    };
  }, []);

  return null;
}
