'use client';
import {useEffect,useMemo,useState} from 'react';
import AppShell from '@/components/AppShell';
import PageHeader from '@/components/PageHeader';
import {createClient} from '@/lib/supabase-browser';
import {CalendarDays,CheckCircle2,Edit3,Trash2,X,ExternalLink,Search,RotateCcw,Clock} from 'lucide-react';

const EVENT_TYPES=['Tournament','College Camp','Campus Visit','Showcase','Coach Call','Follow-up','Recruiting Deadline','Other'];
const SEARCH_EVENT_TYPES=['All Event Types','Prospect Camps','Pitching','Hitting','Catching','Showcases','Visits','Other'];

type FormState={name:string;type:string;date:string;location:string;college:string;url:string};
const EMPTY:FormState={name:'',type:'Tournament',date:'',location:'',college:'',url:''};

type DriveTime={minutes:number;distanceMiles:number};

function text(v:any){return String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()}
function divisionLabel(v:any){
  const s=text(v);
  if(!s)return '';
  if(/(^| )d( |ivision )?1( |$)|division i($| )|ncaa di($| )/.test(s))return 'DI';
  if(/(^| )d( |ivision )?2( |$)|division ii($| )|ncaa dii($| )/.test(s))return 'DII';
  if(/(^| )d( |ivision )?3( |$)|division iii($| )|ncaa diii($| )/.test(s))return 'DIII';
  if(s.includes('naia'))return 'NAIA';
  if(s.includes('juco')||s.includes('njcaa')||s.includes('junior college'))return 'JUCO';
  return String(v||'');
}
function eventCategory(r:any){
  const s=text(`${r.name||''} ${r.type||''} ${r.description||''}`);
  if(/pitcher|pitching/.test(s))return 'Pitching';
  if(/catcher|catching/.test(s))return 'Catching';
  if(/hitter|hitting|offensive|offense/.test(s))return 'Hitting';
  if(/showcase/.test(s))return 'Showcases';
  if(/campus visit|official visit|unofficial visit| visit /.test(` ${s} `))return 'Visits';
  if(/prospect|elite camp|id camp|college camp|softball camp/.test(s))return 'Prospect Camps';
  return 'Other';
}
function monthText(date:string){
  if(!date)return '';
  const d=new Date(`${date}T12:00:00`);
  if(Number.isNaN(d.getTime()))return '';
  return `${d.toLocaleString('en-US',{month:'long'})} ${d.toLocaleString('en-US',{month:'short'})} ${d.getFullYear()}`.toLowerCase();
}
function formatDate(date:string){
  if(!date)return '';
  const d=new Date(`${date}T12:00:00`);
  if(Number.isNaN(d.getTime()))return date;
  return `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}/${d.getFullYear()}`;
}
function matchCollege(r:any,colleges:any[]){
  if(r.college_id)return colleges.find(c=>c.id===r.college_id)||null;
  const hay=text(`${r.name||''} ${r.description||''} ${r.location||''}`);
  if(!hay)return null;
  const stop=new Set(['university','college','school','the','of','at','and','state']);
  let best:any=null,bestScore=0,tie=false;
  for(const c of colleges){
    const full=text(c.name);
    if(full&&hay.includes(full))return c;
    const tokens=full.split(' ').filter((t:string)=>t.length>=4&&!stop.has(t));
    if(!tokens.length)continue;
    const hits=tokens.filter((t:string)=>hay.includes(t)).length;
    const score=hits/tokens.length;
    if(hits>=2||score>=0.75||(tokens.length===1&&hits===1&&tokens[0].length>=6)){
      if(score>bestScore){best=c;bestScore=score;tie=false}else if(score===bestScore){tie=true}
    }
  }
  return tie?null:best;
}
function driveLabel(value?:DriveTime){
  if(!value)return '';
  const h=Math.floor(value.minutes/60),m=value.minutes%60;
  const duration=h?`${h} hr${m?` ${m} min`:''}`:`${m} min`;
  return `≈ ${duration} from Overland Park · ${Math.round(value.distanceMiles)} mi`;
}

export default function Events(){
  const c=createClient();
  const [rows,setRows]=useState<any[]>([]);
  const [orgEvents,setOrgEvents]=useState<any[]>([]);
  const [orgSources,setOrgSources]=useState<any[]>([]);
  const [orgWarnings,setOrgWarnings]=useState<string[]>([]);
  const [colleges,setColleges]=useState<any[]>([]);
  const [form,setForm]=useState<FormState>(EMPTY);
  const [editingId,setEditingId]=useState<string|null>(null);
  const [calendarConnected,setCalendarConnected]=useState(false);
  const [showPersonalCalendarNotice,setShowPersonalCalendarNotice]=useState(false);
  const [showOrgCalendarNotice,setShowOrgCalendarNotice]=useState(false);
  const [msg,setMsg]=useState('');
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [search,setSearch]=useState('');
  const [scope,setScope]=useState<'upcoming'|'past'>('upcoming');
  const [dateFilter,setDateFilter]=useState('all');
  const [divisionFilter,setDivisionFilter]=useState('all');
  const [typeFilter,setTypeFilter]=useState('All Event Types');
  const [distanceFilter,setDistanceFilter]=useState('all');
  const [driveTimes,setDriveTimes]=useState<Record<string,DriveTime>>({});
  const [distanceConfigured,setDistanceConfigured]=useState<boolean|null>(null);
  const [distanceError,setDistanceError]=useState('');

  async function load(){const {data}=await c.from('events').select('*,colleges(name,division)').order('date');setRows(data||[])}
  async function loadOrgEvents(){try{const res=await fetch('/api/google/calendar/organization',{cache:'no-store'});let data:any={};try{data=await res.json()}catch{};if(res.ok){setOrgEvents(data.events||[]);setOrgSources(data.sources||[]);setOrgWarnings(data.warnings||[])}}catch{}}

  useEffect(()=>{(async()=>{
    const {data:{user}}=await c.auth.getUser();await Promise.all([load(),loadOrgEvents()]);
    const {data:collegeRows}=await c.from('colleges').select('id,name,division').order('name');setColleges(collegeRows||[]);
    if(user){const {data}=await c.from('google_workspace_connections').select('calendar_connected').eq('user_id',user.id).maybeSingle();setCalendarConnected(Boolean(data?.calendar_connected))}
  })()},[]);

  const orgNoticeSignature=useMemo(()=>orgSources.map((s:any)=>`${s.organizationId||s.organization_id||s.organizationName||s.organization_name||''}:${s.calendarId||s.calendar_id||s.calendarName||s.calendar_name||''}`).sort().join('|'),[orgSources]);
  useEffect(()=>{
    const timers:number[]=[];
    if(calendarConnected){
      const key='rr-events-google-calendar-notice-seen-v1';
      if(!window.localStorage.getItem(key)){
        setShowPersonalCalendarNotice(true);
        window.localStorage.setItem(key,'1');
        timers.push(window.setTimeout(()=>setShowPersonalCalendarNotice(false),10000));
      }
    }
    if(orgNoticeSignature){
      const key=`rr-events-org-calendar-notice-seen-v1:${orgNoticeSignature}`;
      if(!window.localStorage.getItem(key)){
        setShowOrgCalendarNotice(true);
        window.localStorage.setItem(key,'1');
        timers.push(window.setTimeout(()=>setShowOrgCalendarNotice(false),10000));
      }
    }
    return()=>timers.forEach(timer=>window.clearTimeout(timer));
  },[calendarConnected,orgNoticeSignature]);

  const combined=useMemo(()=>{
    const all=[...orgEvents.map(r=>({...r,_source:'org'})),...rows.map(r=>({...r,_source:'local'}))];
    return all.map(r=>{const college=matchCollege(r,colleges);return {...r,_college:college,_division:divisionLabel(college?.division||r.colleges?.division),_category:eventCategory(r)}})
  },[orgEvents,rows,colleges]);

  const locations=useMemo(()=>[...new Set(combined.map(r=>String(r.location||'').trim()).filter(Boolean))],[combined]);
  useEffect(()=>{
    if(!locations.length){setDriveTimes({});setDistanceConfigured(null);setDistanceError('');return}
    let cancelled=false;
    (async()=>{
      try{
        const res=await fetch('/api/maps/driving-times',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({locations})});
        let data:any={};try{data=await res.json()}catch{}
        if(cancelled)return;
        setDistanceConfigured(data.configured!==false);
        setDriveTimes(data.times||{});
        setDistanceError(data.error||'');
      }catch{if(!cancelled){setDistanceConfigured(false);setDriveTimes({});setDistanceError('Driving-time estimates could not be loaded.')}}
    })();
    return()=>{cancelled=true};
  },[locations.join('|')]);

  const filtered=useMemo(()=>{
    const today=new Date();today.setHours(0,0,0,0);
    const thisMonthStart=new Date(today.getFullYear(),today.getMonth(),1),nextMonthStart=new Date(today.getFullYear(),today.getMonth()+1,1),afterNextMonth=new Date(today.getFullYear(),today.getMonth()+2,1);
    const plus30=new Date(today);plus30.setDate(plus30.getDate()+30);const plus90=new Date(today);plus90.setDate(plus90.getDate()+90);
    const q=text(search);
    return combined.filter(r=>{
      const d=new Date(`${r.date}T12:00:00`);if(Number.isNaN(d.getTime()))return false;
      if(scope==='upcoming'&&d<today)return false;if(scope==='past'&&d>=today)return false;
      if(dateFilter==='this_month'&&(d<thisMonthStart||d>=nextMonthStart))return false;
      if(dateFilter==='next_month'&&(d<nextMonthStart||d>=afterNextMonth))return false;
      if(dateFilter==='30'&&(d<today||d>plus30))return false;
      if(dateFilter==='90'&&(d<today||d>plus90))return false;
      if(divisionFilter!=='all'&&r._division!==divisionFilter)return false;
      if(typeFilter!=='All Event Types'&&r._category!==typeFilter)return false;
      if(distanceFilter!=='all'){
        const minutes=driveTimes[String(r.location||'').trim()]?.minutes;
        if(minutes==null)return false;
        if(distanceFilter==='1'&&minutes>60)return false;
        if(distanceFilter==='2'&&minutes>120)return false;
        if(distanceFilter==='4'&&minutes>240)return false;
        if(distanceFilter==='6'&&minutes>360)return false;
        if(distanceFilter==='8'&&minutes>480)return false;
        if(distanceFilter==='8plus'&&minutes<=480)return false;
      }
      if(q){const hay=text(`${r.name||''} ${r.type||''} ${r.location||''} ${r.description||''} ${r.organizationName||''} ${r.calendarName||''} ${r._college?.name||''} ${r._division||''} ${r._category||''} ${monthText(r.date)}`);if(!hay.includes(q))return false}
      return true;
    }).sort((a,b)=>scope==='past'?String(b.date).localeCompare(String(a.date)):String(a.date).localeCompare(String(b.date)));
  },[combined,search,scope,dateFilter,divisionFilter,typeFilter,distanceFilter,driveTimes]);

  const hasFilters=Boolean(search||dateFilter!=='all'||divisionFilter!=='all'||typeFilter!=='All Event Types'||distanceFilter!=='all');
  function clearFilters(){setSearch('');setDateFilter('all');setDivisionFilter('all');setTypeFilter('All Event Types');setDistanceFilter('all')}

  async function syncCalendar(entityId:string){if(!calendarConnected)return {ok:false,skipped:true,error:''};try{const res=await fetch('/api/google/calendar/sync',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({entityType:'event',entityId})});let data:any={};try{data=await res.json()}catch{}return {ok:res.ok,skipped:false,error:data.error||''}}catch{return {ok:false,skipped:false,error:'Google Calendar could not be reached.'}}}
  async function save(e:React.FormEvent){e.preventDefault();setMsg('');setError('');setBusy(true);const payload={name:form.name.trim(),type:form.type,date:form.date,location:form.location.trim()||null,college_id:form.college||null,registration_url:form.url.trim()||null};let id=editingId;if(editingId){const {error}=await c.from('events').update(payload).eq('id',editingId);if(error){setError(error.message);setBusy(false);return}}else{const {data,error}=await c.from('events').insert(payload).select('id').single();if(error||!data){setError(error?.message||'Could not add event.');setBusy(false);return}id=data.id}const sync=id?await syncCalendar(id):null;setForm(EMPTY);setEditingId(null);await load();setBusy(false);if(sync?.ok)setMsg(editingId?'Event updated in Rebels Recruit and Google Calendar.':'Event added to Rebels Recruit and Google Calendar.');else if(sync&&!sync.skipped)setMsg(`${editingId?'Event updated':'Event added'} in Rebels Recruit. Google Calendar: ${sync.error||'sync failed.'}`);else setMsg(editingId?'Event updated.':'Event added.')}
  function edit(r:any){setEditingId(r.id);setMsg('');setError('');setForm({name:r.name||'',type:r.type||'Other',date:r.date||'',location:r.location||'',college:r.college_id||'',url:r.registration_url||''});window.scrollTo({top:0,behavior:'smooth'})}
  function cancelEdit(){setEditingId(null);setForm(EMPTY);setError('');setMsg('')}
  async function remove(r:any){if(!window.confirm(`Delete “${r.name}”? This will also remove the Google Calendar copy created by Rebels Recruit.`))return;setBusy(true);setError('');setMsg('');if(calendarConnected){try{await fetch('/api/google/calendar/sync',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({entityType:'event',entityId:r.id})})}catch{}}const {error}=await c.from('events').delete().eq('id',r.id);setBusy(false);if(error){setError(error.message);return}if(editingId===r.id)cancelEdit();setMsg('Event deleted. Any Rebels Recruit-managed Google Calendar copy was removed.');await load()}

  return <AppShell><div className="max-w-6xl mx-auto px-5 md:px-8 py-6">
    <PageHeader title="Recruiting Events" subtitle="Track camps, visits, calls, showcases, deadlines and other recruiting opportunities."/>
    {showPersonalCalendarNotice&&calendarConnected&&<div className="mb-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 flex items-center gap-2"><CalendarDays size={17}/><span><b>Google Calendar connected.</b> New and edited recruiting events sync automatically. Rebels Recruit only updates calendar items it created.</span></div>}
    {showOrgCalendarNotice&&orgSources.length>0&&<div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 flex items-center gap-2"><CalendarDays size={17}/><span><b>Rebels organization calendar connected.</b> Shared Google Calendar events are displayed below as read-only and stay managed in Google.</span></div>}
    {orgWarnings.length>0&&<div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Some shared calendar events could not be loaded: {orgWarnings.join(' · ')}</div>}

    <div className="grid lg:grid-cols-3 gap-6">
      <form onSubmit={save} className="card p-5 lg:col-span-1 space-y-4">
        <div className="flex items-center justify-between gap-3"><h2 className="font-black text-lg">{editingId?'Edit Event':'Add Event'}</h2>{editingId&&<button type="button" className="btn py-1.5 px-2.5 text-xs" onClick={cancelEdit}><X size={13}/> Cancel</button>}</div>
        <input className="input" placeholder="Event name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required/>
        <select className="input" value={form.type} onChange={e=>setForm({...form,type:e.target.value})}>{EVENT_TYPES.map(t=><option key={t}>{t}</option>)}</select>
        <input className="input" type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})} required/>
        <input className="input" placeholder="Location" value={form.location} onChange={e=>setForm({...form,location:e.target.value})}/>
        <select className="input" value={form.college} onChange={e=>setForm({...form,college:e.target.value})}><option value="">No college</option>{colleges.map(col=><option key={col.id} value={col.id}>{col.name}</option>)}</select>
        <input className="input" placeholder="Registration / info URL" value={form.url} onChange={e=>setForm({...form,url:e.target.value})}/>
        {error&&<p className="text-sm text-red-700 font-semibold">{error}</p>}{msg&&<p className="text-sm text-green-700 font-semibold flex gap-2 items-start"><CheckCircle2 size={16} className="mt-0.5 shrink-0"/>{msg}</p>}
        <button className="btn btn-red w-full" disabled={busy}>{busy?'Saving...':editingId?'Save Changes':'Add Event'}</button>
      </form>

      <div className="lg:col-span-2">
        <div className="card p-4 mb-4">
          <div className="flex items-center gap-2 border rounded-xl px-3"><Search size={18} className="muted shrink-0"/><input className="w-full py-3 outline-none bg-transparent text-sm" placeholder="Search schools, camps, locations, pitching, June..." value={search} onChange={e=>setSearch(e.target.value)}/>{search&&<button type="button" onClick={()=>setSearch('')} className="muted"><X size={17}/></button>}</div>
          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-2 mt-3">
            <select className="input text-xs sm:text-sm" value={dateFilter} onChange={e=>setDateFilter(e.target.value)}><option value="all">Show All Dates</option><option value="this_month">This Month</option><option value="next_month">Next Month</option><option value="30">Next 30 Days</option><option value="90">Next 90 Days</option></select>
            <select className="input text-xs sm:text-sm" value={divisionFilter} onChange={e=>setDivisionFilter(e.target.value)}><option value="all">All Divisions</option><option value="DI">DI</option><option value="DII">DII</option><option value="DIII">DIII</option><option value="NAIA">NAIA</option><option value="JUCO">JUCO</option></select>
            <select className="input text-xs sm:text-sm" value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}>{SEARCH_EVENT_TYPES.map(t=><option key={t}>{t}</option>)}</select>
            <select className="input text-xs sm:text-sm" value={distanceFilter} disabled={distanceConfigured===false} onChange={e=>setDistanceFilter(e.target.value)}><option value="all">Any Distance</option><option value="1">Within 1 Hour</option><option value="2">Within 2 Hours</option><option value="4">Within 4 Hours</option><option value="6">Within 6 Hours</option><option value="8">Within 8 Hours</option><option value="8plus">More Than 8 Hours</option></select>
          </div>
          {distanceConfigured===false&&<div className="text-xs text-amber-700 mt-2">Distance estimates from Overland Park are not configured yet.</div>}
          {distanceConfigured&&distanceError&&<div className="text-xs text-amber-700 mt-2">Distance estimates are temporarily unavailable: {distanceError}</div>}
          <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
            <div className="inline-flex rounded-lg border p-1"><button type="button" className={`px-3 py-1.5 rounded-md text-sm font-bold ${scope==='upcoming'?'bg-slate-900 text-white':''}`} onClick={()=>setScope('upcoming')}>Upcoming</button><button type="button" className={`px-3 py-1.5 rounded-md text-sm font-bold ${scope==='past'?'bg-slate-900 text-white':''}`} onClick={()=>setScope('past')}>Past</button></div>
            <div className="flex items-center gap-3"><span className="muted text-sm font-semibold">{filtered.length} event{filtered.length===1?'':'s'}</span>{hasFilters&&<button type="button" className="text-sm font-bold flex items-center gap-1" onClick={clearFilters}><RotateCcw size={14}/> Clear filters</button>}</div>
          </div>
        </div>

        <div className="space-y-3">
          {filtered.map(r=>r._source==='org'?<div className="card p-5 border-blue-200" key={r.id}><div className="flex justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><div className="font-black text-lg">{r.name}</div><span className="pill bg-blue-50 text-blue-700">Rebels Calendar</span>{r._division&&<span className="pill">{r._division}</span>}</div><div className="muted text-sm mt-1">{r._college?.name?`${r._college.name} · `:''}{r.organizationName} · {r.calendarName}{r.location?` · ${r.location}`:''}</div>{driveTimes[String(r.location||'').trim()]&&<div className="text-xs font-semibold text-slate-600 mt-2 flex items-center gap-1.5"><Clock size={14}/>{driveLabel(driveTimes[String(r.location||'').trim()])}</div>}</div><div className="font-bold shrink-0">{formatDate(r.date)}</div></div>{r.description&&<div className="text-sm mt-3 whitespace-pre-wrap leading-6">{r.description}</div>}<div className="flex flex-wrap gap-2 mt-4">{r.infoUrl&&<a className="btn text-sm px-3 py-2 inline-flex" href={r.infoUrl} target="_blank" rel="noreferrer"><ExternalLink size={15}/> Event Info / Registration</a>}{r.url&&<a className="btn text-sm px-3 py-2 inline-flex" href={r.url} target="_blank" rel="noreferrer"><CalendarDays size={15}/> Open in Google Calendar</a>}</div><div className="text-xs muted mt-3">Read-only in Rebels Recruit. Edit or delete this event in Google Calendar.</div></div>:
          <div className="card p-5" key={r.id}><div className="flex justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><div className="font-black text-lg">{r.name}</div>{r._division&&<span className="pill">{r._division}</span>}</div><div className="muted text-sm mt-1">{r.type}{r.colleges?.name?` · ${r.colleges.name}`:''}{r.location?` · ${r.location}`:''}</div>{driveTimes[String(r.location||'').trim()]&&<div className="text-xs font-semibold text-slate-600 mt-2 flex items-center gap-1.5"><Clock size={14}/>{driveLabel(driveTimes[String(r.location||'').trim()])}</div>}</div><div className="font-bold shrink-0">{formatDate(r.date)}</div></div>{r.registration_url&&<a className="text-sm font-bold inline-block mt-3" href={r.registration_url} target="_blank" rel="noreferrer">Registration / Info</a>}<div className="mt-4 pt-4 border-t flex flex-wrap gap-2"><button type="button" className="btn text-sm px-3 py-2" onClick={()=>edit(r)} disabled={busy}><Edit3 size={15}/> Edit</button><button type="button" className="btn text-sm px-3 py-2" onClick={()=>remove(r)} disabled={busy}><Trash2 size={15}/> Delete</button>{calendarConnected&&<button type="button" className="btn text-sm px-3 py-2" disabled={busy} onClick={async()=>{setBusy(true);setError('');setMsg('');const result=await syncCalendar(r.id);setBusy(false);if(result.ok)setMsg(`“${r.name}” synced to Google Calendar.`);else setError(result.error||'Calendar sync failed.')}}><CalendarDays size={15}/> Sync Calendar</button>}</div></div>)}
          {!filtered.length&&<div className="card p-10 text-center"><div className="font-black">No matching events</div><div className="muted text-sm mt-1">Try changing your search or filters.</div>{hasFilters&&<button type="button" className="btn mt-4" onClick={clearFilters}><RotateCcw size={14}/> Clear filters</button>}</div>}
        </div>
      </div>
    </div>
  </div></AppShell>
}
