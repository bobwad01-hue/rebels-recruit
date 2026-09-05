import AppShell from '@/components/AppShell';
import PageHeader from '@/components/PageHeader';
import PushNotificationSettings from '@/components/PushNotificationSettings';
import PasswordSettings from '@/components/PasswordSettings';

export default function Settings() {
  return (
    <AppShell>
      <div className="max-w-4xl mx-auto px-5 md:px-8 py-6">
        <PageHeader title="Settings" subtitle="Account and recruiting preferences." />
        <div className="space-y-6">
          <PasswordSettings />
          <PushNotificationSettings />
          <div className="card p-6">
            <h2 className="font-black">Rebels Recruit</h2>
            <p className="muted mt-2">Your recruiting data stays in your account. Phone alerts use free web push notifications rather than paid text messages.</p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
