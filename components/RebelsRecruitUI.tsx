'use client';
import type {ReactNode} from 'react';

export function AthleteAvatar({name,src,size='md'}:{name:string;src?:string|null;size?:'sm'|'md'|'lg'}){
 const initials=String(name||'Athlete').trim().split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase();
 const cls=size==='lg'?'h-14 w-14 text-base':size==='sm'?'h-8 w-8 text-[10px]':'h-10 w-10 text-xs';
 return src?<img src={src} alt="" className={cls+' rounded-full object-cover border border-slate-200 bg-white shrink-0 shadow-sm'}/>:<span className={cls+' rounded-full bg-slate-100 border border-slate-200 grid place-items-center font-black text-slate-600 shrink-0'}>{initials}</span>
}
export function CollegeLogo({name,logoUrl,website,size='md'}:{name:string;logoUrl?:string|null;website?:string|null;size?:'sm'|'md'|'lg'}){
 let src=logoUrl||'';if(!src&&website){try{const host=new URL(website.startsWith('http')?website:'https://'+website).hostname;src='https://www.google.com/s2/favicons?domain='+encodeURIComponent(host)+'&sz=64'}catch{}}
 const cls=size==='lg'?'h-10 w-10':size==='sm'?'h-5 w-5':'h-7 w-7';
 return src?<img src={src} alt="" className={cls+' rounded-md object-contain bg-white border border-slate-200 p-0.5 shrink-0'}/>:<span className={cls+' rounded-md bg-white border border-slate-200 grid place-items-center text-[9px] font-black shrink-0'}>{String(name||'?')[0]}</span>
}
export function CollegeChip({name,logoUrl,website,rank,compact=false}:{name:string;logoUrl?:string|null;website?:string|null;rank?:number|null;compact?:boolean}){
 if(compact)return <span className="inline-flex items-center justify-center" title={name}><CollegeLogo name={name} logoUrl={logoUrl} website={website} size="md"/></span>;
 return <span className="rr-college-chip"><CollegeLogo name={name} logoUrl={logoUrl} website={website} size="sm"/><span className="truncate">{rank?rank+'. ':''}{name}</span></span>
}
export function HealthRing({score,size='md'}:{score:number;size?:'sm'|'md'|'lg'}){
 const n=Math.max(0,Math.min(100,Math.round(score||0))),px=size==='lg'?72:size==='sm'?42:54;
 return <div className="rr-health-ring" style={{width:px,height:px,background:'conic-gradient(var(--rr-health) '+(n*3.6)+'deg,#e9edf2 0)'}} aria-label={'Recruiting Health '+n+' out of 100'}><div>{n}</div></div>
}
export function PipelinePill({stage}:{stage:string}){
 const labels:any={building_list:'Building List',outreach:'Outreach',relationships:'Relationships',camps:'Camps',visits:'Visits',offers:'Offers',committed:'Committed'};
 return <span className={'rr-pipeline-pill rr-pipeline-'+(stage||'building_list')}>{labels[stage]||'Building List'}</span>
}
export function StatusPill({status,children}:{status:'active'|'offer'|'committed'|'attention'|'neutral';children:ReactNode}){return <span className={'rr-status-pill rr-status-'+status}>{children}</span>}
export function AttentionBadge({children}:{children:ReactNode}){return <span className="rr-attention-badge">{children}</span>}
