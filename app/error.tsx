'use client';

import {useEffect} from 'react';
import {AlertCircle,RefreshCw} from 'lucide-react';

export default function GlobalError({error,reset}:{error:Error&{digest?:string};reset:()=>void}){
  useEffect(()=>{console.error(error)},[error]);
  return <div className="min-h-[60vh] flex items-center justify-center px-4" role="alert">
    <div className="card w-full max-w-lg p-6 sm:p-8 text-center">
      <AlertCircle size={28} className="mx-auto" aria-hidden="true"/>
      <h2 className="font-black text-xl mt-4">We couldn’t load this part of Rebels Recruit</h2>
      <p className="muted text-sm mt-2 leading-relaxed">Your recruiting data has not been changed. Try loading this screen again. If the problem continues, return to Home and retry from there.</p>
      <div className="mt-5 flex flex-col sm:flex-row justify-center gap-2">
        <button type="button" onClick={reset} className="btn inline-flex items-center justify-center gap-2"><RefreshCw size={16}/>Try again</button>
        <a href="/dashboard" className="btn secondary inline-flex items-center justify-center">Return Home</a>
      </div>
    </div>
  </div>
}
