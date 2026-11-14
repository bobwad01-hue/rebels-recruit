'use client';
import {useRouter} from 'next/navigation';
import {useTransition} from 'react';

type School={id:string;name:string};
export default function OfferSchoolPicker({schools,selected}:{schools:School[];selected:string}){
 const router=useRouter();
 const [pending,startTransition]=useTransition();
 return <label className="block text-sm font-bold" htmlFor="school">School
 <select id="school" name="school" value={selected} disabled={pending} onChange={e=>{const id=e.target.value;startTransition(()=>router.push('/offers?school='+encodeURIComponent(id)+'#offer-editor'));}} className="input mt-1 block w-full max-w-md">
 {schools.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}
 </select>{pending&&<span role="status" className="mt-1 block text-xs font-normal text-slate-500">Loading school offer…</span>}
 </label>;
}
