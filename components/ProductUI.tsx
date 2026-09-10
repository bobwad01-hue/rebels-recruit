import Link from 'next/link';
import {ArrowRight,AlertCircle,CheckCircle2,Info} from 'lucide-react';

export function PageFrame({children,size='7xl',className=''}:{children:React.ReactNode;size?:'5xl'|'6xl'|'7xl';className?:string}){const max=size==='5xl'?'max-w-5xl':size==='6xl'?'max-w-6xl':'max-w-7xl';return <div className={`${max} mx-auto px-4 sm:px-5 md:px-8 py-6 sm:py-7 ${className}`}>{children}</div>}

export function SectionHeader({eyebrow,title,description,action}:{eyebrow?:string;title:string;description?:string;action?:React.ReactNode}){return <div className="rr-section-head"><div className="min-w-0">{eyebrow&&<div className="rr-eyebrow">{eyebrow}</div>}<h2>{title}</h2>{description&&<p>{description}</p>}</div>{action&&<div className="w-full sm:w-auto shrink-0">{action}</div>}</div>}

export function MetricCard({label,value,detail,href}:{label:string;value:React.ReactNode;detail?:string;href?:string}){const body=<><div className="rr-metric-label">{label}</div><div className="rr-metric-value">{value}</div>{detail&&<div className="muted text-xs mt-1">{detail}</div>}</>;return href?<Link href={href} className="rr-metric-card rr-interactive-card block p-4 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2">{body}</Link>:<div className="rr-metric-card p-4">{body}</div>}

export function PriorityCard({eyebrow='DO THIS NEXT',title,description,href,actionLabel='Open'}:{eyebrow?:string;title:string;description?:string;href?:string;actionLabel?:string}){const body=<><div className="rr-eyebrow">{eyebrow}</div><div className="font-black text-lg leading-snug">{title}</div>{description&&<p className="text-sm mt-1">{description}</p>}{href&&<div className="font-black text-sm mt-4 inline-flex items-center gap-1">{actionLabel}<ArrowRight size={15}/></div>}</>;return href?<Link href={href} className="rr-priority-card rr-interactive-card block p-5 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2">{body}</Link>:<div className="rr-priority-card p-5">{body}</div>}

export function EmptyState({title,description,href,actionLabel='Get started',children}:{title:string;description:string;href?:string;actionLabel?:string;children?:React.ReactNode}){return <div className="rr-empty-state"><div className="font-black text-lg">{title}</div><p className="muted text-sm mt-1 max-w-xl mx-auto">{description}</p>{children}{href&&<Link href={href} className="btn mt-4">{actionLabel}<ArrowRight size={15}/></Link>}</div>}

export function StatePanel({title,description,tone='info',action}:{title:string;description:string;tone?:'info'|'success'|'warning'|'error';action?:React.ReactNode}){const Icon=tone==='success'?CheckCircle2:tone==='error'||tone==='warning'?AlertCircle:Info;const toneClass=tone==='success'?'border-emerald-200 bg-emerald-50':tone==='warning'?'border-amber-200 bg-amber-50':tone==='error'?'border-red-200 bg-red-50':'border-slate-200 bg-slate-50';return <div className={`rounded-2xl border p-4 sm:p-5 ${toneClass}`} role={tone==='error'?'alert':undefined}><div className="flex items-start gap-3"><Icon size={19} className="mt-0.5 shrink-0"/><div className="min-w-0 flex-1"><div className="font-black">{title}</div><p className="text-sm mt-1 text-slate-600 leading-relaxed">{description}</p>{action&&<div className="mt-4">{action}</div>}</div></div></div>}

export function FilterBar({children}:{children:React.ReactNode}){return <div className="rr-filter-bar">{children}</div>}

export function ActionRow({children,align='start'}:{children:React.ReactNode;align?:'start'|'end'|'between'}){const alignment=align==='end'?'justify-end':align==='between'?'justify-between':'justify-start';return <div className={`flex flex-col sm:flex-row sm:items-center ${alignment} gap-2 sm:gap-3`}>{children}</div>}

export function SegmentedControl({children,label}:{children:React.ReactNode;label?:string}){return <div className="inline-flex max-w-full overflow-x-auto rounded-xl border bg-white p-1" role="group" aria-label={label}>{children}</div>}

export function FormSection({title,description,children}:{title:string;description?:string;children:React.ReactNode}){return <section className="card p-5 sm:p-6"><div className="mb-5"><h2 className="font-black text-lg">{title}</h2>{description&&<p className="muted text-sm mt-1 leading-relaxed">{description}</p>}</div><div className="space-y-4">{children}</div></section>}

export function EntityLink({href,children,className=''}:{href:string;children:React.ReactNode;className?:string}){return <Link href={href} className={`rr-entity-link ${className}`}>{children}</Link>}
