'use client';
import {useEffect,useState} from 'react';
import {createClient} from '@/lib/supabase-browser';
import {DEFAULT_TIMEZONE,getGreetingForTimezone} from '@/lib/us-timezones';

export default function AdvisorHomeTitle(){
  const [name,setName]=useState('');
  const [greeting,setGreeting]=useState('Hello');
  useEffect(()=>{(async()=>{const c=createClient();const {data:{user}}=await c.auth.getUser();if(!user)return;const {data}=await c.from('profiles').select('full_name,timezone').eq('id',user.id).single();setName(data?.full_name?.split(' ')[0]||'');setGreeting(getGreetingForTimezone(data?.timezone||DEFAULT_TIMEZONE))})()},[]);
  return <>{greeting}{name?`, ${name}`:''}.</>;
}
