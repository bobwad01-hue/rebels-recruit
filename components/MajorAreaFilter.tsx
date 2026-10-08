'use client';
import {useEffect,useMemo,useState} from 'react';
import {majorLabel,majorMeta} from '@/lib/major-catalog';

type Props={selected:string[];options:string[];onChange:(next:string[])=>void};

export default function MajorAreaFilter({selected,options,onChange}:Props){
 const [search,setSearch]=useState('');
 useEffect(()=>{if(!selected.length)setSearch('')},[selected.length]);
 const query=search.trim().toLowerCase();
 const suggestions=useMemo(()=>{
  if(!query)return[];
  return options.filter(m=>{
   if(selected.includes(m))return false;
   const x=majorMeta(m);
   return x.label.toLowerCase().includes(query)||m.toLowerCase().includes(query)||x.terms.some(t=>t.includes(query)||query.includes(t));
  }).sort((a,b)=>{
   const al=majorLabel(a).toLowerCase(),bl=majorLabel(b).toLowerCase();
   const ae=al===query?0:al.startsWith(query)?1:2,be=bl===query?0:bl.startsWith(query)?1:2;
   return ae-be||al.localeCompare(bl);
  }).slice(0,12);
 },[options,query,selected]);
 const exact=options.find(m=>m.toLowerCase()===query&&!selected.includes(m));
 const add=(m:string)=>{if(!m||selected.includes(m))return;onChange([...selected,m]);setSearch('')};
 return <div className="min-w-0">
  <label htmlFor="major-area-search" className="text-xs font-bold muted">Major / Area of Study</label>
  <div className="relative mt-1">
   <div className="flex gap-2">
    <input id="major-area-search" className="input min-w-0 flex-1" value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&(exact||suggestions.length)){e.preventDefault();add(exact||suggestions[0])}}} placeholder="Search majors..." autoComplete="off" aria-label="Search majors or areas of study"/>
    <button type="button" className="btn shrink-0" disabled={!exact} onClick={()=>exact&&add(exact)}>Add</button>
   </div>
   {query&&suggestions.length>0&&<div className="absolute z-30 left-0 right-0 top-full mt-1 max-h-56 overflow-y-auto rounded-xl border bg-white shadow-xl p-1">{suggestions.map(m=><button key={m} type="button" className="block w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-slate-100" onClick={()=>add(m)}>{majorLabel(m)}</button>)}</div>}
  </div>
  {selected.length>0&&<div className="flex flex-wrap gap-1.5 mt-2">{selected.map(m=><button key={m} type="button" onClick={()=>onChange(selected.filter(x=>x!==m))} className="px-2.5 py-1 rounded-full border bg-white text-xs font-bold" aria-label={'Remove '+majorLabel(m)}>{majorLabel(m)} ×</button>)}</div>}
  <p className="text-[11px] muted mt-1">{selected.length?'Schools offering any selected area of study.':'Add one or more areas of study.'}</p>
 </div>;
}
