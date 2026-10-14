import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase-server';
import {createAdminClient} from '@/lib/supabase-admin';

export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const roles=new Set(['head_coach','associate_head_coach','assistant_coach','recruiting_coordinator',
  'pitching_coach','hitting_coach','graduate_assistant','volunteer_assistant','other_coaching_staff']);
type ManualCoach={name:string;title:string;role:string;email:string|null};

function host(value:string|null|undefined){
  if(!value)return null;
  try{
    const u=new URL(value);
    if(u.protocol!=='https:'||u.username||u.password||u.port)return null;
    return u.hostname.toLowerCase().replace(/^www\./,'');
  }catch{return null;}
}
function matchingHost(candidate:string,allowed:string[]){
  return allowed.some(h=>candidate===h||candidate.endsWith('.'+h));
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
  const sourceUrl=typeof body.source_url==='string'?body.source_url.trim():'';
  const input=body.coaches;
  if(!uuid.test(collegeId)||!Array.isArray(input)||input.length<1||input.length>8||sourceUrl.length>1500)
    return NextResponse.json({error:'Provide the reviewed school, official URL, and 1–8 coaches'},{status:400,headers});
  const seen=new Set<string>();
  const coaches:ManualCoach[]=[];
  let heads=0;
  for(const row of input){
    if(!row||typeof row!=='object'||Array.isArray(row))
      return NextResponse.json({error:'Each coach must be a structured entry'},{status:400,headers});
    const name=typeof row.name==='string'?row.name.trim().replace(/\s+/g,' '):'';
    const title=typeof row.title==='string'?row.title.trim():'';
    const role=typeof row.role==='string'?row.role:'';
    const email=typeof row.email==='string'?row.email.trim().toLowerCase():null;
    const key=name.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/gi,'').toLowerCase();
    if(!/^[\p{Lu}][\p{L}.'’\-]+(?:\s+[\p{Lu}][\p{L}.'’\-]+){1,3}$/u.test(name)
      ||name.length>120||title.length<4||title.length>120||!/softball|coach|assistant|pitching|hitting/i.test(title)
      ||!roles.has(role)||seen.has(key)||email!==null&&(!/^[\w.%+\-]+@[\w.\-]+\.[a-z]{2,}$/i.test(email)||email.length>254)){
      return NextResponse.json({error:'Check each coach name, title, role, and official email; duplicate names are not allowed'},{status:400,headers});
    }
    seen.add(key);
    if(role==='head_coach')heads++;
    coaches.push({name,title,role,email:email||null});
  }
  if(heads!==1)return NextResponse.json({error:'Exactly one head coach must be confirmed'},{status:400,headers});
  try{
    const [{data:school,error:schoolError},{data:source,error:sourceError},
      {data:verification,error:verificationError},{data:queue,error:queueError}]=await Promise.all([
      admin.from('colleges').select('id,website,name').eq('id',collegeId).maybeSingle(),
      admin.from('college_softball_sources').select('athletics_url,softball_url,staff_url').eq('college_id',collegeId).maybeSingle(),
      admin.from('college_staff_source_verifications').select('outcome,source_url,recheck_status,head_coach_name').eq('college_id',collegeId).maybeSingle(),
      admin.from('college_staff_bootstrap_queue').select('status').eq('college_id',collegeId).maybeSingle()
    ]);
    if(schoolError||sourceError||verificationError||queueError)throw new Error('Could not load source review');
    if(!school||!source||!verification||!queue)return NextResponse.json({error:'School verification is missing'},{status:404,headers});
    if(verification.outcome!=='verified'||verification.recheck_status!=='needs_review'
      ||verification.source_url!==sourceUrl||queue.status!=='review'){
      return NextResponse.json({error:'The official source must be saved and approved for manual staff review. Refresh before importing.'},{status:409,headers});
    }
    const canonical=sourceUrl.split('#')[0];
    if(!host(canonical)||canonical!==source.staff_url)
      return NextResponse.json({error:'The official source has changed. Verify the source first.'},{status:409,headers});
    const allowed=[school.website,source.athletics_url,source.softball_url,source.staff_url]
      .map(host).filter((h):h is string=>Boolean(h));
    const sourceHost=host(sourceUrl);
    if(!sourceHost||!matchingHost(sourceHost,allowed))
      return NextResponse.json({error:'The official athletics host is not trusted for this school'},{status:409,headers});
    for(const coach of coaches){
      if(coach.email){
        const domain=coach.email.split('@')[1].replace(/^www\./,'');
        if(!matchingHost(domain,allowed)){
          return NextResponse.json({error:'The email for '+coach.name+' is not on the saved school/athletics domain. Leave it blank for later contact verification.'},{status:400,headers});
        }
      }
    }
    const {data,error}=await admin.rpc('import_manually_verified_college_softball_staff',{
      p_college_id:collegeId,p_user_id:user.id,p_source_url:sourceUrl,p_coaches:coaches
    });
    if(error){
      if(error.code==='P0001')return NextResponse.json({error:error.message},{status:409,headers});
      console.error('Manual verified staff import failed',error);
      return NextResponse.json({error:'Manual import did not complete; no school status was advanced.'},{status:500,headers});
    }
    return NextResponse.json({college_id:collegeId,school:school.name,...data,
      message:'Verified staff imported with official-source snapshots and audit history.'},{headers});
  }catch(e){
    console.error('Manual verified staff import failed',e);
    return NextResponse.json({error:'Could not complete manual staff import. Your saved verification remains available.'},{status:500,headers});
  }
}
