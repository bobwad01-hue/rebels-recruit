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
 const schoolIds=[...new Set((data||[]).map((s:any)=>s.proposed_college_id).filter(Boolean))];
 const {data:proposedSchools,error:schoolError}=schoolIds.length?await c.from('colleges').select('id,name').in('id',schoolIds):{data:[],error:null};
 if(schoolError)return NextResponse.json({error:schoolError.message},{status:500});
 const schoolNames=new Map((proposedSchools||[]).map((s:any)=>[s.id,s.name]));
 const enrich=(items:any[])=>items.map(s=>({...s,submitter:names.get(s.submitted_by_user_id)||null,
  proposed_college_name:schoolNames.get(s.proposed_college_id)||null}));
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
 if(!b||typeof b.id!=='string'||! /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(b.id))
  return NextResponse.json({error:'Invalid suggestion identifier.'},{status:400});
 if(!['accept','verify_only','reject'].includes(b.decision))
  return NextResponse.json({error:'Invalid review decision.'},{status:400});
 if(b.notify!==undefined&&typeof b.notify!=='boolean')return NextResponse.json({error:'Invalid notification preference.'},{status:400});
 if(b.review_note!==undefined&&b.review_note!==null&&(typeof b.review_note!=='string'||b.review_note.length>2000))return NextResponse.json({error:'Invalid verification note.'},{status:400});
 if(b.message!==undefined&&b.message!==null&&typeof b.message!=='string')
  return NextResponse.json({error:'Invalid message.'},{status:400});
 if(b.message_source_url!==undefined&&b.message_source_url!==null&&typeof b.message_source_url!=='string')return NextResponse.json({error:'Invalid message source URL.'},{status:400});
 if(b.source_url!==undefined&&b.source_url!==null&&typeof b.source_url!=='string')
  return NextResponse.json({error:'Invalid official source URL.'},{status:400});
 const {data,error}=await c.rpc('review_college_coach_suggestion_v2',{
  p_id:b.id,p_decision:b.decision,p_notify:typeof b.notify==='boolean'?b.notify:b.decision!=='reject',
  p_message:b.message||null,p_source_url:b.source_url||null,p_review_note:b.review_note||null,
  p_message_source_url:b.message_source_url||null
 });
 if(error){
  const message=error.message||'Could not review coach submission.';
  const status=/Super Owner access required/.test(message)?403:/already been reviewed/.test(message)?409:
   /Suggestion not found/.test(message)?404:/No directory changes|Invalid|must be|at least|message|source|notes/i.test(message)?400:500;
  return NextResponse.json({error:message},{status,headers:{'Cache-Control':'private, no-store'}});
 }
 return NextResponse.json(data,{headers:{'Cache-Control':'private, no-store'}});
}
