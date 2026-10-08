'use client';
import {useEffect,useState} from 'react';
import {createClient} from '@/lib/supabase-browser';

type SchoolWithProgramData={id:string;ipeds_unitid?:number|null};

// Academic programs are based on IPEDS completion records. An unknown program
// record must never be presented as a confirmed match or a confirmed mismatch.
export function useMajorAreaData(schools:SchoolWithProgramData[]){
 const c=createClient();
 const [majors,setMajors]=useState<string[]>([]);
 const [options,setOptions]=useState<string[]>([]);
 const [matchedIds,setMatchedIds]=useState<Set<string>>(new Set());
 const [knownIds,setKnownIds]=useState<Set<string>>(new Set());
 const [resolvedKey,setResolvedKey]=useState('');
 const [error,setError]=useState(false);
 const selectionKey=majors.join('\u001f')+'|'+schools.length;
 const checking=majors.length>0&&resolvedKey!==selectionKey;

 useEffect(()=>{
  let active=true;
  (async()=>{
   const titles:string[]=[];
   for(let from=0;from<5000;from+=1000){
    const{data,error}=await c.from('college_program_catalog').select('cip_title').order('cip_title').range(from,from+999);
    if(error){console.error('Major catalog lookup failed',error);break}
    titles.push(...(data||[]).map((x:any)=>String(x.cip_title)).filter(Boolean));
    if(!data||data.length<1000)break;
   }
   if(active)setOptions([...new Set(titles)]);
  })();
  return()=>{active=false};
 },[]);

 useEffect(()=>{
  let active=true;
  if(!majors.length){
   setMatchedIds(new Set());
   setKnownIds(new Set());
   setError(false);
   setResolvedKey(selectionKey);
   return;
  }
  (async()=>{
   const matches=new Set<string>();
   const known=new Set<string>(schools.filter(s=>s.ipeds_unitid!=null).map(s=>s.id));
   let failed=false;
   for(const title of majors){
    for(let from=0;from<100000;from+=1000){
     const{data,error}=await c.from('college_programs').select('college_id').eq('cip_title',title).range(from,from+999);
     if(error){console.error('Major lookup failed',error);failed=true;break}
     for(const p of data||[])matches.add(p.college_id);
     if(!data||data.length<1000)break;
    }
    if(failed)break;
   }
   if(!active)return;
   setMatchedIds(failed?new Set():matches);
   setKnownIds(failed?new Set():known);
   setError(failed);
   setResolvedKey(selectionKey);
  })();
  return()=>{active=false};
 },[selectionKey,schools]);

 return{majors,setMajors,majorOptions:options,majorSchoolIds:matchedIds,majorKnownIds:knownIds,majorChecking:checking,majorError:error&&!checking};
}
