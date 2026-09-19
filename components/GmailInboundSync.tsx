'use client'

import {useEffect} from 'react'

const SYNC_KEY='rebels:gmail-inbound-last-sync'
const SYNC_INTERVAL_MS=5*60*1000

export default function GmailInboundSync(){
 useEffect(()=>{
  let cancelled=false
  const sync=async()=>{
   try{
    const last=Number(sessionStorage.getItem(SYNC_KEY)||'0')
    if(Date.now()-last<SYNC_INTERVAL_MS)return
    sessionStorage.setItem(SYNC_KEY,String(Date.now()))
    const res=await fetch('/api/google/gmail/sync',{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store'})
    if(cancelled)return
    if(res.ok){
     const data=await res.json().catch(()=>null) as {logged?:number}|null
     if((data?.logged||0)>0)window.dispatchEvent(new CustomEvent('rebels:data-changed',{detail:{source:'gmail-inbound',logged:data?.logged}}))
    }
   }catch{
    // Background sync must never interrupt the athlete experience.
   }
  }
  void sync()
  const onFocus=()=>void sync()
  window.addEventListener('focus',onFocus)
  return()=>{cancelled=true;window.removeEventListener('focus',onFocus)}
 },[])
 return null
}
