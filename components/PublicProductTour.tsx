'use client';

import { useState } from 'react';
import { ArrowRight, Bell, CalendarDays, CheckCircle2, ChevronRight, ClipboardList, Compass, LayoutDashboard, Mail, MessageSquareText, Search, ShieldCheck, Target, Users } from 'lucide-react';
import Link from 'next/link';

const tabs = [
  { id: 'athlete', label: 'Athlete Game Plan', short: 'Athlete' },
  { id: 'connections', label: 'Connections', short: 'Connections' },
  { id: 'advisor', label: 'Advisor Communications', short: 'Advisor' },
  { id: 'organization', label: 'Recruiting Board', short: 'Organization' },
] as const;
type Tab = typeof tabs[number]['id'];

const demoPlayers = [
  { name: 'Athlete A', year: '2028', team: '16U', stage: 'Building Relationships', health: 'Strong', next: 'Follow up with coach' },
  { name: 'Athlete B', year: '2027', team: '18U', stage: 'Evaluating Options', health: 'On track', next: 'Prepare for camp' },
  { name: 'Athlete C', year: '2029', team: '14U', stage: 'Getting Started', health: 'Needs attention', next: 'Add target schools' },
];

function Chip({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'red' | 'green' | 'amber' }) {
  const colors = { neutral: 'bg-slate-100 text-slate-600', red: 'bg-red-50 text-[#D01C29]', green: 'bg-emerald-50 text-emerald-800', amber: 'bg-amber-50 text-amber-800' };
  return <span className={'inline-flex rounded-full px-2.5 py-1 text-[10px] font-black ' + colors[tone]}>{children}</span>;
}
function Metric({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Users }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
    <div className="flex items-center justify-between gap-2 text-[10px] font-bold text-slate-500 sm:text-xs"><span>{label}</span><Icon size={14}/></div>
    <div className="mt-2 text-2xl font-black text-slate-950">{value}</div>
  </div>;
}
function PreviewSidebar({ tab }: { tab: Tab }) {
  const items = tab === 'athlete' ? ['Home', 'Game Plan', 'Find Schools', 'Connections', 'Events', 'Journey']
    : tab === 'organization' ? ['Home', 'Recruiting HQ', 'Recruiting Board', 'Connections', 'Reports']
    : ['Home', 'Recruiting HQ', 'Connections', 'Insights', 'Events', 'Communications'];
  const selected = tab === 'athlete' ? 'Game Plan' : tab === 'organization' ? 'Recruiting Board' : tab === 'connections' ? 'Connections' : 'Communications';
  return <aside className="hidden w-[155px] shrink-0 border-r border-slate-200 bg-white p-3 md:block">
    <div className="mb-6 text-[12px] font-black tracking-tight"><span className="text-[#D01C29]">RLTNL</span> <span className="text-[9px] font-semibold">RECRUITING</span></div>
    <div className="space-y-1">{items.map(item => <div key={item} className={'rounded-lg px-2.5 py-2 text-[10px] font-bold ' + (item === selected ? 'bg-[#D01C29] text-white' : 'text-slate-500')}>{item}</div>)}</div>
  </aside>;
}
function AthleteScreen() {
  return <div>
    <div className="grid grid-cols-3 gap-2"><Metric label="Schools" value="12" icon={Compass}/><Metric label="Connections" value="8" icon={Users}/><Metric label="Next Steps" value="3" icon={ClipboardList}/></div>
    <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-4">
      <p className="text-[10px] font-black uppercase tracking-wide text-[#D01C29]">Your next best move</p>
      <p className="mt-2 text-sm font-black">Follow up after your prospect camp</p>
      <p className="mt-1 text-xs leading-5 text-slate-600">Record what happened and keep the conversation going.</p>
      <div className="mt-3 inline-flex items-center gap-1 text-xs font-black text-[#D01C29]">Open Event Follow-Up <ArrowRight size={12}/></div>
    </div>
    <div className="mt-3 rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 p-3 text-xs font-black">Your recruiting to-do list</div>
      {[
        ['Review a coach reply','Coach responded to your outreach','Review'],
        ['Prepare for your next event','Plan what to ask and what to learn','Upcoming'],
        ['Update your school list','Check your latest target schools','On track'],
      ].map(([title,desc,status],i) => <div key={title} className="flex items-center gap-3 border-b border-slate-100 p-3 last:border-b-0"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-xs font-black">{i+1}</span><div className="min-w-0 flex-1"><p className="text-xs font-bold">{title}</p><p className="mt-0.5 text-[10px] text-slate-500">{desc}</p></div><Chip tone={i===0?'amber':'neutral'}>{status}</Chip></div>)}
    </div>
  </div>;
}
function ConnectionsScreen() {
  return <div>
    <div className="mb-3 flex flex-wrap gap-2">{['Current relationships','Include past','All teams'].map((label,i)=><span key={label} className={'rounded-lg border px-2.5 py-2 text-[10px] font-bold ' + (i===0?'border-red-200 bg-red-50 text-[#D01C29]':'border-slate-200 bg-white text-slate-600')}>{label}</span>)}</div>
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 p-4"><div><p className="text-[10px] font-bold uppercase tracking-wide text-[#D01C29]">School relationship</p><h4 className="mt-1 text-sm font-black">Example University</h4></div><Chip tone="green">Engaged</Chip></div>
      <div className="space-y-2 p-4">
        {[
          ['School added','Added to target schools'],
          ['Coach contacted','Recruiting introduction sent'],
          ['Coach replied','Interest and next steps recorded'],
          ['Follow-up planned','Next action added to Game Plan'],
        ].map(([title,desc],i)=><div key={title} className="flex gap-3 rounded-lg bg-slate-50 p-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-50 text-[10px] font-black text-[#D01C29]">{i+1}</span><div><p className="text-xs font-black">{title}</p><p className="mt-0.5 text-[10px] text-slate-500">{desc}</p></div></div>)}
      </div>
    </div>
  </div>;
}
function AdvisorScreen() {
  return <div>
    <div className="grid grid-cols-3 gap-2"><Metric label="Assigned" value="8" icon={Users}/><Metric label="Sent" value="12" icon={Mail}/><Metric label="Coach replies" value="5" icon={MessageSquareText}/></div>
    <div className="mt-3 grid gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-3">
      {['All assigned athletes','Sent and received','Last 90 days'].map(item=><div key={item} className="rounded-lg border border-slate-200 px-2 py-2 text-[10px] font-semibold text-slate-700">{item}</div>)}
    </div>
    <div className="mt-3 grid min-h-[260px] gap-3 sm:grid-cols-[.85fr_1.15fr]">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white"><p className="border-b p-3 text-xs font-black">Recruiting conversations</p>
        {[
          ['Athlete A · Example University','Coach replied','Camp invitation'],
          ['Athlete B · Sample College','Player sent','Follow-up after visit'],
        ].map(([name,type,subject],i)=><div key={name} className={'border-b border-slate-100 p-3 '+(i===0?'bg-red-50/50':'')}><Chip tone={i===0?'red':'neutral'}>{type}</Chip><p className="mt-2 text-[11px] font-bold">{name}</p><p className="mt-1 text-[10px] text-slate-600">{subject}</p></div>)}
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4"><Chip tone="red">Coach email</Chip><p className="mt-3 text-sm font-black">Camp invitation</p><p className="mt-2 text-[10px] text-slate-500">Coach · Example University</p><div className="mt-3 rounded-lg bg-amber-50 p-3 text-[10px] text-amber-900"><p className="font-black">Awaiting athlete review</p><p className="mt-1">Review invitation and decide on a next step</p></div><div className="mt-3 rounded-lg bg-slate-50 p-3 text-[11px] leading-5 text-slate-700">Thanks for reaching out. We'd love to invite you to our upcoming prospect camp.</div><p className="mt-3 flex items-center gap-1 text-[10px] text-slate-500"><ShieldCheck size={12}/> Advisor view is read-only</p></div>
    </div>
  </div>;
}
function OrganizationScreen() {
  return <div>
    <div className="grid grid-cols-3 gap-2"><Metric label="Athletes" value="18" icon={Users}/><Metric label="Need attention" value="4" icon={Bell}/><Metric label="Active targets" value="52" icon={Target}/></div>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-3">
      <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600"><Search size={13}/> Search athletes</span><div className="flex gap-2"><Chip>All teams</Chip><Chip>Table view</Chip></div>
    </div>
    <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full min-w-[490px] text-left text-[11px]">
        <thead className="bg-slate-50 text-[10px] text-slate-500"><tr>{['Athlete','Class','Team','Recruiting stage','Next action'].map(h=><th key={h} className="border-b border-slate-200 px-3 py-3 font-bold">{h}</th>)}</tr></thead>
        <tbody>{demoPlayers.map(p=><tr key={p.name} className="border-b border-slate-100 last:border-0"><td className="px-3 py-3 font-black">{p.name}</td><td className="px-3 py-3">{p.year}</td><td className="px-3 py-3">{p.team}</td><td className="px-3 py-3"><Chip tone={p.health==='Needs attention'?'amber':'neutral'}>{p.stage}</Chip></td><td className="px-3 py-3 font-semibold">{p.next}</td></tr>)}</tbody>
      </table>
    </div>
  </div>;
}

export default function PublicProductTour() {
  const [tab, setTab] = useState<Tab>('athlete');
  const heading = {
    athlete: ['Game Plan', 'Know your next move.'],
    connections: ['Connections', 'Relationships, not just contacts.'],
    advisor: ['Advisor Communications', 'The conversations behind recruiting.'],
    organization: ['Recruiting Board', 'See the recruiting picture across your teams.'],
  }[tab];
  return <div>
    <div role="tablist" aria-label="Explore RLTNL Recruiting features" className="mb-5 flex flex-wrap gap-2">
      {tabs.map(item=><button type="button" key={item.id} role="tab" aria-selected={tab===item.id}
        aria-controls="rltnl-product-tour-panel" onClick={()=>setTab(item.id)}
        className={tab===item.id?'rounded-xl !bg-[#D01C29] hover:!bg-[#AE1823] px-4 py-2.5 text-xs font-black !text-white hover:!text-white shadow-sm transition-colors sm:text-sm':'rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:border-slate-300 hover:bg-slate-50 transition-colors sm:text-sm'}>
        {item.label}
      </button>)}
    </div>
    <div id="rltnl-product-tour-panel" role="tabpanel" className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-[0_20px_70px_-35px_rgba(15,23,42,.3)]">
      <div className="flex"><PreviewSidebar tab={tab}/><div className="min-w-0 flex-1 p-4 sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.14em] text-[#D01C29]">{heading[0]}</p><h3 className="mt-1 text-lg font-black tracking-tight text-slate-950 sm:text-xl">{heading[1]}</h3></div></div>
        {tab==='athlete'?<AthleteScreen/>:tab==='connections'?<ConnectionsScreen/>:tab==='advisor'?<AdvisorScreen/>:<OrganizationScreen/>}
      </div></div>
    </div>
    <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
      <Link href="/demo" className="inline-flex items-center gap-1.5 text-sm font-black text-[#D01C29] hover:underline">See it with your organization <ChevronRight size={16}/></Link>
    </div>
  </div>;
}
