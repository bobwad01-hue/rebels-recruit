import {NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase-server';
import {createAdminClient} from '@/lib/supabase-admin';
import {getGoogleAccessToken} from '@/lib/google-workspace';

export const dynamic='force-dynamic';

type GmailHeader={name?:string;value?:string};
type GmailMetadata={id?:string;threadId?:string;internalDate?:string;payload?:{headers?:GmailHeader[]}};
function header(headers:GmailHeader[]|undefined,name:string){
  return headers?.find(h=>h.name?.toLowerCase()===name.toLowerCase())?.value||'';
}
function normalizedSubject(value:string){
  return value.trim().replace(/\s+/g,' ').toLowerCase();
}
function addresses(value:string){
  return (value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)||[]).map(x=>x.toLowerCase());
}
async function gmailJson<T>(url:string,accessToken:string):Promise<T|null>{
  const response=await fetch(url,{headers:{Authorization:'Bearer '+accessToken},cache:'no-store'});
  if(!response.ok)return null;
  return response.json() as Promise<T>;
}

// Recover Gmail proof for legacy sends only. The authenticated Google account must
// be the original sender. Match recipient + exact subject + time; never guess IDs.
export async function POST(){
  const client=await createClient();
  const {data:{user}}=await client.auth.getUser();
  if(!user)return NextResponse.json({error:'Please sign in again.'},{status:401});
  const admin=createAdminClient();
  const {data:pending,error}=await admin.from('interactions')
    .select('id,coach_id,email_subject,created_at')
    .eq('actor_user_id',user.id)
    .eq('type','Email Sent')
    .eq('source','automatic')
    .is('gmail_message_id',null)
    .not('email_subject','is',null)
    .order('created_at',{ascending:false})
    .limit(20);
  if(error)return NextResponse.json({error:'Could not load sent activity.'},{status:500});
  if(!pending?.length)return NextResponse.json({updated:0,checked:0});
  let accessToken:string;
  try{
    const token=await getGoogleAccessToken(user.id,'gmail');
    if(!token.grantedScopes.split(/\s+/).some((s:string)=>s.endsWith('/gmail.readonly')))
      return NextResponse.json({updated:0,checked:0,reason:'gmail_read_permission_missing'});
    accessToken=token.accessToken;
  }catch{
    return NextResponse.json({updated:0,checked:0,reason:'gmail_not_connected'});
  }
  const profile=await gmailJson<{emailAddress?:string}>('https://gmail.googleapis.com/gmail/v1/users/me/profile',accessToken);
  const senderEmail=profile?.emailAddress?.trim().toLowerCase()||null;
  if(!senderEmail)return NextResponse.json({updated:0,checked:0,reason:'gmail_profile_unavailable'});
  const ids=[...new Set(pending.map(i=>i.coach_id).filter((v):v is string=>!!v))];
  if(!ids.length)return NextResponse.json({updated:0,checked:0});
  const {data:coaches,error:coachError}=await admin.from('college_coaches').select('id,email').in('id',ids);
  if(coachError)return NextResponse.json({error:'Could not resolve coach addresses.'},{status:500});
  const emails=new Map((coaches||[]).map(c=>[c.id,String(c.email||'').trim().toLowerCase()]));
  let updated=0,checked=0;
  for(const row of pending){
    const coachEmail=emails.get(row.coach_id);
    const when=Date.parse(row.created_at||'');
    if(!coachEmail||!Number.isFinite(when)||!row.email_subject)continue;
    checked++;
    const windowMs=30*60*1000;
    const url=new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
    url.searchParams.set('labelIds','SENT');
    url.searchParams.set('maxResults','30');
    url.searchParams.set('q','to:'+coachEmail+' after:'+Math.floor((when-windowMs)/1000)+' before:'+Math.ceil((when+windowMs)/1000));
    const listing=await gmailJson<{messages?:{id:string}[]}>(url.toString(),accessToken);
    if(!listing?.messages?.length)continue;
    const candidates:GmailMetadata[]=[];
    for(const message of listing.messages.slice(0,30)){
      const detailUrl=new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages/'+encodeURIComponent(message.id));
      detailUrl.searchParams.set('format','metadata');
      for(const name of ['To','From','Subject'])detailUrl.searchParams.append('metadataHeaders',name);
      const detail=await gmailJson<GmailMetadata>(detailUrl.toString(),accessToken);
      if(!detail?.id||!detail.threadId)continue;
      const sentAt=Number(detail.internalDate);
      if(!Number.isFinite(sentAt)||Math.abs(sentAt-when)>windowMs)continue;
      if(normalizedSubject(header(detail.payload?.headers,'Subject'))!==normalizedSubject(row.email_subject))continue;
      if(!addresses(header(detail.payload?.headers,'To')).includes(coachEmail))continue;
      if(!addresses(header(detail.payload?.headers,'From')).includes(senderEmail))continue;
      candidates.push(detail);
    }
    // If there is more than one plausible message, leave this record unlinked.
    if(candidates.length!==1)continue;
    const match=candidates[0];
    const {data:saved,error:saveError}=await admin.from('interactions')
      .update({gmail_message_id:match.id,gmail_thread_id:match.threadId,gmail_sender_email:senderEmail})
      .eq('id',row.id).eq('actor_user_id',user.id).is('gmail_message_id',null)
      .select('id').maybeSingle();
    if(!saveError&&saved)updated++;
  }
  return NextResponse.json({updated,checked});
}
