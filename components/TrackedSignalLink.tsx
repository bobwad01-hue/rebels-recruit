'use client';
import Link from 'next/link';
import {useEffect,useRef} from 'react';
import {createClient} from '@/lib/supabase-browser';

type Props={href:string;className?:string;signalId:string;signalKind:string;surface?:string;athleteId?:string;children:React.ReactNode};

export default function TrackedSignalLink({href,className,signalId,signalKind,surface='next_steps',athleteId,children}:Props){
 const c=createClient(),shown=useRef(false);
 async function record(event_type:'shown'|'opened'){
  try{
   const{data:{user}}=await c.auth.getUser();if(!user)return;
   await c.from('recruiting_intelligence_events').insert({athlete_user_id:athleteId||user.id,actor_user_id:user.id,signal_id:signalId,signal_kind:signalKind,surface,event_type,metadata:{href}});
  }catch{}
 }
 useEffect(()=>{if(shown.current)return;shown.current=true;void record('shown')},[signalId]);
 return <Link href={href} className={className} onClick={()=>void record('opened')}>{children}</Link>
}
