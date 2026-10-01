'use client';
import dynamic from 'next/dynamic';
const OrganizationCommandCenter=dynamic(()=>import('./OrganizationCommandCenter'),{ssr:false,loading:()=> <div className="rr-soft-surface p-6 text-sm text-slate-500">Loading organizational health…</div>});
export default function OrganizationOverview(){return <section className="mt-7 border-t pt-6"><OrganizationCommandCenter/></section>}