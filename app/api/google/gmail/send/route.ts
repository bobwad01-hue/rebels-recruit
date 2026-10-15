import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase-server';
import {getGoogleAccessToken} from '@/lib/google-workspace';
import {renderEmailHtml} from '@/lib/email-html';

function cleanHeader(value:string){return value.replace(/[\r\n]+/g,' ').trim()}
function b64Lines(value:string){return value.replace(/\s/g,'').match(/.{1,76}/g)?.join('\r\n')||''}
type Attachment={name:string;type:string;data:string;size?:number};
function encodeMessage(to:string,cc:string[],subject:string,body:string,bodyHtml?:string,attachments:Attachment[]=[],reply?:{messageId:string;references?:string}){const mixed=`rebels_mixed_${Date.now()}_${Math.random().toString(36).slice(2)}`,alt=`rebels_alt_${Date.now()}_${Math.random().toString(36).slice(2)}`;const html=renderEmailHtml(body,bodyHtml);const headers=[`To: ${cleanHeader(to)}`];if(reply?.messageId){headers.push(`In-Reply-To: ${cleanHeader(reply.messageId)}`);headers.push(`References: ${cleanHeader(reply.references||reply.messageId)}`)}if(cc.length)headers.push(`Cc: ${cc.map(cleanHeader).join(', ')}`);const parts=[...headers,`Subject: ${cleanHeader(subject)}`,'MIME-Version: 1.0',`Content-Type: multipart/mixed; boundary="${mixed}"`,'',`--${mixed}`,`Content-Type: multipart/alternative; boundary="${alt}"`,'',`--${alt}`,'Content-Type: text/plain; charset="UTF-8"','Content-Transfer-Encoding: 8bit','',body,`--${alt}`,'Content-Type: text/html; charset="UTF-8"','Content-Transfer-Encoding: 8bit','',`<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#111;white-space:pre-wrap">${html}</div>`,`--${alt}--`];for(const a of attachments){const safeName=cleanHeader(a.name).replace(/["\\]/g,'_');parts.push(`--${mixed}`,`Content-Type: ${cleanHeader(a.type||'application/octet-stream')}; name="${safeName}"`,'Content-Transfer-Encoding: base64',`Content-Disposition: attachment; filename="${safeName}"`,'',b64Lines(a.data))}parts.push(`--${mixed}--`,'');return Buffer.from(parts.join('\r\n'),'utf8').toString('base64url')}

// Sending is only permitted to coaches already saved in the athlete's active
// My Contacts. A successful Gmail send updates outreach history, but never
// silently creates/restores a coach contact.
async function updateEmailedCoachContact(c:any,athleteUserId:string,coachId:string,emailOverride?:string|null){
 const today=new Date().toISOString().slice(0,10);
 const {data:existing,error:lookupError}=await c.from('athlete_coaches')
  .select('id,last_contact_date').eq('athlete_user_id',athleteUserId)
  .eq('coach_id',coachId).is('archived_at',null).maybeSingle();
 if(lookupError)throw lookupError;
 if(!existing)throw new Error('Coach is no longer in My Contacts.');
 const changes:Record<string,unknown>={};
 if(!existing.last_contact_date||existing.last_contact_date<today)changes.last_contact_date=today;
 if(emailOverride){changes.email_override=emailOverride;changes.email_override_updated_at=new Date().toISOString();}
 if(Object.keys(changes).length){
  const updated=await c.from('athlete_coaches').update(changes)
   .eq('id',existing.id).eq('athlete_user_id',athleteUserId).is('archived_at',null);
  if(updated.error)throw updated.error;
 }
}

export async function POST(req:NextRequest){const c=await createClient();const {data:{user}}=await c.auth.getUser();if(!user)return NextResponse.json({error:'Please sign in again.'},{status:401});let payload:any;try{payload=await req.json()}catch{return NextResponse.json({error:'Invalid request.'},{status:400})}const suppliedRecipient=String(payload?.recipientEmail||'').trim().toLowerCase();const coachId=String(payload?.coachId||''),athleteUserId=String(payload?.athleteUserId||user.id),staffMode=payload?.staffMode===true,subject=String(payload?.subject||'').trim(),body=String(payload?.body||'').replace(/\r\n?/g,'\n'),bodyHtml=String(payload?.bodyHtml||''),emailPurpose=String(payload?.emailPurpose||'custom').trim(),recruitingInteractionId=String(payload?.recruitingInteractionId||'').trim(),recruitingMessageId=String(payload?.recruitingMessageId||'').trim();const ccCoachIds=[...new Set((Array.isArray(payload?.ccCoachIds)?payload.ccCoachIds:[]).map((x:any)=>String(x)).filter(Boolean))].filter(x=>x!==coachId).slice(0,10);const attachments:Attachment[]=Array.isArray(payload?.attachments)?payload.attachments:[];if(recruitingMessageId&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(recruitingMessageId))return NextResponse.json({error:'Invalid reply email identifier.'},{status:400});if(!coachId||!subject||!body.trim())return NextResponse.json({error:'Coach, subject, and message are required.'},{status:400});if(subject.length>200||body.length>20000||bodyHtml.length>100000)return NextResponse.json({error:'Email is too long.'},{status:400});if(attachments.length>5)return NextResponse.json({error:'You can attach up to 5 files per email.'},{status:400});let totalBytes=0;for(const a of attachments){if(!a||typeof a.name!=='string'||typeof a.data!=='string'||typeof a.type!=='string')return NextResponse.json({error:'One of the attachments is invalid.'},{status:400});const bytes=Math.ceil(a.data.replace(/\s/g,'').length*3/4);totalBytes+=bytes;if(bytes>2_500_000)return NextResponse.json({error:`${a.name} is too large. Keep each attachment under 2.5 MB.`},{status:400})}if(totalBytes>3_000_000)return NextResponse.json({error:'Attachments are too large. Keep the combined attachment size under 3 MB.'},{status:400});const {data:coach,error:coachError}=await c.from('college_coaches').select('id,email,contact_verification_needed,lifecycle_status,first_name,last_name,college_id,college:colleges!college_coaches_college_id_fkey(name)').eq('id',coachId).maybeSingle();if(coachError||!coach)return NextResponse.json({error:'Coach not found.'},{status:404});
if(coach.lifecycle_status!=='active')return NextResponse.json({error:'This coach is not currently active. Review the staff listing before emailing.'},{status:409});
if(coach.contact_verification_needed)return NextResponse.json({error:'This coach has conflicting contact details. RLTNL must review the conflict before outreach.'},{status:409});
if(athleteUserId!==user.id){const {data:allowed}=await c.rpc('can_edit_athlete',{a:athleteUserId});if(!allowed)return NextResponse.json({error:'You do not have permission to send email for this athlete.'},{status:403})}
let manualRelationship:any=null;
if(!staffMode){
 const requiredCoachIds=[coachId,...ccCoachIds];
 const {data:relationships,error:relationshipError}=await c.from('athlete_coaches')
  .select('id,coach_id,email_override').eq('athlete_user_id',athleteUserId)
  .in('coach_id',requiredCoachIds).is('archived_at',null);
 if(relationshipError)return NextResponse.json({error:'Could not check My Contacts. Please try again.'},{status:500});
 const linked=new Map((relationships||[]).map((row:any)=>[row.coach_id,row]));
 if(!linked.has(coachId))return NextResponse.json({
  error:'Add this coach to My Contacts before emailing. Adding a coach does not mark them as contacted.'
 },{status:409});
 if(ccCoachIds.some(id=>!linked.has(id)))return NextResponse.json({
  error:'Add each CC coach to My Contacts before including them in an email.'
 },{status:409});
 manualRelationship=linked.get(coachId);
}
const recipient=coach.email||(!staffMode?(suppliedRecipient||manualRelationship?.email_override||''):'');
const validEmail=(value:string)=>value.length<=254&&/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value);
if(!validEmail(recipient))return NextResponse.json({error:'Enter a valid coach email address before sending.'},{status:400});let ccCoaches:any[]=[];if(ccCoachIds.length){const {data,error}=await c.from('college_coaches').select('id,email,contact_verification_needed,lifecycle_status,first_name,last_name,college_id').in('id',ccCoachIds);if(error)return NextResponse.json({error:'Could not load the additional coaches.'},{status:400});ccCoaches=(data||[]).filter((x:any)=>x.college_id===coach.college_id&&x.email&&!x.contact_verification_needed&&x.lifecycle_status==='active');if(ccCoaches.length!==ccCoachIds.length)return NextResponse.json({error:'One or more additional coaches are unavailable or belong to another school.'},{status:400})}try{const {accessToken}=await getGoogleAccessToken(user.id,'gmail');let replyMeta:{threadId:string;messageId:string;references?:string;subject:string}|null=null;let replyRecord:any=null;
if(recruitingInteractionId||recruitingMessageId){
  if(athleteUserId!==user.id)return NextResponse.json({error:'Replies to an existing Gmail thread must be sent from the athlete’s connected Gmail account.'},{status:403});
  const {createAdminClient}=await import('@/lib/supabase-admin');
  const admin=createAdminClient();
  // An interaction may represent several messages in the same Gmail conversation.
  // The specific email ID is authoritative; older links fall back to the newest.
  let lookup=admin.from('gmail_recruiting_messages')
    .select('id,interaction_id,gmail_message_id,gmail_thread_id,subject,recruiting_intent')
    .eq('athlete_user_id',athleteUserId).eq('coach_id',coachId);
  if(recruitingMessageId)lookup=lookup.eq('id',recruitingMessageId);
  else lookup=lookup.eq('interaction_id',recruitingInteractionId).order('received_at',{ascending:false}).limit(1);
  const {data:g,error:lookupError}=await lookup.maybeSingle();
  if(lookupError){console.error('[gmail/send] Reply lookup failed:',{code:lookupError.code,message:lookupError.message});return NextResponse.json({error:'Could not locate the recruiting email for this reply.'},{status:500})}
  if(!g?.gmail_message_id||!g?.gmail_thread_id)return NextResponse.json({error:'This coach email is not available for a Gmail thread reply. Sync Gmail and try again.'},{status:409});
  replyRecord=g;
  const original=await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(g.gmail_message_id)}?format=metadata&metadataHeaders=Message-ID&metadataHeaders=References&metadataHeaders=Subject`,{headers:{Authorization:`Bearer ${accessToken}`},cache:'no-store'});
  if(!original.ok){console.warn('[gmail/send] Original message unavailable:',{status:original.status});return NextResponse.json({error:'The original email is not accessible in this connected Gmail account. Check the Gmail connection or sync and try again.'},{status:409})}
  const om=await original.json() as any;
  const hs=om.payload?.headers||[];
  const messageId=hs.find((h:any)=>h.name?.toLowerCase()==='message-id')?.value;
  const references=hs.find((h:any)=>h.name?.toLowerCase()==='references')?.value;
  const originalSubject=hs.find((h:any)=>h.name?.toLowerCase()==='subject')?.value||g.subject;
  if(!messageId||!originalSubject||!(om.threadId||g.gmail_thread_id))return NextResponse.json({error:'Gmail did not provide the message headers required to reply in the original thread.'},{status:409});
  replyMeta={threadId:om.threadId||g.gmail_thread_id,messageId,references:references?`${references} ${messageId}`:messageId,subject:originalSubject};
}const sendSubject=replyMeta?(/^re:/i.test(replyMeta.subject)?replyMeta.subject:`Re: ${replyMeta.subject}`):subject;const sendRes=await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send',{method:'POST',headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json'},body:JSON.stringify({raw:encodeMessage(recipient,ccCoaches.map(x=>x.email),sendSubject,body,bodyHtml,attachments,replyMeta?{messageId:replyMeta.messageId,references:replyMeta.references}:undefined),...(replyMeta?{threadId:replyMeta.threadId}:{})}),cache:'no-store'});const sent=await sendRes.json() as {id?:string;threadId?:string;error?:{message?:string}};if(!sendRes.ok||!sent.id)return NextResponse.json({error:sent.error?.message||'Gmail could not send the message.'},{status:502});let contactSaved=true;
if(!staffMode){
 for(const contacted of [coach,...ccCoaches]){
  try{
   await updateEmailedCoachContact(c,athleteUserId,contacted.id,
    contacted.id===coach.id&&!coach.email&&suppliedRecipient?recipient:null);
  }catch(e:any){
   contactSaved=false;
   console.error('[gmail/send] Coach outreach date could not be updated after Gmail send',
    {coachId:contacted.id,code:e?.code,message:e?.message});
  }
 }
}
const recipientSaved=staffMode||!!coach.email||!suppliedRecipient||contactSaved;
if(!coach.email&&suppliedRecipient&&!staffMode){
 // An athlete-supplied email is private until independently verified.
 const normalized=recipient.trim().toLowerCase();
 const pending=await c.from('college_coach_update_suggestions').select('id')
  .eq('coach_id',coachId).eq('submitted_by_user_id',user.id)
  .eq('proposed_email',normalized).eq('status','pending').limit(1);
 if(!pending.error&&!(pending.data||[]).length){
  const suggested=await c.from('college_coach_update_suggestions').insert({
   coach_id:coachId,submitted_by_user_id:user.id,suggestion_type:'contact_update',
   proposed_email:normalized,
   details:'Athlete supplied this unverified email for their own Gmail outreach. Do not publish globally without independent verification.'
  });
  if(suggested.error)console.warn('[gmail/send] Coach email verification suggestion not queued',suggested.error.code);
 }
}
let gmailSenderEmail:string|null=null;try{const {data:connection}=await c.from('google_workspace_connections').select('google_email').eq('user_id',user.id).maybeSingle();gmailSenderEmail=connection?.google_email||null;if(!gmailSenderEmail){const profileRes=await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile',{headers:{Authorization:'Bearer '+accessToken},cache:'no-store',signal:AbortSignal.timeout(2500)});if(profileRes.ok){const googleProfile=await profileRes.json() as {emailAddress?:string};gmailSenderEmail=googleProfile.emailAddress?.trim().toLowerCase()||null;if(gmailSenderEmail)await c.from('google_workspace_connections').update({google_email:gmailSenderEmail}).eq('user_id',user.id)}}}catch{};const coachName=[coach.first_name,coach.last_name].filter(Boolean).join(' ')||'Coach';const ccNames=ccCoaches.map(x=>[x.first_name,x.last_name].filter(Boolean).join(' ')).filter(Boolean);const attachmentNote=attachments.length?` [Attachments: ${attachments.map(a=>a.name).join(', ')}]`:'';const ccNote=ccNames.length?` [CC: ${ccNames.join(', ')}]`:'';let logged:any=null,logError:any=null;if(staffMode){const r=await c.from('staff_recruiting_interactions').insert({user_id:user.id,college_id:coach.college_id,coach_id:coach.id,type:'Email Sent',channel:'Email',occurred_at:new Date().toISOString(),source:'automatic',subject:sendSubject,note:`${ccNote}${attachmentNote}`.trim()||null}).select('id').single();logged=r.data;logError=r.error;await c.from('staff_coach_relationships').upsert({user_id:user.id,coach_id:coach.id,college_id:coach.college_id,last_contact_date:new Date().toISOString().slice(0,10),updated_at:new Date().toISOString()},{onConflict:'user_id,coach_id'});}else{const r=await c.from('interactions').insert({athlete_user_id:athleteUserId,actor_user_id:user.id,gmail_message_id:sent.id,gmail_recipient_email:recipient,gmail_thread_id:sent.threadId||null,gmail_sender_email:gmailSenderEmail,college_id:coach.college_id,coach_id:coach.id,type:'Email Sent',initiated_by:athleteUserId===user.id?'Athlete':'Advisor',date:new Date().toISOString().slice(0,10),source:'automatic',email_subject:sendSubject,email_type:emailPurpose.replace(/_/g,' ').replace(/\b\w/g,m=>m.toUpperCase()),email_content:body,note:`${ccNote}${attachmentNote}`.trim()||null}).select('id').single();logged=r.data;logError=r.error;}if(logged?.id&&!staffMode){await c.from('interaction_recipients').insert([{interaction_id:logged.id,coach_id:coach.id,recipient_type:'to'},...ccCoaches.map(x=>({interaction_id:logged.id,coach_id:x.id,recipient_type:'cc'}))]);/* Only pre-existing active coach contacts receive outreach updates. */}if(replyRecord&&athleteUserId===user.id){const {createAdminClient}=await import('@/lib/supabase-admin');const admin=createAdminClient();const intel=replyRecord;{const after:any={camp_invitation:['registration','Review camp registration and prepare for the event',true],call_request:['prepare','Prepare for the coach call',true],visit_invitation:['prepare','Prepare for the campus visit',true],schedule_request:['waiting','Watch for coach attendance or follow-up',false],event_attendance:['prepare','Prepare for the coach to attend your game',true],information_request:['waiting','Continue building the relationship',false],questionnaire:['waiting','Continue building the relationship',false],offer_related:['decision','Record the offer details and decide your next step',true],follow_up:['closed','Continue building the relationship',false]};const [afterState,next,required]=after[intel.recruiting_intent]||['completed','Continue building the relationship',false];await admin.from('gmail_recruiting_messages').update({action_state:afterState,action_updated_at:new Date().toISOString(),next_action:next,action_required:required,reviewed_at:new Date().toISOString()}).eq('id',intel.id);await admin.from('athlete_coaches').update({next_step:next,last_contact_date:new Date().toISOString().slice(0,10)}).eq('athlete_user_id',athleteUserId).eq('coach_id',coachId);if(intel.interaction_id)await admin.from('reminders').update({status:'completed',completed_at:new Date().toISOString()}).eq('athlete_user_id',athleteUserId).eq('interaction_id',intel.interaction_id).eq('reminder_kind','recruiting_action').neq('status','completed');}}return NextResponse.json({ok:true,messageId:sent.id,threadId:sent.threadId||null,repliedToEmailId:replyRecord?.id||null,logged:!logError,recipientSaved,contactSaved,ccCount:ccCoaches.length,logError:logError?'Email sent, but the activity log could not be updated.':null});}catch(error){const message=error instanceof Error?error.message:'Could not send through Gmail.';return NextResponse.json({error:message},{status:500})}}
