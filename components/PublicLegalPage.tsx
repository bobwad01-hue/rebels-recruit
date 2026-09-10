import Link from 'next/link';

export default function PublicLegalPage({title,updated,children}:{title:string;updated:string;children:React.ReactNode}){
  return <div className="min-h-screen bg-slate-50 text-slate-900">
    <header className="border-b bg-white"><div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-5 flex items-center justify-between gap-4"><Link href="/" className="text-xl tracking-tight" aria-label="Rebels Recruit home"><span className="font-black text-red-600">REBELS</span><span className="font-normal text-slate-900"> RECRUIT</span></Link><Link href="/login" className="btn">Sign in</Link></div></header>
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12"><div className="rr-eyebrow">TRUST & TRANSPARENCY</div><h1 className="rr-section-title">{title}</h1><p className="rr-section-subtitle">Last updated: {updated}</p><div className="card p-5 sm:p-6 md:p-10 mt-6"><div className="space-y-7 leading-7 text-slate-700 [&_h2]:font-black [&_h2]:text-slate-950 [&_h2]:text-xl [&_h3]:font-black [&_h3]:text-slate-950 [&_a]:font-bold [&_a]:underline [&_a]:underline-offset-2">{children}</div></div></main>
    <footer className="max-w-4xl mx-auto px-4 sm:px-6 pb-10 text-sm muted flex flex-wrap gap-x-5 gap-y-3"><Link href="/" className="min-h-11 inline-flex items-center">Home</Link><Link href="/privacy" className="min-h-11 inline-flex items-center">Privacy Policy</Link><Link href="/terms" className="min-h-11 inline-flex items-center">Terms of Service</Link></footer>
  </div>
}
