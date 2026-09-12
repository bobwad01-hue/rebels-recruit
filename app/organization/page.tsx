import Link from "next/link";
import { LayoutDashboard, Settings2, Upload } from "lucide-react";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/PageHeader";
import OrganizationJoinCode from "@/components/OrganizationJoinCode";
import OrganizationCommandCenter from "./OrganizationCommandCenter";

export default function Organization() {
  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-5 md:px-8 py-6">
        <PageHeader
          eyebrow="ORGANIZATION OVERVIEW"
          title="Organization"
          subtitle="See where players are in the recruiting process, where staff attention is needed, and how recruiting activity is developing across your program."
          action={
            <div className="flex flex-wrap gap-2">
              <Link href="/organization/setup" className="btn">
                <Settings2 size={17} />
                Organization Setup
              </Link>
              <Link href="/import/team" className="btn">
                <Upload size={17} />
                Import Team History
              </Link>
              <Link
                href="/organization/recruiting-board"
                className="btn btn-red"
              >
                <LayoutDashboard size={17} />
                Open Recruiting Board
              </Link>
            </div>
          }
        />
        <OrganizationJoinCode />
        <div className="rounded-xl border bg-slate-50 px-4 py-3 text-sm text-slate-700 mb-5">
          <b>Start with exceptions, then drill in.</b> Use this page to spot
          players, relationships or workflows that need attention. Open the
          underlying player, school, coach or activity before deciding what
          staff should do next.
        </div>
        <OrganizationCommandCenter />
      </div>
    </AppShell>
  );
}
