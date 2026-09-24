'use client';
import {useEffect} from 'react';

const recent=new Map<string,number>();const REDACTED='[redacted]';
function safeMessage(value:unknown){return String(value||'').replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,REDACTED).replace(/\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,REDACTED).replace(/\b(?:Bearer\s+)?[A-Za-z0-9_-]{24,}\b/g,REDACTED).slice(0,1000)}
function report(payload:Record<string,unknown>){
  try{
    const key=`${String(payload.source||'')}|${String(payload.name||'')}|${String(payload.message||'')}|${location.pathname}`;
    const now=Date.now(),last=recent.get(key)||0;if(now-last<10000)return;recent.set(key,now);
    fetch('/api/telemetry/errors',{method:'POST',headers:{'Content-Type':'application/json'},keepalive:true,body:JSON.stringify({...payload,message:safeMessage(payload.message),path:location.pathname,online:navigator.onLine})}).catch(()=>{});
  }catch{}
}
export default function ProductionErrorMonitor(){
  useEffect(()=>{
    const onError=(event:ErrorEvent)=>report({source:'window.error',name:event.error?.name||'Error',message:event.error?.message||event.message||'Unhandled browser error',digest:''});
    const onRejection=(event:PromiseRejectionEvent)=>{const reason=event.reason;report({source:'unhandledrejection',name:reason?.name||'UnhandledRejection',message:reason?.message||String(reason||'Unhandled promise rejection'),digest:''})};
    window.addEventListener('error',onError);window.addEventListener('unhandledrejection',onRejection);
    return()=>{window.removeEventListener('error',onError);window.removeEventListener('unhandledrejection',onRejection)};
  },[]);return null;
}
