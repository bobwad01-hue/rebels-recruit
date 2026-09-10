import {Suspense} from 'react';
import AppShell from '@/components/AppShell';
import PageHeader from '@/components/PageHeader';
import StaffConnectionsBoard from '@/components/StaffConnectionsBoard';

export default function AdvisorConnections(){return <Suspense fallback={<AppShell><div className="max-w-7xl mx-auto px-5 md:px-8 py-6"><div className="card p-10 text-center muted">Loading Connections...</div></div></AppShell>}><AppShell><div className="max-w-7xl mx-auto px-5 md:px-8 py-6"><PageHeader title="Schools & Coaches" subtitle="View recruiting relationships across the players you can access, with the same familiar Connections patterns used by athletes."/><StaffConnectionsBoard/></div></AppShell></Suspense>}
