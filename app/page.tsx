import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight, ArrowUpRight, CalendarDays, Check, CheckCircle2,
  Compass, FileSpreadsheet, Handshake, Mail, ShieldCheck, Sparkles,
  Target, Upload, Users, Building2, ListChecks, TrendingUp,
  UserRoundCheck, Menu, LayoutDashboard, ClipboardCheck, School,
} from 'lucide-react';
import PublicProductTour from '@/components/PublicProductTour';

export const metadata: Metadata = {
  title: 'RLTNL Recruiting | Recruiting Happens in the Follow-Through',
  description: 'Recruiting happens in the follow-through. RLTNL Recruiting helps travel softball organizations, high school teams, athletes, families and advisors manage coach relationships, recruiting progress and next steps.',
};

const steps = [
  { number: '01', title: 'Find your fit', description: 'Build a school list around what matters to the athlete, not just a ranking.', icon: Compass },
  { number: '02', title: 'Build relationships', description: 'Keep coaches, schools, outreach and relationship history connected.', icon: Handshake },
  { number: '03', title: 'Show up prepared', description: 'Plan camps and visits, record what happened and capture the next move.', icon: CalendarDays },
  { number: '04', title: 'Follow through', description: 'See coach replies, outstanding actions and timely follow-ups.', icon: Mail },
  { number: '05', title: 'Track the journey', description: 'Understand progress from first contact through the recruiting decision.', icon: TrendingUp },
];
function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-black uppercase tracking-[.2em] text-red-700">{children}</p>;
}
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-3 max-w-3xl text-[clamp(2rem,4vw,3.25rem)] font-black leading-[1.08] tracking-[-.045em] text-slate-950">{children}</h2>;
}
function SectionDescription({ children }: { children: React.ReactNode }) {
  return <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">{children}</p>;
}
function PreviewChrome({ children, label }: { children: React.ReactNode; label: string }) {
  return <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_22px_65px_-38px_rgba(16,24,40,.35)]">
    <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/90 px-4 py-3">
      <div className="flex items-center gap-1.5" aria-hidden="true"><span className="h-2 w-2 rounded-full bg-slate-300"/><span className="h-2 w-2 rounded-full bg-slate-300"/><span className="h-2 w-2 rounded-full bg-slate-300"/></div>
      <span className="text-[10px] font-black uppercase tracking-[.14em] text-slate-500">{label}</span>
      <span className="w-8" />
    </div>{children}
  </div>;
}
function HeroPreview() {
  return <div className="relative mx-auto w-full max-w-[540px]">
    <div className="pointer-events-none absolute -right-4 -top-5 h-32 w-32 rounded-full bg-red-100/80 blur-3xl" aria-hidden="true" />
    <PreviewChrome label="Game Plan · Sample data">
      <div className="p-4 sm:p-6">
        <div className="flex items-center justify-between gap-3"><div><div className="text-[11px] font-bold text-red-700">RECRUITING GAME PLAN</div><h3 className="mt-1 text-xl font-black tracking-tight">Know your next move.</h3></div><div className="rounded-xl bg-red-50 p-3 text-red-700"><Target size={23}/></div></div>
        <div className="mt-5 grid grid-cols-3 gap-2.5">
          {[['Schools','12'],['Connections','8'],['Next steps','3']].map(([name,value])=><div key={name} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3"><p className="text-[10px] font-semibold text-slate-500">{name}</p><p className="mt-1 text-2xl font-black">{value}</p></div>)}
        </div>
        <div className="mt-4 rounded-xl border border-red-100 bg-red-50/70 p-3.5">
          <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wide text-red-700"><Sparkles size={15}/> Your next best move</div>
          <p className="mt-2 text-sm font-bold text-slate-900">Follow up after your prospect camp</p>
          <p className="mt-1 text-xs leading-5 text-slate-600">Capture what you learned and keep the conversation going.</p>
          <div className="mt-3 inline-flex items-center gap-1 text-xs font-black text-red-700">Open event follow-up <ArrowRight size={13}/></div>
        </div>
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-3 rounded-lg border border-slate-100 p-3"><div className="rounded-lg bg-slate-100 p-2 text-slate-600"><Mail size={17}/></div><div className="min-w-0 flex-1"><p className="text-xs font-bold">Review a coach reply</p><p className="text-[11px] text-slate-500">Keep the relationship moving</p></div><span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-800">Review</span></div>
          <div className="flex items-center gap-3 rounded-lg border border-slate-100 p-3"><div className="rounded-lg bg-slate-100 p-2 text-slate-600"><CalendarDays size={17}/></div><div className="min-w-0 flex-1"><p className="text-xs font-bold">Prepare for an upcoming event</p><p className="text-[11px] text-slate-500">Arrive with a plan</p></div><ArrowRight size={15} className="text-slate-400"/></div>
        </div>
      </div>
    </PreviewChrome>
    <p className="mt-3 text-center text-xs text-slate-500">Illustrative product preview with sample data.</p>
  </div>;
}

function RoleCard({ icon: Icon, title, description, items }: { icon: typeof Users; title: string; description: string; items: string[] }) {
  return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-700"><Icon size={22}/></div><h3 className="mt-5 text-lg font-black">{title}</h3><p className="mt-2 min-h-0 text-sm leading-6 text-slate-600 lg:min-h-[72px]">{description}</p><ul className="mt-4 space-y-2 border-t border-slate-100 pt-4">{items.map(item=><li key={item} className="flex gap-2 text-xs font-semibold leading-5 text-slate-700"><Check size={15} className="mt-0.5 shrink-0 text-red-700"/>{item}</li>)}</ul></article>;
}

export default function Home() {
  return <div className="min-h-screen bg-white text-slate-950">
    <a href="#main" className="rr-skip-link">Skip to content</a>
    <header className="relative z-20 border-b border-slate-100 bg-white">
      <nav aria-label="Main navigation" className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <Link href="/" aria-label="RLTNL Recruiting home" className="flex shrink-0 items-center">
          <img src="/RLTNL%20Recruiting%20Horizontal.png" alt="RLTNL Recruiting" className="h-auto w-[170px] object-contain sm:w-[205px]"/>
        </Link>
        <div className="hidden items-center gap-5 lg:flex">
          <a href="#features" className="text-sm font-bold text-slate-600 transition hover:text-red-700">Features</a>
          <a href="#how-it-works" className="text-sm font-bold text-slate-600 transition hover:text-red-700">How It Works</a>
          <a href="#organizations" className="text-sm font-bold text-slate-600 transition hover:text-red-700">Organizations</a>
          <Link href="/signup" className="text-sm font-bold text-slate-600 transition hover:text-red-700">Join Your Team</Link>
          <Link href="/login" className="text-sm font-bold text-slate-600 transition hover:text-red-700">Sign In</Link>
          <Link href="/demo" className="btn btn-red px-4 py-2.5 text-sm">Request a Demo <ArrowRight size={15}/></Link>
        </div>
        <div className="flex items-center gap-2 lg:hidden">
          <Link href="/demo" className="btn btn-red px-3 py-2 text-xs sm:text-sm">Request a Demo <ArrowRight size={14}/></Link>
          <details className="group relative">
            <summary aria-label="Open navigation menu" className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-xl border border-slate-200 text-slate-800 [&::-webkit-details-marker]:hidden"><Menu size={21}/></summary>
            <div className="absolute right-0 top-[calc(100%+8px)] z-30 w-[220px] rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
              {[['Features','#features'],['How It Works','#how-it-works'],['Organizations','#organizations'],['Join Your Team','/signup'],['Sign In','/login']].map(([name,href])=><a key={name} href={href} className="block rounded-lg px-3 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 hover:text-red-700">{name}</a>)}
            </div>
          </details>
        </div>
      </nav>
    </header>

    <main id="main">
      <section className="relative overflow-hidden bg-gradient-to-br from-white via-white to-slate-50">
        <div className="mx-auto grid max-w-7xl items-center gap-9 px-5 pb-14 pt-11 sm:gap-12 sm:px-8 sm:pb-20 sm:pt-16 lg:grid-cols-[1.03fr_.97fr] lg:gap-16">
          <div>
            <SectionEyebrow>Built for softball recruiting programs</SectionEyebrow>
            <h1 className="mt-5 max-w-[660px] text-[clamp(2.55rem,6.1vw,5.1rem)] font-black leading-[1.04] tracking-[-.055em]">Recruiting happens in the <span className="text-red-700">follow-through.</span></h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600 sm:text-xl">Getting noticed is only the beginning. RLTNL helps athletes, families and advisors turn coach conversations, camps and recruiting activity into stronger relationships and clear next steps.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link href="/demo" className="btn btn-red w-full justify-center px-5 py-3 text-sm sm:w-auto">Bring RLTNL to Your Organization <ArrowRight size={17}/></Link>
              <Link href="/signup" className="btn w-full justify-center px-5 py-3 text-sm sm:w-auto">Have a Team Code? Join <ArrowUpRight size={16}/></Link>
            </div>
            <p className="mt-4 max-w-xl text-xs leading-5 text-slate-500">New to RLTNL? Request a demo for your organization or high school team. Already invited? Join using your team code.</p>
            <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-slate-600"><span className="flex items-center gap-1.5"><CheckCircle2 size={15} className="text-red-700"/> Athletes first</span><span className="flex items-center gap-1.5"><CheckCircle2 size={15} className="text-red-700"/> Advisors connected</span><span className="flex items-center gap-1.5"><CheckCircle2 size={15} className="text-red-700"/> Organizations informed</span></div>
          </div>
          <HeroPreview/>
        </div>
      </section>

      <section id="organizations" className="scroll-mt-20 border-y border-slate-200 bg-slate-50">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[1fr_.95fr] lg:gap-14">
          <div>
            <SectionEyebrow>For travel clubs and high school teams</SectionEyebrow>
            <SectionTitle>Give your recruiting program a connected system.</SectionTitle>
            <SectionDescription>Help advisors stay aligned, give athletes a consistent process, and see recruiting activity across your organization without piecing it together from spreadsheets and group texts.</SectionDescription>
            <ul className="mt-7 space-y-3">{[
              ['Simpler onboarding','Invite athletes and families using team signup codes.'],
              ['More consistent advisor coverage','Coordinate athlete assignments, coach conversations and next steps.'],
              ['Better organization visibility','Understand recruiting progress across teams with recruiting-board views and reporting.'],
            ].map(([title,desc])=><li key={title} className="flex gap-3"><CheckCircle2 size={19} className="mt-1 shrink-0 text-red-700"/><div><p className="text-sm font-black">{title}</p><p className="mt-1 text-sm leading-6 text-slate-600">{desc}</p></div></li>)}</ul>
            <Link href="/demo" className="btn btn-red mt-8 px-5 py-3">Request an Organization Demo <ArrowRight size={17}/></Link>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="flex items-center gap-3"><div className="rounded-xl bg-red-50 p-3 text-red-700"><Building2 size={24}/></div><div><p className="text-xs font-black uppercase tracking-wide text-red-700">Organization recruiting</p><h3 className="text-xl font-black">From teams to follow-through.</h3></div></div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {[
                {icon:Users,title:'Team onboarding',desc:'Invitations and role-based access'},
                {icon:ListChecks,title:'Advisor coverage',desc:'Assignments and recruiting support'},
                {icon:ClipboardCheck,title:'Recruiting Board',desc:'Progress across your athletes'},
                {icon:School,title:'Reports and outcomes',desc:'Visibility for organization leaders'},
              ].map(({icon:Icon,title,desc})=><div key={title} className="rounded-xl border border-slate-200 bg-slate-50 p-4"><Icon size={20} className="text-red-700"/><h4 className="mt-3 text-sm font-black">{title}</h4><p className="mt-1 text-xs leading-5 text-slate-600">{desc}</p></div>)}
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-7xl scroll-mt-20 px-5 py-16 sm:px-8 sm:py-24">
        <SectionEyebrow>Inside RLTNL Recruiting</SectionEyebrow>
        <SectionTitle>See the system behind the follow-through.</SectionTitle>
        <SectionDescription>Explore the athlete, advisor and organization experiences. These previews reflect real RLTNL workflows and layouts, with sample data instead of private recruiting records.</SectionDescription>
        <div className="mt-9"><PublicProductTour/></div>
      </section>

      <section id="how-it-works" className="scroll-mt-20 bg-slate-950 text-white">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
          <p className="text-[11px] font-black uppercase tracking-[.2em] text-red-300">The recruiting lifecycle</p>
          <h2 className="mt-3 max-w-3xl text-[clamp(2rem,4vw,3.2rem)] font-black leading-[1.08] tracking-[-.04em]">Every step matters. Especially the next one.</h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">One connected journey, from exploring schools to making a decision.</p>
          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {steps.map(({number,title,description,icon:Icon})=><div key={number} className="rounded-2xl border border-white/15 bg-white/[.055] p-5"><div className="flex items-center justify-between"><span className="text-xs font-black text-red-300">{number}</span><Icon size={21} className="text-slate-300"/></div><h3 className="mt-7 text-lg font-black">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-300">{description}</p></div>)}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
        <SectionEyebrow>One platform. Connected roles.</SectionEyebrow>
        <SectionTitle>The right people. The right visibility.</SectionTitle>
        <SectionDescription>Recruiting works best when everyone understands their part. RLTNL connects athletes and their support teams while respecting role-based and athlete-approved access.</SectionDescription>
        <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <RoleCard icon={Target} title="Athletes" description="Own the recruiting journey, build relationships and keep moving." items={['Find Schools and Connections','Game Plan and Next Steps','Events, communication and Journey']}/>
          <RoleCard icon={Users} title="Parents & guardians" description="Stay informed and support progress with athlete-controlled access." items={['Recruiting overview','Schools and event visibility','Appropriate read-only support']}/>
          <RoleCard icon={UserRoundCheck} title="Advisors" description="Help assigned athletes turn activity into meaningful follow-through." items={['Player 360° and Next Steps','Coach relationship context','Approved recruiting communications']}/>
          <RoleCard icon={Building2} title="Organization admins" description="Coordinate the recruiting experience across teams and athletes." items={['Organization command center','Recruiting Board and reporting','Team and Advisor management']}/>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-slate-50">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-2">
          <div className="order-2 lg:order-1">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4"><div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3 text-center sm:p-5"><FileSpreadsheet className="mx-auto text-slate-700" size={26}/><p className="mt-3 text-xs font-black sm:text-sm">Your history</p><p className="mt-1 text-[11px] leading-4 text-slate-500">Schools · Coaches · Activity</p></div><ArrowRight size={20} className="text-red-700"/><div className="min-w-0 rounded-xl border border-red-200 bg-red-50 p-3 text-center sm:p-5"><Upload className="mx-auto text-red-700" size={26}/><p className="mt-3 text-xs font-black sm:text-sm">RLTNL Recruiting</p><p className="mt-1 text-[11px] leading-4 text-slate-500">Review · Import · Continue</p></div></div>
              <p className="mt-4 text-center text-xs leading-5 text-slate-500">Guided recruiting-history import supports Excel and CSV files with review before import.</p>
            </div>
          </div>
          <div className="order-1 lg:order-2">
            <SectionEyebrow>Bring your recruiting history</SectionEyebrow><SectionTitle>You don't have to start over.</SectionTitle>
            <SectionDescription>Already using spreadsheets to track schools, coaches and recruiting activity? Bring the work you've done into RLTNL Recruiting and keep your momentum.</SectionDescription>
            <p className="mt-5 text-base font-black">Your recruiting history should move with you.</p>
          </div>
        </div>
      </section>

      <section className="bg-red-700 text-white">
        <div className="mx-auto max-w-7xl px-5 py-16 text-center sm:px-8 sm:py-20">
          <p className="text-[11px] font-black uppercase tracking-[.2em] text-red-100">Ready for the next step?</p>
          <h2 className="mx-auto mt-4 max-w-3xl text-[clamp(2rem,4vw,3.3rem)] font-black leading-[1.1] tracking-[-.04em]">RLTNL: Relationships lead to the next level.</h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-red-50">Bring RLTNL Recruiting to your travel or club organization or high school team, or join an existing team with your signup code.</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/demo" className="btn w-full border-white bg-white px-6 py-3 text-sm font-black text-slate-950 sm:w-auto">Request an Organization Demo <ArrowRight size={17}/></Link>
            <Link href="/signup" className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/70 px-6 py-3 text-sm font-black text-white transition-colors hover:bg-white/10 sm:w-auto">Have a Team Code? Join Now <ArrowUpRight size={17}/></Link>
          </div>
        </div>
      </section>
    </main>
    <footer className="border-t border-slate-200 bg-white"><div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8">
      <img src="/RLTNL%20Recruiting%20Horizontal.png" alt="RLTNL Recruiting" className="h-auto w-[180px] object-contain"/>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 text-xs font-semibold text-slate-500"><a href="#features" className="hover:text-slate-900">Features</a><a href="#organizations" className="hover:text-slate-900">Organizations</a><Link href="/demo" className="hover:text-slate-900">Request a Demo</Link><Link href="/login" className="hover:text-slate-900">Sign In</Link><Link href="/signup" className="hover:text-slate-900">Join Your Team</Link><Link href="/privacy" className="hover:text-slate-900">Privacy Policy</Link><Link href="/terms" className="hover:text-slate-900">Terms of Service</Link></div>
    </div></footer>
  </div>;
}
