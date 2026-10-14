import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase-server';
import {createAdminClient} from '@/lib/supabase-admin';

export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
const outcomes=new Set(['verified','incorrect_source','unable_to_verify','inactive_program']);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeHost(value:string|null|undefined){
  if(!value)return null;
  try{
    const u=new URL(value);
    if(!['https:','http:'].includes(u.protocol)||u.username||u.password||u.port)return null;
    return u.hostname.toLowerCase().replace(/^www\./,'');
  }catch{return null}
}
function validatedUrl(value:unknown){
  if(typeof value!=='string'||!value.trim())return null;
  const raw=value.trim();
  if(raw.length>1500)throw new Error('Source URL is too long');
  let u:URL;
  try{u=new URL(raw)}catch{throw new Error('Enter a complete https:// source URL')}
  if(u.protocol!=='https:'||u.username||u.password||u.port)
    throw new Error('Source must be a public HTTPS URL without credentials or a custom port');
  // Keep the complete URL (including #sidearm-roster-coaches) for
  // navigation and as a bounded parsing hint. The database procedure
  // stores a separate fragment-free canonical URL for HTTP fetching.
  const host=u.hostname.toLowerCase();
  if(host.length>253||!host.includes('.')||!/^([a-z0-9-]+\.)+[a-z]{2,}$/i.test(host)
    ||host.endsWith('.local')||host.endsWith('.internal')||host.endsWith('.test')
    ||host.endsWith('.localhost')||host==='localhost'
    ||/(^|\.)(google|facebook|instagram|twitter|x|linkedin|tiktok|youtube|bit\.ly|tinyurl)\.com$/i.test(host))
    throw new Error('Use an official university or athletics website, not a social/search/private address');
  return u.toString();
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
  const outcome=typeof body.outcome==='string'?body.outcome:'';
  const manualOnly=body.manual_only===true;
  const reuseSaved=body.reuse_saved===true;
  if((manualOnly&&outcome!=='verified')||(reuseSaved&&!manualOnly))
    return NextResponse.json({error:'Manual access review requires a verified official source'},{status:400,headers});
  if(!uuid.test(collegeId)||!outcomes.has(outcome))
    return NextResponse.json({error:'Invalid school or verification result'},{status:400,headers});
  if((outcome==='verified'||outcome==='inactive_program')&&body.confirmed_official!==true)
    return NextResponse.json({error:'Confirm your review of the official school source first'},{status:400,headers});
  const head=typeof body.head_coach_name==='string'?body.head_coach_name.trim():'';
  const notes=typeof body.notes==='string'?body.notes.trim():'';
  if(head.length>120||notes.length>1000)
    return NextResponse.json({error:'Coach name or notes exceed the allowed length'},{status:400,headers});
  let url:string|null;
  try{url=validatedUrl(body.source_url)}catch(e){
    return NextResponse.json({error:e instanceof Error?e.message:'Invalid URL'},{status:400,headers});
  }
  if(outcome==='verified'&&!url)
    return NextResponse.json({error:'Enter the official coaching staff URL'},{status:400,headers});
  try{
    const {data:school,error:schoolError}=await admin.from('colleges')
      .select('id,name,website,division').eq('id',collegeId).maybeSingle();
    if(schoolError)throw schoolError;
    if(!school)return NextResponse.json({error:'School not found'},{status:404,headers});
    if(manualOnly){
      const {data:queue,error:queueError}=await admin.from('college_staff_bootstrap_queue')
        .select('status,last_error').eq('college_id',collegeId).maybeSingle();
      if(queueError)throw queueError;
      if(queue?.status!=='blocked'||!/403|forbidden|robots|access denied/i.test(queue.last_error||''))
        return NextResponse.json({error:'Manual access recovery is only available for schools blocked by their official website. Refresh the workbench.'},{status:409,headers});
    }
    const {data:source,error:sourceError}=await admin.from('college_softball_sources')
      .select('athletics_url,softball_url,staff_url').eq('college_id',collegeId).maybeSingle();
    if(sourceError)throw sourceError;
    const allowedHosts=[school.website,source?.athletics_url,source?.softball_url,source?.staff_url]
      .map(normalizeHost).filter((x):x is string=>Boolean(x));
    const candidate=normalizeHost(url);
    // A school-specific, independently evidenced Super Owner host approval can
    // be reused for later source corrections. Never trust it for other schools.
    const {data:approvedHost,error:hostError}=candidate
      ?await admin.from('college_staff_approved_hosts').select('host')
        .eq('college_id',collegeId).eq('host',candidate).maybeSingle()
      :{data:null,error:null};
    if(hostError)throw hostError;
    // An explicit Super Owner confirmation of the exact official coaching URL
    // is sufficient for ONE-SCHOOL staff validation. The importer still checks
    // the actual softball coaches and never trusts their identities by domain.
    // Independently linked hosts remain reusable for subsequent corrections.
    const trusted=Boolean(candidate&&(approvedHost||
      allowedHosts.some(h=>candidate===h||candidate.endsWith('.'+h))||
      (outcome==='verified'&&body.confirmed_official===true)));
    const {data:state,error:saveError}=manualOnly
      ?await admin.rpc('prepare_college_staff_blocked_access_manual_review',{
        p_college_id:collegeId,p_user_id:user.id,p_source_url:url,
        p_head_coach_name:head,p_notes:notes,p_trusted_host:trusted,
        p_reuse_saved:reuseSaved
      })
      :await admin.rpc('save_college_staff_source_verification',{
        p_college_id:collegeId,p_user_id:user.id,p_outcome:outcome,
        p_source_url:url,p_head_coach_name:head,p_notes:notes,p_trusted_host:trusted
      });
    if(saveError){
      if(saveError.code==='P0001'||/only schools needing attention|not in staff import queue|college not found/i.test(saveError.message))
        return NextResponse.json({error:saveError.message},{status:409,headers});
      throw saveError;
    }
    return NextResponse.json({college_id:collegeId,name:school.name,
      verification_status:outcome,recheck_status:state,
      source_url:url,anchor_preserved:typeof url==='string'&&url.includes('#'),
      should_recheck:state==='pending'&&!manualOnly,
      message:state==='needs_review'&&manualOnly
        ?'Official source preserved. Automated access is blocked; review each coach on the official page and import only after confirming names, roles and any emails.'
        :state==='pending'
        ?'Official source saved. Running the existing coaching quality gates next.'
        :state==='host_review'
        ?'Proposed source saved for manual review; verify the exact official coaching URL before validating staff.'
        :'Verification saved. No coach records were changed.'},{headers});
  }catch(e){
    console.error('College source verification failed',e);
    return NextResponse.json({error:'Could not save verification. No import was started.'},{status:500,headers});
  }
}
