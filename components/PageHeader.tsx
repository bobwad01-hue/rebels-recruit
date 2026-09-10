import AdvisorHomeTitle from '@/components/AdvisorHomeTitle';

export default function PageHeader({title,subtitle,action,eyebrow}:{title:string;subtitle?:string;action?:React.ReactNode;eyebrow?:string}){
 const renderedTitle=title==='Advisor View'?<AdvisorHomeTitle/>:title;
 const sectionLabel=eyebrow||sectionEyebrow(title);
 return <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6 min-w-0" data-rr-page-header><div className="min-w-0 flex-1">{sectionLabel&&<div className="rr-eyebrow">{sectionLabel}</div>}<h1 className="rr-section-title">{renderedTitle}</h1>{subtitle&&<p className="rr-section-subtitle">{subtitle}</p>}</div>{action&&<div className="w-full sm:w-auto shrink-0 [&>.btn]:w-full sm:[&>.btn]:w-auto [&>a]:w-full sm:[&>a]:w-auto [&>button]:w-full sm:[&>button]:w-auto">{action}</div>}</header>
}

function sectionEyebrow(title:string){
 const t=title.toLowerCase();
 if(t.includes('activity')||t.includes('journey'))return 'RECRUITING JOURNEY';
 if(t.includes('connection'))return 'RELATIONSHIPS';
 if(t.includes('event'))return 'RECRUITING EVENTS';
 if(t.includes('message'))return 'COMMUNICATION';
 if(t.includes('video'))return 'RECRUITING VIDEO';
 if(t.includes('fit')||t.includes('school')||t.includes('college')||t.includes('discover'))return 'SCHOOL DISCOVERY';
 if(t.includes('report')||t.includes('export'))return 'REPORTING';
 if(t.includes('board')||t.includes('organization'))return 'ORGANIZATION';
 if(t.includes('access')||t.includes('player'))return 'PLAYER SUPPORT';
 if(t.includes('task')||t.includes('move')||t.includes('goal')||t.includes('plan')||t.includes('reminder'))return 'NEXT MOVES';
 if(t.includes('advisor'))return 'ADVISOR COMMAND CENTER';
 if(t.includes('profile'))return 'RECRUITING PROFILE';
 if(t.includes('setting'))return 'ACCOUNT & PREFERENCES';
 if(t.includes('import'))return 'BRING YOUR HISTORY';
 if(t.includes('health')||t.includes('intelligence')||t.includes('insight'))return 'RECRUITING INTELLIGENCE';
 return 'REBELS RECRUIT';
}
