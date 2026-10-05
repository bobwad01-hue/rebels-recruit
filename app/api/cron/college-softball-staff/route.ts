import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

export const runtime = "nodejs";
export const maxDuration = 60;

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
  for(const raw of txt.split(/\r?\n/)){
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
 const r=await fetch(url,{redirect:"follow",headers:{"user-agent":USER_AGENT+"/1.0 (+https://www.rltnl.com)","accept":"text/html"}});
 if(!r.ok) throw new Error(`${r.status} ${r.statusText}`);
 return {html:await r.text(),url:r.url,status:r.status};
}

function links(html:string,base:string){
 return [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
  .map(m=>({url:abs(m[1],base),text:clean(m[2])})).filter(x=>x.url);
}
function sameHost(a:string,b:string){try{return new URL(a).hostname.replace(/^www\./,"")===new URL(b).hostname.replace(/^www\./,"")}catch{return false}}

function scoreLink(x:{url:string,text:string},kind:"softball"|"staff"){
 const s=(x.text+" "+x.url).toLowerCase();
 let n=0;
 if(kind==="softball"){if(/softball/.test(s))n+=10;if(/sports\/softball/.test(s))n+=8;if(/roster|schedule|news/.test(s))n-=2}
 else {if(/softball/.test(s))n+=6;if(/coach|staff/.test(s))n+=8;if(/staff-directory/.test(s))n+=5;if(/bio/.test(s))n+=2}
 return n;
}
function bestLink(xs:{url:string,text:string}[],kind:"softball"|"staff",base:string){
 return xs.filter(x=>sameHost(x.url,base)).map(x=>({x,n:scoreLink(x,kind)})).filter(x=>x.n>0).sort((a,b)=>b.n-a.n)[0]?.x.url;
}
async function discover(start:string){
 const home=await get(start); const ls=links(home.html,home.url);
 const athletic=ls.find(x=>/athletics?|sports/i.test(x.text+" "+x.url) && !/facebook|instagram|twitter|x\.com/i.test(x.url))?.url || home.url;
 const a=athletic===home.url?home:await get(athletic);
 const sl=links(a.html,a.url);
 const softball=bestLink(sl,"softball",a.url);
 if(!softball) throw new Error("Official softball page not discovered");
 const s=await get(softball); const staffLinks=links(s.html,s.url);
 let staff=bestLink(staffLinks,"staff",s.url) || s.url;
 // Some schools publish contacts only in the official athletics staff directory.
 if(staff===s.url){
   const directory=sl.find(x=>sameHost(x.url,a.url)&&/staff\s*directory|staff-directory/i.test(x.text+" "+x.url))?.url;
   if(directory) staff=directory;
 }
 return {athletics_url:a.url,softball_url:s.url,staff_url:staff};
}

function extract(html:string,url:string){
 const anchors=links(html,url);
 const emails=new Map<string,string>();
 for(const a of anchors){if(a.url.startsWith("mailto:")) emails.set(a.url.replace(/^mailto:/,"").split("?")[0].toLowerCase(),a.text)}
 const blocks=html.split(/<\/(?:li|tr|article|section|div)>/i).filter(x=>/coach|coordinator/i.test(clean(x)));
 const out:any[]=[];
 for(const block of blocks){
  const email=(block.match(/mailto:([^"'?\s>]+)/i)?.[1]||"").toLowerCase()||null;
  const text=clean(block); if(!/coach|coordinator/i.test(text)) continue;
  const titleMatch=text.match(/((?:Associate\s+Head|Head|Assistant|Volunteer\s+Assistant|Graduate\s+Assistant|Pitching|Hitting)[^|,;]{0,55}(?:Coach|Coordinator)|Recruit(?:ing|ment)\s+Coordinator)/i);
  const title=titleMatch?.[1]?.trim()||"Softball Coach";
  const before=text.split(title)[0].trim();
  const name=(before.match(/([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){1,3})\s*$/)?.[1]||(email?emails.get(email):"")||"").trim();
  if(!name || /email|phone|staff|softball/i.test(name)) continue;
  const parts=name.split(/\s+/); const first_name=parts.shift()!, last_name=parts.join(" ");
  const phone=text.match(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/)?.[0]||null;
  const blockLinks=links(block,url);
  const x=blockLinks.find(a=>/^(https?:\/\/)?(?:www\.)?(?:x\.com|twitter\.com)\//i.test(a.url));
  const bio=blockLinks.find(a=>sameHost(a.url,url)&&!a.url.startsWith("mailto:")&&/coach|staff|bio/i.test(a.url+" "+a.text));
  const rr=role(title);
  out.push({first_name,last_name,title,email,phone,x_url:x?.url||null,x_handle:x?("@"+new URL(x.url).pathname.split("/").filter(Boolean)[0]):null,official_bio_url:bio?.url||null,role_category:rr.category,is_recruiting_coordinator:rr.recruiting,staff_sort_order:rr.order});
 }
 return [...new Map(out.map(x=>[x.email||(`${x.first_name} ${x.last_name}`).toLowerCase(),x])).values()];
}

export async function POST(req:NextRequest){
 const auth=req.headers.get("authorization");
 const manualKey=req.headers.get("x-rlt-ingestion-key");
 const cronOk=Boolean(process.env.CRON_SECRET && auth===`Bearer ${process.env.CRON_SECRET}`);
 const manualOk=Boolean(process.env.STAFF_INGESTION_MANUAL_KEY && manualKey===process.env.STAFF_INGESTION_MANUAL_KEY);
 if(!cronOk && !manualOk) return NextResponse.json({error:"Unauthorized"},{status:401});
 const body=await req.json().catch(()=>({}));
 const limit=Math.min(Math.max(Number(body.limit)||10,1),25);
 const dryRun=body.dry_run===true;
 let query=supabase.from("colleges").select("id,name,website").not("website","is",null).order("name").limit(limit);
 if(body.college_id) query=query.eq("id",body.college_id);
 if(Array.isArray(body.college_ids)&&body.college_ids.length) query=query.in("id",body.college_ids.slice(0,25));
 const {data:colleges,error}=await query; if(error) throw error;
 const results:any[]=[];
 for(const college of colleges||[]){
  try{
   const d=await discover(college.website); const page=await get(d.staff_url); const coaches=extract(page.html,page.url); const now=new Date().toISOString();
   if(!dryRun) await supabase.from("college_softball_sources").upsert({college_id:college.id,...d,last_checked_at:now,last_success_at:now,last_status:page.status,content_hash:hash(page.html),status:coaches.length?"healthy":"review",updated_at:now});
   for(const c of coaches){
    if(dryRun) continue;
    const confidence=c.email&&c.title?0.98:c.title?0.90:0.80;
    let existing:any=null;
    if(c.email){
      const r=await supabase.from("college_coaches").select("id").eq("college_id",college.id).ilike("email",c.email).maybeSingle(); existing=r.data;
    } else {
      const r=await supabase.from("college_coaches").select("id").eq("college_id",college.id).ilike("first_name",c.first_name).ilike("last_name",c.last_name).maybeSingle(); existing=r.data;
    }
    const row={college_id:college.id,...c,official_source_url:page.url,official_source_checked_at:now,official_source_status:"verified",official_source_hash:hash(page.html),last_verified_at:now,verification_status:"verified",verification_confidence:confidence,source_urls:[page.url]};
    const {data:saved,error:saveErr}=existing?.id?await supabase.from("college_coaches").update(row).eq("id",existing.id).select("id").single():await supabase.from("college_coaches").insert(row).select("id").single();
    if(saveErr) throw saveErr;
    await supabase.from("college_coach_source_snapshots").insert({college_id:college.id,coach_id:saved.id,source_url:page.url,observed_name:`${c.first_name} ${c.last_name}`,observed_title:c.title,observed_email:c.email,observed_phone:c.phone,observed_x_url:c.x_url,observed_x_handle:c.x_handle,observed_bio_url:c.official_bio_url,content_hash:hash(page.html),confidence,verification_status:"verified",raw_evidence:{official_source:true}});
   }
   results.push({college:college.name,status:"ok",staff_url:page.url,coaches:coaches.length});
  }catch(e:any){
   if(!dryRun) await supabase.from("college_softball_sources").upsert({college_id:college.id,last_checked_at:new Date().toISOString(),status:"review",updated_at:new Date().toISOString()});
   results.push({college:college.name,status:"review",error:e?.message||String(e)});
  }
 }
 return NextResponse.json({processed:results.length,dry_run:dryRun,results});
}
