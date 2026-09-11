import {Suspense} from 'react';
import AppShell from '@/components/AppShell';
import PageHeader from '@/components/PageHeader';
import StaffConnectionsBoard from '@/components/StaffConnectionsBoard';

export default function AdvisorConnections(){return <Suspense fallback={<AppShell><div className="max-w-7xl mx-auto px-5 md:px-8 py-6"><div className="card p-10 text-center muted">Loading Connections...</div></div></AppShell>}><AppShell><div className="max-w-7xl mx-auto px-5 md:px-8 py-6"><PageHeader eyebrow="ADVISOR RELATIONSHIP VIEW" title="Connections" subtitle="See which schools and coaches each player is pursuing, where relationships may need attention, and which player you should help next."/><div className="rounded-xl border bg-slate-50 px-4 py-3 text-sm text-slate-700 mb-5"><b>Use this view to coach the player, not replace them:</b> open a school or coach relationship to understand the context, then help the athlete choose and complete the right next action.</div><StaffConnectionsBoard/></div></AppShell></Suspense>}
