'use client';
import {useEffect,useMemo} from 'react';
import {CalendarDays,Check,ExternalLink,MapPin,Users,X} from 'lucide-react';
import {cleanEventText,normalizeEventUrl,extractEventUrl} from '@/lib/event-links';

type Attendee={athleteUserId:string;name:string;teamIds?:string[]};
type Team={id:string;name:string;going:Attendee[]};
type EventDetails={name:string;date:string;location?:string|null;description?:string|null;registration_url?:string|null;infoUrl?:string|null;url_text?:string|null;organizationName?:string|null;going?:Attendee[];teams?:Team[]};

function formattedTeam(orgName:string|undefined|null,teamName:string){
 const org=orgName==='Kansas City Rebels'?'KC Rebels':orgName||'Organization';
 return teamName.toLowerCase().startsWith(org.toLowerCase()+' ')?teamName:`${org} ${teamName}`;
}

function splitDescription(raw:string|undefined|null){
 const lines=cleanEventText(raw).split('\n').map(line=>line.trim()).filter(Boolean);
 const details:{label:string;value:string}[]=[];
 const narrative:string[]=[];
 let source='';
 for(const line of lines){
  const match=line.match(/^(Eligibility|Cost|Price|Fee|Age(?:s)?|Location|Check-in|Source)\s*:\s*(.+)$/i);
  if(!match){narrative.push(line);continue}
  const label=match[1].toLowerCase(),value=match[2].trim();
  if(label==='source'){source=value;continue}
  if(label==='check-in'){narrative.push(line);continue}
  details.push({label:label==='price'||label==='fee'?'Cost':label==='ages'||label==='age'?'Ages':match[1],value});
 }
 return{details,narrative,source};
}

export default function CalendarAttendanceModal({event,onClose}:{event:EventDetails;onClose:()=>void}){
 const content=useMemo(()=>splitDescription(event.description),[event.description]);
 const link=normalizeEventUrl(event.registration_url||event.infoUrl)||extractEventUrl(event.description,event.url_text);
 const date=event.date?new Date(`${event.date}T12:00:00`):null;
 const dateLabel=date&&!Number.isNaN(date.getTime())?date.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'}):event.date;
 const attendees=event.going||[];
 const teams=event.teams||[];
 const org=event.organizationName==='Kansas City Rebels'?'KC Rebels':event.organizationName||'Organization';
 useEffect(()=>{function closeOnEscape(e:KeyboardEvent){if(e.key==='Escape')onClose()}window.addEventListener('keydown',closeOnEscape);return()=>window.removeEventListener('keydown',closeOnEscape)},[onClose]);
 return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-3 sm:p-6" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
  <div role="dialog" aria-modal="true" aria-labelledby="attendance-event-title" className="w-full max-w-2xl max-h-[min(90vh,860px)] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
   <header className="border-b border-slate-200 px-5 pb-5 pt-5 sm:px-7 sm:pb-6 sm:pt-6">
    <div className="flex items-start justify-between gap-4">
     <div className="min-w-0">
      <div className="mb-2.5 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[.13em] text-red-600"><Users size={14}/>{org} Attendance</div>
      <h2 id="attendance-event-title" className="text-xl sm:text-2xl font-black leading-tight tracking-tight text-slate-900 break-words">{event.name}</h2>
     </div>
     <button type="button" onClick={onClose} aria-label="Close event details" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"><X size={18}/></button>
    </div>
    <div className="mt-5 flex flex-col gap-2.5 text-sm text-slate-600">
     <div className="flex items-start gap-2.5"><CalendarDays size={17} className="mt-0.5 shrink-0 text-slate-500"/><span className="font-semibold text-slate-700">{dateLabel}</span></div>
     {event.location&&<div className="flex items-start gap-2.5"><MapPin size={17} className="mt-0.5 shrink-0 text-slate-500"/><span className="leading-5">{event.location}</span></div>}
    </div>
   </header>
   <div className="space-y-6 px-5 py-6 sm:px-7">
    {(content.details.length>0||content.narrative.length>0||content.source||link)&&<section aria-label="Event information">
     <h3 className="mb-3 text-xs font-extrabold uppercase tracking-[.12em] text-slate-500">Event Details</h3>
     {content.details.length>0&&<div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">{content.details.map((detail,i)=><div key={i} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"><div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{detail.label}</div><div className="mt-1 text-sm font-bold leading-5 text-slate-900">{detail.value}</div></div>)}</div>}
     {content.narrative.length>0&&<div className="space-y-3 text-sm leading-6 text-slate-700">{content.narrative.map((line,i)=><p key={i}>{line}</p>)}</div>}
     {content.source&&<p className="mt-4 border-l-2 border-slate-200 pl-3 text-xs leading-5 text-slate-500"><span className="font-bold">Source:</span> {content.source}</p>}
     {link&&<a href={link} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-100"><ExternalLink size={15}/>Event Info / Registration</a>}
    </section>}
    <section className="border-t border-slate-200 pt-5" aria-label="Event attendance">
     <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h3 className="flex items-center gap-2 text-base font-black text-slate-900"><Users size={19}/>Players Attending</h3><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-extrabold text-slate-700">{attendees.length} {attendees.length===1?'player':'players'}</span></div>
     {attendees.length===0?<div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-7 text-center"><Users size={22} className="mx-auto mb-2 text-slate-400"/><p className="text-sm font-semibold text-slate-700">No {org} players have marked Going yet.</p><p className="mt-1 text-xs text-slate-500">Players who RSVP will appear here, grouped by team.</p></div>:<div className="space-y-3">
      {teams.filter(t=>t.going?.length).map(team=><div key={team.id} className="overflow-hidden rounded-xl border border-slate-200"><div className="flex items-center justify-between gap-2 bg-slate-50 px-4 py-3"><span className="text-sm font-extrabold text-slate-900">{formattedTeam(event.organizationName,team.name)}</span><span className="text-xs font-bold text-slate-500">{team.going.length} going</span></div><div className="divide-y divide-slate-100 px-4">{team.going.map(person=><div key={person.athleteUserId} className="flex items-center gap-2 py-3 text-sm font-semibold text-slate-700"><Check size={15} className="text-green-600"/>{person.name}</div>)}</div></div>)}
      {attendees.filter(p=>!p.teamIds?.length).length>0&&<div className="rounded-xl border border-slate-200 px-4 py-3"><div className="mb-2 text-sm font-bold text-slate-800">Team not assigned</div>{attendees.filter(p=>!p.teamIds?.length).map(person=><div key={person.athleteUserId} className="py-1 text-sm text-slate-700">{person.name}</div>)}</div>}
     </div>}
    </section>
   </div>
  </div>
 </div>;
}
