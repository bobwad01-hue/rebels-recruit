'use client';

import { Bell, BellOff, CheckCircle2, Smartphone } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase-browser';

const VAPID_PUBLIC_KEY = 'BMBT6hH2_JTlpzZwVR3P2WWHov3-htCifqaJXDKBb77SiQvTClLPzGhvqw9G6rio-aYhiXfhapWhIEOm5BO9dgI';

type Preferences = {
  messages: boolean;
  tasks: boolean;
  reminders: boolean;
  advisor_activity: boolean;
};

function urlBase64ToUint8Array(value: string) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map(char => char.charCodeAt(0)));
}

function isIos() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
}

export default function PushNotificationSettings() {
  const supabase = createClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [prefs, setPrefs] = useState<Preferences>({ messages: true, tasks: true, reminders: true, advisor_activity: true });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [needsHomeScreen, setNeedsHomeScreen] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setUserId(user.id);

    const { data: preference } = await supabase.from('notification_preferences').select('messages,tasks,reminders,advisor_activity').eq('user_id', user.id).maybeSingle();
    if (preference) setPrefs(preference);

    if ('serviceWorker' in navigator && 'PushManager' in window) {
      const registration = await navigator.serviceWorker.getRegistration('/');
      const subscription = registration ? await registration.pushManager.getSubscription() : null;
      setEnabled(Boolean(subscription));
    }
    setNeedsHomeScreen(isIos() && !isStandalone());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function savePreference(key: keyof Preferences, value: boolean) {
    if (!userId) return;
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    const { error: updateError } = await supabase.from('notification_preferences').upsert({ user_id: userId, ...next, updated_at: new Date().toISOString() });
    if (updateError) setError(updateError.message);
  }

  async function enableNotifications() {
    if (!userId) return;
    setBusy(true); setError(''); setMessage('');
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        throw new Error('This browser does not support web push notifications.');
      }
      if (isIos() && !isStandalone()) {
        setNeedsHomeScreen(true);
        throw new Error('On iPhone or iPad, first add Rebels Recruit to your Home Screen and open it there.');
      }
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') throw new Error('Notification permission was not granted.');

      const registration = await navigator.serviceWorker.register('/sw.js');
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) });
      }
      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) throw new Error('Your browser did not return a complete push subscription.');

      const { error: saveError } = await supabase.from('push_subscriptions').upsert({
        user_id: userId,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        user_agent: navigator.userAgent,
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'endpoint' });
      if (saveError) throw saveError;

      await supabase.from('notification_preferences').upsert({ user_id: userId, ...prefs, updated_at: new Date().toISOString() });
      setEnabled(true);
      setMessage('Phone notifications are enabled on this device.');
    } catch (e: any) {
      setError(e?.message || 'Unable to enable phone notifications.');
    } finally {
      setBusy(false);
    }
  }

  async function disableNotifications() {
    if (!userId) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const registration = await navigator.serviceWorker.getRegistration('/');
      const subscription = registration ? await registration.pushManager.getSubscription() : null;
      const endpoint = subscription?.endpoint;
      if (subscription) await subscription.unsubscribe();
      if (endpoint) await supabase.from('push_subscriptions').delete().eq('user_id', userId).eq('endpoint', endpoint);
      setEnabled(false);
      setMessage('Phone notifications are disabled on this device.');
    } catch (e: any) {
      setError(e?.message || 'Unable to disable phone notifications.');
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    if (!userId || !enabled) return;
    setBusy(true); setError(''); setMessage('');
    const { error: testError } = await supabase.from('notifications').insert({
      user_id: userId,
      title: 'Rebels Recruit test alert',
      body: 'Phone notifications are working.',
      kind: 'general',
      url: '/settings',
      data: { test: true },
    });
    if (testError) setError(testError.message); else setMessage('Test alert queued. It should arrive shortly.');
    setBusy(false);
  }

  if (loading) return <div className="card p-6"><div className="muted">Loading notification settings...</div></div>;

  return <section id="notifications" className="card p-6">
    <div className="flex items-start gap-4">
      <div className="h-11 w-11 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0"><Bell size={21}/></div>
      <div className="flex-1">
        <h2 className="font-black text-lg">Phone Alerts</h2>
        <p className="muted text-sm mt-1">Get free push notifications for recruiting messages, tasks, reminders and advisor activity.</p>
      </div>
      {enabled ? <div className="text-green-700 text-sm font-bold flex items-center gap-1"><CheckCircle2 size={16}/> Enabled</div> : null}
    </div>

    {needsHomeScreen && <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
      <div className="font-bold flex items-center gap-2"><Smartphone size={17}/> iPhone/iPad setup</div>
      <p className="mt-2">In Safari, tap Share, choose Add to Home Screen, open the new Rebels Recruit icon, then return here and tap Enable phone alerts.</p>
    </div>}

    <div className="mt-5 flex flex-wrap gap-2">
      {!enabled ? <button className="btn btn-red" onClick={enableNotifications} disabled={busy}><Bell size={17}/>{busy ? 'Enabling...' : 'Enable phone alerts'}</button> : <><button className="btn" onClick={sendTest} disabled={busy}>Send test alert</button><button className="btn" onClick={disableNotifications} disabled={busy}><BellOff size={17}/>Disable on this device</button></>}
    </div>

    <div className="mt-6 border-t pt-5">
      <div className="font-bold">What should alert me?</div>
      <div className="mt-3 grid sm:grid-cols-2 gap-3">
        {([['messages','Messages','New direct or group messages'],['tasks','Tasks','New or due recruiting tasks'],['reminders','Reminders','Due and overdue recruiting reminders'],['advisor_activity','Advisor activity','Advisor invitations and relationship updates']] as const).map(([key,label,description]) => <label key={key} className="border rounded-xl p-4 flex items-start gap-3 cursor-pointer"><input className="mt-1" type="checkbox" checked={prefs[key]} onChange={e=>savePreference(key,e.target.checked)}/><span><span className="font-bold block">{label}</span><span className="muted text-xs">{description}</span></span></label>)}
      </div>
    </div>

    {message && <p className="text-sm text-green-700 mt-4">{message}</p>}
    {error && <p className="text-sm text-red-600 mt-4">{error}</p>}
  </section>;
}
