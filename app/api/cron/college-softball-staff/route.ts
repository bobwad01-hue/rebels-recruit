import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

export const runtime = "nodejs";
export const maxDuration = 60;

const FETCH_TIMEOUT_MS=12000;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!,
  { auth: { persistSession: false } }
);

const clean=(s:string)=>s.replace(/<[^>]*>/g," ").replace(/&amp;/g,"&").replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/\s+/g," ").trim();
const abs=(u:string,b:string)=>{try{return new URL(u,b).toString()}catch{return ""}};
const hash=(s:string)=>crypto.createHash("sha256").update(s).digest("hex");

function role(title:string){
 const t=title.toLowerCase();
 const recruiting=/recruit(ing|ment) coordinator/.test(t);
 let category="other_coaching_staff", order=90;
 if(/head.*coach|head softball/.test(t)&&!/associate|assistant/.test(t)){category="head_coach";order=10}
 else if(/associate.*head/.test(t)){category="associate_head_coach";order=20}
 else if(recruiting){category="recruiting_coordinator";order=30}
 else if(/pitching.*coach/.test(t)){category="pitching_coach";order=40}
 else if(/hitting.*coach/.test(t)){category="hitting_coach";order=45}
 else if(/assistant.*coach|assistant softball/.test(t)){category="assistant_coach";order=50}
 else if(/graduate.*assistant/.test(t)){category="graduate_assistant";order=60}
 else if(/volunteer.*assistant/.test(t)){category="volunteer_assistant";order=70}
 return {category,order,recruiting};
}

const USER_AGENT="RLTNL-College-Staff-Intelligence";
const robotsCache=new Map<string,string>();
async function allowedByRobots(url:string){
 try{
  const u=new URL(url); const origin=u.origin;
  let txt=robotsCache.get(origin);
  if(txt===undefined){
   const r=await fetch(origin+"/robots.txt",{redirect:"follow",headers:{"user-agent":USER_AGENT+"/1.0 (+https://www.rltnl.com)"}});
   txt=r.ok?await r.text():""; robotsCache.set(origin,txt);
  }
  let applies=false; const rules:string[]=[];
  for(const raw of txt.split(/\\r?\\n/)){
   const line=raw.split("#")[0].trim(); if(!line) continue;
   const [k,...rest]=line.split(":"); const v=rest.join(":").trim();
   if(k.toLowerCase()==="user-agent"){applies=v==="*"||v.toLowerCase()===USER_AGENT.toLowerCase(); continue}
   if(applies&&k.toLowerCase()==="disallow"&&v) rules.push(v);
  }
  return !rules.some(rule=>u.pathname.startsWith(rule));
 }catch{return false}
}
async function get(url:string){
 if(!(await allowedByRobots(url))) throw new Error("Blocked by robots.txt");
 const r=await fetch(url,{redirect:"follow",signal:AbortSignal.timeout(FETCH_TIMEOUT_MS),headers:{"user-agent":USER_AGENT+"/1.0 (+https://www.rltnl.com)","accept":"text/html,application/xhtml+xml"}});
 if(!r.ok) throw new Error(`${r.status} ${r.statusText}`);
 return {html:await r.text(),url:r.url,status:r.status};
}

function links(html:string,base:string){
 return [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
  .map(m=>({url:abs(m[1],base),text:clean(m[2])})).filter(x=>x.url);
}
function sameHost(a:string,b:string){try{return new URL(a).hostname.replace(/^www\./,"")===new URL(b).hostname.replace(/^www\./,"")}catch{return false}}

function scoreLink(x:{url:string,text:string},kind:"softball"|"staff"){
 const s=(x.text+" "+x.url).toLowerCase(); const path=(()=>{try{return new URL(x.url).pathname.toLowerCase()}catch{return ""}})();
 let n=0;
 if(kind==="softball"){
   if(/softball/.test(s))n+=12;if(/sports\/softball/.test(s))n+=16;if(/\/sports\/softball(?:\/|$)/.test(path))n+=12;
   if(/\/sports\/softball\/coaches/.test(path))n+=35;
   if(/\/sports\/softball\/(?:schedule|news|stats|archives|tickets|roster)(?:\/|$)/.test(path))n-=45;
   if(/schedule|news|article|tickets|stats|archives/.test(x.text.toLowerCase()))n-=30;
 } else {
   if(/\/sports\/softball\/coaches(?:\/|$)/.test(path))n+=50;
   if(/softball/.test(s))n+=12;if(/coach|staff/.test(s))n+=10;if(/staff-directory/.test(path))n+=7;if(/bio/.test(s))n+=2;
   if(/schedule|news|article|tickets|stats|archives|facilities/.test(s))n-=50;
 }
 return n;
}
function bestLink(xs:{url:string,text:string}[],kind:"softball"|"staff",base:string){
 return xs.filter(x=>sameHost(x.url,base)).map(x=>({x,n:scoreLink(x,kind)})).filter(x=>x.n>0).sort((a,b)=>b.n-a.n)[0]?.x.url;
}
async function tryGet(urls:string[]){
 for(const url of [...new Set(urls.filter(Boolean))]){try{return await get(url)}catch{}}
 return null;
}
async function discover(start:string){
 const home=await get(start); const ls=links(home.html,home.url);
 const athleticCandidates=ls.filter(x=>/athletics?|sports/i.test(x.text+" "+x.url)&&!/facebook|instagram|twitter|x\.com/i.test(x.url)).sort((x,y)=>(/athletics/i.test(y.text)?2:0)-(/athletics/i.test(x.text)?2:0));
 const a=athleticCandidates.length?await tryGet(athleticCandidates.slice(0,5).map(x=>x.url)):home;
 const athletics=a||home; const sl=links(athletics.html,athletics.url);
 let softball=bestLink(sl,"softball",athletics.url);
 // Official athletics sites commonly expose predictable softball routes even when the school homepage does not link them cleanly.
 if(!softball){
   const origin=new URL(athletics.url).origin;
   const probe=await tryGet([origin+"/sports/softball",origin+"/sports/softball/",origin+"/sports/softball/roster",origin+"/sports/softball/schedule"]);
   if(probe) softball=probe.url;
 }
 if(!softball) throw new Error("Official softball page not discovered");
 const s=await get(softball); const staffLinks=links(s.html,s.url);
 const origin=new URL(s.url).origin;
 let staff=bestLink(staffLinks,"staff",s.url);
 if(!staff){
   const coachPage=await tryGet([origin+"/sports/softball/coaches",origin+"/sports/softball/coaches/",origin+"/sports/softball/roster?path=softball"]);
   if(coachPage) staff=coachPage.url;
 }
 if(!staff){
   const directory=sl.find(x=>sameHost(x.url,athletics.url)&&/staff\s*directory|staff-directory/i.test(x.text+" "+x.url))?.url;
   if(directory) staff=directory;
 }
 // Never treat schedule/news/etc. as a staff source merely because it is a softball page.
 if(!staff||/\/(schedule|news|stats|archives|tickets|facilities)(?:\/|$)/i.test(new URL(staff).pathname)) throw new Error("Official softball staff page not discovered");
 return {athletics_url:athletics.url,softball_url:s.url,staff_url:staff};
}

function plausibleName(name:string){
 const n=name.trim();
 if(!/^[A-Z][A-Za-z.'’-]+(?:\s+[A-Z][A-Za-z.'’-]+){1,3}$/.test(n)) return false;
 if(/\b(Stadium|Field|Center|Complex|Development|Academic|Success|Tryouts?|Tickets?|Roster|Schedule|News|Facilities|Archives?|Parking|Map|Women|Rise|Weather|Line|Full|Bio|View|Recruit|Questionnaire|Media|Almanac|Guide|Record|Book)\b/i.test(n)) return false;
 if(/\b(University|College|Athletics|Softball|Baseball|Basketball|Football|Volleyball|Soccer|Association|Additional|Links?|Camp|Staff|Directory|Department|Sports?|Coach(?:es)?|National|Christian University's)\b/i.test(n)) return false;
 return true;
}
function extract(html:string,url:string){
 const path=new URL(url).pathname;
 const dedicated=/softball|w-softbl/i.test(path);
 const departmentScoped=/staff-directory\/(?:softball-department|department\/softball)/i.test(path);
 // Work from semantic rows/cards first. The fallback fragments handle Sidearm and custom athletics templates.
 const candidates=[
   ...[...html.matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi)].map(m=>m[0]),
   ...[...html.matchAll(/<li\b[^>]*>[\s\S]*?<\/li>/gi)].map(m=>m[0]),
   ...[...html.matchAll(/<article\b[^>]*>[\s\S]*?<\/article>/gi)].map(m=>m[0]),
   ...html.split(/<\/(?:section|div)>/i)
 ].filter(x=>/coach|coordinator|graduate assistant/i.test(clean(x)));
 const out:any[]=[];
 for(const block of candidates){
  const text=clean(block);
  if(!/coach|coordinator|graduate assistant/i.test(text)) continue;
  if(!dedicated&&!departmentScoped&&!/softball/i.test(text)) continue;
  // Some department-filtered Sidearm pages still render every sport in the HTML. Require local softball evidence there too.
  if(departmentScoped&&!/softball/i.test(text)) continue;
  if(/\b(strength|conditioning|athletic trainer|sports medicine|communications?|academic|nutrition|dietitian|administrator|sport administrator|video|creative|manager|operations|player development|performance)\b/i.test(text)
     && !/\b(head|associate head|assistant|pitching|hitting)\s+(?:softball\s+)?coach\b|recruit(?:ing|ment) coordinator/i.test(text)) continue;
  if(/\b(baseball|basketball|football|volleyball|soccer|lacrosse|tennis|golf|wrestling|track|cross country|swimming)\b/i.test(text)&&!/softball/i.test(text)) continue;
  const titleMatch=text.match(/((?:Associate\s+Head|Head|Assistant|Volunteer\s+Assistant|Graduate\s+Assistant|Pitching|Hitting)[^|,;]{0,55}(?:Softball\s+)?Coach(?:\/[^|,;]{0,35})?|(?:Recruit(?:ing|ment)|Pitching|Hitting)\s+Coordinator|Graduate\s+Assistant)/i);
  if(!titleMatch) continue;
  let title=titleMatch[1].trim()
    .replace(/\s+[\w.+-]+@[\w.-]*(?:\.\w{0,})?.*$/i,"")
    .replace(/\s+\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}.*$/,"")
    .replace(/\s+@[A-Za-z0-9_]+.*$/,"")
    .trim();
  if(/strength|conditioning|trainer|operations|player development|performance/i.test(title)) continue;
  const blockLinks=links(block,url);
  // Mixed directories can contain many sports; bind a row to softball rather than trusting a broad parent fragment.
  if(!dedicated && !/softball/i.test(text)) continue;
  const email=(block.match(/mailto:([^"'?\s>]+)/i)?.[1]||"").replace(/[.,;]+$/,"").toLowerCase()||null;
  const profile=blockLinks.find(a=>sameHost(a.url,url)&&/(?:\/coaches?\/|\/staff-directory\/|\/staff\/)/i.test(a.url)&&plausibleName(a.text));
  if(!dedicated&&!departmentScoped && profile && !/softball/i.test(text.slice(Math.max(0,text.indexOf(profile.text)-120),text.indexOf(profile.text)+220))) continue;
  const profileName=profile?.text?.trim()||"";
  const before=text.split(title)[0].trim();
  const fallback=before.match(/([A-Z][A-Za-z.'’-]+(?:\s+[A-Z][A-Za-z.'’-]+){1,3})\s*$/)?.[1]||"";
  let name=plausibleName(profileName)?profileName:(plausibleName(fallback)?fallback:"");
  if(!name){
    const names=blockLinks.map(a=>a.text.trim()).filter(plausibleName);
    name=names[0]||"";
  }
  // On a dedicated softball roster/coaches page, the page context itself is authoritative.
  // On mixed directories, still require direct contact/profile evidence.
  if(!name||(!dedicated&&!departmentScoped&&!email&&!profile)) continue;
  const parts=name.split(/\s+/); const first_name=parts.shift()!, last_name=parts.join(" ");
  const phone=text.match(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/)?.[0]||null;
  const x=blockLinks.find(a=>/^(https?:\/\/)?(?:www\.)?(?:x\.com|twitter\.com)\//i.test(a.url));
  const rr=role(title);
  out.push({first_name,last_name,title,email,phone,x_url:x?.url||null,x_handle:x?("@"+new URL(x.url).pathname.split("/").filter(Boolean)[0]):null,official_bio_url:profile?.url||null,role_category:rr.category,is_recruiting_coordinator:rr.recruiting,staff_sort_order:rr.order});
 }
 return [...new Map(out.map(x=>[x.email||(`${x.first_name} ${x.last_name}`).toLowerCase(),x])).values()]
   .filter(x=>x.role_category!=="other_coaching_staff" || /pitching|hitting coordinator|graduate assistant/i.test(x.title));
}

export async function POST(req:NextRequest){
 const auth=req.headers.get("authorization");
 const manualKey=req.headers.get("x-rlt-ingestion-key");
 const cronOk=Boolean(process.env.CRON_SECRET && auth===`Bearer ${process.env.CRON_SECRET}`);
 const manualOk=Boolean(process.env.STAFF_INGESTION_MANUAL_KEY && manualKey===process.env.STAFF_INGESTION_MANUAL_KEY);
 const internalTrigger=req.headers.get("x-vercel-cron")==="1";
 if(!cronOk && !manualOk && !internalTrigger) return NextResponse.json({error:"Unauthorized"},{status:401});
 const body=await req.json().catch(()=>({}));
 const approvedPilotIds=new Set(["1ad3f717-06f1-42ba-8846-d25af5dfe5e0","76ec4683-6660-4f28-9202-8ad95b7fa51d","7807b761-19c4-4985-a037-e0d101b406dd","5f6b8905-b694-4f86-8dd0-13589844610c","780e372c-dcc4-41ea-9984-962e78c27cdf","08cb7422-5392-44c7-9e0e-ecb0dc3ecf01","4fcfa4d1-aee8-4439-a85d-dbc76ca39675","aa8d21bc-9693-4d24-b28f-50aa805cadd3","d0736a10-3714-40ff-9a15-e878a66bde6e","e369965b-0e9a-42c7-afbb-506359ba4c30"]);
 const approvedExpansionIds=new Set(["aa9f860e-1cf3-4259-9af2-b29d2893fb62","3f70500b-0847-4398-8cb3-0e9c93a77cbd","644b79c9-6b52-400d-93d4-f62f03369c9e","6d8b983f-9209-4cdc-9c8d-363d7ea7d112","14adc832-92ce-4771-9ae9-6d06320c7e40","5f863060-16e1-4b29-b67f-e4dcd6dc407d","1d142cd0-9aa7-4354-94bf-ff12c852be4d","699e0f6e-e751-48b1-ab3e-68fddb6ecfbb","30b625a4-cd95-4cd4-a001-cac303ccbc13","818c9f94-30fd-4b0e-a495-ec6858e69c43"]);
 if(internalTrigger && !cronOk && !manualOk && body.dry_run!==true && body.bootstrap!==true){
   const ids=Array.isArray(body.college_ids)?body.college_ids:[];
   const allowed=body.expansion_write===true?approvedExpansionIds:approvedPilotIds;
   if((body.pilot_write!==true&&body.expansion_write!==true) || ids.length===0 || ids.some((id:string)=>!allowed.has(id))) return NextResponse.json({error:"Controlled write not authorized"},{status:403});
 }
 const bootstrap=body.bootstrap===true;
 const limit=Math.min(Math.max(Number(body.limit)||10,1),bootstrap?50:25);
 const offset=Math.max(Number(body.offset)||0,0);
 const dryRun=body.dry_run===true;
 const persistDryRun=body.persist_dry_run===true;
 let query=supabase.from("colleges").select("id,name,website,division").not("website","is",null).order("name").range(offset,offset+limit-1);
 if(bootstrap) query=query.or("division.ilike.%D1%,division.ilike.%Division I%");
 if(body.college_id) query=query.eq("id",body.college_id);
 if(Array.isArray(body.college_ids)&&body.college_ids.length) query=query.in("id",body.college_ids.slice(0,25));
 const {data:colleges,error}=await query; if(error) throw error;
 const results:any[]=[];
 for(const college of colleges||[]){
  try{
   const {data:knownSource}=await supabase.from("college_softball_sources").select("athletics_url,softball_url,staff_url,status").eq("college_id",college.id).maybeSingle();
   let d:any;
   let page:any;
   if(knownSource?.staff_url){
    try{
     page=await get(knownSource.staff_url);
     d={athletics_url:knownSource.athletics_url||new URL(page.url).origin,softball_url:knownSource.softball_url||knownSource.staff_url,staff_url:page.url};
    }catch{
     d=await discover(college.website); page=await get(d.staff_url);
    }
   }else{
    d=await discover(college.website); page=await get(d.staff_url);
   }
   const coaches=extract(page.html,page.url); const now=new Date().toISOString();
   const suspicious=coaches.length===0||coaches.length>8||coaches.some((x:any)=>!plausibleName(`${x.first_name} ${x.last_name}`))||!coaches.some((x:any)=>x.role_category==="head_coach");
   if(bootstrap&&suspicious){
     await supabase.from("college_softball_sources").upsert({college_id:college.id,...d,last_checked_at:now,last_status:page.status,content_hash:hash(page.html),status:"review",updated_at:now});
     await supabase.from("college_staff_bootstrap_queue").update({status:"review",attempts:1,last_error:"Bootstrap quality gate",updated_at:now}).eq("college_id",college.id);
     results.push({college:college.name,status:"review",staff_url:page.url,coaches:coaches.length,error:"Bootstrap quality gate"}); continue;
   }
   if(!dryRun) await supabase.from("college_softball_sources").upsert({college_id:college.id,...d,last_checked_at:now,last_success_at:now,last_status:page.status,content_hash:hash(page.html),status:coaches.length?"healthy":"review",updated_at:now});
   for(const c of coaches){
    if(dryRun) continue;
    const confidence=c.email&&c.official_bio_url?0.98:c.email?0.94:c.official_bio_url?0.90:0.75;
    const verificationStatus=confidence>=0.94?"high_confidence":"review";
    let existing:any=null;
    if(c.email){
      const r=await supabase.from("college_coaches").select("id").eq("college_id",college.id).ilike("email",c.email).maybeSingle(); existing=r.data;
    } else {
      const r=await supabase.from("college_coaches").select("id").eq("college_id",college.id).ilike("first_name",c.first_name).ilike("last_name",c.last_name).maybeSingle(); existing=r.data;
    }
    const row={college_id:college.id,...c,official_source_url:page.url,official_source_checked_at:now,official_source_status:verificationStatus,official_source_hash:hash(page.html),last_verified_at:null,verification_status:verificationStatus,verification_confidence:confidence,source_urls:[page.url]};
    const {data:saved,error:saveErr}=existing?.id?await supabase.from("college_coaches").update(row).eq("id",existing.id).select("id").single():await supabase.from("college_coaches").insert(row).select("id").single();
    if(saveErr) throw saveErr;
    await supabase.from("college_coach_source_snapshots").insert({college_id:college.id,coach_id:saved.id,source_url:page.url,observed_name:`${c.first_name} ${c.last_name}`,observed_title:c.title,observed_email:c.email,observed_phone:c.phone,observed_x_url:c.x_url,observed_x_handle:c.x_handle,observed_bio_url:c.official_bio_url,content_hash:hash(page.html),confidence,verification_status:verificationStatus,raw_evidence:{official_source:true,parser:"conservative-v2"}});
   }
   if(bootstrap) await supabase.from("college_staff_bootstrap_queue").update({status:"imported",attempts:1,last_error:null,updated_at:now}).eq("college_id",college.id);
   results.push({college:college.name,status:"ok",staff_url:page.url,coaches:coaches.length,extracted:coaches.map(c=>({name:`${c.first_name} ${c.last_name}`,title:c.title,email:c.email,phone:c.phone,x_url:c.x_url,bio:c.official_bio_url}))});
  }catch(e:any){
   if(!dryRun) await supabase.from("college_softball_sources").upsert({college_id:college.id,last_checked_at:new Date().toISOString(),status:"review",updated_at:new Date().toISOString()});
   if(bootstrap){const msg=e?.message||String(e);await supabase.from("college_staff_bootstrap_queue").update({status:/403|robots/i.test(msg)?"blocked":"review",attempts:1,last_error:msg,updated_at:new Date().toISOString()}).eq("college_id",college.id);}
   results.push({college:college.name,status:"review",error:e?.message||String(e)});
  }
 }
 if(dryRun&&persistDryRun){
  const now=new Date().toISOString();
  for(const r of results){
   const college=(colleges||[]).find((x:any)=>x.name===r.college);
   if(!college) continue;
   await supabase.from("college_staff_dry_runs").insert({college_id:college.id,college_name:r.college,status:r.status,staff_url:r.staff_url||null,result:r,created_at:now});
  }
 }
 return NextResponse.json({processed:results.length,dry_run:dryRun,results});
}
