'use client';
import {useEffect,useRef,useState} from 'react';
import {CheckCircle2,X} from 'lucide-react';
import {SUCCESS_EVENT,SUCCESS_STORAGE_KEY} from '@/lib/feedback';

type Feedback={message:string;createdAt:number};
export default function SuccessFeedback(){
 const [feedback,setFeedback]=useState<Feedback|null>(null);const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 useEffect(()=>{
  const show=(next:Feedback)=>{setFeedback(next);if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(()=>setFeedback(null),3200)};
  try{const saved=sessionStorage.getItem(SUCCESS_STORAGE_KEY);if(saved){sessionStorage.removeItem(SUCCESS_STORAGE_KEY);show(JSON.parse(saved))}}catch{}
  const listener=(event:Event)=>show((event as CustomEvent<Feedback>).detail);
  window.addEventListener(SUCCESS_EVENT,listener as EventListener);
  return()=>{window.removeEventListener(SUCCESS_EVENT,listener as EventListener);if(timer.current)clearTimeout(timer.current)};
 },[]);
 if(!feedback)return null;
 return <div className="rr-success-toast" role="status" aria-live="polite"><CheckCircle2 size={18} aria-hidden="true"/><span>{feedback.message}</span><button type="button" aria-label="Dismiss confirmation" onClick={()=>setFeedback(null)}><X size={16}/></button></div>
}
