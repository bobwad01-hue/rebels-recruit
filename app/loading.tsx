import {PrimaryBrand} from '@/components/BrandLogo';

export default function Loading(){
  return <div className="min-h-[60vh] flex items-center justify-center px-4" role="status" aria-live="polite">
    <div className="card w-full max-w-md p-6 sm:p-8 text-center">
      <div className="flex justify-center"><PrimaryBrand className="text-xl"/></div>
      <div className="mt-5 font-black text-lg">Loading your recruiting workspace…</div>
      <p className="muted text-sm mt-2">We’re getting the latest relationships, activity, and next steps ready.</p>
      <span className="sr-only">Loading</span>
    </div>
  </div>
}
