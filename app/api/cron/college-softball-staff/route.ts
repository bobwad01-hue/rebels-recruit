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

async function get(url:string){
 const r=await fetch(url,{redirect:"follow",headers:{"user-agent":"RLTNL-College-Staff-Intelligence/1.0 (+https://www.rltnl.com)","accept":"text/html"}});
 if(!r.ok) throw new Error(`${r.status} ${r.statusText}`);
 return {html:await r.text(),url:r.url,status:r.status};
}

function links(html:string,base:string){
 return [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
  .map(m=>({url:abs(m[1],base),text:clean(m[2])})).filter(x=>x.url);
}
function sameHost(a:string,b:string){try{return new URL(a).hostname.replace(/^www\./,"")===new URL(b).hostname.replace(/^www\./,"")}catch{return false}}

async function discover(start:string){
 const home=await get(start); const ls=links(home.html,home.url);
 const athletic=ls.find(x=>/athletics?|sports/i.test(x.text+" "+x.url) && !/facebook|instagram|twitter|x\.com/i.test(x.url))?.url || home.url;
 const a=athletic===home.url?home:await get(athletic);
 const sl=links(a.html,a.url);
 const softball=sl.find(x=>/softball/i.test(x.text+" "+x.url))?.url;
 if(!softball) throw new Error("Official softball page not discovered");
 const s=await get(softball); const staffLinks=links(s.html,s.url);
 const staff=staffLinks.find(x=>/coach|staff/i.test(x.text+" "+x.url) && /softball|coach|staff/i.test(x.url))?.url || s.url;
 return {athletics_url:a.url,softball_url:s.url,staff_url:staff};
}

function extract(html:string,url:string){
 const anchors=links(html,url);
 const emails=new Map<string,string>();
 for(const a of anchors){if(a.url.startsWith("mailto:")) emails.set(a.url.replace(/^mailto:/,"").split("?")[0].toLowerCase(),a.text)}
 const blocks=html.split(/<\/(?:li|tr|article|section|div)>/i).filter(x=>/mailto:/i.test(x));
 const out:any[]=[];
 for(const block of blocks){
  const email=(block.match(/mailto:([^"'?\s>]+)/i)?.[1]||"").toLowerCase(); if(!email) continue;
  const text=clean(block); if(!/coach|coordinator/i.test(text)) continue;
  const titleMatch=text.match(/((?:Associate\s+Head|Head|Assistant|Volunteer\s+Assistant|Graduate\s+Assistant|Pitching|Hitting)[^|,;]{0,55}(?:Coach|Coordinator)|Recruit(?:ing|ment)\s+Coordinator)/i);
  const title=titleMatch?.[1]?.trim()||"Softball Coach";
  const before=text.split(title)[0].trim();
  const name=(before.match(/([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){1,3})\s*$/)?.[1]||emails.get(email)||"").trim();
  if(!name || /email|phone|staff|softball/i.test(name)) continue;
  const parts=name.split(/\s+/); const first_name=parts.shift()!, last_name=parts.join(" ");
  const phone=text.match(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/)?.[0]||null;
  const blockLinks=links(block,url);
  const x=blockLinks.find(a=>/^(https?:\/\/)?(?:www\.)?(?:x\.com|twitter\.com)\//i.test(a.url));
  const bio=blockLinks.find(a=>sameHost(a.url,url)&&!a.url.startsWith("mailto:")&&/coach|staff|bio/i.test(a.url+" "+a.text));
  const rr=role(title);
  out.push({first_name,last_name,title,email,phone,x_url:x?.url||null,x_handle:x?("@"+new URL(x.url).pathname.split("/").filter(Boolean)[0]):null,official_bio_url:bio?.url||null,role_category:rr.category,is_recruiting_coordinator:rr.recruiting,staff_sort_order:rr.order});
 }
 return [...new Map(out.map(x=>[x.email,x])).values()];
}

export async function POST(req:NextRequest){
 const auth=req.headers.get("authorization");
 if(process.env.CRON_SECRET && auth!==`Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({error:"Unauthorized"},{status:401});
 const body=await req.json().catch(()=>({}));
 const limit=Math.min(Number(body.limit)||10,25);
 let query=supabase.from("colleges").select("id,name,website").not("website","is",null).order("name").limit(limit);
 if(body.college_id) query=query.eq("id",body.college_id);
 const {data:colleges,error}=await query; if(error) throw error;
 const results:any[]=[];
 for(const college of colleges||[]){
  try{
   const d=await discover(college.website); const page=await get(d.staff_url); const coaches=extract(page.html,page.url); const now=new Date().toISOString();
   await supabase.from("college_softball_sources").upsert({college_id:college.id,...d,last_checked_at:now,last_success_at:now,last_status:page.status,content_hash:hash(page.html),status:coaches.length?"healthy":"review",updated_at:now});
   for(const c of coaches){
    const confidence=c.email&&c.title?0.98:0.85;
    const {data:existing}=await supabase.from("college_coaches").select("id").eq("college_id",college.id).ilike("email",c.email).maybeSingle();
    const row={college_id:college.id,...c,official_source_url:page.url,official_source_checked_at:now,official_source_status:"verified",official_source_hash:hash(page.html),last_verified_at:now,verification_status:"verified",verification_confidence:confidence,source_urls:[page.url]};
    const {data:saved,error:saveErr}=existing?.id?await supabase.from("college_coaches").update(row).eq("id",existing.id).select("id").single():await supabase.from("college_coaches").insert(row).select("id").single();
    if(saveErr) throw saveErr;
    await supabase.from("college_coach_source_snapshots").insert({college_id:college.id,coach_id:saved.id,source_url:page.url,observed_name:`${c.first_name} ${c.last_name}`,observed_title:c.title,observed_email:c.email,observed_phone:c.phone,observed_x_url:c.x_url,observed_x_handle:c.x_handle,observed_bio_url:c.official_bio_url,content_hash:hash(page.html),confidence,verification_status:"verified",raw_evidence:{official_source:true}});
   }
   results.push({college:college.name,status:"ok",staff_url:page.url,coaches:coaches.length});
  }catch(e:any){
   await supabase.from("college_softball_sources").upsert({college_id:college.id,last_checked_at:new Date().toISOString(),status:"review",updated_at:new Date().toISOString()});
   results.push({college:college.name,status:"review",error:e?.message||String(e)});
  }
 }
 return NextResponse.json({processed:results.length,results});
}
