'use client';
import {useEffect} from 'react';
import {usePathname,useRouter} from 'next/navigation';
import {DATA_CHANGED_EVENT} from '@/lib/feedback';

const relevant:Record<string,string[]>={
  '/':['interaction','connection','coach','reminder','event','event_rsvp','athlete_colleges','athlete_coaches','reminders','advisor_tasks'],
  '/dashboard':['interaction','connection','coach','reminder','event','event_rsvp','athlete_colleges','athlete_coaches','reminders','advisor_tasks'],
  '/connections':['connection','coach','athlete_colleges','athlete_coaches','interaction'],
  '/game-plan':['connection','reminder','event','event_rsvp','interaction','athlete_colleges','athlete_coaches','reminders','advisor_tasks'],
  '/journey':['interaction','connection','coach','athlete_colleges','athlete_coaches'],
  '/events':['event','event_rsvp'],
  '/discover':['connection','parent_school_advice'],
};

export default function DataChangeSync(){
 const router=useRouter(),pathname=usePathname();
 useEffect(()=>{
  let timer:number|undefined;
  const onChange=(event:Event)=>{
   const detail=(event as CustomEvent).detail||{},entity=String(detail.entity||'');
   const keys=Object.keys(relevant).filter(k=>pathname===k||pathname.startsWith(`${k}/`));
   if(!keys.some(k=>relevant[k].includes(entity)))return;
   if(timer)window.clearTimeout(timer);
   timer=window.setTimeout(()=>router.refresh(),40);
  };
  window.addEventListener(DATA_CHANGED_EVENT,onChange as EventListener);
  return()=>{if(timer)window.clearTimeout(timer);window.removeEventListener(DATA_CHANGED_EVENT,onChange as EventListener)};
 },[pathname,router]);
 return null;
}
