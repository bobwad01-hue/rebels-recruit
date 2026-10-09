import {createHash} from 'node:crypto';

export type CalendarEntry={eventKey:string;eventId:string;name:string;date:string;end_date:string|null;location:string|null;description:string|null;registration_url:string|null};
type RawEvent={uid:string;start:string;end:string;name:string;location:string;description:string;url:string;status:string;rule:string;exdates:string[];recurrenceId:string};
const day=(s:string)=>{const x=s.match(/^(\d{4})(\d{2})(\d{2})/);return x?`${x[1]}-${x[2]}-${x[3]}`:''};
const add=(s:string,n:number)=>{const d=new Date(s+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
const daysBetween=(a:string,b:string)=>Math.round((Date.parse(b+'T12:00:00Z')-Date.parse(a+'T12:00:00Z'))/86400000);
const unescapeText=(s:string)=>s.replace(/\\n/gi,'\n').replace(/\\,/g,',').replace(/\\;/g,';').replace(/\\\\/g,'\\');
const weekday=(s:string)=>['SU','MO','TU','WE','TH','FR','SA'][new Date(s+'T12:00:00Z').getUTCDay()];
function occurrences(e:RawEvent,lower:string,upper:string){
 const start=day(e.start);if(!start)return [];
 if(!e.rule)return start>=lower&&start<=upper?[start]:[];
 const opts=Object.fromEntries(e.rule.split(';').map(p=>p.split('='))) as Record<string,string>;
 const freq=opts.FREQ||'',interval=Math.max(1,Number(opts.INTERVAL)||1),until=day(opts.UNTIL||'')||upper,count=Math.min(5000,Number(opts.COUNT)||5000);
 const bydays=(opts.BYDAY||weekday(start)).split(',').map(s=>s.replace(/^[+-]?\d+/,''));
 const bymonths=(opts.BYMONTH||'').split(',').map(Number);
 const bymonthdays=(opts.BYMONTHDAY||'').split(',').map(Number);
 const out:string[]=[];let emitted=0;
 for(let offset=0;offset<Math.min(11000,daysBetween(start,upper)+1);offset++){
  const current=add(start,offset);if(current>until||current>upper)break;
  const date=new Date(current+'T12:00:00Z');
  const startDate=new Date(start+'T12:00:00Z');
  const monthDiff=(date.getUTCFullYear()-startDate.getUTCFullYear())*12+date.getUTCMonth()-startDate.getUTCMonth();
  let match=false;
  if(freq==='DAILY')match=offset%interval===0;
  if(freq==='WEEKLY')match=Math.floor(offset/7)%interval===0&&bydays.includes(weekday(current));
  if(freq==='MONTHLY')match=monthDiff%interval===0&&(bymonthdays.length?bymonthdays.includes(date.getUTCDate()):date.getUTCDate()===startDate.getUTCDate());
  if(freq==='YEARLY')match=(date.getUTCFullYear()-startDate.getUTCFullYear())%interval===0&&date.getUTCMonth()===startDate.getUTCMonth()&&date.getUTCDate()===startDate.getUTCDate();
  if(bymonths.length&&!bymonths.includes(date.getUTCMonth()+1))match=false;
  if(!match)continue;
  emitted++;if(emitted>count)break;
  if(current>=lower)out.push(current);
  if(out.length>=1500)break;
 }
 return out;
}
export function parsePublicIcs(source:string,organizationId:string,now=new Date()):CalendarEntry[]{
 if(!/BEGIN:VCALENDAR/.test(source))throw new Error('The URL did not return an iCalendar feed.');
 const unfolded=source.replace(/\r\n/g,'\n').replace(/\n[ \t]/g,'').split('\n');
 const raw:RawEvent[]=[];let props:Record<string,string[]>|null=null;
 for(const line of unfolded){
  if(line==='BEGIN:VEVENT'){props={};continue}
  if(line==='END:VEVENT'&&props){const first=(k:string)=>props?.[k]?.[0]||'';raw.push({uid:first('UID'),start:first('DTSTART'),end:first('DTEND'),name:unescapeText(first('SUMMARY'))||'Calendar event',location:unescapeText(first('LOCATION')),description:unescapeText(first('DESCRIPTION')),url:first('URL'),status:first('STATUS'),rule:first('RRULE'),exdates:props.EXDATE||[],recurrenceId:first('RECURRENCE-ID')});props=null;continue}
  if(!props)continue;const idx=line.indexOf(':');if(idx<0)continue;const key=line.slice(0,idx).split(';')[0].toUpperCase();(props[key]??=[]).push(line.slice(idx+1));
 }
 const lower=add(now.toISOString().slice(0,10),-120),upper=add(now.toISOString().slice(0,10),730);
 const overrides=new Map<string,RawEvent>();for(const e of raw)if(e.recurrenceId&&e.uid)overrides.set(e.uid+'|'+day(e.recurrenceId),e);
 const result=new Map<string,CalendarEntry>();
 function store(e:RawEvent,instance:string){if(e.status==='CANCELLED'||!e.uid||!instance||instance<lower||instance>upper)return;
  const key=e.uid+'|'+instance,hash=createHash('sha256').update(key).digest('hex').slice(0,32);
  const url=/^https?:\/\//i.test(e.url)?e.url:null;
  const duration=e.end&&e.start?Math.max(0,daysBetween(day(e.start),day(e.end))):0;
  result.set(key,{eventKey:key,eventId:`google:${organizationId}:${hash}`,name:e.name,date:instance,end_date:duration?add(instance,duration):null,location:e.location||null,description:e.description||null,registration_url:url});}
 for(const e of raw){if(e.recurrenceId||e.status==='CANCELLED')continue;const excluded=new Set(e.exdates.flatMap(x=>x.split(',').map(day)));
  for(const instance of occurrences(e,lower,upper)){if(excluded.has(instance))continue;const override=overrides.get(e.uid+'|'+instance);if(override){store(override,day(override.start)||instance)}else store(e,instance)}
 }
 for(const e of raw)if(e.recurrenceId&&!raw.some(base=>base.uid===e.uid&&!base.recurrenceId)){store(e,day(e.start))}
 return [...result.values()].sort((a,b)=>a.date.localeCompare(b.date));
}
export function normalizePublicGoogleIcs(input:string){
 let u:URL;try{u=new URL(input.trim().replace(/^webcal:\/\//i,'https://'))}catch{throw new Error('Enter a valid Google Calendar public iCal URL.')}
 if(u.protocol!=='https:'||u.hostname!=='calendar.google.com'||u.port||u.username||u.password||!/^\/calendar\/ical\/[^/]+\/public\/basic\.ics$/.test(u.pathname)||u.search||u.hash)throw new Error('Use the Public address in iCal format from Google Calendar settings (not a secret or private link).');
 return u.toString();
}
export async function fetchPublicIcs(url:string,organizationId:string){
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),15000);
 try{const res=await fetch(url,{redirect:'error',signal:controller.signal,cache:'no-store',headers:{Accept:'text/calendar,text/plain'}});if(!res.ok)throw new Error('Google Calendar returned '+res.status);
  const length=Number(res.headers.get('content-length')||0);if(length>4_000_000)throw new Error('Calendar feed exceeds 4 MB.');
  const body=await res.text();if(body.length>4_000_000)throw new Error('Calendar feed exceeds 4 MB.');
  return parsePublicIcs(body,organizationId);
 }finally{clearTimeout(timer)}
}
