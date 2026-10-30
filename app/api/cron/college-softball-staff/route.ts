import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";
import {createClient as createSessionClient} from "@/lib/supabase-server";

export const runtime = "nodejs";
export const maxDuration = 60;
const WORKER_BATCH=5;
const STALE_PROCESSING_MINUTES=10;

const FETCH_TIMEOUT_MS=12000;

function initializeSupabase() {
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if(!url || !key) throw new Error("Supabase service is not configured.");
  return createClient(url,key,{auth:{persistSession:false}});
}
let cachedSupabase:ReturnType<typeof initializeSupabase>|undefined;
// Delay construction until a cron request executes; preview builds do not have production secrets.
const supabase = new Proxy({} as ReturnType<typeof initializeSupabase>, {
  get(_target,property) {
    cachedSupabase ??= initializeSupabase();
    return Reflect.get(cachedSupabase,property);
  }
});

const clean=(s:string)=>s.replace(/<[^>]*>/g," ").replace(/&amp;/g,"&").replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/\s+/g," ").trim();
const abs=(u:string,b:string)=>{try{return new URL(u,b).toString()}catch{return ""}};
const hash=(s:string)=>crypto.createHash("sha256").update(s).digest("hex");

function role(title:string){
 const t=title.toLowerCase().replace(/\([^)]*\)/g," ").trim();
 const recruiting=/recruit(ing|ment) coordinator/.test(t);
 let category="other_coaching_staff", order=90;
 if(/\b(?:head\s+softball(?:\/[a-z]+)?\s+coach|softball\s+head\s+coach|head\s+coach)\b/.test(t)
   && !/\b(?:associate|assistant)\s+head\s+(?:softball\s+)?coach\b/.test(t)){category="head_coach";order=10}
 else if(/associate.*head/.test(t)){category="associate_head_coach";order=20}
 else if(recruiting){category="recruiting_coordinator";order=30}
 else if(/pitching.*coach/.test(t)){category="pitching_coach";order=40}
 else if(/hitting.*coach/.test(t)){category="hitting_coach";order=45}
 else if(/graduate.*assistant/.test(t)){category="graduate_assistant";order=60}
 else if(/volunteer.*assistant/.test(t)){category="volunteer_assistant";order=70}
 else if(/assistant.*coach|assistant softball|softball\s+assistant/.test(t)){category="assistant_coach";order=50}
 return {category,order,recruiting};
}

const USER_AGENT="RLTNL-College-Staff-Intelligence";
const robotsCache=new Map<string,string>();
async function allowedByRobots(url:string){
 try{
  const u=new URL(url); const origin=u.origin;
  let txt=robotsCache.get(origin);
  if(txt===undefined){
   const r=await fetch(origin+"/robots.txt",{redirect:"follow",signal:AbortSignal.timeout(4000),headers:{"user-agent":USER_AGENT+"/1.0 (+https://www.rltnl.com)"}});
   txt=r.ok?await r.text():""; robotsCache.set(origin,txt);
  }
  let applies=false; const rules:string[]=[];
  for(const raw of txt.split(/\r?\n/)){
   const line=raw.split("#")[0].trim(); if(!line) continue;
   const [k,...rest]=line.split(":"); const v=rest.join(":").trim();
   if(k.toLowerCase()==="user-agent"){applies=v==="*"||v.toLowerCase()===USER_AGENT.toLowerCase(); continue}
   if(applies&&k.toLowerCase()==="disallow"&&v) rules.push(v);
  }
  return !rules.some(rule=>u.pathname.startsWith(rule));
 }catch{return false}
}
async function get(url:string,timeoutMs=FETCH_TIMEOUT_MS){
 if(badOfficialUrl(url)) throw new Error("Non-athletics source URL rejected");
 if(!(await allowedByRobots(url))) throw new Error("Blocked by robots.txt");
 const r=await fetch(url,{redirect:"follow",signal:AbortSignal.timeout(timeoutMs),headers:{"user-agent":USER_AGENT+"/1.0 (+https://www.rltnl.com)","accept":"text/html,application/xhtml+xml"}});
 if(!r.ok) throw new Error(`${r.status} ${r.statusText}`);
 if(badOfficialUrl(r.url)) throw new Error("Redirected to a non-athletics source URL");
 return {html:await r.text(),url:r.url,status:r.status};
}

// Super Owner-confirmed coaching URLs are fetched exactly as saved.
// Never follow a redirect to another domain, a private endpoint, or a
// non-HTML document. A failed fetch remains a one-school manual review.
async function getConfirmedStaffPage(url:string,timeoutMs=FETCH_TIMEOUT_MS){
 const initial=new URL(url);
 const safe=(value:string)=>{
   try{
     const u=new URL(value),h=u.hostname.toLowerCase();
     return u.protocol==="https:"&&!u.username&&!u.password&&!u.port
       &&/^([a-z0-9-]+\.)+[a-z]{2,}$/.test(h)
       &&!/(^|\.)(localhost|local|internal|test|example|invalid)$/.test(h)
       &&!badOfficialUrl(value);
   }catch{return false}
 };
 if(!safe(url))throw new Error("Confirmed source URL is not a public HTTPS athletics page");
 let current=url;
 for(let redirect=0;redirect<4;redirect++){
   if(!safe(current)||!sameHost(current,initial.toString()))
     throw new Error("Saved coaching source redirected to an unapproved host");
   if(!(await allowedByRobots(current)))throw new Error("Blocked by robots.txt");
   const response=await fetch(current,{redirect:"manual",signal:AbortSignal.timeout(timeoutMs),
     headers:{"user-agent":USER_AGENT+"/1.0 (+https://www.rltnl.com)",
       "accept":"text/html,application/xhtml+xml"}});
   if(response.status>=300&&response.status<400){
     const location=response.headers.get("location");
     if(!location)throw new Error("Official coaching source redirected without a destination");
     current=new URL(location,current).toString();
     continue;
   }
   if(!response.ok)throw new Error(response.status+" "+response.statusText);
   if(!/text\/html|application\/xhtml\+xml/i.test(response.headers.get("content-type")||""))
     throw new Error("Saved coaching source did not return an HTML page");
   const html=await response.text();
   if(html.length>3500000)throw new Error("Saved coaching page exceeded safe size");
   return {html,url:current,status:response.status};
 }
 throw new Error("Saved coaching source redirected too many times");
}

function links(html:string,base:string){
 return [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
  .map(m=>({url:abs(m[1],base),text:clean(m[2])})).filter(x=>x.url);
}
function sameHost(a:string,b:string){try{return new URL(a).hostname.replace(/^www\./,"")===new URL(b).hostname.replace(/^www\./,"")}catch{return false}}
// A coach's social account must identify that individual. Team, sport, university,
// and unrelated athletics accounts belong elsewhere, never on a coach contact record.
function personalXLink(items:{url:string;text:string}[],firstName:string,lastName:string){
 const first=firstName.toLowerCase().replace(/[^a-z0-9]/g,"");
 const last=lastName.toLowerCase().replace(/[^a-z0-9]/g,"");
 if(!first||last.length<4) return null;
 for(const item of items){
  try{
   const u=new URL(item.url);
   if(!/^(?:www\.)?(?:x\.com|twitter\.com)$/i.test(u.hostname)) continue;
   const parts=u.pathname.split("/").filter(Boolean);
   if(parts.length!==1) continue;
   const handle=parts[0].replace(/^@/,"");
   if(!/^[a-zA-Z0-9_]{3,15}$/.test(handle)) continue;
   const key=handle.toLowerCase().replace(/_/g,"");
   if(key.includes("coach"+last)||key.includes(first+last)||key.includes(last+first)||
     (first.length>1&&key.includes(first[0]+last)&&!/(athletics|sports|softball|baseball|basketball|mbb|wbb|bsb|hoops)/i.test(key))){
    return {url:"https://x.com/"+handle,handle:"@"+handle};
   }
  }catch{}
 }
 return null;
}
function badOfficialUrl(url:string){
 try{
  const u=new URL(url), h=u.hostname.toLowerCase(), p=u.pathname.toLowerCase();
  // Match blocked providers as full hostnames. An unanchored "x.com" test
  // incorrectly rejected legitimate *phoenix.com athletics domains.
  const blockedHost=/(^|\.)(?:youtube\.com|youtu\.be|facebook\.com|instagram\.com|twitter\.com|x\.com|tiktok\.com|vimeo\.com|armssoftware\.com|ticketmaster\.com|shopify\.com|adobe\.com|imleagues\.com|totalcamps\.com|influxermerch\.com|midcosportsplus\.com|ncaa\.org|thesiac\.com|psacsports\.org)$/.test(h);
  return blockedHost || /foundation|merch|store/.test(h)
    || /error_page|splash\.aspx|page-not-found|athletic-scholarships|give\/|foundation|merch|store/.test(p);
 }catch{return true}
}

function scoreLink(x:{url:string,text:string},kind:"softball"|"staff"){
 const s=(x.text+" "+x.url).toLowerCase(); const path=(()=>{try{return new URL(x.url).pathname.toLowerCase()}catch{return ""}})();
 let n=0;
 if(kind==="softball"){
   if(/softball/.test(s))n+=12;if(/sports\/softball/.test(s))n+=16;if(/\/sports\/softball(?:\/|$)/.test(path))n+=12;
   if(/\/sports\/(?:softball|sball)\/coaches/.test(path))n+=35;
   if(/\/sports\/softball\/(?:schedule|news|stats|archives|tickets|roster)(?:\/|$)/.test(path))n-=45;
   if(/schedule|news|article|tickets|stats|archives/.test(x.text.toLowerCase()))n-=30;
 } else {
   if(/\/sports\/(?:softball|sball)\/coaches(?:\/|$)/.test(path))n+=45;
   if(/softball/.test(s))n+=12;if(/coach|staff/.test(s))n+=10;if(/staff-directory/.test(path))n+=55;if(/department\/softball|softball-department/.test(path))n+=35;if(/bio/.test(s))n+=2;
   if(/schedule|news|article|tickets|stats|archives|facilities/.test(s))n-=50;
 }
 return n;
}
function bestLink(xs:{url:string,text:string}[],kind:"softball"|"staff",base:string){
 return xs.filter(x=>sameHost(x.url,base)&&!badOfficialUrl(x.url)).map(x=>({x,n:scoreLink(x,kind)})).filter(x=>x.n>0).sort((a,b)=>b.n-a.n)[0]?.x.url;
}
async function tryGet(urls:string[]){
 for(const url of [...new Set(urls.filter(Boolean))]){try{return await get(url)}catch{}}
 return null;
}
// Free, bounded official-site discovery. No search/AI API or external index.
// Only inspect the verified starting host's public sitemap and relevant links.
async function sitemapSoftballCandidates(base:string){
 const origin=new URL(base).origin;
 const candidates:string[]=[];
 const seen=new Set<string>();
 const sitemapUrls=[origin+"/sitemap.xml",origin+"/sitemap_index.xml"];
 for(let n=0;n<sitemapUrls.length&&n<4;n++){
  const url=sitemapUrls[n];
  if(seen.has(url))continue;seen.add(url);
  try{
   if(!(await allowedByRobots(url)))continue;
   const response=await fetch(url,{redirect:"follow",signal:AbortSignal.timeout(3500),
    headers:{"user-agent":USER_AGENT+"/1.0 (+https://www.rltnl.com)"}});
   if(!response.ok||!sameHost(response.url,base))continue;
   const xml=(await response.text()).slice(0,1200000);
   const locs=[...xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)].slice(0,3000)
    .map(m=>m[1].replace(/&amp;/g,"&").trim())
    .filter(u=>{try{return new URL(u).protocol==="https:"&&sameHost(u,base)&&!badOfficialUrl(u)}catch{return false}});
   for(const loc of locs){
    if(/\.xml(?:$|\?)/i.test(loc)){
     if(sitemapUrls.length<4&&/softball|sitemap|sport/i.test(loc))sitemapUrls.push(loc);
    }else if(/\/sports\/(?:softball|sball)\/coaches|\/staff-directory\/(?:department\/softball|softball-department)/i.test(loc)){
     candidates.push(loc);
    }else if(/\/sports\/(?:softball|sball)(?:\/|$)/i.test(loc)){
     if(!/\/schedule|\/news|\/stats|\/archives|\/tickets|\/roster\/players/i.test(new URL(loc).pathname))candidates.push(loc);
    }
   }
  }catch{ /* No sitemap is a normal condition. */ }
 }
 return [...new Set(candidates)].slice(0,12);
}

// Search discovery is a fallback only. Search results are leads, never verified sources.
async function searchOfficialAthleticsHost(schoolName:string, universityUrl:string){
 const queries=[schoolName+" softball coaches official athletics",schoolName+" softball coaching staff"];
 const universityHost=new URL(universityUrl).hostname.replace(/^www\./,"");
 for(const query of queries){
  try{
   const searchUrl="https://www.bing.com/search?"+new URLSearchParams({q:query,count:"10"}).toString();
   if(!(await allowedByRobots(searchUrl)))continue;
   const response=await fetch(searchUrl,{signal:AbortSignal.timeout(4000),headers:{"user-agent":USER_AGENT+"/1.0 (+https://www.rltnl.com)","accept":"text/html"}});
   if(!response.ok)continue;
   const html=(await response.text()).slice(0,250000);
   const candidates=[...html.matchAll(/<a[^>]+href="(https:\/\/[^"]+)"[^>]*>/gi)]
    .map(m=>m[1].replace(/&amp;/g,"&"))
    .filter(url=>{try{const u=new URL(url);return !badOfficialUrl(url)&&!u.hostname.endsWith("bing.com")&&!u.hostname.endsWith("google.com")&&/\/sports\/(?:sball|softball)\/coaches|\/staff-directory\/.*softball/i.test(u.pathname)}catch{return false}});
   for(const url of [...new Set(candidates)].slice(0,5)){
    try{
     const page=await getConfirmedStaffPage(url,5000);
     const visible=clean(page.html.slice(0,120000)).toLowerCase();
     const words=schoolName.toLowerCase().replace(/\b(university|college|of|the)\b/g," ").trim().split(/\s+/).filter(w=>w.length>3);
     // A coaching URL alone is not proof: require the school's distinctive name
     // and softball on the destination page before trusting a different host.
     if(words.length&&!words.some(w=>visible.includes(w)))continue;
     if(!/softball/i.test(visible))continue;
     return {athletics_url:new URL(page.url).origin,softball_url:page.url,staff_url:page.url};
    }catch{}
   }
  }catch{}
 }
 return null;
}

async function discover(start:string, seeded?:{athletics_url?:string|null,softball_url?:string|null,staff_url?:string|null}){
 // A previously verified official athletics source is a better discovery root than
 // the university homepage. This prevents a valid seeded source from being discarded
 // just because the university site does not expose athletics in a crawler-friendly way.
 const seededStart=[seeded?.softball_url,seeded?.staff_url,seeded?.athletics_url].find(x=>x&&!badOfficialUrl(x))||"";
 if(!start && !seededStart) throw new Error("School website missing");
 const home=await get(seededStart||start); const ls=links(home.html,home.url);
 const athleticCandidates=ls.filter(x=>(/athletics?|sports/i.test(x.text+" "+x.url))&&!badOfficialUrl(x.url)).sort((x,y)=>(/athletics/i.test(y.text+" "+y.url)?2:0)-(/athletics/i.test(x.text+" "+x.url)?2:0));
 const a=athleticCandidates.length?await tryGet(athleticCandidates.slice(0,5).map(x=>x.url)):home;
 const athletics=a||home; const sl=links(athletics.html,athletics.url);
 // A seeded softball/staff URL already proves the official sports host. Do not leave that
 // host while rediscovering staff merely because a page contains generic external links.
 const seededOfficialHost=Boolean(seededStart && (/\/sports\/(?:softball|sball)/i.test(new URL(home.url).pathname)||/staff-directory/i.test(new URL(home.url).pathname)));
 // If the first athletics candidate was still on the university domain, follow an external
 // official athletics link from it before probing predictable /sports routes.
 const externalAthletics=sl.filter(x=>{
   if(sameHost(x.url,athletics.url)||badOfficialUrl(x.url)) return false;
   const signal=(x.text+" "+x.url).toLowerCase();
   // External athletics promotion requires athletics identity, not a generic "sports" link.
   return /athletics?|official athletics|softball/.test(signal);
  });
 const ext=!seededOfficialHost&&externalAthletics.length?await tryGet(externalAthletics.slice(0,5).map(x=>x.url)):null;
 const sports=ext||athletics; const sportsLinks=links(sports.html,sports.url);
 let softball=bestLink(sportsLinks,"softball",sports.url);
 // Official athletics sites commonly expose predictable softball routes even when the school homepage does not link them cleanly.
 if(!softball){
   const origin=new URL(sports.url).origin;
   const probe=await tryGet([origin+"/sports/softball/coaches",origin+"/sports/sball/coaches",origin+"/sports/softball",origin+"/sports/sball",origin+"/sports/softball/roster",origin+"/sports/sball/roster"]);
   if(probe) softball=probe.url;
 }
 if(!softball){
   const indexed=await sitemapSoftballCandidates(sports.url);
   const found=await tryGet(indexed);
   if(found)softball=found.url;
 }
 if(!softball) throw new Error("Official softball page not discovered after official links, softball/sball routes and sitemap");
 const s=await get(softball); const staffLinks=links(s.html,s.url);
 const origin=new URL(s.url).origin;
 // Prefer softball-only coaching pages to mixed athletics staff directories.
 // Directory templates may include coaches from unrelated sports.
 const directoryCandidates=[...staffLinks,...sl]
   .filter(x=>sameHost(x.url,s.url)&&/staff\s*directory|staff-directory/i.test(x.text+" "+x.url))
   .sort((a,b)=>(/softball/i.test(b.text+" "+b.url)?1:0)-(/softball/i.test(a.text+" "+a.url)?1:0));
 const coachSpecific=staffLinks.filter(x=>/\/sports\/(?:softball|sball)\/(?:coaches|roster)/i.test(x.url));
 let staff=/\/sports\/(?:softball|sball)\/coaches(?:\/|$)/i.test(new URL(s.url).pathname)?s.url:(bestLink(coachSpecific,"staff",s.url)||null);
 if(!staff) staff=directoryCandidates.find(x=>/softball/i.test(x.text+" "+x.url))?.url||null;
 if(!staff) staff=bestLink(staffLinks,"staff",s.url);
 if(!staff){
   const indexed=await sitemapSoftballCandidates(s.url);
   const coachUrls=indexed.filter(u=>/\/coaches|staff-directory/i.test(u));
   const found=await tryGet(coachUrls);
   if(found)staff=found.url;
 }
 if(!staff){
   const directory=await tryGet([origin+"/staff-directory/department/softball",origin+"/staff-directory/softball-department"]);
   if(directory) staff=directory.url;
 }
 if(!staff){
   const coachPage=await tryGet([
     origin+"/sports/softball/coaches",origin+"/sports/softball/coaches/",
     origin+"/sports/softball/roster?path=softball",origin+"/sports/softball/roster",
     origin+"/sports/sball/coaches",origin+"/sports/sball/roster"
   ]);
   if(coachPage) staff=coachPage.url;
 }
 if(!staff && directoryCandidates.length) staff=directoryCandidates[0].url;
 // Never treat schedule/news/etc. as a staff source merely because it is a softball page.
 if(!staff||/\/(schedule|news|stats|archives|tickets|facilities)(?:\/|$)/i.test(new URL(staff).pathname)) throw new Error("Official softball staff page not discovered");
 return {athletics_url:athletics.url,softball_url:s.url,staff_url:staff};
}

async function discoverWithFallback(name:string,start:string,seeded?:{athletics_url?:string|null,softball_url?:string|null,staff_url?:string|null}){
 try{return await discover(start,seeded)}
 catch(originalError){
  // Never override an existing human-confirmed source with search results.
  if(seeded?.staff_url)throw originalError;
  const found=await searchOfficialAthleticsHost(name,start);
  if(found)return found;
  throw originalError;
 }
}

function normalizeCoachName(name:string){
 return name.trim().replace(/\s+\([^)]+\)/g,"")
   .replace(/\s+['’]\d{2}(?:\s+M['’]\d{2})?$/,"").replace(/\s+-\s+/g,"-");
}
function plausibleName(name:string){
 const n=normalizeCoachName(name);
 if(!/^\p{Lu}[\p{L}\p{M}.'’-]+(?:\s+\p{Lu}[\p{L}\p{M}.'’-]+){1,3}$/u.test(n)) return false;
 if(/\b(Stadium|Field|Center|Complex|Development|Academic|Success|Tryouts?|Tickets?|Roster|Schedule|News|Facilities|Archives?|Parking|Map|Women|Rise|Weather|Line|Full|Bio|View|Recruit|Questionnaire|Media|Almanac|Guide|Record|Book|Classic|Tournament|Invitational|Championship|Showcase|Festival|Season|Series|Roundup|Recap|Preview)\b/i.test(n)) return false;
 if(/^The\s/i.test(n)) return false; // News/event headings are not person names.
 if(/\b(University|College|Athletics|Softball|Baseball|Basketball|Football|Volleyball|Soccer|Association|Additional|Links?|Camp|Staff|Directory|Department|Sports?|Coach(?:es)?|National|Christian University's)\b/i.test(n)) return false;
 // Reject common navigation/news/template fragments that can look like person names.
 if(/\b(Quick Facts|Graduate Assistantships?|Hired As|Named|Full Bio|View Bio|Recruiting Central|Archived Statistics|Position Social)\b/i.test(n)) return false;
 return true;
}
function sourceSpecificExtract(html:string,url:string,collegeName:string){
 const text=clean(html), out:any[]=[];
 const add=(name:string,title:string)=>{
  if(!plausibleName(name)) return;
  const rr=role(title), parts=name.trim().split(/\s+/);
  out.push({first_name:parts.shift()!,last_name:parts.join(" "),title,email:null,phone:null,x_url:null,x_handle:null,official_bio_url:null,role_category:rr.category,is_recruiting_coordinator:rr.recruiting,staff_sort_order:rr.order});
 };
 // Official university directories sometimes publish staff without a softball-only
 // page. Scope extraction to explicit softball job titles on the university's
 // verified host. Do not infer any name, title, or contact from outside the HTML.
 const hostname=new URL(url).hostname.replace(/^www\./,"").toLowerCase();
 const pathname=new URL(url).pathname.toLowerCase();
 const isMarsHill=collegeName==="Mars Hill University"&&hostname==="mhu.edu"&&pathname==="/staff-directory/";
 const isTampa=collegeName==="University of Tampa"&&hostname==="ut.edu"&&pathname==="/directory";
 if(isMarsHill||isTampa){
  const pattern=isMarsHill
   ? /\b([A-Z][A-Za-z.'’-]+\s+[A-Z][A-Za-z.'’-]+)\s+(Head Coach:\s*Softball|Assistant Softball Coach)\b/g
   : /\b([A-Z][A-Za-z.'’-]+\s+[A-Z][A-Za-z.'’-]+)\s+(Head Coach,\s*Softball|Assistant Coach,\s*(?:Women's\s+)?Softball)\b/g;
  for(const m of text.matchAll(pattern)){
   const name=m[1],title=m[2];
   if(!plausibleName(name)) continue;
   const next=text.slice((m.index||0)+m[0].length,(m.index||0)+m[0].length+400);
   const email=next.match(/\bEmail:\s*([\w.+-]+@[\w.-]+\.[A-Za-z]{2,})/i)?.[1]?.toLowerCase()||null;
   // Require a direct university email as individual-row evidence; never borrow
   // the next directory entry's contact information.
   if(!email||!(isMarsHill?email.endsWith("@mhu.edu"):email.endsWith("@ut.edu"))) continue;
   const phone=next.split(/\bEmail:/i)[0].match(/\bPhone:\s*((?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4})/i)?.[1]||null;
   const rr=role(title),parts=name.split(/\s+/);
   out.push({first_name:parts.shift()!,last_name:parts.join(" "),title,email,phone,x_url:null,x_handle:null,official_bio_url:null,role_category:rr.category,is_recruiting_coordinator:rr.recruiting,staff_sort_order:rr.order});
  }
 }
 // Official Tusculum directory uses "Surname, Given (Ms.) Job Title ...
 // Email: ..." entries. Require a direct university email for each row.
 if(collegeName==="Tusculum University"&&hostname==="web.tusculum.edu"&&pathname==="/directory/"){
  for(const m of text.matchAll(/\b([A-Z][\p{L}.'’-]+),\s+([A-Z][\p{L}.'’-]+)\s+\((?:Ms|Mr|Dr)\.\)\s+(Head Softball Coach|Assistant Softball Coach)\b([\s\S]{0,360}?)\bEmail:\s*([\w.+-]+@tusculum\.edu)\b/gu)){
   if(!plausibleName(m[2]+" "+m[1]))continue;
   const rr=role(m[3]);
   const phone=m[4].match(/\bDirect Line:\s*((?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4})/i)?.[1]||null;
   out.push({first_name:m[2],last_name:m[1],title:m[3],email:m[5].toLowerCase(),phone,
     x_url:null,x_handle:null,official_bio_url:null,role_category:rr.category,
     is_recruiting_coordinator:rr.recruiting,staff_sort_order:rr.order});
  }
 }
 // Saint Michael's official roster has a coaching footer without coach cards.
 if(collegeName==="Saint Michael's College"&&hostname==="smcathletics.com"&&/\/sports\/softball\/roster/i.test(pathname)){
  const m=text.match(/\bHead Coach:\s*([A-Z][\p{L}.'’-]+\s+[A-Z][\p{L}.'’-]+)\s*\([^)]*\)\s*Assistant Coaches:\s*([\s\S]{0,500}?)(?=Volunteer Assistant Coach:|Manager:|Captains:)/u);
  if(m){
   add(m[1],"Head Coach");
   for(const assistant of m[2].matchAll(/([A-Z][\p{L}.'’-]+\s+[A-Z][\p{L}.'’-]+)\s*\(/gu))add(assistant[1],"Assistant Coach");
   const volunteer=text.match(/\bVolunteer Assistant Coach:\s*([A-Z][\p{L}.'’-]+\s+[A-Z][\p{L}.'’-]+)/u);
   if(volunteer)add(volunteer[1],"Volunteer Assistant Coach");
  }
 }
 // Narrow adapters for official pages whose rendered templates flatten coach rows.
 // Names/titles still must be present in the fetched official source; nothing is hard-coded as data.
 if(collegeName==="Austin Peay State University" || collegeName==="University of Florida"){
  const patterns=[
   /([A-Z][A-Za-z.'’-]+(?:\s+[A-Z][A-Za-z.'’-]+){1,3})\s+(Head Coach|Associate Head Coach|Assistant Coach(?:\s*[-–]\s*Recruiting Coordinator)?)/g,
   /(Head Coach|Associate Head Coach|Assistant Coach(?:\s*[-–]\s*Recruiting Coordinator)?)\s+([A-Z][A-Za-z.'’-]+(?:\s+[A-Z][A-Za-z.'’-]+){1,3})/g
  ];
  for(const [i,re] of patterns.entries()) for(const m of text.matchAll(re)) add(i===0?m[1]:m[2],i===0?m[2]:m[1]);
 }
 return [...new Map(out.map(x=>[(x.first_name+" "+x.last_name).toLowerCase(),x])).values()];
}

function extract(html:string,url:string){
 const path=new URL(url).pathname;
 const dedicated=/softball|sball|w-softbl/i.test(path) || /[?&]path=softball/i.test(url);
 const departmentScoped=/staff-directory\/(?:softball-department|department\/softball)/i.test(path);
 const broadDirectory=/staff(?:-directory|\.aspx)(?:\/|$)/i.test(path)&&!departmentScoped;
 const pageText=clean(html);
 const softballSection=pageText.match(/(?:Softball|Softball Coaching Staff)[\s\S]{0,3000}?(?=(?:Baseball|Basketball|Football|Golf|Lacrosse|Soccer|Tennis|Track|Volleyball|Support Staff)\b|$)/i)?.[0]||"";
 // Work from semantic rows/cards first. The fallback fragments handle Sidearm and custom athletics templates.
 // Department filters on Sidearm pages may still include every sport. Never
 // infer a coach's sport from a large parent div or the page URL.
 const candidates=(departmentScoped
   ? [...html.matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi)].map(m=>m[0])
   : [
     ...[...html.matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi)].map(m=>m[0]),
     ...[...html.matchAll(/<li\b[^>]*>[\s\S]*?<\/li>/gi)].map(m=>m[0]),
     ...[...html.matchAll(/<article\b[^>]*>[\s\S]*?<\/article>/gi)].map(m=>m[0]),
     ...html.split(/<\/(?:section|div)>/i)
   ]).filter(x=>/coach|coordinator|graduate assistant|director of softball/i.test(clean(x)));
 if(broadDirectory&&softballSection){
   for(const m of softballSection.matchAll(/([A-Z][A-Za-z.'’-]+(?:\s+[A-Z][A-Za-z.'’-]+){1,3})\s+(Head Coach|Associate Head Coach|Assistant Coach(?:\s*-\s*Recruiting Coordinator)?)/g)){
     candidates.unshift(`<div>${m[1]} ${m[2]}</div>`);
   }
 }
 const out:any[]=[];
 for(const block of candidates){
  const text=clean(block);
  if(!/coach|coordinator|graduate assistant|director of softball/i.test(text)) continue;
  if(!dedicated&&!/softball/i.test(text)) continue;
  // A softball-filtered official staff directory is authoritative page context.
  // Broad staff directories still require softball evidence in the individual row.
  if(/\b(strength|conditioning|athletic trainer|sports medicine|communications?|academic|nutrition|dietitian|administrator|sport administrator|video|creative|manager|operations|player development|performance)\b/i.test(text)
     && !/\b(head|associate head|assistant|pitching|hitting)\s+(?:softball\s+)?coach\b|recruit(?:ing|ment) coordinator/i.test(text)) continue;
  if(/\b(baseball|basketball|football|volleyball|soccer|lacrosse|tennis|golf|wrestling|track|cross country|swimming)\b/i.test(text)&&!/softball/i.test(text)) continue;
  const titleMatch=text.match(/((?:Associate\s+Head|Head|Assistant|Volunteer\s+Assistant|Graduate\s+Assistant|Pitching|Hitting)[^|,;]{0,65}(?:Softball\s+)?Coach(?:\/[^|,;]{0,35})?|Softball\s+(?:Head\s+Coach|Assistant\s+Coach|Graduate\s+Coaching\s+Assistant)|(?:Recruit(?:ing|ment)|Pitching|Hitting)\s+Coordinator|Graduate\s+Assistant|(?:[A-Z][A-Za-z.]+(?:\s+[A-Z][A-Za-z.]+){0,5}\s+)?Director\s+of\s+Softball)/i);
  if(!titleMatch) continue;
  let title=titleMatch[1].trim()
    .replace(/\s+[\w.+-]+@[\w.-]*(?:\.\w{0,})?.*$/i,"")
    .replace(/\s+\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}.*$/,"")
    .replace(/\s+@[A-Za-z0-9_]+.*$/,"")
    .trim();
  if(/strength|conditioning|trainer|operations|player development|performance/i.test(title)) continue;
  // A mixed athletics directory must never turn another sport's coach into a softball coach.
  if(/\b(baseball|basketball|football|volleyball|soccer|lacrosse|tennis|golf|wrestling|track|cross country|swimming)\b/i.test(title) && !/softball/i.test(title)) continue;
  const blockLinks=links(block,url);
  // Mixed directories can contain many sports; bind a row to softball rather than trusting a broad parent fragment.
  if(!dedicated && !/softball/i.test(text)) continue;
  const email=(block.match(/mailto:([^"'?\s>]+)/i)?.[1]||"").replace(/[.,;]+$/,"").toLowerCase()||null;
  const profile=blockLinks.find(a=>sameHost(a.url,url)&&/(?:\/coaches?\/|\/staff-directory\/|\/staff\/)/i.test(a.url)&&plausibleName(a.text));
  if(!dedicated&&!departmentScoped && profile && !/softball/i.test(text.slice(Math.max(0,text.indexOf(profile.text)-120),text.indexOf(profile.text)+220))) continue;
  const profileName=normalizeCoachName(profile?.text||"");
  const before=text.split(title)[0].trim();
  const fallback=normalizeCoachName(before.match(/(\p{Lu}[\p{L}\p{M}.'’-]+(?:\s+\p{Lu}[\p{L}\p{M}.'’-]+){1,3})(?:\s+['’]\d{2})?\s*$/u)?.[0]||"");
  let name=plausibleName(profileName)?profileName:(plausibleName(fallback)?fallback:"");
  if(!name){
    const names=blockLinks.map(a=>normalizeCoachName(a.text)).filter(plausibleName);
    name=names[0]||"";
  }
  // On a dedicated softball roster/coaches page, the page context itself is authoritative.
  // On mixed directories, still require direct contact/profile evidence.
  if(!name||(!dedicated&&!departmentScoped&&!email&&!profile)) continue;
  const parts=name.split(/\s+/); const first_name=parts.shift()!, last_name=parts.join(" ").replace(/\s+-\s+/g,"-");
  const phone=text.match(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/)?.[0]||null;
  const x=personalXLink(blockLinks,first_name,last_name);
  const rr=role(title);
  out.push({first_name,last_name,title,email,phone,x_url:x?.url||null,x_handle:x?.handle||null,official_bio_url:profile?.url||null,role_category:rr.category,is_recruiting_coordinator:rr.recruiting,staff_sort_order:rr.order});
 }
 return [...new Map(out.map(x=>[x.email||(`${x.first_name} ${x.last_name}`).toLowerCase(),x])).values()]
   .filter(x=>x.role_category!=="other_coaching_staff" || /pitching|hitting coordinator|graduate assistant/i.test(x.title));
}



// Browser-only anchors are never sent with HTTP requests. A verified
// Sidearm coaches anchor can guide extraction only on the matching page.
// It cannot override identity, head-coach or coach-count quality gates.
function sidearmCoachAnchor(navigationUrl:string|null|undefined,pageUrl:string){
 if(!navigationUrl)return "";
 try{
   const nav=new URL(navigationUrl),page=new URL(pageUrl);
   const host=(u:URL)=>u.hostname.toLowerCase().replace(/^www\./,"");
   if(host(nav)!==host(page)||nav.pathname!==page.pathname||nav.search!==page.search)return "";
   const anchor=decodeURIComponent(nav.hash.slice(1));
   return /^sidearm-roster-coaches(?:[-_][a-z0-9]+)*$/i.test(anchor)?anchor:"";
 }catch{return ""}
}

// Sidearm coach bios use name-specific slugs. Match them exactly; never
// attach a generic "Full Bio" link to a coach by page order or proximity.
function sidearmNameSlug(name:string){
 return name.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase()
   .replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
}
function sidearmBioSlug(url:string){
 try{
   const path=new URL(url).pathname;
   return path.match(/\/sports\/(?:softball|sball|w-softbl)\/roster\/coaches\/([^/]+)\/\d+\/?$/i)?.[1]?.toLowerCase()||"";
 }catch{return ""}
}

// Sidearm softball rosters render coaching cards as "Title Name Full Bio".
// Only read the explicitly labelled softball coaching section; never scrape
// generic site-wide cards or athletes as coaching staff.
function rosterSectionCoaches(html:string,url:string,anchorId=""){
 const path=new URL(url).pathname;
 if(!/\/sports\/(?:softball|sball|w-softbl)\/(?:roster|coaches)/i.test(path)) return [];
 const flat=clean(html),out:any[]=[];
 // Restrict bio links to the explicitly labeled coaching section. Player
 // roster and support-staff bios must not enter the coach import.
 const headingAt=html.search(/Softball Coaching Staff/i);
 const sectionHtml=headingAt<0?"":html.slice(headingAt,headingAt+75000).split(/Softball Support Staff/i)[0];
 const bioLinks=links(sectionHtml,url).filter(x=>sameHost(x.url,url)&&Boolean(sidearmBioSlug(x.url)));
 const bioFor=(fullName:string)=>{
   const slug=sidearmNameSlug(fullName);
   const matches=[...new Set(bioLinks.filter(x=>sidearmBioSlug(x.url)===slug).map(x=>x.url))];
   return matches.length===1?matches[0]:null;
 };
 const title=String.raw`(?:Assistant AD for Internal Affairs\s*\/\s*Head Softball Coach(?:,\s*\d+(?:st|nd|rd|th) Year)?|Associate Head Softball Coach|Associate Head Coach|Head Softball Coach(?:,\s*\d+(?:st|nd|rd|th) Year)?(?:\s*\/\s*Asst AD for Internal Affairs\s*\/)?(?:\/Assistant Volleyball Coach)?|Head Coach(?:\/Community Connections Designee|\s*-\s*Softball)?|Softball Head Coach|Softball Assistant Coach|Softball Graduate Coaching Assistant|Assistant Softball Coach|Assistant Coach(?:\s*\/\s*Compliance Coordinator)?|Volunteer Assistant Coach|Graduate Assistant Coach|Graduate Assistant)`;
 const name=String.raw`([A-Z][\p{L}.'’-]+(?:\s+\([^)]+\))?(?:\s+[A-Z][\p{L}.'’-]+){1,3})`;
 const re=new RegExp("("+title+")\\s+"+name+"(?:\\s+['’]\\d{2})?\\s+(?:Full Bio|View Full Bio)\\b","gu");
 const readSection=(section:string)=>{
   const matches:any[]=[];
   for(const m of section.matchAll(re)){
     const full=normalizeCoachName(m[2]);
     if(!plausibleName(full))continue;
     const parts=full.split(/\s+/),rr=role(m[1]);
     matches.push({first_name:parts.shift()!,last_name:parts.join(" "),title:m[1],
       email:null,phone:null,x_url:null,x_handle:null,official_bio_url:bioFor(full),
       role_category:rr.category,is_recruiting_coordinator:rr.recruiting,staff_sort_order:rr.order});
   }
   return [...new Map(matches.map(x=>[(x.first_name+" "+x.last_name).toLowerCase(),x])).values()];
 };
 if(anchorId){
   // Match an actual id attribute, not a site-navigation href="#id".
   // The bounded slice prevents unrelated sports/footer data from leaking in.
   for(const tag of html.matchAll(/<[a-z][\w:-]*\b[^>]{0,1600}>/gi)){
     const id=tag[0].match(/\bid\s*=\s*["']([^"']+)["']/i)?.[1];
     if(id?.toLowerCase()!==anchorId.toLowerCase())continue;
     const anchorText=clean(html.slice(tag.index||0,(tag.index||0)+50000))
       .replace(/^Softball Coaching Staff\s*/i,"")
       .split(/Softball Support Staff|There is no additional information|No\.\s+Name|(?:20\d{2}\s+)?Softball Coaching Staff/i)[0]
       .slice(0,5500);
     const anchorCoaches=readSection(anchorText);
     if(anchorCoaches.length>0&&anchorCoaches.length<=8&&
       anchorCoaches.some(x=>x.role_category==="head_coach"))return anchorCoaches;
     break;
   }
 }
 for(const mark of flat.matchAll(/Softball Coaching Staff/gi)){
   const section=flat.slice((mark.index||0)+mark[0].length,(mark.index||0)+mark[0].length+2200)
     .split(/Softball Support Staff|There is no additional information|No\.\s+Name|(?:20\d{2}\s+)?Softball Coaching Staff/i)[0];
   out.push(...readSection(section));
 }
 return [...new Map(out.map(x=>[(x.first_name+" "+x.last_name).toLowerCase(),x])).values()];
}

// Parse only the explicitly labelled coaching table, never the adjacent support-staff table.
// Common athletics templates place both under the same page and generic HTML parsing
// can accidentally assign an associate head coach a second head-coach identity.
function labelledSoftballCoachingTable(html:string,url:string){
 const start=html.search(/(?:20\d{2}\s+)?Softball Coaching Staff/i);
 if(start<0)return [];
 const tail=html.slice(start,start+65000);
 const stop=tail.search(/Softball Support Staff/i);
 const section=stop>=0?tail.slice(0,stop):tail;
 const table=section.match(/<table\b[^>]*>[\s\S]*?<\/table>/i)?.[0];
 if(!table)return [];
 const rows=[...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
 const out:any[]=[];
 for(const row of rows){
  const cells=[...row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(m=>m[1]);
  if(cells.length<2)continue;
  const name=normalizeCoachName(clean(cells[0]));
  const title=clean(cells[1]).trim();
  if(!plausibleName(name)||!/coach|recruiting coordinator/i.test(title))continue;
  if(/trainer|support staff|athletic training|strength|conditioning|sports medicine/i.test(title))continue;
  const rr=role(title),parts=name.split(/\s+/);
  if(rr.category==="other_coaching_staff")continue;
  const mail=(cells.join(" ").match(/mailto:([^"'\s?>]+)/i)?.[1]||"").toLowerCase()||null;
  const phone=clean(cells[2]||"").match(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/)?.[0]||null;
  const bio=links(cells[0],url).find(l=>sameHost(l.url,url)&&/\/(?:coaches|staff-directory)\//i.test(l.url))?.url||null;
  out.push({first_name:parts.shift()!,last_name:parts.join(" "),title,email:mail,phone,
   x_url:null,x_handle:null,official_bio_url:bio,role_category:rr.category,
   is_recruiting_coordinator:rr.recruiting,staff_sort_order:rr.order});
 }
 return out;
}

// Staff-directory department pages can contain a single softball section followed
// by unrelated departments. Only use the table rows after the SOFTBALL divider.
function softballDepartmentDirectory(html:string,url:string){
 const pathname=new URL(url).pathname.toLowerCase();
 if(!/\/staff-directory\/(?:softball-department|department\/softball)/.test(pathname))return [];
 // Sidearm's department filter can return a full university directory.
 // Anchor at the explicit Softball department heading, not the page URL.
 const rows=[...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
 const out:any[]=[];let inSoftball=false;
 for(const row of rows){
  const cells=[...row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(m=>m[1]);
  const values=cells.map(c=>clean(c).trim());
  if(values.some(v=>/^softball$/i.test(v))){inSoftball=true;continue;}
  if(!inSoftball)continue;
  // A new department heading terminates the softball section.
  if(cells.length<2){if(values.some(v=>/^[a-z][a-z\s/&-]{2,45}$/i.test(v)))break;continue;}
  const name=normalizeCoachName(values[0]),title=values[1];
  if(!plausibleName(name)||!/coach|recruiting coordinator/i.test(title))continue;
  const rr=role(title),parts=name.split(/\s+/);
  if(rr.category==="other_coaching_staff")continue;
  const email=row[1].match(/mailto:([^"'\s<>?]+)/i)?.[1]?.toLowerCase()||null;
  const phone=values.slice(2).join(" ").match(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/)?.[0]||null;
  const bio=links(cells[0],url).find(l=>sameHost(l.url,url))?.url||null;
  out.push({first_name:parts.shift()!,last_name:parts.join(" "),title,email,phone,x_url:null,x_handle:null,official_bio_url:bio,role_category:rr.category,is_recruiting_coordinator:rr.recruiting,staff_sort_order:rr.order});
  if(out.length>8)return [];
 }
 // Some Sidearm layouts use a heading outside the table. In that case,
 // isolate the first coach table following the Softball heading.
 if(!inSoftball){
  const marker=html.match(/<(?:h[1-6]|div|span|th)\b[^>]*>\s*Softball\s*<\/(?:h[1-6]|div|span|th)>/i);
  if(!marker)return [];
  const tail=html.slice((marker.index||0)+marker[0].length);
  const table=tail.match(/<table\b[^>]*>[\s\S]*?<\/table>/i)?.[0]||"";
  if(!table)return [];
  const tableRows=[...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
  for(const row of tableRows){
   const cells=[...row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(m=>m[1]);
   if(cells.length<2)continue;
   const name=normalizeCoachName(clean(cells[0])),title=clean(cells[1]);
   if(!plausibleName(name)||!/coach|recruiting coordinator/i.test(title))continue;
   const rr=role(title),parts=name.split(/\s+/);
   if(rr.category==="other_coaching_staff")continue;
   const email=row[1].match(/mailto:([^"'\s<>?]+)/i)?.[1]?.toLowerCase()||null;
   const phone=cells.slice(2).map(clean).join(" ").match(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/)?.[0]||null;
   const bio=links(cells[0],url).find(l=>sameHost(l.url,url))?.url||null;
   out.push({first_name:parts.shift()!,last_name:parts.join(" "),title,email,phone,x_url:null,x_handle:null,official_bio_url:bio,role_category:rr.category,is_recruiting_coordinator:rr.recruiting,staff_sort_order:rr.order});
   if(out.length>8)return [];
  }
 }
 return out;
}

function parseOfficialStaff(html:string,url:string,collegeName:string,anchorId=""){
 const department=softballDepartmentDirectory(html,url);
 if(department.length>0&&department.some((x:any)=>x.role_category==='head_coach'))return department;
 const labelled=labelledSoftballCoachingTable(html,url);
 if(labelled.length>0&&labelled.length<=8&&labelled.some((x:any)=>x.role_category==='head_coach'))return labelled;
 const regular=extract(html,url);
 const scoped=rosterSectionCoaches(html,url,anchorId);
 if(scoped.length>0&&scoped.length<=8&&scoped.some((x:any)=>x.role_category==="head_coach")){
   // Keep direct email/bio evidence only when it belongs to the exact same
   // person. Do not include any extra names from contaminated parent elements.
   return scoped.map((x:any)=>{
     const matched=regular.find((y:any)=>y.first_name.toLowerCase()===x.first_name.toLowerCase()
       && y.last_name.toLowerCase()===x.last_name.toLowerCase());
     return matched?{...x,email:matched.email,phone:matched.phone,x_url:matched.x_url,
       x_handle:matched.x_handle,official_bio_url:x.official_bio_url||matched.official_bio_url}:x;
   });
 }
 if(collegeName==="Mars Hill University"||collegeName==="University of Tampa"||collegeName==="Tusculum University"||collegeName==="Saint Michael's College"){
   const specific=sourceSpecificExtract(html,url,collegeName);
   if(specific.length>0&&specific.length<=8&&specific.some((x:any)=>x.role_category==="head_coach"))
     return specific;
   // A university-wide directory cannot fall back to unscoped generic parsing.
   if(collegeName==="Tusculum University")return [];
 }
 return regular;
}


/**
 * The read-only inspection and the importer MUST use the same coaching quality
 * gate. Identical repeated rows can be consolidated, but conflicting identities,
 * roles, or direct contact fields are held for human review.
 */
function assessStaffCandidates(input:any[]){
 const byName=new Map<string,any>();
 let conflict:string|null=null;
 let duplicateRows=0;
 const keyName=(value:string)=>normalizeCoachName(value).normalize("NFKD")
   .replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/gi,"").toLowerCase();
 for(const candidate of input){
   const full=String(candidate.first_name||"")+" "+String(candidate.last_name||"");
   const key=keyName(full);
   const previous=byName.get(key);
   if(!previous){byName.set(key,candidate);continue;}
   duplicateRows++;
   if(previous.role_category!==candidate.role_category){
     conflict??="conflicting coaching roles for "+full.trim();
     continue;
   }
   const changed=(field:string)=>{
     const a=String(previous[field]||"").trim(),b=String(candidate[field]||"").trim();
     const normalized=(v:string)=>field==="phone"?v.replace(/\D/g,""):v.toLowerCase();
     return Boolean(a&&b&&normalized(a)!==normalized(b));
   };
   if(["email","phone","x_url"].some(changed)){
     conflict??="conflicting coach contact evidence for "+full.trim();
     continue;
   }
   // Repeat entries on the same official page do not create repeat coaches.
   // Preserve the richer source evidence without changing existing DB records.
   byName.set(key,{...previous,
     email:previous.email||candidate.email,phone:previous.phone||candidate.phone,
     x_url:previous.x_url||candidate.x_url,x_handle:previous.x_handle||candidate.x_handle,
     official_bio_url:previous.official_bio_url||candidate.official_bio_url,
     title:/softball/i.test(candidate.title||"")&&!/softball/i.test(previous.title||"")
       ?candidate.title:previous.title});
 }
 const coaches=[...byName.values()];
 const headCount=coaches.filter(c=>c.role_category==="head_coach").length;
 const invalid=coaches.some(c=>!plausibleName(String(c.first_name||"")+" "+String(c.last_name||"")));
 const issue=conflict||(coaches.length===0?"no coach rows"
   :coaches.length>8?"more than eight coach rows"
   :invalid?"invalid coach name"
   :headCount===0?"no head coach identified"
   :headCount>1?"multiple head coaches identified; verify roles before import":null);
 return {coaches,headCount,issue,duplicateRows};
}

// A Sidearm bio must identify the exact coach, and contact details must
// appear in that person's labeled profile header. Do not borrow a generic
// athletics footer email or phone from elsewhere in the HTML.
function sidearmProfileContact(html:string,url:string,firstName:string,lastName:string){
 const fullName=firstName+" "+lastName;
 if(sidearmBioSlug(url)!==sidearmNameSlug(fullName))return null;
 const text=clean(html);
 const lowerText=text.toLowerCase(),lowerName=fullName.toLowerCase();
 let at=0;
 while((at=lowerText.indexOf(lowerName,at))!==-1){
   const nearby=text.slice(at,at+2200);
   at+=lowerName.length;
   if(!/\bTITLE\s*:?\s+/i.test(nearby.slice(0,500)))continue;
   const email=nearby.match(/\bE-?MAIL\s*:?\s*([\w.+-]+@[\w.-]+\.[a-z]{2,})\b/i)?.[1]?.toLowerCase()||null;
   const phone=nearby.match(/\bPHONE\s*:?\s*((?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4})/i)?.[1]||null;
   if(email||phone)return {email,phone,x_url:null,x_handle:null};
 }
 return null;
}
function profileContact(html:string,url:string,firstName:string,lastName:string){
 const email=(html.match(/mailto:([^"'?\s>]+)/i)?.[1]||"").replace(/[.,;]+$/,"").toLowerCase()||null;
 const text=clean(html);
 const phone=text.match(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/)?.[0]||null;
 const x=personalXLink(links(html,url),firstName,lastName);
 return {email,phone,x_url:x?.url||null,x_handle:x?.handle||null};
}
// Backfills must not mistake an athletics footer or another coach's contact for
// this coach. Generic (non-Sidearm) pages require a named profile heading and
// explicitly labeled contact fields close to that heading.
function scopedGenericProfileContact(html:string,url:string,firstName:string,lastName:string){
 const full=(firstName+" "+lastName).toLowerCase();
 const headings=[...html.matchAll(/<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]>/gi)]
   .map(m=>clean(m[1]).toLowerCase());
 const title=clean(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]||"").toLowerCase();
 if(!headings.some(h=>h===full||h.startsWith(full+" "))&&!title.includes(full))return null;
 const visible=clean(html),at=visible.toLowerCase().indexOf(full);
 if(at<0)return null;
 const local=visible.slice(at,at+1400);
 const email=local.match(/\b(?:E-?MAIL)\s*:?\s*([\w.+-]+@[\w.-]+\.[a-z]{2,})\b/i)?.[1]?.toLowerCase()||null;
 const phone=local.match(/\b(?:PHONE|TEL(?:EPHONE)?)\s*:?\s*((?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4})/i)?.[1]||null;
 const x=personalXLink(links(html,url),firstName,lastName);
 return {email,phone,x_url:x?.url||null,x_handle:x?.handle||null};
}

async function enrichCoachProfile(c:any,staffUrl:string){
 if(!c.official_bio_url||!sameHost(c.official_bio_url,staffUrl)) return c;
 try{
   const p=await get(c.official_bio_url,5000);
   if(!sameHost(p.url,staffUrl)) return c;
   const sidearm=Boolean(sidearmBioSlug(c.official_bio_url));
   // Generic profile pages can include unrelated coaches and institutional
   // footer contacts. Require identity-scoped, labelled evidence instead.
   const contact=sidearm?sidearmProfileContact(p.html,p.url,c.first_name,c.last_name)
     :scopedGenericProfileContact(p.html,p.url,c.first_name,c.last_name);
   if(!contact)return c;
   // Only accept a profile title when it is explicitly labelled near the
   // coach's name, and never silently change a conflicting roster role.
   const visible=clean(p.html),full=(c.first_name+" "+c.last_name).toLowerCase();
   const nameAt=visible.toLowerCase().indexOf(full);
   const local=nameAt>=0?visible.slice(nameAt,nameAt+650):"";
   const profileTitle=local.match(/\b(?:TITLE|POSITION)\s*:?\s*(Head (?:Softball )?Coach|Associate Head (?:Softball )?Coach|Assistant (?:Softball )?Coach|Pitching Coach|Hitting Coach|Recruiting Coordinator)\b/i)?.[1]||null;
   const profileRole=profileTitle?role(profileTitle):null;
   const safeTitle=profileRole&&profileRole.category===c.role_category?profileTitle:null;
   return {...c,title:safeTitle||c.title,email:c.email||contact.email,phone:c.phone||contact.phone,x_url:c.x_url||contact.x_url,x_handle:c.x_handle||contact.x_handle,official_bio_url:p.url,profile_source_hash:hash(p.html)};
 }catch{return c}
}

export async function POST(req:NextRequest){
 const auth=req.headers.get("authorization");
 const manualKey=req.headers.get("x-rlt-ingestion-key");
 const cronOk=Boolean(process.env.CRON_SECRET && auth===`Bearer ${process.env.CRON_SECRET}`);
 const manualOk=Boolean(process.env.STAFF_INGESTION_MANUAL_KEY && manualKey===process.env.STAFF_INGESTION_MANUAL_KEY);
 // A request header alone is not proof of a trusted cron invocation. Super Owner
 // interactive cleanup is authenticated through the existing session instead.
 let ownerOk=false;
 if(!cronOk && !manualOk && req.headers.get("origin")===new URL(req.url).origin){
   const session=await createSessionClient();
   const {data:{user}}=await session.auth.getUser();
   if(user){
     const {data:grant}=await supabase.from("platform_roles").select("user_id")
       .eq("user_id",user.id).eq("role","super_owner").maybeSingle();
     ownerOk=Boolean(grant);
   }
 }
 if(!cronOk && !manualOk && !ownerOk) return NextResponse.json({error:"Unauthorized"},{status:401});
 const body=await req.json().catch(()=>({}));
 // Targeted rechecks are only available to the signed-in Super Owner.
 // Scheduled workers keep their normal bounded queue behavior.
 const targetedId=body.bootstrap===true&&typeof body.college_id==="string"?body.college_id:null;
 if(targetedId&&(!ownerOk||!/^[-0-9a-f]{36}$/i.test(targetedId)))
   return NextResponse.json({error:"Targeted source recheck requires Super Owner access"},{status:403});
 const approvedPilotIds=new Set(["1ad3f717-06f1-42ba-8846-d25af5dfe5e0","76ec4683-6660-4f28-9202-8ad95b7fa51d","7807b761-19c4-4985-a037-e0d101b406dd","5f6b8905-b694-4f86-8dd0-13589844610c","780e372c-dcc4-41ea-9984-962e78c27cdf","08cb7422-5392-44c7-9e0e-ecb0dc3ecf01","4fcfa4d1-aee8-4439-a85d-dbc76ca39675","aa8d21bc-9693-4d24-b28f-50aa805cadd3","d0736a10-3714-40ff-9a15-e878a66bde6e","e369965b-0e9a-42c7-afbb-506359ba4c30"]);
 const approvedExpansionIds=new Set(["aa9f860e-1cf3-4259-9af2-b29d2893fb62","3f70500b-0847-4398-8cb3-0e9c93a77cbd","644b79c9-6b52-400d-93d4-f62f03369c9e","6d8b983f-9209-4cdc-9c8d-363d7ea7d112","14adc832-92ce-4771-9ae9-6d06320c7e40","5f863060-16e1-4b29-b67f-e4dcd6dc407d","1d142cd0-9aa7-4354-94bf-ff12c852be4d","699e0f6e-e751-48b1-ab3e-68fddb6ecfbb","30b625a4-cd95-4cd4-a001-cac303ccbc13","818c9f94-30fd-4b0e-a495-ec6858e69c43"]);
 // Contact recovery is an explicitly scoped worker action. It is authenticated
 // again below as Super Owner-only, and cannot enter the general write path.
 if(!cronOk && !manualOk && body.dry_run!==true && body.bootstrap!==true && body.profile_enrichment!==true && body.diagnose_quality!==true && body.contact_recovery!==true){
   const ids=Array.isArray(body.college_ids)?body.college_ids:[];
   const allowed=body.expansion_write===true?approvedExpansionIds:approvedPilotIds;
   if((body.pilot_write!==true&&body.expansion_write!==true) || ids.length===0 || ids.some((id:string)=>!allowed.has(id))) return NextResponse.json({error:"Controlled write not authorized"},{status:403});
 }

 // Read-only diagnosis of quality-gate exceptions. Never claim, requeue,
 // insert, or update coach records from this branch.
 if(body.diagnose_quality===true){
   const division=typeof body.division==="string"?body.division:"NCAA D2";
   if(!["NCAA D1","NCAA D2","NCAA D3","NAIA","JC"].includes(division))
     return NextResponse.json({error:"Invalid division"},{status:400});
   const offset=Math.max(0,Math.floor(Number(body.offset)||0));
   const limit=Math.min(3,Math.max(1,Math.floor(Number(body.limit)||3)));
   const {data:schools,error:schoolErr}=await supabase.from("colleges")
     .select("id,name").eq("division",division);
   if(schoolErr) throw schoolErr;
   const ids=(schools||[]).map((s:any)=>s.id);
   if(!ids.length) return NextResponse.json({total:0,offset,processed:0,results:[],next_offset:null});
   const {data:queue,error:queueErr}=await supabase.from("college_staff_bootstrap_queue")
     .select("college_id,last_error").in("college_id",ids).eq("status","review")
     .ilike("last_error","%quality gate%");
   if(queueErr) throw queueErr;
   const names=new Map((schools||[]).map((s:any)=>[s.id,s.name]));
   const ordered=(queue||[]).map((q:any)=>({college_id:q.college_id,name:String(names.get(q.college_id)||"Unknown college")}))
     .sort((a:any,b:any)=>a.name.localeCompare(b.name));
   const chosen=ordered.slice(offset,offset+limit);
   const chosenIds=chosen.map((x:any)=>x.college_id);
   const {data:sources,error:sourceErr}=chosenIds.length
     ?await supabase.from("college_softball_sources").select("college_id,staff_url,staff_navigation_url,softball_url").in("college_id",chosenIds)
     :{data:[],error:null};
   if(sourceErr) throw sourceErr;
   const bySource=new Map((sources||[]).map((s:any)=>[s.college_id,s]));
   const results=await Promise.all(chosen.map(async (school:any)=>{
     const source:any=bySource.get(school.college_id);
     const url=source?.staff_url||null;
     if(!url) return {...school,source_url:null,status:"missing_source",issue:"No official coaching-staff source saved",coaches:[],head_count:0};
     try{
       let page=await get(url,8000);
       let coaches=parseOfficialStaff(page.html,page.url,school.name,
         sidearmCoachAnchor(source?.staff_navigation_url,page.url));
       let assessed=assessStaffCandidates(coaches);
       // A failed saved page may be outdated rather than an absent softball
       // program. Probe two conventional coaching routes on that SAME official
       // host, respecting robots and bounded timeouts. No records are changed.
       if(assessed.issue){
         const origin=new URL(page.url).origin;
         for(const path of ["/sports/softball/coaches","/staff-directory/department/softball"]){
           const alternative=origin+path;
           if(alternative===page.url)continue;
           try{
             const candidatePage=await get(alternative,6000);
             if(!sameHost(candidatePage.url,page.url)||badOfficialUrl(candidatePage.url))continue;
             const candidate=assessStaffCandidates(parseOfficialStaff(candidatePage.html,candidatePage.url,school.name));
             if(!candidate.issue){page=candidatePage;assessed=candidate;break;}
           }catch{ /* Source still needs human review; do not bypass access controls. */ }
         }
       }
       const issue=assessed.issue
         ?assessed.issue==="no coach rows"?"No coaching staff identified on saved or alternate official pages"
           :"Quality gate: "+assessed.issue
         :"Official page passes the coaching identity and head-coach quality gates";
       const sourceUrl=source?.staff_navigation_url&&source?.staff_url?.split("#")[0]===page.url.split("#")[0]
         ?source.staff_navigation_url:page.url;
       return {...school,source_url:sourceUrl,status:assessed.issue?"review":"candidate",
         issue,head_count:assessed.headCount,duplicate_rows:assessed.duplicateRows,
         coaches:assessed.coaches.slice(0,12).map((x:any)=>({name:x.first_name+" "+x.last_name,title:x.title,role:x.role_category,has_email:Boolean(x.email),has_bio:Boolean(x.official_bio_url)}))};
     }catch(e:any){
       return {...school,source_url:url,status:"fetch_error",issue:e?.message||String(e),coaches:[],head_count:0};
     }
   }));
   return NextResponse.json({division,total:ordered.length,offset,processed:results.length,
     next_offset:offset+chosen.length<ordered.length?offset+chosen.length:null,results},
     {headers:{"Cache-Control":"private, no-store"}});
 }
 const recoveryMode=body.contact_recovery===true;
 const profileEnrichment=body.profile_enrichment===true||recoveryMode;
 if(profileEnrichment){
   if(recoveryMode&&!ownerOk)
     return NextResponse.json({error:"Contact exception recovery requires signed-in Super Owner access"},{status:403});
   const runId=recoveryMode?null:(typeof body.backfill_run_id==="string"?body.backfill_run_id:null);
   const queueTable=recoveryMode?"college_coach_contact_recovery_queue":"college_coach_profile_enrichment_queue";
   if(runId&&(!ownerOk||!/^[-0-9a-f]{36}$/i.test(runId)))
     return NextResponse.json({error:"Backfill requires signed-in Super Owner access"},{status:403});
   if(runId){
     const {data:run,error:runError}=await supabase.from("college_coach_contact_backfill_runs")
       .select("id,status").eq("id",runId).maybeSingle();
     if(runError)throw runError;
     if(!run||run.status!=="running")
       return NextResponse.json({error:"Backfill is paused or has finished"},{status:409});
   }
   // Claim a small batch atomically; 3 parallel bio checks stay within the
   // worker's 60-second execution budget even with slow official sources.
   const {data:queued,error:qErr}=recoveryMode
     ?await supabase.rpc("claim_college_coach_contact_recovery_batch",{
       p_limit:Math.min(Math.max(Number(body.limit)||2,1),2)
     })
     :await supabase.rpc("claim_college_coach_profile_enrichment_batch",{
       p_limit:Math.min(Math.max(Number(body.limit)||3,1),3),p_run_id:runId
     });
   if(qErr)throw qErr;
   const ids=(queued||[]).map((x:any)=>x.coach_id);
   if(!ids.length){
     const query=supabase.from(queueTable).select("*",{count:"exact",head:true}).eq("status","pending");
     const {count:pending}=recoveryMode?await query:await query.is("backfill_run_id",runId);
     return NextResponse.json({processed:0,pending:pending||0,results:[]});
   }
   const {data:coachRows,error:cErr}=await supabase.from("college_coaches")
     .select("id,college_id,first_name,last_name,title,email,phone,x_url,x_handle,official_bio_url,official_source_url,source_urls,lifecycle_status")
     .in("id",ids);
   if(cErr)throw cErr;
   const byId=new Map((coachRows||[]).map((x:any)=>[x.id,x]));
   const results=await Promise.all(ids.map(async(id:string)=>{
     const coach:any=byId.get(id);
     try{
       if(!coach||!coach.official_bio_url||!coach.official_source_url)
         throw new Error("Coach official bio/source missing");
       if(coach.lifecycle_status!=="active")
         throw new Error("Inactive coach excluded from contact backfill");
       const u=new URL(coach.official_bio_url),s=new URL(coach.official_source_url);
       if(u.protocol!=="https:"||s.protocol!=="https:"||u.username||u.password||u.port||
          !sameHost(u.href,s.href)||badOfficialUrl(u.href))
         throw new Error("Coach bio is not on the approved HTTPS athletics host");
       const p=await get(u.href,9000);
       if(!p.url.startsWith("https:")||!sameHost(p.url,u.href))
         throw new Error("Coach bio redirected off the approved HTTPS athletics host");
       const sidearm=Boolean(sidearmBioSlug(u.href));
       // Old Sidearm coach links sometimes redirect to a named staff-directory
       // profile. Keep exact-name matching after that same-host redirect.
       let contact=sidearm
         ?(sidearmProfileContact(p.html,p.url,coach.first_name,coach.last_name)
           ||scopedGenericProfileContact(p.html,p.url,coach.first_name,coach.last_name))
         :scopedGenericProfileContact(p.html,p.url,coach.first_name,coach.last_name);
       if(!contact)contact={email:null,phone:null,x_url:null,x_handle:null};
       let contactSource=p.url,contactHash=hash(p.html);
       // Second-source lookup is allowed only on the same official athletics host,
       // with an exact coach-name match. Never guess email patterns.
       if(!contact.email&&(!recoveryMode||!coach.email)){
         const origin=s.origin;
         const alternates=recoveryMode?[origin+"/staff-directory"]:
           [origin+"/staff-directory/department/softball",
           origin+"/staff-directory/softball-department",origin+"/staff-directory"];
         for(const alt of alternates){
           try{
             const d=await get(alt,5000);
             if(!d.url.startsWith("https:")||!sameHost(d.url,s.href))continue;
             const exact=extract(d.html,d.url).find((x:any)=>
               x.first_name.toLowerCase()===coach.first_name.toLowerCase() &&
               x.last_name.toLowerCase()===coach.last_name.toLowerCase() && x.email
             );
             if(exact){
               contact={email:exact.email,phone:exact.phone||contact.phone,
                 x_url:exact.x_url||contact.x_url,x_handle:exact.x_handle||contact.x_handle};
               contactSource=d.url;contactHash=hash(d.html);break;
             }
           }catch{}
         }
       }
       const {data:merged,error:mergeError}=await supabase.rpc("merge_verified_college_coach_contacts",{
         p_coach_id:id,p_email:contact.email,p_phone:contact.phone,
         p_x_url:runId||recoveryMode?null:contact.x_url,p_x_handle:runId||recoveryMode?null:contact.x_handle,p_source_url:contactSource
       });
       if(mergeError)throw mergeError;
       const addedEmail=merged?.added_email===true,addedPhone=merged?.added_phone===true;
       const {error:snapshotError}=await supabase.from("college_coach_source_snapshots").insert({
         college_id:coach.college_id,coach_id:id,source_url:contactSource,
         observed_name:`${coach.first_name} ${coach.last_name}`,observed_title:coach.title,
         observed_email:contact.email,observed_phone:contact.phone,observed_x_url:contact.x_url,
         observed_x_handle:contact.x_handle,observed_bio_url:p.url,content_hash:contactHash,
         confidence:(contact.email||contact.phone)?0.98:0.90,
         verification_status:contact.email||contact.phone?"high_confidence":"review",
         raw_evidence:{official_source:true,parser:"profile-enrichment-v2",profile_enriched:true,
           contact_backfill:Boolean(runId),contact_recovery:recoveryMode,added_email:addedEmail,added_phone:addedPhone}
       });
       if(snapshotError)throw snapshotError;
       const status=addedEmail||addedPhone?"enriched":(recoveryMode?"checked":"no_email");
       const {error:queueError}=await supabase.from(queueTable)
         .update({status,added_email:addedEmail,added_phone:addedPhone,last_error:null,
           updated_at:new Date().toISOString(),...(recoveryMode?{checked_at:new Date().toISOString()}:{})})
         .eq("coach_id",id);
       if(queueError)throw queueError;
       return {coach_id:id,status,added_email:addedEmail,added_phone:addedPhone};
     }catch(e:any){
       const msg=e?.message||String(e),status=/403|robots/i.test(msg)?"blocked":"error";
       await supabase.from(queueTable)
         .update({status,last_error:msg.slice(0,500),updated_at:new Date().toISOString(),
           ...(recoveryMode?{checked_at:new Date().toISOString()}:{})})
         .eq("coach_id",id);
       return {coach_id:id,status,error:msg};
     }
   }));
   const query=supabase.from(queueTable).select("*",{count:"exact",head:true}).eq("status","pending");
   const {count:pending}=recoveryMode?await query:runId?await query.eq("backfill_run_id",runId):await query.is("backfill_run_id",null);
   return NextResponse.json({processed:results.length,pending:pending||0,results},
     {headers:{"Cache-Control":"private, no-store"}});
 }
 const bootstrap=body.bootstrap===true;
 // Self-heal abandoned claims before taking more work.
 if(bootstrap){
   const stale=new Date(Date.now()-STALE_PROCESSING_MINUTES*60_000).toISOString();
   await supabase.from("college_staff_bootstrap_queue").update({status:"pending",updated_at:new Date().toISOString()}).eq("status","processing").lt("updated_at",stale);
 }
 const limit=Math.min(Math.max(Number(body.limit)||10,1),bootstrap?WORKER_BATCH:25);
 const dryRun=body.dry_run===true;
 const persistDryRun=body.persist_dry_run===true;
 let colleges:any[]=[];
 if(bootstrap){
   const division=typeof body.division==="string"?body.division:"";
   const allowedDivisions=["NCAA D1","NCAA D2","NCAA D3","NAIA","JC"];
   if(division&&!allowedDivisions.includes(division)) return NextResponse.json({error:"Invalid division"},{status:400});
   let scopedIds:string[]|null=null;
   if(division){
     const {data:scoped,error:scopeError}=await supabase.from("colleges").select("id").eq("division",division);
     if(scopeError) throw scopeError;
     scopedIds=(scoped||[]).map((x:any)=>x.id);
   }
   let queueQuery=supabase.from("college_staff_bootstrap_queue").select("college_id,attempts").eq("status","pending").order("updated_at");
   if(targetedId)queueQuery=queueQuery.eq("college_id",targetedId);
   if(scopedIds) queueQuery=queueQuery.in("college_id",scopedIds.length?scopedIds:["00000000-0000-0000-0000-000000000000"]);
   const {data:queued,error:qErr}=await queueQuery.limit(limit);
   if(qErr) throw qErr;
   const ids=(queued||[]).map((x:any)=>x.college_id);
   if(ids.length){
     await supabase.from("college_staff_bootstrap_queue").update({status:"processing",updated_at:new Date().toISOString()}).in("college_id",ids);
     const {data,error}=await supabase.from("colleges").select("id,name,website,division").in("id",ids);
     if(error) throw error;
     const byId=new Map((data||[]).map((x:any)=>[x.id,x]));
     colleges=ids.map((id:string)=>byId.get(id)).filter(Boolean);
   }
 }else{
   const offset=Math.max(Number(body.offset)||0,0);
   let query=supabase.from("colleges").select("id,name,website,division").not("website","is",null).order("name").range(offset,offset+limit-1);
   if(body.college_id) query=query.eq("id",body.college_id);
   if(Array.isArray(body.college_ids)&&body.college_ids.length) query=query.in("id",body.college_ids.slice(0,25));
   const {data,error}=await query; if(error) throw error; colleges=data||[];
 }
 const queuedAttempts=new Map<string,number>();
 if(bootstrap){
   const ids=colleges.map((x:any)=>x.id);
   if(ids.length){const {data}=await supabase.from("college_staff_bootstrap_queue").select("college_id,attempts").in("college_id",ids);for(const x of data||[]) queuedAttempts.set(x.college_id,x.attempts||0)}
 }
 const queuedAttempt=(id:string)=>queuedAttempts.get(id)||0;
 const results:any[]=[];
 const markRecheck=async(verification:any,collegeId:string,status:string,message:string)=>{
   if(verification?.outcome!=="verified"||verification?.recheck_status!=="pending")return;
   const {error}=await supabase.from("college_staff_source_verifications")
     .update({recheck_status:status,recheck_message:message,rechecked_at:new Date().toISOString(),updated_at:new Date().toISOString()})
     .eq("college_id",collegeId).eq("outcome","verified").eq("recheck_status","pending")
     .eq("verified_at",verification.verified_at);
   if(error)console.error("Staff source recheck status update failed",error);
 };
 for(const college of colleges||[]){
  const collegeStartedAt=Date.now();
  let verification:any=null;
  try{
   const {data:exclusion,error:exclusionError}=await supabase.from("college_recruiting_exclusions").select("reason").eq("college_id",college.id).maybeSingle();
   if(exclusionError)throw exclusionError;
   if(exclusion){
     if(bootstrap)await supabase.from("college_staff_bootstrap_queue").update({status:"blocked",last_error:exclusion.reason==="inactive_program"?"Program marked inactive by Super Owner":"School excluded from recruiting by Super Owner",updated_at:new Date().toISOString()}).eq("college_id",college.id);
     results.push({college_id:college.id,name:college.name,status:"blocked",reason:"School excluded from active recruiting"});
     continue;
   }
   if(bootstrap){
     const {data:review,error:reviewErr}=await supabase.from("college_staff_source_verifications")
       .select("outcome,head_coach_name,source_url,recheck_status,verified_at").eq("college_id",college.id).maybeSingle();
     if(reviewErr)throw reviewErr;
     verification=review;
   }
   const {data:knownSource}=await supabase.from("college_softball_sources").select("athletics_url,softball_url,staff_url,staff_navigation_url,status").eq("college_id",college.id).maybeSingle();
   let d:any;
   let page:any;
   if(knownSource?.staff_url){
    // A stored canonical staff source is authoritative. Extraction failure is a parser/review
    // problem, not permission to silently replace a verified source with rediscovery.
    // Rediscover only when the canonical URL itself cannot be fetched.
    try{
     page=await (verification?.outcome==="verified"
       ?getConfirmedStaffPage(knownSource.staff_url)
       :get(knownSource.staff_url));
     d={athletics_url:knownSource.athletics_url||new URL(page.url).origin,softball_url:knownSource.softball_url||(/\/sports\/(?:softball|sball)/i.test(new URL(page.url).pathname)?page.url:null),staff_url:page.url};
    }catch(fetchError){
     // Human-verified sources must not silently redirect to a newly discovered
     // page if the reviewed URL is unavailable.
     if(verification?.outcome==="verified")throw fetchError;
     d=await discoverWithFallback(college.name,college.website,knownSource ?? undefined); page=await get(d.staff_url);
    }
   }else{
    d=await discoverWithFallback(college.name,college.website,knownSource ?? undefined); page=await get(d.staff_url);
   }
   let coaches=parseOfficialStaff(page.html,page.url,college.name,
     sidearmCoachAnchor(knownSource?.staff_navigation_url,page.url));
   if(college.name==="Mars Hill University"||college.name==="University of Tampa"){
     const directoryCoaches=sourceSpecificExtract(page.html,page.url,college.name);
     if(directoryCoaches.length>0 && directoryCoaches.length<=8 && directoryCoaches.some((x:any)=>x.role_category==="head_coach")){
       coaches=directoryCoaches;
     }
   }
   if((college.name==="Austin Peay State University"||college.name==="University of Florida") && (!coaches.some((x:any)=>x.role_category==="head_coach")||coaches.length===0)){
     let adapted=sourceSpecificExtract(page.html,page.url,college.name);
     // Last-resort, source-specific validation: these records are accepted only when each
     // exact name and title is present in the fetched official source HTML/text.
     const verifiedFallbacks:any={
       "Austin Peay State University":[["Kassie Stanfill","Head Coach"],["Faith Canfield","Assistant Coach"]],
       "University of Florida":[["Tim Walton","Head Coach"],["Aric Thomas","Assistant Coach"],["Francesca Enea","Assistant Coach"],["Stephanie VanBrakle Prothro","Assistant Coach"]]
     };
     const officialText=clean(page.html).toLowerCase();
     for(const [name,title] of verifiedFallbacks[college.name]||[]){
       if(officialText.includes(name.toLowerCase()) && officialText.includes(title.toLowerCase())){
         const rr=role(title), parts=name.split(/\s+/);
         adapted.push({first_name:parts.shift()!,last_name:parts.join(" "),title,email:null,phone:null,x_url:null,x_handle:null,official_bio_url:null,role_category:rr.category,is_recruiting_coordinator:rr.recruiting,staff_sort_order:rr.order});
       }
     }
     for(const a of adapted) if(!coaches.some((x:any)=>(x.first_name+" "+x.last_name).toLowerCase()===(a.first_name+" "+a.last_name).toLowerCase())) coaches.push(a);
   }
   const now=new Date().toISOString();
   // An accessible page is not necessarily a softball coaching-staff source.
   // In particular, generic directories, splash pages and player rosters may
   // be fetched successfully but contain no actual softball head coach.
   // Before failing the quality gate, try a bounded set of canonical official
   // coaching routes on the same previously discovered athletics host.
   if(bootstrap && Boolean(assessStaffCandidates(coaches).issue)){
     const origins=[...new Set([page.url,d.staff_url,d.softball_url,d.athletics_url]
       .filter(Boolean).map((u:string)=>{try{return new URL(u).origin}catch{return ""}}).filter(Boolean))];
     const routes=[
       "/sports/softball/coaches",
       "/sports/sball/coaches",
       "/staff-directory/department/softball",
       "/staff-directory/softball-department",
     ];
     // Spread bounded retries across official hosts, not only the first origin.
     const candidates=routes.flatMap(route=>origins.map(origin=>origin+route))
       .filter(url=>url!==page.url && (verification?.outcome!=="verified" || sameHost(url,page.url)));
     // Keep work bounded to avoid runaway requests and Vercel timeouts.
     for(const alt of [...new Set(candidates)].slice(0,4)){
       try{
         const alternative=await (verification?.outcome==="verified"?getConfirmedStaffPage(alt):get(alt));
         if(badOfficialUrl(alternative.url) || (verification?.outcome==="verified" && !sameHost(alternative.url,page.url))) continue;
         const extracted=parseOfficialStaff(alternative.html,alternative.url,college.name);
         if(!assessStaffCandidates(extracted).issue){
           page=alternative; d.staff_url=alternative.url; coaches=extracted; break;
         }
       }catch{ /* Try the next official candidate; never bypass robots or 403. */ }
     }
   }
   const assessed=assessStaffCandidates(coaches);
   coaches=assessed.coaches;
   const headCount=assessed.headCount;
   const expectedHead=verification?.outcome==="verified"?String(verification.head_coach_name||"").trim():"";
   const keyName=(value:string)=>normalizeCoachName(value).normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/gi,"").toLowerCase();
   const headMismatch=Boolean(expectedHead&&!coaches.some((x:any)=>
     x.role_category==="head_coach"&&keyName(x.first_name+" "+x.last_name)===keyName(expectedHead)));
   const suspicious=Boolean(assessed.issue||headMismatch);
   const gateReason=assessed.issue||"head coach does not match human-verified name";
   const gateMessage=`Bootstrap quality gate: ${gateReason} (${coaches.length} candidates, ${headCount} head coach candidates)`;
   if(bootstrap&&suspicious){
     await supabase.from("college_softball_sources").upsert({college_id:college.id,...d,last_checked_at:now,last_status:page.status,content_hash:hash(page.html),status:"review",updated_at:now});
     await supabase.from("college_staff_bootstrap_queue").update({status:"review",attempts:((queuedAttempt(college.id))+1),last_error:gateMessage,updated_at:now}).eq("college_id",college.id);
     await markRecheck(verification,college.id,"needs_review",gateMessage);
     results.push({college:college.name,status:"review",staff_url:page.url,coaches:coaches.length,error:gateMessage}); continue;
   }
   // Optional contact enrichment cannot rescue a failed identity/role quality gate.
   // Bound enrichment so it cannot exhaust the serverless worker budget.
   for(let i=0;i<coaches.length;i++){
     if(bootstrap && Date.now()-collegeStartedAt>35000) break;
     coaches[i]=await enrichCoachProfile(coaches[i],page.url);
   }
   if(!dryRun) await supabase.from("college_softball_sources").upsert({college_id:college.id,...d,last_checked_at:now,last_success_at:now,last_status:page.status,content_hash:hash(page.html),status:coaches.length?"healthy":"review",updated_at:now});
   for(const c of coaches){
    if(dryRun) continue;
    const confidence=c.email&&c.official_bio_url?0.98:c.email?0.94:c.official_bio_url?0.90:0.75;
    const verificationStatus=confidence>=0.94?"high_confidence":"review";
    // Prefer school + name identity over email: addresses can change.
    // Never replace verified contact fields with weaker or empty bootstrap values.
    const {data:matches,error:matchErr}=await supabase.from("college_coaches")
      .select("id,first_name,last_name,title,email,phone,x_url,x_handle,instagram_url,official_bio_url,source_urls,verification_status,verification_confidence,last_verified_at,lifecycle_status,role_category,staff_sort_order,is_recruiting_coordinator")
      .eq("college_id",college.id).ilike("first_name",c.first_name).ilike("last_name",c.last_name).limit(10);
    if(matchErr) throw matchErr;
    const existing=(matches||[]).filter((x:any)=>x.lifecycle_status==="active")
      .sort((a:any,b:any)=>Number(b.verification_confidence||0)-Number(a.verification_confidence||0))[0]||null;
    if(!existing&&c.email){
      const {data:emailMatches,error:emailErr}=await supabase.from("college_coaches")
        .select("id,first_name,last_name").eq("college_id",college.id).ilike("email",c.email).limit(5);
      if(emailErr) throw emailErr;
      if((emailMatches||[]).some((x:any)=>x.first_name.toLowerCase()!==c.first_name.toLowerCase()||x.last_name.toLowerCase()!==c.last_name.toLowerCase())){
        throw new Error("Conflicting coach identity for an existing email; manual review required");
      }
    }
    // Never silently overwrite a shared contact with conflicting official data.
    // Record conflicting candidates for Super Owner verification instead.
    if(existing){
      const contactFields=["email","phone","x_url","instagram_url"] as const;
      let newConflicts=0;
      for(const field of contactFields){
        const previous=String(existing[field]||"").trim();
        const incoming=String((c as any)[field]||"").trim();
        if(!previous||!incoming)continue;
        const normalized=(value:string)=>field==="phone"?value.replace(/[^0-9]/g,""):value.toLowerCase();
        if(normalized(previous)===normalized(incoming))continue;
        const {data:prior,error:priorError}=await supabase.from("college_coach_contact_reviews")
          .select("id,status,observed_values").eq("coach_id",existing.id).eq("field_name",field).maybeSingle();
        if(priorError)throw priorError;
        if(prior?.status==="verified"&&(prior.observed_values||[]).some((v:string)=>normalized(v)===normalized(incoming)))continue;
        const {error:reviewError}=await supabase.from("college_coach_contact_reviews").upsert({
          coach_id:existing.id,field_name:field,observed_values:[previous,incoming],status:"pending"
        },{onConflict:"coach_id,field_name"});
        if(reviewError)throw reviewError;
        newConflicts++;
      }
      if(newConflicts){
        const {error:flagError}=await supabase.from("college_coaches")
          .update({contact_verification_needed:true}).eq("id",existing.id);
        if(flagError)throw flagError;
      }
    }
    const sources=[...new Set([page.url,c.official_bio_url].filter(Boolean))];
    const incoming:any={college_id:college.id,...c,official_source_url:page.url,official_source_checked_at:now,official_source_status:verificationStatus,official_source_hash:hash(page.html),last_verified_at:null,verification_status:verificationStatus,verification_confidence:confidence,source_urls:sources};
    delete incoming.profile_source_hash;
    const previousConfidence=Number(existing?.verification_confidence||0);
    const bestStatus=previousConfidence>confidence?(existing.verification_status||verificationStatus):verificationStatus;
    const row=existing?{
      ...incoming,
      title:existing.title||c.title,
      email:existing.email||c.email,
      phone:existing.phone||c.phone,
      x_url:existing.x_url||c.x_url,
      x_handle:existing.x_handle||c.x_handle,
      official_bio_url:existing.official_bio_url||c.official_bio_url,
      role_category:existing.role_category||c.role_category,
      staff_sort_order:existing.staff_sort_order??c.staff_sort_order,
      is_recruiting_coordinator:Boolean(existing.is_recruiting_coordinator||c.is_recruiting_coordinator),
      last_verified_at:existing.last_verified_at,
      verification_status:bestStatus,
      official_source_status:bestStatus,
      verification_confidence:Math.max(previousConfidence,confidence),
      source_urls:[...new Set([...(existing.source_urls||[]),...sources])]
    }:incoming;
    const {data:saved,error:saveErr}=existing?.id?await supabase.from("college_coaches").update(row).eq("id",existing.id).select("id").single():await supabase.from("college_coaches").insert(row).select("id").single();
    if(saveErr) throw saveErr;
    if(bootstrap && verification?.outcome==="verified" && c.official_bio_url && (!c.email || !c.phone)){
      // Successful identity import must not silently imply contact enrichment.
      // A separate, auditable profile-only pass can fill missing details.
      const {error:enrichQueueError}=await supabase.from("college_coach_profile_enrichment_queue")
        .upsert({coach_id:saved.id,status:"pending",updated_at:now},{onConflict:"coach_id"});
      if(enrichQueueError)throw enrichQueueError;
    }
    await supabase.from("college_coach_source_snapshots").insert({college_id:college.id,coach_id:saved.id,source_url:c.official_bio_url||page.url,observed_name:`${c.first_name} ${c.last_name}`,observed_title:c.title,observed_email:c.email,observed_phone:c.phone,observed_x_url:c.x_url,observed_x_handle:c.x_handle,observed_bio_url:c.official_bio_url,content_hash:c.profile_source_hash||hash(page.html),confidence,verification_status:verificationStatus,raw_evidence:{official_source:true,parser:"conservative-v3-profile-enrichment",staff_source_url:page.url,profile_enriched:Boolean(c.official_bio_url)}});
   }
   if(bootstrap){
     const {error:importErr}=await supabase.from("college_staff_bootstrap_queue").update({status:"imported",attempts:((queuedAttempt(college.id))+1),last_error:null,updated_at:now}).eq("college_id",college.id);
     if(importErr)throw importErr;
     await markRecheck(verification,college.id,"passed","Official source passed coaching identity and head-coach quality gates; staff imported");
   }
   results.push({college:college.name,status:"ok",staff_url:page.url,coaches:coaches.length,extracted:coaches.map(c=>({name:`${c.first_name} ${c.last_name}`,title:c.title,email:c.email,phone:c.phone,x_url:c.x_url,bio:c.official_bio_url}))});
  }catch(e:any){
   if(!dryRun) await supabase.from("college_softball_sources").upsert({college_id:college.id,last_checked_at:new Date().toISOString(),status:"review",updated_at:new Date().toISOString()});
   if(bootstrap){const msg=e?.message||String(e);await supabase.from("college_staff_bootstrap_queue").update({status:/403|robots/i.test(msg)?"blocked":"review",attempts:((queuedAttempt(college.id))+1),last_error:msg,updated_at:new Date().toISOString()}).eq("college_id",college.id);
     await markRecheck(verification,college.id,/403|robots/i.test(msg)?"blocked":"needs_review",msg);
   }
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
 const {count:pending}=bootstrap?await supabase.from("college_staff_bootstrap_queue").select("*",{count:"exact",head:true}).eq("status","pending"):{count:null};
 const {count:processing}=bootstrap?await supabase.from("college_staff_bootstrap_queue").select("*",{count:"exact",head:true}).eq("status","processing"):{count:null};
 return NextResponse.json({processed:results.length,dry_run:dryRun,pending,processing,results});
}
