'use client';
import Link from 'next/link';
import {useMemo,useState} from 'react';
import {Plus,Search,School,Users} from 'lucide-react';
import PageHeader from '@/components/PageHeader';

export default function CollegesCoachesBoard({colleges,coaches}:{colleges:any[];coaches:any[]}){
  const [search,setSearch]=useState('');
  const q=search.trim().toLowerCase();
  const filteredColleges=useMemo(()=>colleges.filter((row:any)=>{
    if(!q)return true;
    const c=Array.isArray(row.colleges)?row.colleges[0]:row.colleges;
    return [c?.name,c?.division,c?.state,c?.city,row.status].filter(Boolean).join(' ').toLowerCase().includes(q);
  }),[colleges,q]);
  const filteredCoaches=useMemo(()=>coaches.filter((row:any)=>{
    if(!q)return true;
    const c=Array.isArray(row.colleges)?row.colleges[0]:row.colleges;
    const coach=Array.isArray(row.college_coaches)?row.college_coaches[0]:row.college_coaches;
    return [coach?.first_name,coach?.last_name,coach?.title,coach?.email,coach?.phone,c?.name,c?.state].filter(Boolean).join(' ').toLowerCase().includes(q);
  }),[coaches,q]);
  return <>
    <PageHeader title="Colleges & Coaches" subtitle="Keep your schools and coach relationships together in one place." action={<div className="flex flex-col gap-2"><Link href="/colleges/new" className="btn btn-red"><Plus size={18}/> Add College</Link><Link href="/coaches/new" className="btn"><Plus size={18}/> Add Coach</Link></div>}/>
    <div className="card p-3 mb-7 flex items-center gap-3"><Search size={18} className="muted"/><input className="w-full outline-none" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search colleges, coaches, states, divisions or titles"/></div>
    <section>
      <div className="flex items-center gap-2 mb-4"><School size={20}/><h2 className="font-black text-xl">Colleges</h2><span className="muted text-sm">{filteredColleges.length}</span></div>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">{filteredColleges.map((row:any)=>{const c=Array.isArray(row.colleges)?row.colleges[0]:row.colleges;return <Link href={`/colleges/${c?.id}`} key={row.id} className="card p-5 hover:shadow-md transition"><div className="flex justify-between gap-3"><div><div className="font-black text-lg">{c?.name||'College'}</div><div className="muted text-sm mt-1">{c?.division||'College'}{c?.state?` · ${c.state}`:''}</div></div><span className="pill">{row.status||'Researching'}</span></div><div className="mt-6 flex justify-between text-sm"><span className="muted">Fit</span><span className="font-bold">{row.fit_rating?`${row.fit_rating}/5`:'Not rated'}</span></div></Link>})}{!filteredColleges.length&&<div className="card p-8 md:col-span-2 xl:col-span-3 text-center"><div className="font-black">{q?'No colleges match your search.':'Start building your college list'}</div><p className="muted mt-2">{q?'Try a school name, state, division or recruiting status.':'Add schools you’re researching or already talking with.'}</p></div>}</div>
    </section>
    <section className="mt-9">
      <div className="flex items-center gap-2 mb-4"><Users size={20}/><h2 className="font-black text-xl">Coaches</h2><span className="muted text-sm">{filteredCoaches.length}</span></div>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">{filteredCoaches.map((row:any)=>{const c=Array.isArray(row.colleges)?row.colleges[0]:row.colleges;const coach=Array.isArray(row.college_coaches)?row.college_coaches[0]:row.college_coaches;return <div key={row.id} className="card p-5"><div className="font-black text-lg">{[coach?.first_name,coach?.last_name].filter(Boolean).join(' ')||'Coach'}</div><div className="muted text-sm mt-1">{coach?.title||'Coach'}{c?.name?` · ${c.name}`:''}</div>{coach?.email&&<div className="text-sm mt-3">{coach.email}</div>}<div className="mt-5 flex items-center justify-between gap-3"><span className="muted text-xs">{row.last_contact_date?`Last contact ${row.last_contact_date}`:'No contact logged yet'}</span>{c?.id&&coach?.id?<Link href={`/activity/new?college=${c.id}&coach=${coach.id}`} className="text-sm font-bold">Log Interaction</Link>:null}</div></div>})}{!filteredCoaches.length&&<div className="card p-8 md:col-span-2 xl:col-span-3 text-center"><div className="font-black">{q?'No coaches match your search.':'No coaches added yet'}</div><p className="muted mt-2">{q?'Try a coach name, school, title, email or state.':'Use Add Coach to connect a coach with one of your colleges.'}</p></div>}</div>
    </section>
  </>;
}
