import {NextRequest,NextResponse} from 'next/server';import {createClient} from '@/lib/supabase-server';
async function owner(){const c=await createClient();const{data:{user}}=await c.auth.getUser();if(!user)return {c,user:null};const{data}=await c.from('platform_roles').select('role').eq('user_id',user.id).eq('role','super_owner').maybeSingle();return {c,user:data?user:null}}
export async function GET(req:NextRequest){
 const {c:admin,user}=await owner();
 if(!user)return NextResponse.json({error:'Forbidden'},{status:403});
 const u=new URL(req.url);
 if(u.searchParams.get('mode')==='filters'){
  // PostgREST may cap responses at 1,000 rows. Collect all school options
  // independently of the current coach page, so later alphabetic schools
  // are always selectable.
  const schools:any[]=[];
  for(let offset=0;offset<10000;offset+=500){
   const {data,error}=await admin.from('colleges').select('id,name,division')
    .order('name',{ascending:true}).order('id',{ascending:true})
    .range(offset,offset+499);
   if(error)return NextResponse.json({error:error.message},{status:500});
   schools.push(...(data||[]));
   if((data||[]).length<500)break;
  }
  return NextResponse.json({schools},{headers:{'Cache-Control':'private, no-store'}});
 }
 const q=(u.searchParams.get('q')||'').trim().replace(/[,()]/g,' ').slice(0,120);
 const status=u.searchParams.get('status')||'all',
  verification=u.searchParams.get('verification')||'all',
  division=u.searchParams.get('division')||'all',
  college=u.searchParams.get('college')||'all',
  source=u.searchParams.get('source')||'all',
  email=u.searchParams.get('email')||'all',
  phone=u.searchParams.get('phone')||'all',
  twitter=u.searchParams.get('twitter')||'all',
  sort=u.searchParams.get('sort')||'az';
 const pageSize=100;
 const page=Math.max(1,Math.min(100000,Number.parseInt(u.searchParams.get('page')||'1',10)||1));
 const ascending=sort!=='za';
 // Filter BEFORE pagination, including division. An inner college join
 // ensures every page and the total count represent the same result set.
 let x=admin.from('college_coaches').select(
  'id,college_id,first_name,last_name,title,email,phone,x_url,official_bio_url,official_source_url,verification_status,verification_confidence,last_verified_at,contact_verification_needed,lifecycle_status,lifecycle_note,role_category,staff_sort_order,updated_at,colleges!college_coaches_college_id_fkey!inner(id,name,division)',
  {count:'exact'}
 ).order('last_name',{ascending}).order('first_name',{ascending}).order('id',{ascending})
  .range((page-1)*pageSize,page*pageSize-1);
 if(status!=='all')x=x.eq('lifecycle_status',status);
 if(verification==='contact_conflict')x=x.eq('contact_verification_needed',true);
 else if(verification!=='all')x=x.eq('verification_status',verification);
 if(college!=='all')x=x.eq('college_id',college);
 if(division!=='all')x=x.eq('colleges.division',division);
 if(source==='official')x=x.not('official_source_url','is',null);
 if(source==='missing')x=x.is('official_source_url',null);
 if(email==='missing')x=x.is('email',null);
 if(phone==='missing')x=x.is('phone',null);
 if(twitter==='missing')x=x.is('x_url',null);
 if(q)x=x.or('first_name.ilike.%'+q+'%,last_name.ilike.%'+q+'%,email.ilike.%'+q+'%,title.ilike.%'+q+'%');
 const {data,error,count}=await x;
 if(error)return NextResponse.json({error:error.message},{status:500});
 const total=count||0;
 return NextResponse.json({
  coaches:data||[],total,page,pageSize,totalPages:Math.max(1,Math.ceil(total/pageSize))
 },{headers:{'Cache-Control':'private, no-store'}});
}
export async function PATCH(req:NextRequest){const{c:admin,user}=await owner();if(!user)return NextResponse.json({error:'Forbidden'},{status:403});const b=await req.json();if(!b.id)return NextResponse.json({error:'Missing id'},{status:400});if(b.action==='delete'){const{error}=await admin.from('college_coaches').delete().eq('id',b.id);return error?NextResponse.json({error:error.message},{status:500}):NextResponse.json({ok:true})}if(b.action==='archive'){const{error}=await admin.from('college_coaches').update({lifecycle_status:'inactive',lifecycle_note:b.note||'Archived by Super Owner',updated_by_user_id:user.id,updated_at:new Date().toISOString()}).eq('id',b.id);return error?NextResponse.json({error:error.message},{status:500}):NextResponse.json({ok:true})}if(b.action==='review'){const{error}=await admin.from('college_coaches').update({verification_status:'review',lifecycle_note:b.note||'Flagged for system review by Super Owner',updated_by_user_id:user.id,updated_at:new Date().toISOString()}).eq('id',b.id);return error?NextResponse.json({error:error.message},{status:500}):NextResponse.json({ok:true})}const allowed=['first_name','last_name','title','email','phone','x_url','official_bio_url','official_source_url','role_category','lifecycle_status'];
const patch:Record<string,string|null>={};
for(const k of allowed)if(Object.prototype.hasOwnProperty.call(b,k))patch[k]=typeof b[k]==='string'?b[k].trim():null;
if(!Object.keys(patch).length)return NextResponse.json({error:'No changes provided'},{status:400});
const reason=String(b.reason||'').trim(),evidence=String(b.evidence_url||'').trim();
const {data,error}=await admin.rpc('platform_manual_edit_college_coach',{
 p_coach_id:b.id,p_patch:patch,p_reason:reason,p_evidence_url:evidence||null,
 p_expected_updated_at:b.expected_updated_at||null
});
return error?NextResponse.json({error:error.message},{status:400}):NextResponse.json(data)}