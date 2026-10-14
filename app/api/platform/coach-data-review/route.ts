import {NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase-server';

async function owner(){
 const c=await createClient(); const {data:{user}}=await c.auth.getUser(); if(!user)return {c,user:null};
 const {data:r}=await c.from('platform_roles').select('role').eq('user_id',user.id).eq('role','super_owner').maybeSingle();
 return {c,user:r?user:null};
}
export async function GET(){const {c,user}=await owner();if(!user)return NextResponse.json({error:'Forbidden'},{status:403});
 const {data,error}=await c.from('college_coach_update_suggestions').select('id,coach_id,submitted_by_user_id,suggestion_type,details,proposed_first_name,proposed_last_name,proposed_email,proposed_phone,proposed_title,proposed_x_url,proposed_college_id,status,created_at,college_coaches(id,first_name,last_name,title,email,phone,x_url,college_id,lifecycle_status,colleges!college_coaches_college_id_fkey(name))').eq('status','pending').order('created_at',{ascending:true});
 if(error)return NextResponse.json({error:error.message},{status:500});
 const {data:conflicts,error:conflictError}=await c.from('college_coach_contact_reviews')
  .select('id,coach_id,field_name,observed_values,status,created_at,college_coaches(id,first_name,last_name,title,email,phone,x_url,instagram_url,colleges!college_coaches_college_id_fkey(name))')
  .eq('status','pending').order('created_at',{ascending:true});
 if(conflictError)return NextResponse.json({error:conflictError.message},{status:500});
 const {data:recent,error:recentError}=await c.from('college_coach_update_suggestions')
  .select('id,coach_id,submitted_by_user_id,suggestion_type,details,proposed_first_name,proposed_last_name,proposed_email,proposed_phone,proposed_title,proposed_x_url,status,created_at,reviewed_at,college_coaches(id,first_name,last_name,title,email,phone,x_url,lifecycle_status,colleges!college_coaches_college_id_fkey(name))')
  .neq('status','pending').order('reviewed_at',{ascending:false}).limit(40);
 if(recentError)return NextResponse.json({error:recentError.message},{status:500});
 const ids=[...new Set([...(data||[]),...(recent||[])].map((s:any)=>s.submitted_by_user_id).filter(Boolean))];
 const {data:people,error:peopleError}=ids.length?await c.from('profiles').select('id,full_name,email').in('id',ids):{data:[],error:null};
 if(peopleError)return NextResponse.json({error:peopleError.message},{status:500});
 const names=new Map((people||[]).map((p:any)=>[p.id,{full_name:p.full_name,email:p.email}]));
 const enrich=(items:any[])=>items.map(s=>({...s,submitter:names.get(s.submitted_by_user_id)||null}));
 return NextResponse.json({suggestions:enrich(data||[]),recent:enrich(recent||[]),contactConflicts:conflicts||[]},
  {headers:{'Cache-Control':'private, no-store'}})}
export async function POST(req:Request){const {c,user}=await owner();if(!user)return NextResponse.json({error:'Forbidden'},{status:403});const b=await req.json();
 if(b.type==='resolve_contact'){
  const id=Number(b.id),value=String(b.verifiedValue||'').trim(),evidence=String(b.evidence||'').trim();
  if(!Number.isSafeInteger(id)||id<=0||!value||evidence.length<10)
   return NextResponse.json({error:'Select a verified contact value and describe your independent verification source (at least 10 characters).'},{status:400});
  const {data:review,error:readError}=await c.from('college_coach_contact_reviews').select('id,coach_id,field_name,status')
    .eq('id',id).eq('status','pending').maybeSingle();
  if(readError||!review)return NextResponse.json({error:'Pending conflict not found.'},{status:404});
  if(!['email','phone','x_url','instagram_url'].includes(review.field_name))
   return NextResponse.json({error:'Unsupported contact field.'},{status:400});
  if(review.field_name==='email'&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
   return NextResponse.json({error:'Enter a valid verified email address.'},{status:400});
  const {data:existing}=await c.from('college_coaches').select('source_note').eq('id',review.coach_id).maybeSingle();
  const patch:any={updated_by_user_id:user.id,last_verified_at:new Date().toISOString(),
   source_note:[existing?.source_note,'Contact verified by Super Owner ('+review.field_name+'): '+evidence].filter(Boolean).join('\n').slice(-4000)};
  patch[review.field_name]=value;
  const {data:updated,error:updateError}=await c.from('college_coaches').update(patch).eq('id',review.coach_id).select('id').maybeSingle();
  if(updateError||!updated)return NextResponse.json({error:updateError?.message||'Could not update canonical coach contact.'},{status:500});
  const {error:reviewError}=await c.from('college_coach_contact_reviews').update({
   status:'verified',resolved_at:new Date().toISOString(),resolved_by:user.id,
   resolution_note:'Verified value: '+value+'. Evidence: '+evidence
  }).eq('id',review.id).eq('status','pending');
  if(reviewError)return NextResponse.json({error:'Coach contact was updated, but the review flag could not be cleared. Please retry.'},{status:500});
  const {count,error:countError}=await c.from('college_coach_contact_reviews').select('id',{count:'exact',head:true})
    .eq('coach_id',review.coach_id).eq('status','pending');
  if(!countError&&count===0)await c.from('college_coaches').update({contact_verification_needed:false}).eq('id',review.coach_id);
  return NextResponse.json({ok:true});
 }
 const {data:s}=await c.from('college_coach_update_suggestions').select('*').eq('id',b.id).eq('status','pending').maybeSingle();if(!s)return NextResponse.json({error:'Suggestion not found'},{status:404});
 if(b.decision==='reject'){const {error}=await c.from('college_coach_update_suggestions').update({status:'rejected',reviewed_at:new Date().toISOString(),reviewed_by_user_id:user.id}).eq('id',s.id);return NextResponse.json(error?{error:error.message}:{ok:true},{status:error?500:200})}
 if(b.decision!=='accept')return NextResponse.json({error:'Invalid decision'},{status:400});
 const patch:any={updated_by_user_id:user.id,updated_at:new Date().toISOString(),source_note:'Verified community update approved by RLTNL'};
 if(s.suggestion_type==='contact_update'||s.suggestion_type==='incorrect_info'){if(s.proposed_first_name)patch.first_name=s.proposed_first_name;if(s.proposed_last_name)patch.last_name=s.proposed_last_name;if(s.proposed_email)patch.email=s.proposed_email;if(s.proposed_phone)patch.phone=s.proposed_phone;if(s.proposed_x_url)patch.x_url=s.proposed_x_url;if(s.proposed_title)patch.title=s.proposed_title}
 if(s.suggestion_type==='title_update'&&s.proposed_title)patch.title=s.proposed_title;
 if(s.suggestion_type==='left_program'){patch.lifecycle_status='departed';patch.departed_at=new Date().toISOString().slice(0,10);patch.lifecycle_note=s.details||'Community report verified by RLTNL'}
 if(s.suggestion_type==='retired'){patch.lifecycle_status='retired';patch.departed_at=new Date().toISOString().slice(0,10);patch.lifecycle_note=s.details||'Retirement verified by RLTNL'}
 if(s.suggestion_type==='moved_school'&&s.proposed_college_id){const {data:coach}=await c.from('college_coaches').select('college_id').eq('id',s.coach_id).single();patch.previous_college_id=coach?.college_id||null;patch.college_id=s.proposed_college_id;patch.lifecycle_status='active';patch.departed_at=null;patch.lifecycle_note=s.details||'School move verified by RLTNL'}
 if(!Object.keys(patch).some(k=>!['updated_by_user_id','updated_at','source_note'].includes(k)))return NextResponse.json({error:'Other suggestions require manual investigation before acceptance.'},{status:400});
 const {data:updated,error:u}=await c.from('college_coaches').update(patch).eq('id',s.coach_id).select('id').maybeSingle();if(u)return NextResponse.json({error:u.message},{status:500});if(!updated)return NextResponse.json({error:'Coach record was not updated. Check Super Owner database write permissions. Suggestion remains pending.'},{status:403});
 const {error:r}=await c.from('college_coach_update_suggestions').update({status:'accepted',reviewed_at:new Date().toISOString(),reviewed_by_user_id:user.id}).eq('id',s.id);return NextResponse.json(r?{error:r.message}:{ok:true},{status:r?500:200})}