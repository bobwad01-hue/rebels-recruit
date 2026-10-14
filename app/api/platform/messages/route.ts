import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase-server';
import {createAdminClient} from '@/lib/supabase-admin';

export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function actor(){
 const session=await createClient();
 const {data:{user}}=await session.auth.getUser();
 if(!user)return null;
 const admin=createAdminClient();
 const {data:role,error}=await admin.from('platform_roles').select('user_id')
   .eq('user_id',user.id).eq('role','super_owner').maybeSingle();
 if(error)throw error;
 return {admin,user,owner:!!role};
}
const fail=(message:string,status:number)=>NextResponse.json({error:message},{status,headers});

export async function GET(req:NextRequest){
 try{
  const auth=await actor();if(!auth)return fail('Sign in to read messages.',401);
  const {admin,user,owner}=auth;
  let q=admin.from('platform_message_threads')
   .select('id,source_type,source_id,recipient_user_id,subject,created_at,updated_at')
   .order('updated_at',{ascending:false}).limit(150);
  if(!owner)q=q.eq('recipient_user_id',user.id);
  const {data:threads,error}=await q;
  if(error)throw error;
  const ids=(threads||[]).map(t=>t.id);
  if(!ids.length)return NextResponse.json({threads:[],unread:0},{headers});
  const {data:unreadRows,error:unreadError}=await admin.from('platform_message_entries')
   .select('id,thread_id,sender_user_id').in('thread_id',ids).is('read_at',null)
   .neq('sender_user_id',user.id).limit(2000);
  if(unreadError)throw unreadError;
  const counts=new Map<string,number>();
  for(const m of unreadRows||[])counts.set(m.thread_id,(counts.get(m.thread_id)||0)+1);
  const unread=[...counts.values()].reduce((a,b)=>a+b,0);
  if(req.nextUrl.searchParams.get('summary')==='1')return NextResponse.json({unread},{headers});
  const {data:entries,error:entryError}=await admin.from('platform_message_entries')
   .select('id,thread_id,sender_user_id,body,source_url,created_at,read_at')
   .in('thread_id',ids).order('created_at',{ascending:true}).limit(2500);
  if(entryError)throw entryError;
  const byThread=new Map<string,any[]>();
  for(const entry of entries||[])byThread.set(entry.thread_id,[...(byThread.get(entry.thread_id)||[]),entry]);
  let people=new Map<string,string>();
  if(owner){
   const recipients=[...new Set((threads||[]).map(t=>t.recipient_user_id))];
   const {data:profiles,error:profileError}=await admin.from('profiles')
     .select('id,full_name,email').in('id',recipients);
   if(profileError)throw profileError;
   people=new Map((profiles||[]).map(p=>[p.id,p.full_name||p.email||'RLTNL user']));
  }
  return NextResponse.json({unread,threads:(threads||[]).map(t=>({
   ...t,recipient_name:owner?people.get(t.recipient_user_id)||'RLTNL user':null,
   unread:counts.get(t.id)||0,messages:byThread.get(t.id)||[]
  }))},{headers});
 }catch(e){return fail(e instanceof Error?e.message:'Messages could not be loaded.',500)}
}

export async function POST(req:NextRequest){
 try{
  const auth=await actor();if(!auth)return fail('Sign in to send a message.',401);
  if(req.headers.get('origin')!==new URL(req.url).origin)return fail('Invalid request origin.',403);
  const {admin,user,owner}=auth;
  const b=await req.json().catch(()=>({}));
  const body=typeof b.body==='string'?b.body.trim():'';
  if(body.length<1||body.length>4000)return fail('Write a message between 1 and 4000 characters.',400);
  const sourceUrl=typeof b.source_url==='string'?b.source_url.trim():'';
  if(sourceUrl&&(sourceUrl.length>1500||!/^https:\/\/[^\s]+$/i.test(sourceUrl)))return fail('Source link must be a valid HTTPS URL.',400);
  let thread:any=null;
  if(b.thread_id){
   if(!uuid.test(String(b.thread_id)))return fail('Invalid conversation.',400);
   const {data,error}=await admin.from('platform_message_threads').select('*').eq('id',b.thread_id).maybeSingle();
   if(error)throw error;
   if(!data||(!owner&&data.recipient_user_id!==user.id))return fail('Conversation not found.',404);
   thread=data;
  }else{
   if(!owner)return fail('Only RLTNL Support can begin a support conversation.',403);
   const sourceType=String(b.source_type||''),sourceId=String(b.source_id||'');
   if(!['coach_suggestion','feedback'].includes(sourceType)||!uuid.test(sourceId))return fail('Invalid source item.',400);
   let recipientId:string|undefined,subject:string;
   if(sourceType==='coach_suggestion'){
    const {data,error}=await admin.from('college_coach_update_suggestions')
      .select('id,submitted_by_user_id,coach_id').eq('id',sourceId).maybeSingle();
    if(error)throw error;if(!data)return fail('Coach suggestion not found.',404);
    recipientId=data.submitted_by_user_id;
    const {data:coach}=await admin.from('college_coaches').select('first_name,last_name')
      .eq('id',data.coach_id).maybeSingle();
    subject='Coach information: '+[coach?.first_name,coach?.last_name].filter(Boolean).join(' ');
   }else{
    const {data,error}=await admin.from('support_cases').select('id,reporter_user_id')
      .eq('id',sourceId).not('feedback_type','is',null).maybeSingle();
    if(error)throw error;if(!data)return fail('Feedback case not found.',404);
    recipientId=data.reporter_user_id;subject='Your RLTNL feedback';
   }
   if(!recipientId)return fail('Submitter account is not available.',404);
   const {data,error}=await admin.from('platform_message_threads').upsert({
    source_type:sourceType,source_id:sourceId,recipient_user_id:recipientId,
    created_by_user_id:user.id,subject
   },{onConflict:'source_type,source_id,recipient_user_id',ignoreDuplicates:true})
   .select('id,recipient_user_id').maybeSingle();
   if(error)throw error;
   if(data)thread=data;
   else{
    const {data:existing,error:existingError}=await admin.from('platform_message_threads')
     .select('id,recipient_user_id').eq('source_type',sourceType).eq('source_id',sourceId)
     .eq('recipient_user_id',recipientId).maybeSingle();
    if(existingError)throw existingError;
    thread=existing;
   }
   if(!thread)return fail('Could not open support conversation.',500);
  }
  const {data:sent,error:sendError}=await admin.from('platform_message_entries')
    .insert({thread_id:thread.id,sender_user_id:user.id,body,source_url:sourceUrl||null})
    .select('id,created_at').single();
  if(sendError)throw sendError;
  const {error:touchError}=await admin.from('platform_message_threads')
    .update({updated_at:new Date().toISOString()}).eq('id',thread.id);
  if(touchError)throw touchError;
  return NextResponse.json({ok:true,thread_id:thread.id,message_id:sent.id},{headers});
 }catch(e){return fail(e instanceof Error?e.message:'Could not send message.',500)}
}

export async function PATCH(req:NextRequest){
 try{
  const auth=await actor();if(!auth)return fail('Sign in to read messages.',401);
  if(req.headers.get('origin')!==new URL(req.url).origin)return fail('Invalid request origin.',403);
  const {admin,user,owner}=auth;
  const b=await req.json().catch(()=>({}));
  if(!uuid.test(String(b.thread_id||'')))return fail('Invalid conversation.',400);
  const {data:thread,error}=await admin.from('platform_message_threads')
    .select('id,recipient_user_id').eq('id',b.thread_id).maybeSingle();
  if(error)throw error;
  if(!thread||(!owner&&thread.recipient_user_id!==user.id))return fail('Conversation not found.',404);
  const {error:updateError}=await admin.from('platform_message_entries')
    .update({read_at:new Date().toISOString()}).eq('thread_id',thread.id)
    .neq('sender_user_id',user.id).is('read_at',null);
  if(updateError)throw updateError;
  return NextResponse.json({ok:true},{headers});
 }catch(e){return fail(e instanceof Error?e.message:'Could not mark messages as read.',500)}
}
