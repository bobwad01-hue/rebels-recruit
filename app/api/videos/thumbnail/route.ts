import {NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase-server';

const ALLOWED_HOSTS=['sportsrecruits.com','www.sportsrecruits.com','my.sportsrecruits.com'];
const isAllowedHost=(host:string)=>ALLOWED_HOSTS.includes(host.toLowerCase())||host.toLowerCase().endsWith('.sportsrecruits.com');
const decode=(value:string)=>value.replace(/&amp;/g,'&').replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/&lt;/g,'<').replace(/&gt;/g,'>');

function meta(html:string,key:string){
 const esc=key.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const patterns=[
  new RegExp(`<meta[^>]+(?:property|name)=["']${esc}["'][^>]+content=["']([^"']+)["'][^>]*>`,'i'),
  new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${esc}["'][^>]*>`,'i')
 ];
 for(const pattern of patterns){const m=html.match(pattern);if(m?.[1])return decode(m[1]);}
 return '';
}

function resolveImage(html:string,base:string){
 const candidates=[
  meta(html,'og:image:secure_url'),meta(html,'og:image'),meta(html,'twitter:image'),meta(html,'twitter:image:src'),
  html.match(/<video[^>]+poster=["']([^"']+)["']/i)?.[1]||'',
  html.match(/<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i)?.[1]||'',
  html.match(/["']thumbnail(?:_url|Url)?["']\s*:\s*["']([^"']+)["']/i)?.[1]||''
 ].filter(Boolean) as string[];
 for(const raw of candidates){
  try{const u=new URL(decode(raw),base);if(u.protocol==='https:'||u.protocol==='http:')return u.toString();}catch{}
 }
 return '';
}

export async function GET(request:Request){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)return NextResponse.json({error:'Not signed in.'},{status:401});
 const raw=new URL(request.url).searchParams.get('url')||'';
 let target:URL;
 try{target=new URL(raw);}catch{return NextResponse.json({error:'Invalid video URL.'},{status:400});}
 if(!['https:','http:'].includes(target.protocol)||!isAllowedHost(target.hostname))return NextResponse.json({error:'Thumbnail lookup is only supported for SportsRecruits links.'},{status:400});
 try{
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),8000);
  const res=await fetch(target.toString(),{redirect:'follow',cache:'no-store',signal:controller.signal,headers:{'User-Agent':'Mozilla/5.0 (compatible; RebelsRecruit/1.0)','Accept':'text/html,application/xhtml+xml'}});
  clearTimeout(timer);
  if(!res.ok)return NextResponse.json({thumbnail:''},{status:200});
  const finalUrl=new URL(res.url||target.toString());
  if(!isAllowedHost(finalUrl.hostname))return NextResponse.json({thumbnail:''},{status:200});
  const html=(await res.text()).slice(0,750000);
  return NextResponse.json({thumbnail:resolveImage(html,finalUrl.toString()),source:'SportsRecruits'});
 }catch{return NextResponse.json({thumbnail:''},{status:200});}
}
