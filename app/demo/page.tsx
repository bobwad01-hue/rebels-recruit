import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Handshake, LayoutDashboard, ShieldCheck, Users } from 'lucide-react';
import DemoRequestForm from '@/components/DemoRequestForm';

export const metadata: Metadata = {
  title: 'Request a Demo | RLTNL Recruiting',
  description: 'See how RLTNL Recruiting can help your travel softball organization or high school team manage recruiting relationships, advisor coverage and follow-through.',
};

export default function DemoPage() {
  return <div className="min-h-screen bg-slate-50 text-slate-950">
    <a href="#demo-content" className="rr-skip-link">Skip to content</a>
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <Link href="/" aria-label="RLTNL Recruiting homepage">
          <img src="/RLTNL%20Recruiting%20Horizontal.png" alt="RLTNL Recruiting" className="h-auto w-[175px] sm:w-[205px]"/>
        </Link>
        <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-red-700 sm:text-sm"><ArrowLeft size={15}/> Back to home</Link>
      </div>
    </header>
    <main id="demo-content" className="mx-auto grid max-w-7xl items-start gap-10 px-5 py-12 sm:px-8 sm:py-20 lg:grid-cols-[.95fr_1.05fr] lg:gap-16">
      <div className="lg:sticky lg:top-12">
        <p className="text-[11px] font-black uppercase tracking-[.2em] text-red-700">RLTNL Recruiting · For organizations</p>
        <h1 className="mt-4 max-w-lg text-[clamp(2.5rem,4.5vw,4.25rem)] font-black leading-[1.06] tracking-[-.05em]">Give your athletes a better recruiting system.</h1>
        <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">See how RLTNL connects athletes, families, advisors and organization leaders around the work that moves recruiting forward.</p>
        <div className="mt-8 space-y-5">
          {[
            { icon: Handshake, title: 'Keep coach relationships connected', body: 'From first contact to follow-through, without losing the history.' },
            { icon: LayoutDashboard, title: 'See recruiting progress across teams', body: 'Give organization leaders visibility into athlete progress and advisor coverage.' },
            { icon: Users, title: 'Bring everyone into the right workflow', body: 'Athletes, parents and advisors work together with role-based access.' },
            { icon: ShieldCheck, title: 'Athlete-approved advisor access', body: 'Private recruiting communications stay within approved assignments.' },
          ].map(({icon:Icon,title,body})=><div key={title} className="flex gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-700"><Icon size={19}/></span><div><p className="font-black">{title}</p><p className="mt-1 text-sm leading-6 text-slate-600">{body}</p></div></div>)}
        </div>
        <p className="mt-8 flex items-center gap-2 text-sm font-bold text-slate-600"><CheckCircle2 size={17} className="text-red-700"/> Recruiting happens in the follow-through.</p>
      </div>
      <DemoRequestForm/>
    </main>
    <footer className="border-t border-slate-200 bg-white px-5 py-6 text-center text-xs text-slate-500">
      <Link href="/privacy" className="hover:underline">Privacy Policy</Link><span className="mx-3">·</span><Link href="/terms" className="hover:underline">Terms of Service</Link>
    </footer>
  </div>;
}
