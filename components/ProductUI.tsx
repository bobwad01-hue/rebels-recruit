import Link from 'next/link';
import {ArrowRight} from 'lucide-react';

export function SectionHeader({eyebrow,title,description,action}:{eyebrow?:string;title:string;description?:string;action?:React.ReactNode}){return <div className="rr-section-head"><div className="min-w-0">{eyebrow&&<div className="rr-eyebrow">{eyebrow}</div>}<h2>{title}</h2>{description&&<p>{description}</p>}</div>{action&&<div className="shrink-0">{action}</div>}</div>}

export function MetricCard({label,value,detail,href}:{label:string;value:React.ReactNode;detail?:string;href?:string}){const body=<><div className="rr-metric-label">{label}</div><div className="rr-metric-value">{value}</div>{detail&&<div className="muted text-xs mt-1">{detail}</div>}</>;return href?<Link href={href} className="rr-metric-card rr-interactive-card block p-4 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2">{body}</Link>:<div className="rr-metric-card p-4">{body}</div>}

export function PriorityCard({eyebrow='DO THIS NEXT',title,description,href,actionLabel='Open'}:{eyebrow?:string;title:string;description?:string;href?:string;actionLabel?:string}){const body=<><div className="rr-eyebrow">{eyebrow}</div><div className="font-black text-lg leading-snug">{title}</div>{description&&<p className="text-sm mt-1">{description}</p>}{href&&<div className="font-black text-sm mt-4 inline-flex items-center gap-1">{actionLabel}<ArrowRight size={15}/></div>}</>;return href?<Link href={href} className="rr-priority-card rr-interactive-card block p-5 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2">{body}</Link>:<div className="rr-priority-card p-5">{body}</div>}

export function EmptyState({title,description,href,actionLabel='Get started'}:{title:string;description:string;href?:string;actionLabel?:string}){return <div className="rr-empty-state"><div className="font-black text-lg">{title}</div><p className="muted text-sm mt-1 max-w-xl mx-auto">{description}</p>{href&&<Link href={href} className="btn mt-4">{actionLabel}<ArrowRight size={15}/></Link>}</div>}

export function FilterBar({children}:{children:React.ReactNode}){return <div className="rr-filter-bar">{children}</div>}

export function EntityLink({href,children,className=''}:{href:string;children:React.ReactNode;className?:string}){return <Link href={href} className={`rr-entity-link ${className}`}>{children}</Link>}
