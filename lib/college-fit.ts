export type FitFactorKey='division'|'school_type'|'distance'|'climate'|'academics';
export type FitFactor={key:FitFactorKey;label:string;matched:boolean;detail:string;weight:number};
export type FitResult={percent:number|null;matched:number;evaluated:number;requested:number;coverage:number;factors:FitFactor[];unavailable:string[];reasons:string[];pending:boolean};
export type CollegeFitSchool={id:string;division?:string|null;school_type?:string|null;enrichment?:{climate_profile?:string[]|null}|null};
export type CollegeFitDrive={minutes:number};
export type CollegeFitPrograms={known:Set<string>;matches:Record<string,string[]>;pending:boolean};
const norm=(v:unknown)=>String(v??'').toLowerCase().trim();
const compact=(v:unknown)=>norm(v).replace(/[^a-z0-9]/g,'');
const chosen=(v:unknown):string[]=>Array.isArray(v)?v.filter(x=>typeof x==='string'&&x.trim()&&x!=='No preference'&&x!=='Either works'):[];
export function divisionLabel(v:unknown){const s=compact(v);if(s.includes('division1')||s.includes('d1')||s==='ncaadi')return'D1';if(s.includes('division2')||s.includes('d2')||s==='ncaadii')return'D2';if(s.includes('division3')||s.includes('d3')||s==='ncaadiii')return'D3';if(s.includes('naia'))return'NAIA';if(s.includes('juco')||s.includes('njcaa')||s.includes('juniorcollege')||s==='jc')return'JUCO';return String(v||'');}
function divisionChoice(v:unknown){return divisionLabel(v)}
export function academicSearchTerms(interests:unknown):string[]{
  const parts=chosen(interests).flatMap(x=>x.split(/\s*[,;]\s*|\s+\/\s+/)).map(x=>x.trim()).filter(Boolean);
  const aliases:Record<string,string[]>={
    'child psychology':['child psychology','psychology'],
    'pre-med':['pre-medicine','biological sciences'], 'pre med':['pre-medicine','biological sciences'],
    'business':['business','commerce'], 'education':['education','teaching'],
    'exercise science':['exercise science','kinesiology'],'kinesiology':['kinesiology','exercise science'],
    'sports management':['sport management','sport and fitness administration'],
    'nursing':['nursing','registered nurse'],
    'criminal justice':['criminal justice'],
    'film':['film','cinema'],
    'dental hygiene':['dental hygiene'],
    'psychology':['psychology'],
    'computer science':['computer science'],
    'architectural engineering':['architectural engineering'],
  };
  const terms=parts.flatMap(x=>aliases[norm(x)]||[norm(x)]);
  return [...new Set(terms.filter(x=>x.length>=3&&x.length<=90))].slice(0,20);
}
function hasMeaningful(v:unknown){return chosen(v).length>0}
export function evaluateCollegeFit(s:CollegeFitSchool,fit:any,drive:CollegeFitDrive|undefined,programs:CollegeFitPrograms):FitResult|null{
  if(!fit)return null;
  const factors:FitFactor[]=[],unavailable:string[]=[];
  let requested=0;
  const priorities=chosen(fit.top_priorities);
  const weight=(key:FitFactorKey)=>{
    const priority:Record<FitFactorKey,string>={division:'Softball level',school_type:'School type',distance:'Distance from home',climate:'Weather',academics:'Academics'};
    let w=priorities.includes(priority[key])?2:1;
    if(key==='distance'&&fit.distance_importance==='Must-have')w=Math.max(w,3);
    if(key==='distance'&&fit.distance_importance==='Strong preference')w=Math.max(w,2);
    return w;
  };
  function check(key:FitFactorKey,label:string,active:boolean,available:boolean,matched:boolean,detail:string){
    if(!active)return;
    requested++;
    if(!available){unavailable.push(label);return}
    factors.push({key,label,matched,detail,weight:weight(key)});
  }
  const levels=chosen(fit.divisions);
  const schoolLevel=divisionLabel(s.division);
  check('division','Softball level',levels.length>0,!!schoolLevel,levels.some(x=>divisionChoice(x)===schoolLevel),schoolLevel?(levels.some(x=>divisionChoice(x)===schoolLevel)?'Matches: ':'Outside selected levels: ')+schoolLevel:'');
  const types=chosen(fit.school_types);
  check('school_type','School type',types.length>0,!!s.school_type,types.some(x=>norm(s.school_type)===norm(x)),s.school_type?(types.some(x=>norm(s.school_type)===norm(x))?'Matches: ':'Outside selected types: ')+s.school_type:'');
  const max=Number(fit.max_drive_minutes||0),distanceActive=max>0&&max<99999&&fit.distance_importance!=='Doesn’t matter';
  const within=!!drive&&drive.minutes<=max;
  check('distance','Distance from home',distanceActive,!!drive&&Number.isFinite(drive.minutes),within,drive?(within?'Within':'Beyond')+' preferred '+Math.round(max/60)+'-hour drive range':'');
  const weather=chosen(fit.weather_preferences).filter(x=>x!=='Snow is okay');
  const climate=(s.enrichment?.climate_profile||[]).filter(Boolean);
  const weatherMatch=weather.some(x=>climate.some(c=>norm(c)===norm(x)));
  check('climate','Climate',weather.length>0,climate.length>0,weatherMatch,climate.length?(weatherMatch?'Matches: ':'Outside preferred climate: ')+climate.join(', '):'');
  const majors=academicSearchTerms(fit.academic_interests);
  const matches=programs.matches[s.id]||[];
  check('academics','Academic interests',majors.length>0,!programs.pending&&programs.known.has(s.id),matches.length>0,matches.length?'Related programs with reported completions: '+matches.slice(0,2).join(', '):'No related program found in reported completions (not proof a major is unavailable)');
  const unverified:[unknown,string][]=[
    [fit.school_sizes,'School size'],
    [fit.settings,'Campus setting'],
    [fit.campus_experience,'Campus experience'],
    [fit.city_access_preferences,'City access'],
    [chosen(fit.religious_affiliation_preferences).filter(x=>x!=='Open to religious affiliation'),'Religious affiliation'],
    [fit.competition_preferences,'Playing opportunity / program culture'],
  ];
  for(const [value,label] of unverified){if(hasMeaningful(value)){requested++;unavailable.push(label)}}
  if(fit.max_annual_cost!=null||fit.cost_importance==='Must-have'||fit.cost_importance==='Strong factor'||priorities.includes('Cost')){requested++;unavailable.push('Cost / affordability')}
  if(fit.athletic_aid_required==='No'||fit.athletic_aid_required==='Maybe, depending on other aid'){requested++;unavailable.push('Financial aid')}
  const evaluated=factors.length,matched=factors.filter(x=>x.matched).length;
  const weightTotal=factors.reduce((n,x)=>n+x.weight,0);
  const percent=weightTotal?Math.round(factors.reduce((n,x)=>n+(x.matched?x.weight:0),0)/weightTotal*100):null;
  return{percent,matched,evaluated,requested,coverage:requested?evaluated/requested:0,factors,unavailable,reasons:factors.filter(x=>x.matched).map(x=>x.detail),pending:programs.pending&&majors.length>0};
}
export function factorFor(result:FitResult|null|undefined,key:FitFactorKey){return result?.factors.find(f=>f.key===key)}
export function fitTooltip(result:FitResult|null|undefined){if(!result||result.percent==null)return 'Not enough verified information to calculate a match';return result.percent+'% Match across '+result.evaluated+' checked factor'+(result.evaluated===1?'':'s')+'. '+(result.unavailable.length?'Not yet evaluated: '+result.unavailable.join(', ')+'. ':'')+'This does not measure a coach’s recruiting interest.'}
