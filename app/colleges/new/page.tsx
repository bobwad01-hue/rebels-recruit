'use client';
import {useEffect,useState} from 'react';import Link from 'next/link';import AppShell from '@/components/AppShell';import {createClient} from '@/lib/supabase-browser';import {saveAthleteSchoolTarget} from '@/lib/save-athlete-school-target';import {emitDataChanged} from '@/lib/data-events';
const CONFERENCE_ALIASES:Record<string,string>={sec:'Southeastern Conference',b1g:'Big Ten Conference','big 10':'Big Ten Conference','big ten':'Big Ten Conference',acc:'Atlantic Coast Conference',aac:'American Athletic Conference',mac:'Mid-American Conference',mvc:'Missouri Valley Conference',wcc:'West Coast Conference',caa:'Colonial Athletic Association',swac:'Southwestern Athletic Conference',meac:'Mid-Eastern Athletic Conference',wac:'Western Athletic Conference',rmAC:'Rocky Mountain Athletic Conference',kjccc:'KJCCC'};
export default function NewCollege(){const c=createClient();const [name,setName]=useState('');const [selected,setSelected]=useState<any>(null);const [matches,setMatches]=useState<any[]>([]);const [city,setCity]=useState('');const [state,setState]=useState('');const [division,setDivision]=useState('');const [conference,setConference]=useState('');const [website,setWebsite]=useState('');const [status,setStatus]=useState('Researching');const [fit,setFit]=useState('');const [msg,setMsg]=useState('');const [busy,setBusy]=useState(false);
useEffect(()=>{const q=name.trim();if(selected||q.length<2){setMatches([]);return}const timer=setTimeout(async()=>{const alias=CONFERENCE_ALIASES[q.toLowerCase()]||q;const safe=alias.replace(/[%_,()]/g,' ');const {data}=await c.from('colleges').select('id,name,city,state,division,conference,school_type,website,logo_url').or(`name.ilike.%${safe}%,city.ilike.%${safe}%,state.ilike.%${safe}%,division.ilike.%${safe}%,conference.ilike.%${safe}%`).order('name').limit(12);setMatches(data||[])},180);return()=>clearTimeout(timer)},[name,selected]);
function choose(s:any){setSelected(s);setName(s.name);setCity(s.city||'');setState(s.state||'');setDivision(s.division||'');setConference(s.conference||'');setWebsite(s.website||'');setMatches([])}
async function save(e:React.FormEvent){
 e.preventDefault();if(busy)return;setBusy(true);setMsg('');
 try{
  const {data:{user},error:authError}=await c.auth.getUser();
  if(authError||!user)throw new Error('Please sign in as an athlete to add a school.');
  let school=selected;
  if(!school){
   const found=await c.from('colleges').select('id,name,city,state,division,conference,website,logo_url').ilike('name',name.trim()).maybeSingle();
   if(found.error)throw found.error;
   school=found.data;
  }
  if(!school){
   const created=await c.from('colleges').insert({name:name.trim(),city,state,division,conference,website:website.trim()||null}).select('id,name,city,state,division,conference,website,logo_url').single();
   if(created.error)throw created.error;
   school=created.data;
  }
  if(!school)throw new Error('Unable to find or save this school.');
  if(!school.website&&website.trim()){
   const normalized=/^https?:\/\//i.test(website.trim())?website.trim():`https://${website.trim()}`;
   const updated=await c.from('colleges').update({website:normalized}).eq('id',school.id).select('id,name,city,state,division,conference,website,logo_url').single();
   if(!updated.error&&updated.data)school=updated.data;
  }
  if(school.website&&!school.logo_url)void c.functions.invoke('enrich-college-logos',{body:{collegeIds:[school.id]}}).catch(()=>{});
  const saved=await saveAthleteSchoolTarget(c,{
   athleteId:user.id,collegeId:school.id,status,fitRating:fit?Number(fit):null
  });
  emitDataChanged('athlete_colleges',saved.action==='restored'?'restore':saved.action==='created'?'create':'update',saved.id);
  location.href=`/connections?search=${encodeURIComponent(school.name)}`;
 }catch(error:any){setMsg(error?.message||'Unable to save school. Please try again.');}
 finally{setBusy(false);}
}
return <AppShell><div className="max-w-xl mx-auto px-5 md:px-8 py-8"><div className="card p-6"><h1 className="text-2xl font-black">Add a School</h1><p className="muted mt-1">Search the softball directory by school, city, state, division or conference.</p><form onSubmit={save} className="space-y-5 mt-7"><div className="relative"><input className="input" placeholder="Start typing a school, state, division or conference" value={name} onChange={e=>{setName(e.target.value);setSelected(null)}} required/>{matches.length>0&&<div className="absolute z-20 left-0 right-0 mt-2 bg-white border rounded-xl shadow-xl max-h-80 overflow-y-auto">{matches.map(s=><div key={s.id} className="flex items-center gap-2 border-b last:border-0">
 <button type="button" onClick={()=>choose(s)} className="min-w-0 flex-1 p-3 text-left hover:bg-slate-50">
  <div className="font-bold">{s.name}</div><div className="muted text-xs mt-1">{[s.city,s.state,s.division,s.conference].filter(Boolean).join(' · ')}</div>
 </button>
 <Link href={'/colleges/'+s.id+'#coach-relationships'} className="mr-3 shrink-0 rounded-lg border px-2.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">View Staff →</Link>
 </div>)}</div>}</div>{selected&&<div className="rounded-xl bg-slate-50 p-4"><div className="font-bold">{selected.name}</div><div className="muted text-sm mt-1">{[city,state,division,conference].filter(Boolean).join(' · ')}</div><Link href={'/colleges/'+selected.id+'#coach-relationships'} className="mt-3 inline-flex text-sm font-bold text-red-700 hover:underline">View School Coaching Staff →</Link></div>}{!selected&&<><div className="grid grid-cols-2 gap-4"><input className="input" placeholder="City" value={city} onChange={e=>setCity(e.target.value)}/><input className="input" placeholder="State" value={state} onChange={e=>setState(e.target.value)}/></div><select className="input" value={division} onChange={e=>setDivision(e.target.value)}><option value="">Division</option><option>NCAA D1</option><option>NCAA D2</option><option>NCAA D3</option><option>NAIA</option><option>JC</option></select><input className="input" placeholder="Conference (optional)" value={conference} onChange={e=>setConference(e.target.value)}/><label className="block"><span className="text-sm font-bold">School website</span><input className="input mt-1" type="text" inputMode="url" placeholder="school.edu" value={website} onChange={e=>setWebsite(e.target.value)}/></label></>}<select className="input" value={status} onChange={e=>setStatus(e.target.value)}>{['Researching','Target','Contacted','Engaged','Recruiting Interest','High Interest','Visit/Camp','Decision','Committed'].map(x=><option key={x}>{x}</option>)}</select><label className="block"><span className="text-sm font-bold">Fit rating</span><select className="input mt-1" value={fit} onChange={e=>setFit(e.target.value)}><option value="">Not rated</option>{[1,2,3,4,5].map(x=><option key={x}>{x}</option>)}</select></label>{msg&&<p role="alert" className="text-sm font-semibold text-red-700">{msg}</p>}<p className="text-xs text-slate-600">After saving, view the school's softball staff in Connections and choose Add Connection for any coach you want to track. Email is available only after adding the coach.</p><button className="btn btn-red w-full" disabled={busy}>{busy?'Saving...':'Save School'}</button></form></div></div></AppShell>}
