'use client';

import {useEffect,useMemo,useState} from 'react';
import {CalendarDays,ExternalLink,Search,Users} from 'lucide-react';
import CalendarAttendanceModal from '@/components/CalendarAttendanceModal';

type EventRow={
 id:string;name:string;date:string;location?:string|null;description?:string|null;
 registration_url?:string|null;calendarName?:string|null;organizationName?:string|null;
 allTeams?:boolean;teamNames?:string[];organizationId?:string;_source?:string;
};
type Attendance={going:any[];teams:any[]};
const fmt=(date:string)=>new Date(`${date}T12:00:00`).toLocaleDateString('en-US',{month:'2-digit',day:'2-digit',year:'numeric'});
function calendarLink(event:EventRow){
 const date=event.date.replace(/-/g,'');
 const next=new Date(`${event.date}T00:00:00Z`);next.setUTCDate(next.getUTCDate()+1);
 const params=new URLSearchParams({action:'TEMPLATE',text:event.name,dates:`${date}/${next.toISOString().slice(0,10).replace(/-/g,'')}`,location:event.location||'',details:event.registration_url||''});
 return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
export default function ParentSubscribedEvents({athleteId,preview}:{athleteId:string;preview:boolean}){
 const [events,setEvents]=useState<EventRow[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [query,setQuery]=useState('');
 const [visibleCount,setVisibleCount]=useState(5);
 const [attendance,setAttendance]=useState<Record<string,Attendance>>({});
 const [selected,setSelected]=useState<EventRow|null>(null);
 const [selectedLoading,setSelectedLoading]=useState(false);
 const params=useMemo(()=>{
  const p=new URLSearchParams();
  if(preview){p.set('previewRole','parent');p.set('previewAthlete',athleteId)}
  else p.set('parentAthlete',athleteId);
  return p.toString();
 },[preview,athleteId]);
 useEffect(()=>{
  let alive=true;
  setLoading(true);setError('');setEvents([]);setAttendance({});setVisibleCount(5);setSelected(null);
  fetch(`/api/calendar-subscriptions?${params}`,{cache:'no-store'})
   .then(async response=>{const json=await response.json();if(!response.ok)throw new Error(json.error||'Subscribed events could not be loaded.');return json})
   .then(data=>{if(alive)setEvents(data.events||[])})
   .catch(e=>{if(alive)setError(e instanceof Error?e.message:'Subscribed events could not be loaded.')})
   .finally(()=>{if(alive)setLoading(false)});
  return()=>{alive=false};
 },[params]);
 const upcoming=useMemo(()=>{
  const today=new Date().toISOString().slice(0,10),needle=query.trim().toLowerCase();
  return events.filter(e=>e.date>=today&&(!needle||[e.name,e.location,e.calendarName,e.description].some(v=>String(v||'').toLowerCase().includes(needle)))).sort((a,b)=>a.date.localeCompare(b.date)||a.name.localeCompare(b.name));
 },[events,query]);
 const visible=useMemo(()=>upcoming.slice(0,visibleCount),[upcoming,visibleCount]);
 useEffect(()=>{
  if(!visible.length)return;
  let alive=true;
  // Only request counts for the currently visible cards, rather than all subscribed events.
  Promise.all(visible.filter(e=>!attendance[e.id]).map(async event=>{
   try{
    const response=await fetch(`/api/events/rsvp?eventId=${encodeURIComponent(event.id)}&${params}`,{cache:'no-store'});
    if(!response.ok)return null;
    const data=await response.json();
    return {id:event.id,going:data.going||[],teams:data.teams||[]};
   }catch{return null}
  })).then(results=>{
   if(!alive)return;
   setAttendance(old=>{const next={...old};for(const item of results)if(item)next[item.id]={going:item.going,teams:item.teams};return next});
  });
  return()=>{alive=false};
 // Counts are refreshed when the visible event list changes, not on every count update.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[visible,params]);
 async function openEvent(event:EventRow){
  setSelected(event);
  if(attendance[event.id])return;
  setSelectedLoading(true);
  try{
   const response=await fetch(`/api/events/rsvp?eventId=${encodeURIComponent(event.id)}&${params}`,{cache:'no-store'});
   if(response.ok){const data=await response.json();setAttendance(old=>({...old,[event.id]:{going:data.going||[],teams:data.teams||[]}}))}
  }finally{setSelectedLoading(false)}
 }
 return <section className="mb-6" aria-label="Upcoming recruiting opportunities">
  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
   <h2 className="flex items-center gap-2 text-lg font-black text-slate-900"><CalendarDays size={19}/>Upcoming Recruiting Events <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-bold text-slate-700">{loading?'…':upcoming.length}</span></h2>
  </div>
  <p className="mb-4 text-sm text-slate-600">Camps and recruiting opportunities shared by your athlete's organization and team. Attendance is managed by the athlete.</p>
  <div className="mb-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
   <Search size={17} className="shrink-0 text-slate-400"/>
   <input aria-label="Search recruiting events" value={query} onChange={e=>{setQuery(e.target.value);setVisibleCount(5)}} placeholder="Search events, schools, locations…" className="w-full min-w-0 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"/>
  </div>
  {error&&<div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
  {loading?<div className="rounded-xl border bg-white p-6 text-center text-sm text-slate-500">Loading shared recruiting events…</div>:
   visible.length?<div className="space-y-3">{visible.map(event=>{
    const count=attendance[event.id]?.going.length;
    return <article key={event.id} className="rounded-xl border border-slate-200 bg-white px-4 py-4 sm:px-5">
     <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
       <button type="button" onClick={()=>void openEvent(event)} className="block text-left text-sm font-black leading-5 text-slate-900 hover:text-red-700 hover:underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-600">{event.name}</button>
       <p className="mt-1 text-xs leading-5 text-slate-600">{fmt(event.date)}{event.location?' · '+event.location:''}</p>
       <p className="mt-0.5 text-xs text-slate-500">From {event.calendarName||'Shared Calendar'} · {event.allTeams?'All organization teams':event.teamNames?.join(', ')||'Team event'}</p>
       <button type="button" onClick={()=>void openEvent(event)} className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-red-700 hover:underline"><Users size={13}/>{count===undefined?'View KC Rebels Attendance':`${count} KC Rebels ${count===1?'Player':'Players'} Attending`} · See Teams</button>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
       <button type="button" onClick={()=>void openEvent(event)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">View Details <ExternalLink size={13}/></button>
       <a href={calendarLink(event)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Add to Google Calendar <ExternalLink size={13}/></a>
      </div>
     </div>
    </article>;
   })}
   {upcoming.length>visibleCount&&<div className="flex justify-center pt-2"><button type="button" onClick={()=>setVisibleCount(v=>v+5)} className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 hover:bg-slate-50">Load More ({upcoming.length-visibleCount} More)</button></div>}
   </div>:!error&&<div className="rounded-xl border border-dashed border-slate-200 bg-white px-5 py-8 text-center text-sm text-slate-600">{query?'No shared events match your search.':'No upcoming shared recruiting events are available for this athlete.'}</div>}
  {selected&&<CalendarAttendanceModal event={{...selected,going:attendance[selected.id]?.going||[],teams:attendance[selected.id]?.teams||[]}} onClose={()=>{setSelected(null);setSelectedLoading(false)}}/>}
  {selected&&selectedLoading&&<span className="sr-only" role="status">Loading event attendance…</span>}
 </section>;
}
