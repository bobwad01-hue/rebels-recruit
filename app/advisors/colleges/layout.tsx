import {Suspense} from 'react';

export default function AdvisorCollegesLayout({children}:{children:React.ReactNode}){
  return <Suspense fallback={<div className="p-10 text-center text-slate-500">Loading colleges & coaches...</div>}>{children}</Suspense>;
}
