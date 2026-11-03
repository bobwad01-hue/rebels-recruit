'use client';

import {AlertTriangle, RefreshCw, LogOut} from 'lucide-react';
import {PrimaryBrand} from '@/components/BrandLogo';
import {createClient} from '@/lib/supabase-browser';

export default function ServiceUnavailable(){
  async function signOut(){
    await createClient().auth.signOut();
    window.location.assign('/login');
  }

  return <main className="min-h-screen bg-slate-50 px-4 py-12 sm:py-20">
    <section className="mx-auto max-w-lg rounded-2xl border bg-white p-6 shadow-sm sm:p-9">
      <div className="flex justify-center"><PrimaryBrand className="h-10"/></div>
      <div className="mx-auto mt-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
        <AlertTriangle size={28}/>
      </div>
      <h1 className="mt-5 text-center text-2xl font-black text-slate-950">We couldn't verify your access</h1>
      <p className="mt-3 text-center text-sm leading-6 text-slate-600">
        Your sign-in succeeded, but RLTNL Recruiting couldn't check your account permissions right now.
        This does not mean you need a new team invitation or need to accept our terms again.
        Please try again shortly.
      </p>
      <button type="button" className="btn btn-red mt-7 w-full justify-center" onClick={()=>window.location.assign('/auth/callback')}>
        <RefreshCw size={16}/> Try again
      </button>
      <button type="button" className="mx-auto mt-5 flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-950" onClick={signOut}>
        <LogOut size={15}/> Sign out
      </button>
    </section>
  </main>;
}
