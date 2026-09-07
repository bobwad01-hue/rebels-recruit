'use client';
import {useMemo,useState} from 'react';
import {Search,X} from 'lucide-react';

type College={id:string;name:string;division?:string|null};

type Props={
  colleges:College[];
  value:string;
  onChange:(collegeId:string)=>void;
  placeholder?:string;
};

export default function CollegeSearchSelect({colleges,value,onChange,placeholder='Search college...'}:Props){
  const selected=colleges.find(c=>c.id===value)||null;
  const [query,setQuery]=useState('');
  const [open,setOpen]=useState(false);
  const matches=useMemo(()=>{
    const q=query.trim().toLowerCase();
    if(!q)return colleges.slice(0,12);
    return colleges.filter(c=>c.name.toLowerCase().includes(q)).slice(0,20);
  },[colleges,query]);

  return <div className="relative">
    <div className="input flex items-center gap-2 px-3">
      <Search size={16} className="muted shrink-0"/>
      <input
        className="min-w-0 flex-1 bg-transparent outline-none"
        value={open?query:(selected?.name||'')}
        placeholder={selected?'':placeholder}
        onFocus={()=>{setOpen(true);setQuery('')}}
        onChange={e=>{setQuery(e.target.value);setOpen(true)}}
        onBlur={()=>window.setTimeout(()=>setOpen(false),120)}
        aria-label="Search college"
        autoComplete="off"
      />
      {value&&<button type="button" className="muted shrink-0" aria-label="Clear college" onMouseDown={e=>e.preventDefault()} onClick={()=>{onChange('');setQuery('');setOpen(false)}}><X size={15}/></button>}
    </div>
    {open&&<div className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border bg-white shadow-lg">
      <button type="button" className="block w-full px-3 py-2.5 text-left text-sm hover:bg-slate-50" onMouseDown={e=>e.preventDefault()} onClick={()=>{onChange('');setQuery('');setOpen(false)}}>No college</button>
      {matches.map(col=><button key={col.id} type="button" className="block w-full border-t px-3 py-2.5 text-left hover:bg-slate-50" onMouseDown={e=>e.preventDefault()} onClick={()=>{onChange(col.id);setQuery('');setOpen(false)}}><div className="text-sm font-semibold">{col.name}</div>{col.division&&<div className="muted mt-0.5 text-xs">{col.division}</div>}</button>)}
      {!matches.length&&<div className="px-3 py-3 text-sm muted">No matching colleges</div>}
    </div>}
  </div>
}
