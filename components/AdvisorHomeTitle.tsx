'use client';
import {useEffect,useState} from 'react';
import {createClient} from '@/lib/supabase-browser';

export default function AdvisorHomeTitle(){
  const [name,setName]=useState('');
  useEffect(()=>{(async()=>{const c=createClient();const {data:{user}}=await c.auth.getUser();if(!user)return;const {data}=await c.from('profiles').select('full_name').eq('id',user.id).single();setName(data?.full_name?.split(' ')[0]||'')})()},[]);
  return <>Hello{name?`, ${name}`:''}.</>;
}
