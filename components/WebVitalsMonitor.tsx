'use client';

import {useEffect} from 'react';

type MetricName='LCP'|'INP'|'CLS';
const budgets:Record<MetricName,number>={LCP:2500,INP:200,CLS:.1};

export default function WebVitalsMonitor(){
 useEffect(()=>{
  let route=location.pathname,lcp=0,sent=false;
  let clsValue=0,sessionValue=0,sessionStart=0,sessionLast=0;
  const interactions=new Map<number,number>();
  const observers:PerformanceObserver[]=[];
  const reset=()=>{route=location.pathname;lcp=0;sent=false;clsValue=0;sessionValue=0;sessionStart=0;sessionLast=0;interactions.clear()};
  const send=(metric:MetricName,value:number)=>{if(!Number.isFinite(value)||value<0)return;const budget=budgets[metric],payload={type:'web-vital',metric,value,budget,overBudget:value>budget,route,ts:new Date().toISOString()};try{if(navigator.sendBeacon('/api/telemetry/vitals',new Blob([JSON.stringify(payload)],{type:'application/json'})))return}catch{}fetch('/api/telemetry/vitals',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),keepalive:true}).catch(()=>{})};
  // INP is the high-percentile interaction latency, not the single slowest event entry.
  // Group event-timing entries by interactionId, retain each interaction's max duration,
  // then use the same 98th-percentile-by-interaction principle used by web-vitals.
  const inpValue=()=>{const values=[...interactions.values()].sort((a,b)=>b-a);if(!values.length)return 0;return values[Math.min(values.length-1,Math.floor(values.length/50))]||0};
  const flush=()=>{if(sent)return;sent=true;if(lcp>0)send('LCP',lcp);send('CLS',clsValue);const inp=inpValue();if(inp>0)send('INP',inp)};
  const onVisibility=()=>{if(document.visibilityState==='hidden')flush()};const onPageHide=()=>flush();const onRoute=()=>{if(location.pathname===route)return;flush();reset()};
  document.addEventListener('visibilitychange',onVisibility);window.addEventListener('pagehide',onPageHide);window.addEventListener('popstate',onRoute);
  const originalPush=history.pushState,originalReplace=history.replaceState;
  history.pushState=function(data:any,unused:string,url?:string|URL|null){originalPush.call(history,data,unused,url);queueMicrotask(onRoute)};
  history.replaceState=function(data:any,unused:string,url?:string|URL|null){originalReplace.call(history,data,unused,url);queueMicrotask(onRoute)};
  try{const o=new PerformanceObserver(list=>{for(const e of list.getEntries() as any[]){if(e.hadRecentInput)continue;const t=Number(e.startTime)||0,v=Number(e.value)||0;if(!sessionStart||t-sessionLast>1000||t-sessionStart>5000){sessionStart=t;sessionValue=0}sessionValue+=v;sessionLast=t;clsValue=Math.max(clsValue,sessionValue)}});o.observe({type:'layout-shift',buffered:true} as any);observers.push(o)}catch{}
  try{const o=new PerformanceObserver(list=>{const entries=list.getEntries();const e=entries[entries.length-1] as any;if(e)lcp=Math.max(lcp,Number(e.startTime)||0)});o.observe({type:'largest-contentful-paint',buffered:true} as any);observers.push(o)}catch{}
  try{const o=new PerformanceObserver(list=>{for(const e of list.getEntries() as any[]){const id=Number(e.interactionId)||0;if(!id)continue;interactions.set(id,Math.max(interactions.get(id)||0,Number(e.duration)||0))}});o.observe({type:'event',buffered:true,durationThreshold:40} as any);observers.push(o)}catch{}
  return()=>{flush();observers.forEach(o=>o.disconnect());document.removeEventListener('visibilitychange',onVisibility);window.removeEventListener('pagehide',onPageHide);window.removeEventListener('popstate',onRoute);history.pushState=originalPush;history.replaceState=originalReplace};
 },[]);return null;
}
