'use client';

import {useEffect,useMemo,useRef,useState} from 'react';
import Link from 'next/link';
import {CheckCircle2,Info,Plus,Search,X,XCircle} from 'lucide-react';
import {createClient} from '@/lib/supabase-browser';
import {factorFor,FitResult} from '@/lib/college-fit';

type School={id:string;name:string;city?:string|null;state?:string|null;division?:string|null;conference?:string|null;school_type?:string|null;logo_url?:string|null};
type Drive={minutes:number;distanceMiles?:number};
type Suggestion={title:string;ids:string[]};
type Props={
  schools:School[];
  fit?:any;
  fitById?:Record<string,FitResult|null>;
  times?:Record<string,Drive>;
  suggestions?:Suggestion[];
  schoolHref?:(id:string)=>string;
};
type Row={label:string;value:(school:School)=>string};
const unavailable='Data unavailable';
const clean=(v:any)=>String(v||'').toLowerCase().replace(/[^a-z0-9]/g,'');
function level(v:any){
  const s=clean(v);
  if(s.includes('division1')||s.includes('d1')||s==='ncaadi')return 'D1';
  if(s.includes('division2')||s.includes('d2')||s==='ncaadii')return 'D2';
  if(s.includes('division3')||s.includes('d3')||s==='ncaadiii')return 'D3';
  if(s.includes('naia'))return 'NAIA';
  if(s.includes('juco')||s.includes('njcaa')||s.includes('juniorcollege'))return 'JUCO';
  return String(v||unavailable);
}
function dollars(v:any){
  if(v===null||v===undefined||v==='')return unavailable;
  const n=Number(v);
  return Number.isFinite(n)?new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n):unavailable;
}
function number(v:any){
  const n=Number(v);
  return v!==null&&v!==undefined&&v!==''&&Number.isFinite(n)?n.toLocaleString('en-US'):unavailable;
}
function readable(v:any){
  if(Array.isArray(v))return v.filter(Boolean).join(', ')||unavailable;
  return v===null||v===undefined||v===''?unavailable:String(v);
}
export default function SchoolCompare({schools,fit,fitById={},times={},suggestions=[],schoolHref}:Props){
  const c=useMemo(()=>createClient(),[]);
  const [selected,setSelected]=useState<string[]>([]);
  const [pickerSlot,setPickerSlot]=useState<number|null>(null);
  const [fitInfoSchoolId,setFitInfoSchoolId]=useState<string|null>(null);
  const fitInfoTriggerRef=useRef<HTMLButtonElement|null>(null);
  const [query,setQuery]=useState('');
  const [hideSimilar,setHideSimilar]=useState(false);
  const [enrichment,setEnrichment]=useState<Record<string,any>>({});
  const [majors,setMajors]=useState<Record<string,string[]>>({});
  const [reviews,setReviews]=useState<Record<string,any>>({});
  const [loading,setLoading]=useState(false);
  const [loadError,setLoadError]=useState(false);
  const [selectionNotice,setSelectionNotice]=useState('');
  const byId=useMemo(()=>new Map(schools.map(s=>[s.id,s])),[schools]);
  const chosen=selected.map(id=>byId.get(id)).filter((s):s is School=>!!s);
  const fitInfoSchool=fitInfoSchoolId?byId.get(fitInfoSchoolId):null;
  const fitInfo=fitInfoSchoolId?fitById[fitInfoSchoolId]:null;
  function closeFitInfo(){setFitInfoSchoolId(null);fitInfoTriggerRef.current?.focus();}
  const presets=suggestions.map(g=>({title:g.title,ids:[...new Set(g.ids)].filter(id=>byId.has(id)).slice(0,3)})).filter(g=>g.ids.length>=2).slice(0,4);
  const options=useMemo(()=>{
    const q=query.trim().toLowerCase();
    return schools.filter(s=>!selected.includes(s.id)&&(!q||[s.name,s.city,s.state,s.division,s.conference].some(v=>String(v||'').toLowerCase().includes(q)))).slice(0,35);
  },[schools,selected,query]);

  useEffect(()=>{
    if(!selected.length){setEnrichment({});setMajors({});setReviews({});setLoadError(false);return}
    let active=true;
    setLoading(true);setLoadError(false);
    Promise.all([
      c.from('college_enrichment').select('college_id,undergraduate_enrollment,enrollment_total,campus_setting,religious_affiliation,climate_profile,total_cost_in_state,total_cost_out_of_state,room_board,source_year').in('college_id',selected),
      c.from('college_programs').select('college_id,cip_title,completions,reporting_year').in('college_id',selected).order('completions',{ascending:false}),
      c.from('athlete_recruiting_experience_summary').select('college_id,response_count,overall_experience').eq('subject_type','program').is('coach_id',null).in('college_id',selected),
    ]).then(([e,m,r])=>{
      if(!active)return;
      setEnrichment(Object.fromEntries((e.data||[]).map((x:any)=>[x.college_id,x])));
      const majorMap:Record<string,string[]>={};
      for(const x of m.data||[]){if(x.cip_title&&Number(x.completions)>0){const titles=majorMap[x.college_id]??=[];if(!titles.includes(x.cip_title))titles.push(x.cip_title);majorMap[x.college_id]=titles}}
      setMajors(majorMap);
      setReviews(Object.fromEntries((r.data||[]).map((x:any)=>[x.college_id,x])));
      setLoadError(!!(e.error||m.error||r.error));
    }).catch(()=>{if(active)setLoadError(true)}).finally(()=>{if(active)setLoading(false)});
    return()=>{active=false};
  },[c,selected]);

  function choose(id:string){
    if(selected.includes(id))return;
    setSelected(current=>{
      if(pickerSlot!==null&&pickerSlot<current.length)return current.map((v,i)=>i===pickerSlot?id:v);
      return current.length<3?[...current,id]:current;
    });
    setPickerSlot(null);setQuery('');
  }
  useEffect(()=>{
    function handleCardCompare(event:Event){
      const id=(event as CustomEvent<string>).detail;
      if(!id||!byId.has(id))return;
      if(selected.includes(id)){setSelectionNotice('That school is already in your comparison.');}
      else if(selected.length>=3){setSelectionNotice('Three schools selected. Remove or change a school above before adding another.');}
      else{setSelected([...selected,id]);setSelectionNotice('School added to comparison.');}
      document.getElementById('compare-schools')?.scrollIntoView({behavior:'smooth',block:'start'});
    }
    window.addEventListener('rltnl-compare-school',handleCardCompare);
    return()=>window.removeEventListener('rltnl-compare-school',handleCardCompare);
  },[byId,selected]);
  function drive(s:School){return times[[s.city,s.state].filter(Boolean).join(', ')];}
  function driveLabel(s:School){const d=drive(s);if(!d)return unavailable;const minutes=Math.round(d.minutes);return minutes<60?'≈ '+minutes+' min':'≈ '+Math.floor(minutes/60)+' hr '+String(minutes%60).padStart(2,'0')+' min';}
  function factor(s:School,key:'division'|'school_type'|'distance'|'climate'|'academics'){return factorFor(fitById[s.id],key)?.detail||unavailable;}
  function fitSummary(s:School){
    const r=fitById[s.id];
    if(!r||r.percent==null)return unavailable;
    if(r.pending)return 'Calculating academic fit…';
    return r.percent+'% Match';
  }
  function driveAndPreference(s:School){
    const d=driveLabel(s);
    if(d===unavailable)return unavailable;
    const f=factorFor(fitById[s.id],'distance');
    return d+(f?' · '+f.detail.toLowerCase():'');
  }
  function review(s:School){
    if(loadError&&!reviews[s.id])return unavailable;
    const r=reviews[s.id],n=Number(r?.response_count||0);
    return n>0&&Number(r?.overall_experience)>0?Number(r.overall_experience).toFixed(1)+'/5 · '+n+' athlete review'+(n===1?'':'s'):'No athlete reviews yet';
  }
  const groups:{id:string;title:string;rows:Row[]}[]=[
    {id:'overview',title:'Overview',rows:[
      {label:'Location',value:s=>readable([s.city,s.state].filter(Boolean).join(', '))},
      {label:'Division',value:s=>level(s.division)},
      {label:'Conference',value:s=>readable(s.conference)},
      {label:'School type',value:s=>readable(s.school_type)},
    ]},
    {id:'fit',title:'College Fit',rows:[
      {label:'College Fit match',value:fitSummary},
      {label:'Academic interests',value:s=>factor(s,'academics')},
      {label:'Climate preference',value:s=>factor(s,'climate')},
      {label:'Competitive level',value:s=>factor(s,'division')},
      {label:'School type preference',value:s=>factor(s,'school_type')},
      {label:'Estimated drive from home',value:driveAndPreference},
    ]},
    {id:'campus',title:'Academics & Campus',rows:[
      {label:'Undergraduate enrollment',value:s=>number(enrichment[s.id]?.undergraduate_enrollment??enrichment[s.id]?.enrollment_total)},
      {label:'Campus setting',value:s=>readable(enrichment[s.id]?.campus_setting)},
      {label:'Programs with reported completions',value:s=>majors[s.id]?.length?majors[s.id].length+' academic programs (2025)':unavailable},
      {label:'Examples of reported programs',value:s=>majors[s.id]?.length?majors[s.id].slice(0,4).join(' · '):unavailable},
      {label:'Religious affiliation',value:s=>readable(enrichment[s.id]?.religious_affiliation)},
      {label:'Climate',value:s=>readable(enrichment[s.id]?.climate_profile)},
    ]},
    {id:'cost',title:'Cost',rows:[
      {label:'In-state total cost',value:s=>dollars(enrichment[s.id]?.total_cost_in_state)},
      {label:'Out-of-state total cost',value:s=>dollars(enrichment[s.id]?.total_cost_out_of_state)},
      {label:'Room & board',value:s=>dollars(enrichment[s.id]?.room_board)},
    ]},
    {id:'reviews',title:'RLTNL Reviews',rows:[
      {label:'Athlete recruiting experiences',value:review},
    ]},
  ];
  const hasCostData=chosen.some(s=>[enrichment[s.id]?.total_cost_in_state,enrichment[s.id]?.total_cost_out_of_state,enrichment[s.id]?.room_board].some(v=>dollars(v)!==unavailable));
  const hasReviews=chosen.some(s=>Number(reviews[s.id]?.response_count||0)>0&&Number(reviews[s.id]?.overall_experience)>0);
  const costPreferenceSet=!!fit&&(fit.max_annual_cost!=null||!!fit.cost_importance||!!fit.athletic_aid_required||(fit.top_priorities||[]).includes('Cost'));
  const visibleGroups=(fit?groups:groups.filter(g=>g.id!=='fit'))
    .filter(g=>(g.id!=='cost'||hasCostData)&&(g.id!=='reviews'||hasReviews))
    .map(g=>({...g,rows:g.rows.filter(r=>chosen.some(s=>r.value(s)!==unavailable))
      .filter(r=>!hideSimilar||chosen.length<2||!chosen.every(s=>r.value(s)===r.value(chosen[0])))}))
    .filter(g=>g.rows.length>0);
  const href=(id:string)=>schoolHref?schoolHref(id):'/colleges/'+id;

  return <section id="compare-schools" className="mb-10 scroll-mt-24 min-w-0 w-full">
    <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
      <div><div className="rr-eyebrow">COMPARE</div><h2 className="text-xl font-black mt-1">Compare Schools Side-by-Side</h2><p className="muted text-sm mt-1">Choose up to three schools to compare.</p></div>
      <span className="rounded-full border bg-white px-3 py-2 text-xs font-black">{selected.length} of 3 selected</span>
    </div>
    {presets.length>0&&<div className="flex flex-wrap items-center gap-2 mb-4"><span className="text-xs font-bold text-slate-600">Quick compare:</span>{presets.map(g=><button key={g.title} type="button" onClick={()=>setSelected(g.ids)} className="rounded-full border bg-white px-3 py-2 text-xs font-bold hover:border-red-400 hover:text-red-700">{g.title} ({g.ids.length})</button>)}</div>}
    <div className="grid grid-cols-3 gap-2 sm:gap-4">
      {[0,1,2].map(i=>{
        const s=chosen[i];
        return <div key={i} className="min-w-0 rounded-xl border bg-white p-2.5 sm:p-4 min-h-[112px] sm:min-h-[126px] shadow-sm">
          {s?<div className="flex h-full flex-col justify-between gap-2">
            <div className="flex items-start justify-between gap-1"><span className="font-black text-xs sm:text-base leading-snug break-words">{s.name}</span><button type="button" aria-label={'Remove '+s.name} onClick={()=>setSelected(v=>v.filter(id=>id!==s.id))} className="shrink-0 rounded-md p-1 text-slate-500 hover:bg-slate-100"><X size={15}/></button></div>
            <button type="button" onClick={()=>{setPickerSlot(i);setQuery('')}} className="text-left text-xs font-bold text-red-700 hover:underline">Change school</button>
          </div>:<button type="button" onClick={()=>{setPickerSlot(i);setQuery('')}} className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-1 text-xs font-bold text-slate-600 hover:border-red-400 hover:text-red-700"><Plus size={18}/><span>Add school</span></button>}
        </div>;
      })}
    </div>
    {selectionNotice&&<p role="status" className="mt-3 text-sm font-medium text-slate-600">{selectionNotice}</p>}
    {chosen.length<2?<div className="mt-3 rounded-xl border border-dashed bg-slate-50 p-4 text-sm text-slate-600">Select at least two schools to see the comparison. You can replace any school without starting over.</div>:<>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">{visibleGroups.map(g=><a key={g.id} href={'#compare-'+g.id} className="rounded-full border bg-white px-3 py-2 text-xs font-bold hover:border-red-400 hover:text-red-700">{g.title}</a>)}</div>
        <label className="flex cursor-pointer items-center gap-2 text-sm font-bold"><input type="checkbox" checked={hideSimilar} onChange={e=>setHideSimilar(e.target.checked)} className="h-4 w-4 accent-red-600"/>Hide similarities</label>
      </div>
      {loadError&&<p role="alert" className="mt-3 text-xs font-bold text-amber-800">Some comparison details couldn't load. Try refreshing the page; missing values are not treated as poor matches.</p>}
      <p className="mt-3 text-xs text-slate-500 sm:hidden">Swipe left or right to compare all three colleges.</p>
      <div className="mt-4 overflow-x-auto rounded-xl border bg-white" role="region" aria-label="School comparison table" tabIndex={0}>
        <table className="w-full min-w-[780px] border-collapse text-left text-sm">
          <thead><tr className="bg-slate-50">
            <th scope="col" className="sticky left-0 z-20 w-[190px] min-w-[190px] border-b border-r bg-slate-50 p-4 align-top text-xs font-black">Compare</th>
            {chosen.map(s=><th scope="col" key={s.id} className="min-w-[195px] border-b border-r p-4 align-top"><div className="font-black">{s.name}</div><div className="text-xs font-normal text-slate-500 mt-1">{[s.city,s.state].filter(Boolean).join(', ')}</div><Link href={href(s.id)} className="mt-2 inline-block text-xs font-bold text-red-700 hover:underline">View school & reviews →</Link></th>)}
          </tr></thead>
          <tbody>{visibleGroups.map(g=><FragmentRows key={g.id} id={g.id} title={g.title} rows={g.rows} chosen={chosen} loading={loading} fitById={fitById} onShowFitInfo={(schoolId,trigger)=>{fitInfoTriggerRef.current=trigger;setFitInfoSchoolId(schoolId)}} emptyMessage="No differences among the available values in this category."/>)}</tbody>
        </table>
      </div>
      {hideSimilar&&visibleGroups.length===0&&<p className="mt-3 rounded-xl border bg-white p-4 text-sm text-slate-600">All available details are the same for these schools. Turn off Hide similarities to review them.</p>}
      {!loading&&!hasCostData&&<p className="mt-3 text-xs text-slate-500" role="note">{costPreferenceSet?'Cost preferences aren’t included yet; verified cost data is unavailable for these schools.':'Verified cost data isn’t available for these schools yet.'}</p>}
      
    </>}
    {fitInfoSchool&&fitInfo&&fitInfo.percent!=null&&!fitInfo.pending&&<div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/55 p-4" onMouseDown={e=>{if(e.target===e.currentTarget)closeFitInfo()}}>
      <div role="dialog" aria-modal="true" aria-labelledby="fit-info-title" onKeyDown={e=>{if(e.key==='Escape')closeFitInfo()}} className="w-full max-w-md max-h-[85dvh] overflow-y-auto rounded-2xl bg-white p-5 sm:p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div><p className="text-xs font-black uppercase tracking-wide text-red-600">College Fit Match</p><h3 id="fit-info-title" className="mt-1 text-lg font-black">{fitInfoSchool.name}</h3></div>
          <button type="button" autoFocus aria-label="Close match details" onClick={closeFitInfo} className="shrink-0 rounded-lg border p-2 text-slate-600 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-600"><X size={18}/></button>
        </div>
        <p className="mt-4 text-xl font-black">{fitInfo.percent}% Match</p>
        <h4 className="mt-5 text-sm font-black">Factors used in this match</h4>
        <ul className="mt-3 space-y-3">
          {fitInfo.factors.map(f=><li key={f.key} className="flex items-start gap-3 rounded-xl border border-slate-200 p-3">
            {f.matched?<CheckCircle2 size={19} className="mt-0.5 shrink-0 text-green-600" aria-label="Matches preference"/>:<XCircle size={19} className="mt-0.5 shrink-0 text-red-600" aria-label="Does not match preference"/>}
            <div className="min-w-0"><div className="text-sm font-bold text-slate-900">{f.label}</div><div className="mt-0.5 text-sm leading-relaxed text-slate-600">{f.detail}</div></div>
          </li>)}
        </ul>
      </div>
    </div>}
    {pickerSlot!==null&&<div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4" onMouseDown={e=>{if(e.target===e.currentTarget)setPickerSlot(null)}}>
      <div role="dialog" aria-modal="true" aria-labelledby="compare-picker-title" onKeyDown={e=>{if(e.key==='Escape')setPickerSlot(null)}} className="flex w-full max-w-xl flex-col rounded-2xl bg-white p-4 sm:p-6 shadow-xl max-h-[min(78dvh,640px)]">
        <div className="flex items-center justify-between gap-3"><div><h3 id="compare-picker-title" className="text-lg font-black">Choose a School</h3><p className="muted text-xs mt-1">Search any college in the RLTNL directory.</p></div><button type="button" aria-label="Close school selector" onClick={()=>setPickerSlot(null)} className="rounded-lg border p-2"><X size={18}/></button></div>
        <label className="mt-4 flex items-center gap-2 rounded-xl border px-3 focus-within:ring-2 focus-within:ring-red-500"><Search size={18} className="text-slate-500"/><input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search school, city, division..." className="w-full min-w-0 py-3 outline-none focus-visible:outline-none text-base"/></label>
        <div className="mt-3 min-h-0 flex-1 overflow-y-auto divide-y">{options.map(s=><button key={s.id} type="button" onClick={()=>choose(s.id)} className="flex w-full items-center justify-between gap-3 px-2 py-3 text-left hover:bg-slate-50"><span><span className="block font-bold text-sm">{s.name}</span><span className="text-xs text-slate-500">{[s.city,s.state,level(s.division)].filter(Boolean).join(' · ')}</span></span><Plus size={16} className="shrink-0 text-red-700"/></button>)}{options.length===0&&<p className="p-5 text-center text-sm text-slate-500">No other schools match. Try a different search.</p>}</div>
      </div>
    </div>}
  </section>;
}
function FragmentRows({id,title,rows,chosen,loading,fitById,onShowFitInfo,emptyMessage}:{id:string;title:string;rows:Row[];chosen:School[];loading:boolean;fitById:Record<string,FitResult|null>;onShowFitInfo:(schoolId:string,trigger:HTMLButtonElement)=>void;emptyMessage:string}){
  return <><tr id={'compare-'+id} className="scroll-mt-24 bg-slate-100"><th colSpan={chosen.length+1} className="p-3.5 text-xs font-black uppercase tracking-wide">{title}</th></tr>{rows.length===0?<tr><td colSpan={chosen.length+1} className="border-b bg-white p-4 text-sm text-slate-600">{loading?'Loading comparison details…':emptyMessage}</td></tr>:rows.map(r=><tr key={id+'-'+r.label}>
    <th scope="row" className="sticky left-0 z-10 w-[190px] min-w-[190px] border-b border-r bg-white p-4 align-top text-xs sm:text-sm font-bold">{r.label}</th>
    {chosen.map(s=><td key={s.id} className="border-b border-r p-4 align-top text-sm leading-relaxed"><span className="inline-flex items-center gap-2">{loading&&id!=='overview'&&id!=='fit'?'Loading…':r.value(s)}{id==='fit'&&r.label==='College Fit match'&&fitById[s.id]?.percent!=null&&!fitById[s.id]?.pending&&<button type="button" aria-label={'View factors used for '+s.name+' College Fit Match'} onClick={e=>onShowFitInfo(s.id,e.currentTarget)} className="inline-flex shrink-0 items-center justify-center rounded-full text-slate-500 hover:text-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-600"><Info size={17} aria-hidden="true"/></button>}</span></td>)}
  </tr>)}</>;
}
