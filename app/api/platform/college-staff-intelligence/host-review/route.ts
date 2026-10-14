import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase-server';
import {createAdminClient} from '@/lib/supabase-admin';

export const dynamic='force-dynamic';
export const runtime='nodejs';
export const maxDuration=30;
const headers={'Cache-Control':'private, no-store'};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function host(value:string|null|undefined):string|null{
  if(!value)return null;
  try{
    const u=new URL(value);
    if(u.protocol!=='https:'||u.username||u.password||u.port)return null;
    const h=u.hostname.toLowerCase().replace(/^www\./,'');
    if(h.length>253||!/^([a-z0-9-]+\.)+[a-z]{2,}$/.test(h)
      ||/(^|\.)(localhost|local|internal|test|example|invalid)$/.test(h)
      ||/(^|\.)(google\.com|facebook\.com|instagram\.com|x\.com|twitter\.com|youtube\.com|linkedin\.com|tiktok\.com|bit\.ly)$/.test(h))
      return null;
    return h;
  }catch{return null;}
}
function sameUniversityHost(url:string,schoolHost:string){
  const h=host(url);
  return h===schoolHost||Boolean(h&&h.endsWith('.'+schoolHost));
}
async function fetchOfficialUniversityPage(url:string,schoolHost:string,athleticsHost:string){
  let current=url;
  for(let redirects=0;redirects<3;redirects++){
    if(!sameUniversityHost(current,schoolHost))throw new Error('Evidence must remain on the university website');
    const response=await fetch(current,{redirect:'manual',cache:'no-store',
      signal:AbortSignal.timeout(6500),
      headers:{'User-Agent':'RLTNL-College-Staff-Intelligence/1.0 (+https://www.rltnl.com)',
        'Accept':'text/html,application/xhtml+xml'}});
    if(response.status>=300&&response.status<400){
      const next=response.headers.get('location');
      if(!next)throw new Error('Official university page redirected without a destination');
      const destination=new URL(next,current).toString();
      // An official university /athletics page redirecting directly to the
      // school's proposed athletics host is strong independent evidence.
      // Do not follow off-site redirects or accept arbitrary open-redirect paths.
      if(host(destination)===athleticsHost){
        const path=new URL(current).pathname;
        if(!new URL(current).search && /(^|\/)(athletics|sports|varsity)(\/|$)/i.test(path))
          return {url:current,html:'',redirectedAthleticsLink:destination};
        throw new Error('Cross-domain redirect is not from an athletics path');
      }
      if(!sameUniversityHost(destination,schoolHost))
        throw new Error('University evidence redirected to an unrelated website');
      current=destination;
      continue;
    }
    if(!response.ok)throw new Error('University evidence page returned HTTP '+response.status);
    const contentType=response.headers.get('content-type')||'';
    if(!/text\/html|application\/xhtml\+xml/i.test(contentType))
      throw new Error('Evidence must be an official university HTML page');
    const reader=response.body?.getReader();
    if(!reader)throw new Error('Official university page had no readable content');
    const parts:Uint8Array[]=[];let size=0;
    try{
      while(true){
        const {done,value}=await reader.read();
        if(done)break;
        size+=value.byteLength;
        if(size>1250000)throw new Error('University evidence page exceeded safe size');
        parts.push(value);
      }
    }finally{await reader.cancel().catch(()=>{});}
    const decoder=new TextDecoder('utf-8');
    return {url:current,html:parts.map(p=>decoder.decode(p,{stream:true})).join('')+decoder.decode()};
  }
  throw new Error('University evidence page redirected too many times');
}
function findOfficialAthleticsLink(html:string,evidenceUrl:string,athleticsHost:string){
  // Require an actual hyperlink to the athletics host on an independently
  // fetched university page. Mentioning a domain in free text is insufficient.
  for(const match of html.matchAll(/<a\b[^>]*\s+href\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/gi)){
    const raw=(match[1]||match[2]||match[3]||'').replace(/&amp;/gi,'&').trim();
    if(!raw||raw.startsWith('#'))continue;
    try{
      const u=new URL(raw,evidenceUrl);
      if(host(u.toString())===athleticsHost)return u.toString();
    }catch{}
  }
  return null;
}
type Evidence={verified:boolean;school_website:string;athletics_host:string;
  evidence_url:string|null;matched_link:string|null;checked_urls:string[];message:string};
// Independently located university-side entry points for schools whose official
// athletics link is not on one of the conventional paths. These are NOT trusted
// approvals: every page is fetched afresh and must link to the saved athletics
// host (or redirect to it from an explicit university Athletics path).
const knownUniversityEvidencePaths:Record<string,string[]>={
  'deltastate.edu':['/library/departments/archives-museum/baseball-musuem/'],
  'eu.edu':['/athletics/'],
  'glenville.edu':['/athletics'],
  'lynn.edu':['/news/2026/coaching-beyond-the-field'],
  'obu.edu':['/athletics.php'],
  'pba.edu':['/about/facts/students/'],
  'uco.edu':['/about/divisions','https://www3.uco.edu/press/prdetail.asp?NewsID=29594'],
  'uiu.edu':['/families/']
};
function discoverUniversityPages(html:string,pageUrl:string,schoolHost:string){
  const matches:string[]=[];
  // Crawl only pages that are linked from an independently fetched official
  // university HTML page. Do not trust links or redirects from athletics hosts.
  for(const m of html.matchAll(/<a\b[^>]*\s+href\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))[^>]*>/gi)){
    const raw=(m[1]||m[2]||m[3]||'').replace(/&amp;/gi,'&').trim();
    if(!raw||raw.startsWith('#'))continue;
    try{
      const u=new URL(raw,pageUrl);
      if(!sameUniversityHost(u.toString(),schoolHost)||u.search||u.hash)continue;
      const label=html.slice((m.index||0)+m[0].length,(m.index||0)+m[0].length+180)
        .replace(/<[^>]*>/g,' ').replace(/&amp;/gi,'&');
      if(!/(athletic|sport|student.life|campus.life|divisions|family|families)/i.test(u.pathname+' '+label))continue;
      if(!matches.includes(u.toString()))matches.push(u.toString());
      if(matches.length>=8)break;
    }catch{}
  }
  return matches;
}
async function verifyIndependentEvidence(website:string,sourceUrl:string,optionalEvidence:string){
  const schoolHost=host(website),athleticsHost=host(sourceUrl);
  if(!schoolHost||!athleticsHost||schoolHost===athleticsHost)
    throw new Error('A separate official university website and athletics domain are required');
  const origin=new URL(website).origin;
  const home=origin+'/';
  if(optionalEvidence&&!sameUniversityHost(optionalEvidence,schoolHost))
    throw new Error('Evidence URL must be hosted on the school’s saved university website');
  const checked:string[]=[];
  let blocked=0;
  const inspected:{url:string;html:string}[]=[];
  async function inspect(candidate:string){
    try{
      const page=await fetchOfficialUniversityPage(candidate,schoolHost!,athleticsHost!);
      checked.push(page.url);
      const link=page.redirectedAthleticsLink||
        findOfficialAthleticsLink(page.html,page.url,athleticsHost!);
      if(link)return {verified:true,school_website:website,athletics_host:athleticsHost!,
        evidence_url:page.url,matched_link:link,checked_urls:checked,
        message:page.redirectedAthleticsLink
          ?'The university’s official Athletics page redirects directly to this athletics domain.'
          :'The university’s official page directly links to this athletics domain.'} satisfies Evidence;
      if(page.html)inspected.push({url:page.url,html:page.html});
    }catch(e){
      checked.push(candidate);
      if(e instanceof Error&&/HTTP (403|429|503)|fetch failed|timeout|abort/i.test(e.message))blocked++;
    }
    return null;
  }
  // User-supplied evidence is checked on its own, without replacing the saved
  // coaching source or searching for a different approval basis.
  if(optionalEvidence){
    const found=await inspect(optionalEvidence);
    if(found)return found;
  }else{
    // Parallel, bounded checks avoid exhausting the 30-second route budget.
    const first=[
      ...(knownUniversityEvidencePaths[schoolHost]||[]).map(path=>path.startsWith('https://')?path:origin+path),
      origin+'/athletics/',origin+'/athletics',origin+'/athletics.php',
      home,origin+'/student-life/'
    ];
    const firstResults=await Promise.all([...new Set(first)].map(inspect));
    const found=firstResults.find(x=>x!==null);
    if(found)return found;
    const linked=inspected.flatMap(page=>discoverUniversityPages(page.html,page.url,schoolHost));
    const second=[
      ...linked,
      origin+'/sports/',origin+'/about/divisions',origin+'/about/facts/students/',
      origin+'/families/',origin+'/student-life/athletics/'
    ].filter(url=>!first.includes(url));
    const secondResults=await Promise.all([...new Set(second)].slice(0,8).map(inspect));
    const secondFound=secondResults.find(x=>x!==null);
    if(secondFound)return secondFound;
  }
  return {verified:false,school_website:website,athletics_host:athleticsHost,
    evidence_url:null,matched_link:null,checked_urls:[...new Set(checked)],
    message:blocked
      ?'No independent athletics link was confirmed. Some official university pages blocked automated access ('+blocked+' checks). Open an official university page in your browser and paste its exact URL above; approval remains locked until the link can be verified.'
      :'No independent athletics link was found on the official university pages checked. Paste a specific university page that links directly to the athletics site; approval remains locked until verified.'} satisfies Evidence;
}

export async function POST(req:NextRequest){
  if(req.headers.get('origin')!==new URL(req.url).origin)
    return NextResponse.json({error:'Same-origin request required'},{status:403,headers});
  const session=await createClient();
  const {data:{user}}=await session.auth.getUser();
  if(!user)return NextResponse.json({error:'Sign in required'},{status:401,headers});
  const admin=createAdminClient();
  const {data:grant,error:grantError}=await admin.from('platform_roles').select('user_id')
    .eq('user_id',user.id).eq('role','super_owner').maybeSingle();
  if(grantError||!grant)return NextResponse.json({error:'Super Owner access required'},{status:403,headers});
  const body=await req.json().catch(()=>({}));
  const collegeId=typeof body.college_id==='string'?body.college_id:'';
  const action=body.action;
  const evidenceUrl=typeof body.evidence_url==='string'?body.evidence_url.trim():'';
  if(!uuid.test(collegeId)||!['check','approve'].includes(action)||evidenceUrl.length>1500)
    return NextResponse.json({error:'Invalid official-host review request'},{status:400,headers});
  if(action==='approve'&&body.confirmed_approval!==true)
    return NextResponse.json({error:'Explicit Super Owner domain approval is required'},{status:400,headers});
  try{
    const [{data:school,error:schoolError},{data:verification,error:verificationError},
      {data:queue,error:queueError}]=await Promise.all([
      admin.from('colleges').select('id,name,website').eq('id',collegeId).maybeSingle(),
      admin.from('college_staff_source_verifications')
        .select('outcome,source_url,recheck_status').eq('college_id',collegeId).maybeSingle(),
      admin.from('college_staff_bootstrap_queue').select('status').eq('college_id',collegeId).maybeSingle()
    ]);
    if(schoolError||verificationError||queueError)throw new Error('Could not load saved source verification');
    if(!school||!verification||!queue)return NextResponse.json({error:'School not found'},{status:404,headers});
    if(queue.status!=='review'||verification.outcome!=='verified'
      ||verification.recheck_status!=='host_review'||!verification.source_url)
      return NextResponse.json({error:'This school is no longer awaiting official-host approval. Refresh the workbench.'},{status:409,headers});
    if(!host(school.website)||!host(verification.source_url))
      return NextResponse.json({error:'Saved university website or proposed athletics URL is invalid'},{status:409,headers});
    const evidence=await verifyIndependentEvidence(school.website,verification.source_url,evidenceUrl);
    if(action==='check')return NextResponse.json(evidence,{headers});
    if(!evidence.verified||!evidence.evidence_url||!evidence.matched_link)
      return NextResponse.json({error:evidence.message,...evidence},{status:409,headers});
    const {data:status,error:approvalError}=await admin.rpc('approve_college_staff_official_host',{
      p_college_id:collegeId,p_user_id:user.id,p_source_url:verification.source_url,
      p_host:evidence.athletics_host,p_evidence_url:evidence.evidence_url,
      p_matched_link:evidence.matched_link
    });
    if(approvalError){
      if(approvalError.code==='P0001')return NextResponse.json({error:approvalError.message},{status:409,headers});
      throw approvalError;
    }
    return NextResponse.json({...evidence,approved:true,recheck_status:status,
      source_url:verification.source_url,school:school.name,
      message:'Official athletics host approved for this school. Saved coaching source queued for one-school quality recheck; coach records remain unapproved.'},{headers});
  }catch(e){
    console.error('Independent official-host approval failed',e);
    return NextResponse.json({error:e instanceof Error?e.message:'Could not verify the official university link'},{status:500,headers});
  }
}