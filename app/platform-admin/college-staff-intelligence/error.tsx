'use client';

import {useEffect} from 'react';

export default function StaffIntelligenceError({error,reset}:{error:Error&{digest?:string};reset:()=>void}){
 useEffect(()=>{
  console.error('[College Staff Intelligence] Client render failed',{
   name:error.name,message:error.message,digest:error.digest,stack:error.stack
  });
 },[error]);
 return <main className="mx-auto max-w-xl px-5 py-20">
  <section className="card p-8">
   <p className="text-xs font-bold uppercase tracking-widest text-red-600">Platform Admin</p>
   <h1 className="mt-3 text-2xl font-black">College Staff Intelligence couldn't display</h1>
   <p className="mt-3 text-sm text-slate-600">Your college and recruiting records remain saved. This is a dashboard display error, not a reason to restart ingestion.</p>
   <p className="mt-3 break-words rounded-lg bg-slate-100 p-3 text-xs text-slate-700" role="alert">{error.message||'Unexpected dashboard error'}{error.digest?' (reference: '+error.digest+')':''}</p>
   <div className="mt-5 flex gap-3"><button type="button" className="btn btn-red" onClick={reset}>Try again</button><a className="btn" href="/platform-admin">Return to Platform Admin</a></div>
  </section>
 </main>;
}
