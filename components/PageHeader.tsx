import AdvisorHomeTitle from '@/components/AdvisorHomeTitle';

export default function PageHeader({title,subtitle,action,eyebrow}:{title:string;subtitle?:string;action?:React.ReactNode;eyebrow?:string|null}){
 const renderedTitle=title==='Advisor View'?<AdvisorHomeTitle/>:title;
 const sectionLabel=eyebrow||'';
 return <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6 min-w-0" data-rr-page-header><div className="min-w-0 flex-1">{sectionLabel&&<div className="rr-eyebrow">{sectionLabel}</div>}<h1 className="rr-section-title">{renderedTitle}</h1>{subtitle&&<p className="rr-section-subtitle">{subtitle}</p>}</div>{action&&<div className="w-full sm:w-auto shrink-0 [&>.btn]:w-full sm:[&>.btn]:w-auto [&>a]:w-full sm:[&>a]:w-auto [&>button]:w-full sm:[&>button]:w-auto">{action}</div>}</header>
}

