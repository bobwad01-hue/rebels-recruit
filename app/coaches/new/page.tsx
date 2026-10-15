'use client';
import {useEffect,useMemo,useState} from 'react';import Link from 'next/link';import AppShell from '@/components/AppShell';import CollegeSearchSelect from '@/components/CollegeSearchSelect';import {createClient} from '@/lib/supabase-browser';
export default function NewCoach(){const c=createClient();const [userId,setUserId]=useState('');const [colleges,setColleges]=useState<any[]>([]);const [collegeId,setCollegeId]=useState('');const [known,setKnown]=useState<any[]>([]);const [coachSearch,setCoachSearch]=useState('');const [existingCoachId,setExistingCoachId]=useState('');const [first,setFirst]=useState('');const [last,setLast]=useState('');const [title,setTitle]=useState('');const [email,setEmail]=useState('');const [phone,setPhone]=useState('');const [x,setX]=useState('');const [instagram,setInstagram]=useState('');const [msg,setMsg]=useState('');const [busy,setBusy]=useState(false);
useEffect(()=>{(async()=>{const params=new URLSearchParams(window.location.search);const presetCollege=params.get('college')||'';if(presetCollege)setCollegeId(presetCollege);const {data:{user}}=await c.auth.getUser();if(!user)return;setUserId(user.id);const allColleges:any[]=[];for(let from=0;from<20000;from+=1000){const {data}=await c.from('colleges').select('id,name,city,state,division,conference,school_type').order('name').range(from,from+999);allColleges.push(...(data||[]));if(!data||data.length<1000)break}const allCoaches:any[]=[];for(let from=0;from<20000;from+=500){const {data}=await c.from('college_coaches').select('id,college_id,first_name,last_name,title,email,phone,x_url,instagram_url,colleges!college_coaches_college_id_fkey(id,name,city,state,division,conference)').eq('lifecycle_status','active').order('last_name').order('id').range(from,from+499);allCoaches.push(...(data||[]));if(!data||data.length<500)break}setColleges(allColleges);setKnown(allCoaches);const presetCoach=params.get('coach');if(presetCoach){const chosen=allCoaches.find(k=>k.id===presetCoach);if(chosen)choose(chosen)}})()},[]);
const suggestions=useMemo(()=>{const q=coachSearch.trim().toLowerCase();if(q.length<2)return [];return known.filter(k=>{const col=Array.isArray(k.colleges)?k.colleges[0]:k.colleges;return [k.first_name,k.last_name,k.title,k.email,k.phone,col?.name,col?.state].filter(Boolean).join(' ').toLowerCase().includes(q)}).slice(0,12)},[known,coachSearch]);function clearCoach(){setExistingCoachId('');setFirst('');setLast('');setTitle('');setEmail('');setPhone('');setX('');setInstagram('')}function choose(k:any){const col=Array.isArray(k.colleges)?k.colleges[0]:k.colleges;setExistingCoachId(k.id);setCollegeId(k.college_id||col?.id||'');setFirst(k.first_name||'');setLast(k.last_name||'');setTitle(k.title||'');setEmail(k.email||'');setPhone(k.phone||'');setX(k.x_url||'');setInstagram(k.instagram_url||'');setCoachSearch(`${k.first_name||''} ${k.last_name||''}`.trim())}
async function save(e:React.FormEvent){
 e.preventDefault();
 if(!userId||!collegeId||!first.trim()||!last.trim())return;
 setBusy(true);setMsg('');
 const fail=(message:string)=>{setMsg(message);setBusy(false)};
 try{
  // The identity check runs at save time, not just against the first 5,000
  // records loaded for suggestions. A database trigger also guards races.
  const lookup=await c.from('college_coaches')
   .select('id,college_id,first_name,last_name,title,email,phone,x_url,instagram_url')
   .eq('college_id',collegeId).eq('lifecycle_status','active')
   .ilike('first_name',first.trim()).ilike('last_name',last.trim()).limit(2);
  if(lookup.error)throw lookup.error;
  let record:any=(lookup.data||[])[0]||null;
  if(existingCoachId){
   const selected=await c.from('college_coaches').select('id,college_id,first_name,last_name,title,email,phone,x_url,instagram_url').eq('id',existingCoachId).maybeSingle();
   if(selected.error)throw selected.error;
   if(selected.data){
    if(selected.data.college_id!==collegeId){
     fail('To report a coach changing schools, submit a coach update for review. Adding a relationship must not move a shared coach record.');
     return;
    }
    record=selected.data;
   }
  }
  if(!record){
   const inserted=await c.from('college_coaches').insert({
    college_id:collegeId,first_name:first.trim(),last_name:last.trim(),
    title:title||null,email:null,phone:null,x_url:null,
    instagram_url:null,updated_by_user_id:userId,verification_status:'unverified',
    source_note:'Unverified athlete-submitted coaching identity. Verify identity and contacts before sharing as confirmed staff.'
   }).select('id').single();
   if(inserted.error){
    // A concurrent request may have added the same coach just before ours.
    if(inserted.error.code!=='23505')throw inserted.error;
    const retry=await c.from('college_coaches')
     .select('id,college_id,first_name,last_name,title,email,phone,x_url,instagram_url')
     .eq('college_id',collegeId).eq('lifecycle_status','active')
     .ilike('first_name',first.trim()).ilike('last_name',last.trim()).maybeSingle();
    if(retry.error||!retry.data)throw inserted.error;
    record=retry.data;
   }else record={id:inserted.data.id,first_name:first.trim(),last_name:last.trim(),title,email:null,phone:null,x_url:null,instagram_url:null};
  }
  const coachId=record.id;
  const changes:any={};
  const differs=(a:string,b:string)=>Boolean(a.trim())&&a.trim().toLowerCase()!==String(b||'').trim().toLowerCase();
  if(differs(first,record.first_name))changes.proposed_first_name=first.trim();
  if(differs(last,record.last_name))changes.proposed_last_name=last.trim();
  if(differs(title,record.title))changes.proposed_title=title.trim();
  if(differs(email,record.email))changes.proposed_email=email.trim();
  if(differs(phone,record.phone))changes.proposed_phone=phone.trim();
  if(differs(x,record.x_url))changes.proposed_x_url=x.trim();
  if(Object.keys(changes).length||differs(instagram,record.instagram_url)){
   const suggestion=await c.from('college_coach_update_suggestions').insert({
    coach_id:coachId,submitted_by_user_id:userId,
    suggestion_type:changes.proposed_first_name||changes.proposed_last_name||changes.proposed_title?'incorrect_info':'contact_update',
    details:'Submitted when adding an athlete-coach relationship. Shared coach information remains unchanged until reviewed.'
      +(differs(instagram,record.instagram_url)?' Suggested Instagram: '+instagram.trim():''),
    ...changes
   });
   if(suggestion.error)throw new Error('The existing coach was found, but the proposed contact changes could not be submitted for review: '+suggestion.error.message);
  }
  // Linking a coach cannot reset an existing school's Recruiting Journey.
  const existingSchool=await c.from('athlete_colleges').select('id,archived_at')
   .eq('athlete_user_id',userId).eq('college_id',collegeId).maybeSingle();
  if(existingSchool.error)throw existingSchool.error;
  if(existingSchool.data?.archived_at){
   const restored=await c.from('athlete_colleges')
    .update({archived_at:null,archived_reason:null}).eq('id',existingSchool.data.id);
   if(restored.error)throw restored.error;
  }else if(!existingSchool.data){
   const added=await c.from('athlete_colleges').insert({
    athlete_user_id:userId,college_id:collegeId,status:'Researching'
   });
   if(added.error)throw added.error;
  }
  const linked=await c.from('athlete_coaches').select('id')
   .eq('athlete_user_id',userId).eq('coach_id',coachId).maybeSingle();
  if(linked.error)throw linked.error;
  const relationship=linked.data
   ?await c.from('athlete_coaches').update({college_id:collegeId,archived_at:null,archived_reason:null,...(!record.email&&email.trim()?{email_override:email.trim().toLowerCase(),email_override_updated_at:new Date().toISOString()}:{})}).eq('id',linked.data.id)
   :await c.from('athlete_coaches').insert({athlete_user_id:userId,college_id:collegeId,coach_id:coachId,archived_at:null,archived_reason:null,...(!record.email&&email.trim()?{email_override:email.trim().toLowerCase(),email_override_updated_at:new Date().toISOString()}:{})});
  if(relationship.error)throw relationship.error;
  const params=new URLSearchParams(window.location.search);
  const returnTo=params.get('returnTo');
  location.href=returnTo&&returnTo.startsWith('/')?returnTo:'/colleges';
 }catch(error:any){fail(error?.message||'Could not add this coach relationship. Please try again.')}
}

return <AppShell><div className="max-w-xl mx-auto px-5 md:px-8 py-8"><Link href="/colleges" className="text-sm font-bold">← Back to Schools & Coaches</Link><div className="card p-6 mt-5"><h1 className="text-2xl font-black">Add a coach</h1><p className="muted mt-1">Search the shared RLTNL Recruiting coach directory first. If another player has already added the coach, their information will be ready for you to use.</p><form onSubmit={save} className="space-y-4 mt-7"><div><label className="text-sm font-bold">Find a coach</label><input className="input mt-1" placeholder="Type a coach name, school or email" value={coachSearch} onChange={e=>{setCoachSearch(e.target.value);if(existingCoachId)clearCoach()}}/>{suggestions.length>0&&<div className="border rounded-xl mt-2 divide-y overflow-hidden max-h-80 overflow-y-auto">{suggestions.map(k=>{const col=Array.isArray(k.colleges)?k.colleges[0]:k.colleges;return <button type="button" key={k.id} onClick={()=>choose(k)} className="w-full text-left p-3 hover:bg-slate-50"><div className="font-bold">{k.first_name} {k.last_name}</div><div className="muted text-xs">{k.title||'Coach'}{col?.name?` · ${col.name}`:''}{k.email?` · ${k.email}`:''}</div></button>})}</div>}</div>{existingCoachId&&<div className="rounded-xl bg-green-50 border border-green-200 p-3 text-sm"><b>Shared coach found.</b> Connect this coach with one click. You can add an email address later in the composer if RLTNL doesn't have one. Coach corrections have a separate review process.</div>}<div><label className="text-sm font-bold">Current school</label><div className="mt-1"><CollegeSearchSelect colleges={colleges} value={collegeId} onChange={setCollegeId} allowNone={false}/></div></div>{!existingCoachId&&<div className="grid grid-cols-2 gap-4"><input className="input" placeholder="First name" value={first} onChange={e=>setFirst(e.target.value)} required/><input className="input" placeholder="Last name" value={last} onChange={e=>setLast(e.target.value)} required/></div>}{!existingCoachId&&<><select className="input" value={title} onChange={e=>setTitle(e.target.value)}><option value="">Title (optional)</option><option value="Head Coach">Head Coach</option><option value="Assistant Coach">Assistant Coach</option><option value="Recruiting Coordinator">Recruiting Coordinator</option><option value="Other">Other</option></select><label className="block text-xs font-semibold text-slate-600">Email (optional; saved for your own outreach, pending RLTNL verification)<input className="input mt-1" type="email" placeholder="coach@school.edu" value={email} onChange={e=>setEmail(e.target.value)}/></label><details className="rounded-xl border p-3"><summary className="cursor-pointer text-sm font-bold">Other contact information (optional)</summary><div className="mt-3 space-y-3"><input className="input" placeholder="Phone" value={phone} onChange={e=>setPhone(e.target.value)}/><input className="input" placeholder="X/Twitter URL" value={x} onChange={e=>setX(e.target.value)}/><input className="input" placeholder="Instagram URL" value={instagram} onChange={e=>setInstagram(e.target.value)}/></div><p className="mt-2 text-xs text-slate-600">These details go to RLTNL for review. They are not automatically added as verified shared contacts.</p></details></>}{msg&&<p className="text-sm text-red-600">{msg}</p>}<button className="btn btn-red w-full" disabled={busy||!collegeId}>{busy?'Saving...':existingCoachId?'Connect Coach':'Add New Coach'}</button></form></div></div></AppShell>}
