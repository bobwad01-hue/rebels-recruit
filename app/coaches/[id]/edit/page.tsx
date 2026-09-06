'use client';
import {useEffect,useState} from 'react';
import {useParams} from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import {createClient} from '@/lib/supabase-browser';

type CoachRecord={
  id:string;
  college_id:string|null;
  previous_college_id:string|null;
  first_name:string|null;
  last_name:string|null;
  title:string|null;
  email:string|null;
  phone:string|null;
  x_url:string|null;
  instagram_url:string|null;
};

export default function EditCoach(){
  const {id}=useParams<{id:string}>();
  const c=createClient();
  const [userId,setUserId]=useState('');
  const [colleges,setColleges]=useState<any[]>([]);
  const [collegeId,setCollegeId]=useState('');
  const [previousCollege,setPreviousCollege]=useState('');
  const [first,setFirst]=useState('');
  const [last,setLast]=useState('');
  const [title,setTitle]=useState('');
  const [email,setEmail]=useState('');
  const [phone,setPhone]=useState('');
  const [x,setX]=useState('');
  const [instagram,setInstagram]=useState('');
  const [msg,setMsg]=useState('');
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    (async()=>{
      const {data:{user}}=await c.auth.getUser();
      if(!user){setLoading(false);return;}
      setUserId(user.id);

      const [{data:cols},{data:coachData}]=await Promise.all([
        c.from('colleges').select('id,name,state').order('name').limit(2500),
        c.from('college_coaches').select('id,college_id,previous_college_id,first_name,last_name,title,email,phone,x_url,instagram_url').eq('id',id).single()
      ]);
      setColleges(cols||[]);

      const coach=coachData as CoachRecord|null;
      if(coach){
        setCollegeId(coach.college_id||'');
        setFirst(coach.first_name||'');
        setLast(coach.last_name||'');
        setTitle(coach.title||'');
        setEmail(coach.email||'');
        setPhone(coach.phone||'');
        setX(coach.x_url||'');
        setInstagram(coach.instagram_url||'');
        if(coach.previous_college_id){
          const {data:previous}=await c.from('colleges').select('name').eq('id',coach.previous_college_id).maybeSingle();
          setPreviousCollege(previous?.name||'');
        }
      }
      setLoading(false);
    })();
  },[id]);

  async function save(e:React.FormEvent){
    e.preventDefault();
    setBusy(true);
    setMsg('');
    const {error}=await c.from('college_coaches').update({
      college_id:collegeId,
      first_name:first.trim(),
      last_name:last.trim(),
      title:title||null,
      email:email||null,
      phone:phone||null,
      x_url:x||null,
      instagram_url:instagram||null,
      updated_by_user_id:userId,
      source_note:'Community-updated in Rebels Recruit'
    }).eq('id',id);
    if(error){setMsg(error.message);setBusy(false);return;}
    setMsg('Coach information updated for the Rebels Recruit community.');
    setBusy(false);
  }

  return <AppShell><div className="max-w-xl mx-auto px-5 md:px-8 py-8"><Link href="/colleges" className="text-sm font-bold">← Back to Colleges & Coaches</Link>{loading?<div className="card p-8 mt-5 text-center muted">Loading...</div>:<div className="card p-6 mt-5"><h1 className="text-2xl font-black">Edit shared coach</h1><p className="muted mt-1">Updates here improve this coach record for everyone using Rebels Recruit.</p>{previousCollege&&<div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm">Previous school on record: <b>{previousCollege}</b></div>}<form onSubmit={save} className="space-y-4 mt-7"><div><label className="text-sm font-bold">Current college</label><select className="input mt-1" value={collegeId} onChange={e=>setCollegeId(e.target.value)} required><option value="">Choose a college</option>{colleges.map((col:any)=><option key={col.id} value={col.id}>{col.name}{col.state?` · ${col.state}`:''}</option>)}</select></div><div className="grid grid-cols-2 gap-4"><input className="input" placeholder="First name" value={first} onChange={e=>setFirst(e.target.value)} required/><input className="input" placeholder="Last name" value={last} onChange={e=>setLast(e.target.value)} required/></div><select className="input" value={title} onChange={e=>setTitle(e.target.value)}><option value="">Select title</option><option value="Head Coach">Head Coach</option><option value="Assistant Coach">Assistant Coach</option><option value="Recruiting Coordinator">Recruiting Coordinator</option><option value="Other">Other</option></select><input className="input" type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)}/><input className="input" placeholder="Phone" value={phone} onChange={e=>setPhone(e.target.value)}/><input className="input" placeholder="X/Twitter URL" value={x} onChange={e=>setX(e.target.value)}/><input className="input" placeholder="Instagram URL" value={instagram} onChange={e=>setInstagram(e.target.value)}/>{msg&&<p className={`text-sm ${msg.startsWith('Coach information')?'text-green-700':'text-red-600'}`}>{msg}</p>}<button className="btn btn-red w-full" disabled={busy}>{busy?'Saving...':'Save shared coach'}</button></form></div>}</div></AppShell>;
}
