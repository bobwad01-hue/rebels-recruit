import {NextResponse} from 'next/server';
import {inflateRawSync} from 'node:zlib';
import {createAdminClient} from '@/lib/supabase-admin';
export const maxDuration=300;
const TOKEN='ipeds-2025-rltnl-8f2c1a';
const states:any={Alabama:'AL',Alaska:'AK',Arizona:'AZ',Arkansas:'AR',California:'CA',Colorado:'CO',Connecticut:'CT',Delaware:'DE',Florida:'FL',Georgia:'GA',Hawaii:'HI',Idaho:'ID',Illinois:'IL',Indiana:'IN',Iowa:'IA',Kansas:'KS',Kentucky:'KY',Louisiana:'LA',Maine:'ME',Maryland:'MD',Massachusetts:'MA',Michigan:'MI',Minnesota:'MN',Mississippi:'MS',Missouri:'MO',Montana:'MT',Nebraska:'NE',Nevada:'NV','New Hampshire':'NH','New Jersey':'NJ','New Mexico':'NM','New York':'NY','North Carolina':'NC','North Dakota':'ND',Ohio:'OH',Oklahoma:'OK',Oregon:'OR',Pennsylvania:'PA','Rhode Island':'RI','South Carolina':'SC','South Dakota':'SD',Tennessee:'TN',Texas:'TX',Utah:'UT',Vermont:'VT',Virginia:'VA',Washington:'WA','West Virginia':'WV',Wisconsin:'WI',Wyoming:'WY'};
const norm=(s:string)=>String(s||'').toLowerCase().replace(/&/g,'and').replace(/[–—-]/g,' ').replace(/[^a-z0-9]+/g,' ').trim();
const loose=(s:string,state:string)=>norm(s).replace(new RegExp('\\b'+norm(state)+'\\b','g'),' ').replace(/\b(the|university|college|of|at|campus|main)\b/g,' ').replace(/\s+/g,' ').trim();
function unzip(buf:Buffer,prefix:string){let p=0;while(p+30<buf.length){if(buf.readUInt32LE(p)!==0x04034b50){p++;continue}const method=buf.readUInt16LE(p+8),cs=buf.readUInt32LE(p+18),ns=buf.readUInt16LE(p+26),es=buf.readUInt16LE(p+28),name=buf.subarray(p+30,p+30+ns).toString();const start=p+30+ns+es;if(name.toUpperCase().startsWith(prefix)&&name.toLowerCase().endsWith('.csv')){const d=buf.subarray(start,start+cs);return(method===8?inflateRawSync(d):d).toString('utf8')}p=start+cs}throw new Error('CSV missing '+prefix)}
function csv(text:string){const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/).filter(Boolean),row=(line:string)=>{const a:string[]=[];let v='',q=false;for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'){if(q&&line[i+1]==='"'){v+='"';i++}else q=!q}else if(ch===','&&!q){a.push(v);v=''}else v+=ch}a.push(v);return a};const h=row(lines[0]).map(x=>x.toUpperCase());return lines.slice(1).map(l=>{const v=row(l),o:any={};h.forEach((k,i)=>o[k]=v[i]??'');return o})}
async function zipCsv(url:string,prefix:string){const r=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0 (compatible; RLTNL-IPEDSSync/1.0)','Referer':'https://nces.ed.gov/ipeds/datacenter/DataFiles.aspx'}});if(!r.ok)throw new Error(url+' '+r.status);return csv(unzip(Buffer.from(await r.arrayBuffer()),prefix))}
async function textCsv(url:string){const r=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0 (compatible; RLTNL-IPEDSSync/1.0)','Referer':'https://nces.ed.gov/ipeds/cipcode/resources.aspx'}});if(!r.ok)throw new Error(url+' '+r.status);return csv(await r.text())}
export async function GET(req:Request){if(new URL(req.url).searchParams.get('token')!==TOKEN)return NextResponse.json({error:'forbidden'},{status:403});try{
 const sb=createAdminClient();
 const [hd,comp,cips]=await Promise.all([
  zipCsv('https://nces.ed.gov/ipeds/complete-data-files/HD2025.zip','HD2025'),
  zipCsv('https://nces.ed.gov/ipeds/complete-data-files/C2025_A.zip','C2025_A'),
  textCsv('https://nces.ed.gov/ipeds/cipcode/Files/CIPCode2020.csv')
 ]);
 const titles=new Map(cips.filter((r:any)=>/^\d{2}\.\d{4}$/.test(String(r.CIPCODE||r['CIP CODE']||''))).map((r:any)=>[String(r.CIPCODE||r['CIP CODE']),String(r.CIPTITLE||r['CIP TITLE']||'').replace(/\.$/,'')]));
 const{data:schools,error}=await sb.from('colleges').select('id,name,state');if(error)throw error;
 const exact=new Map<string,any[]>(),looseMap=new Map<string,any[]>();
 for(const r of hd){const st=String(r.STABBR||'').toUpperCase(),e=norm(r.INSTNM)+'|'+st,l=loose(r.INSTNM,st)+'|'+st;(exact.get(e)||exact.set(e,[]).get(e)!).push(r);(looseMap.get(l)||looseMap.set(l,[]).get(l)!).push(r)}
 const matched=new Map<number,string>(),unmatched:string[]=[];
 for(const s of schools||[]){const st=states[s.state]||String(s.state||'').toUpperCase();let a=exact.get(norm(s.name)+'|'+st)||[];if(a.length!==1)a=looseMap.get(loose(s.name,s.state)+'|'+st)||[];if(a.length===1){const unit=Number(a[0].UNITID);matched.set(unit,s.id);await sb.from('colleges').update({ipeds_unitid:unit}).eq('id',s.id)}else unmatched.push(s.name)}
 const agg=new Map<string,any>();
 for(const r of comp){const unit=Number(r.UNITID),college_id=matched.get(unit),level=Number(r.AWLEVEL),total=Number(r.CTOTALT||0),cip=String(r.CIPCODE||'').trim();if(!college_id||![3,5].includes(level)||total<=0||!titles.has(cip))continue;const k=college_id+'|'+cip+'|'+level;const x=agg.get(k)||{college_id,ipeds_unitid:unit,cip_code:cip,cip_title:titles.get(cip),award_level:level,completions:0,reporting_year:2025,source:'IPEDS'};x.completions+=total;agg.set(k,x)}
 const rec=[...agg.values()];const{error:de}=await sb.from('college_programs').delete().eq('source','IPEDS');if(de)throw de;
 for(let i=0;i<rec.length;i+=500){const{error:e}=await sb.from('college_programs').upsert(rec.slice(i,i+500),{onConflict:'college_id,cip_code,award_level,reporting_year'});if(e)throw e}
 return NextResponse.json({ok:true,schools:(schools||[]).length,matched:matched.size,unmatched:unmatched.length,programRows:rec.length,uniqueMajors:new Set(rec.map(x=>x.cip_title)).size,year:2025,unmatchedSample:unmatched.slice(0,30)});
 }catch(e){return NextResponse.json({ok:false,error:String(e)},{status:500})}}
