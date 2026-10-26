import AppShell from '@/components/AppShell';
import RecruitingQuickComposer from '@/components/RecruitingQuickComposer';

export default function ComposeEmailPage(){
 return <AppShell><div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
  <RecruitingQuickComposer/>
 </div></AppShell>;
}
