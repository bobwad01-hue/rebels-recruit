import Link from "next/link";
import {LayoutDashboard,Settings2,Upload} from "lucide-react";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import OrganizationJoinCode from "@/components/OrganizationJoinCode";
import OrganizationOverview from "./OrganizationOverview";
import {PageFrame} from "@/components/ProductUI";
export default function Organization(){return <AppShell><PageFrame><PageHeader eyebrow="ORGANIZATION" title="Organization" subtitle="Manage your organization, teams and player onboarding, then keep recruiting work moving." action={<Link href="/organization/recruiting-board" className="btn btn-red rr-primary-action"><LayoutDashboard size={17}/>Open Recruiting HQ</Link>}/><section className="grid md:grid-cols-2 gap-3 mt-6"><Link href="/organization/setup" className="card p-5 hover:border-slate-400"><div className="flex items-center gap-2 font-black text-lg"><Settings2 size={19}/>Organization Setup</div><p className="muted text-sm mt-2">Manage organization details, teams and private join codes.</p></Link><Link href="/import/team" className="card p-5 hover:border-slate-400"><div className="flex items-center gap-2 font-black text-lg"><Upload size={19}/>Import Team History</div><p className="muted text-sm mt-2">Bring existing team and recruiting history into Rebels Recruit.</p></Link></section><div className="mt-5 max-w-xl"><OrganizationJoinCode/></div><OrganizationOverview/></PageFrame></AppShell>}
