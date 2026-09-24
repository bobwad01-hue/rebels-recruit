import Link from "next/link";
import {LayoutDashboard,Settings2,Upload} from "lucide-react";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import OrganizationJoinCode from "@/components/OrganizationJoinCode";
import OrganizationOverview from "./OrganizationOverview";
import OwnerAdminHome from "./OwnerAdminHome";
import {PageFrame} from "@/components/ProductUI";
export default function Organization(){return <AppShell><PageFrame><PageHeader eyebrow="ORGANIZATION" title="Organization" subtitle="See what needs attention across your recruiting program and get to the right work quickly." action={<Link href="/organization/recruiting-board" className="btn btn-red rr-primary-action"><LayoutDashboard size={17}/>Open Recruiting HQ</Link>}/><OwnerAdminHome/><OrganizationOverview/><details className="mt-8 border-t pt-5"><summary className="cursor-pointer font-black text-sm">Organization tools</summary><p className="muted text-sm mt-2 max-w-2xl">Setup, team history and invitation tools stay available without competing with daily recruiting work.</p><div className="rr-action-cluster mt-4"><Link href="/organization/setup" className="btn"><Settings2 size={17}/>Organization Setup</Link><Link href="/import/team" className="btn"><Upload size={17}/>Import Team History</Link></div><div className="mt-5 max-w-xl"><OrganizationJoinCode/></div></details></PageFrame></AppShell>}
