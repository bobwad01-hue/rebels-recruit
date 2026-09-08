import Link from 'next/link';

export default function PublicLegalPage({title,updated,children}:{title:string;updated:string;children:React.ReactNode}){
  return <div className="min-h-screen bg-slate-50 text-slate-900">
    <header className="border-b bg-white"><div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between gap-4"><Link href="/" className="text-xl tracking-tight"><span className="font-black text-red-600">REBELS</span><span className="font-normal text-slate-900"> RECRUIT</span></Link><Link href="/login" className="btn">Sign in</Link></div></header>
    <main className="max-w-4xl mx-auto px-6 py-12"><div className="card p-6 md:p-10"><h1 className="text-3xl md:text-4xl font-black tracking-tight">{title}</h1><p className="muted text-sm mt-2">Last updated: {updated}</p><div className="mt-8 space-y-7 leading-7 text-slate-700">{children}</div></div></main>
    <footer className="max-w-4xl mx-auto px-6 pb-10 text-sm muted flex flex-wrap gap-x-5 gap-y-2"><Link href="/">Home</Link><Link href="/privacy">Privacy Policy</Link><Link href="/terms">Terms of Service</Link></footer>
  </div>
}
