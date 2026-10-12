'use client';
import {useEffect,useMemo,useState} from 'react';
import {createClient} from '@/lib/supabase-browser';
import {academicSearchTerms,CollegeFitPrograms} from '@/lib/college-fit';

export function useCollegeFitPrograms(fit:any):CollegeFitPrograms{
  const client=useMemo(()=>createClient(),[]);
  const terms=academicSearchTerms(fit?.academic_interests);
  const key=terms.join('\u001f');
  const [state,setState]=useState<{key:string;known:Set<string>;matches:Record<string,string[]>}>({key:'',known:new Set(),matches:{}});
  useEffect(()=>{
    let active=true;
    if(!key){setState({key,known:new Set(),matches:{}});return()=>{active=false}}
    client.rpc('get_college_fit_program_matches',{search_terms:terms}).then(({data,error})=>{
      if(!active)return;
      if(error){console.error('College Fit program lookup unavailable',error);setState({key,known:new Set(),matches:{}});return}
      const known=new Set<string>(),matches:Record<string,string[]>={};
      for(const row of data||[]){known.add(row.college_id);if(Array.isArray(row.matched_titles)&&row.matched_titles.length)matches[row.college_id]=row.matched_titles}
      setState({key,known,matches});
    }).catch(error=>{if(active){console.error('College Fit program lookup unavailable',error);setState({key,known:new Set(),matches:{}})}});
    return()=>{active=false};
  },[client,key]);
  return{known:state.key===key?state.known:new Set(),matches:state.key===key?state.matches:{},pending:!!key&&state.key!==key};
}
