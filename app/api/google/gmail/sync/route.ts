import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase-server';
import {createAdminClient} from '@/lib/supabase-admin';
import {getGoogleAccessToken} from '@/lib/google-workspace';
import {extractGmailAttachmentMetadata} from '@/lib/gmail-attachment-metadata';
import type {GmailMimePart} from '@/lib/gmail-attachment-metadata';

type Header={name?:string;value?:string};
function header(headers:Header[]|undefined,name:string){return headers?.find(h=>h.name?.toLowerCase()===name.toLowerCase())?.value||''}
function emailFrom(value:string){return (value.match(/<([^>]+)>/)?.[1]||value).trim().toLowerCase()}
function senderDetails(headers:Header[]|undefined){const from=header(headers,'From');const email=emailFrom(from);const name=from.includes('<')?from.split('<')[0].trim():'';return {senderEmail:email,senderName:name||email}}
function decode(data?:string){if(!data)return '';try{return Buffer.from(data.replace(/-/g,'+').replace(/_/g,'/'),'base64').toString('utf8')}catch{return ''}}
function bodyText(p:GmailMimePart|undefined):string{if(!p)return '';if(p.mimeType==='text/plain'&&p.body?.data)return decode(p.body.data);for(const x of p.parts||[]){const v=bodyText(x);if(v)return v}return ''}
function cleanMessage(body:string,subject:string){const raw=(body||subject).replace(/\r/g,'');const cut=raw.split(/\n(?:-{2,}\s*Forwarded message\s*-{2,}|On .+wrote:|From:\s|>)/i)[0];return cut.replace(/\n{3,}/g,'\n\n').replace(/[ \t]+/g,' ').replace(/ *\n */g,'\n').trim()}
function summaryText(v:string){return v.replace(/\s+/g,' ').trim().slice(0,500)}
function extractUrls(v:string){return [...new Set((v.match(/https?:\/\/[^\s<>]+/gi)||[]).map(x=>x.replace(/[),.;]+$/,'')))]}
function normalizeForMatch(v:string){return v.toLowerCase().replace(/https?:\/\/\S+/g,'').replace(/[^a-z0-9]+/g,' ').trim().slice(0,240)}
function classify(subject:string,body:string){
 const t=(subject+'\n'+body).toLowerCase();
 let intent='general_response',nextAction:string|null=null;
 if(/send (me|us).*(schedule|game times)|your schedule/.test(t)){intent='schedule_request';nextAction='Send game schedule'}
 else if(/(?:excited|looking forward|glad|happy).*(?:come|coming|visit|campus)|(?:see you|seeing you).*(?:friday|monday|tuesday|wednesday|thursday|saturday|sunday|soon|campus)|(?:visit|campus).*(?:confirmed|scheduled|see you)/.test(t)){intent='visit_confirmation';nextAction='Prepare for visit'}
 else if(/camp|prospect day|clinic/.test(t)){intent='camp_invitation';nextAction='Review camp or clinic invitation'}
 else if(/phone call|zoom|facetime|call you|set up a call/.test(t)){intent='call_request';nextAction='Respond to call request'}
 else if(/visit|campus/.test(t)){intent='visit_invitation';nextAction='Review visit invitation'}
 else if(/we('ll| will) (be|watch)|coming to watch|plan to watch/.test(t)){intent='event_attendance';nextAction='Confirm event details'}
 else if(/questionnaire|recruiting form|prospective student-athlete form|prospect form/.test(t)){intent='questionnaire';nextAction='Complete recruiting questionnaire'}
 else if(/offer|scholarship/.test(t)){intent='offer_related';nextAction='Review offer conversation'}
 else if(/follow up|following up|checking in|circle back/.test(t)){intent='follow_up';nextAction='Review coach follow-up'}
 else if(/roster (is )?full|no roster|not recruiting|no need/.test(t)){intent='roster_status';nextAction='Review recruiting status'}
 else if(/send (me|us)|please send|can you send/.test(t)){intent='information_request';nextAction='Send requested information'}
 const clean=cleanMessage(body,subject);
 const summary=summaryText(clean.replace(/https?:\/\/[^\s<>]+/gi,'').replace(/\s+(Coach|Thanks|Thank you|Best|Sincerely)[ ,].*$/i,''));
 return {intent,summary,nextAction,actionRequired:!!nextAction,confidence:nextAction?0.8:0.55};
}
export async function POST(req:NextRequest){
 const c=await createClient(); const {data:{user}}=await c.auth.getUser();const pushUser=req.headers.get('x-gmail-push-user'),pushSecret=req.headers.get('x-gmail-push-secret');const trustedPush=!!pushUser&&!!process.env.GMAIL_PUSH_SECRET&&pushSecret===process.env.GMAIL_PUSH_SECRET;const userId=user?.id||(trustedPush?pushUser:null);if(!userId)return NextResponse.json({error:'Please sign in again.'},{status:401});
 try{
  const {accessToken,grantedScopes}=await getGoogleAccessToken(userId,'gmail');
  if(!grantedScopes.includes('gmail.readonly'))return NextResponse.json({error:'Reconnect Gmail to enable incoming coach email intelligence.',reconnectRequired:true},{status:409});
  const list=await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages?labelIds=INBOX&maxResults=50',{headers:{Authorization:`Bearer ${accessToken}`},cache:'no-store'});
  const listing=await list.json() as {messages?:{id:string}[];error?:{message?:string}};
  if(!list.ok)throw new Error(listing.error?.message||'Could not read Gmail.');
  const admin=createAdminClient(); let logged=0,matched=0,backfilled=0; let persistenceFailures=0;
  for(const item of listing.messages||[]){
   const existing=await admin.from('gmail_recruiting_messages').select('id,extracted_data').eq('athlete_user_id',userId).eq('gmail_message_id',item.id).maybeSingle();
   if(existing.data){
    // Existing emails were synced before attachment metadata was captured.
    // Backfill a bounded number per sync, preserving prior extracted fields.
    if(backfilled<8&&(existing.data.extracted_data?.attachmentMetadataChecked!==true||!existing.data.extracted_data?.senderEmail)){
     const detail=await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/'+encodeURIComponent(item.id)+'?format=full',{headers:{Authorization:'Bearer '+accessToken},cache:'no-store'});
     if(detail.ok){
      const oldMessage=await detail.json() as {payload?:GmailMimePart};
      const meta=extractGmailAttachmentMetadata(oldMessage.payload);
      if(meta.attachmentMetadataChecked){
       const prior=existing.data.extracted_data&&typeof existing.data.extracted_data==='object'&&!Array.isArray(existing.data.extracted_data)?existing.data.extracted_data:{};
       const saved=await admin.from('gmail_recruiting_messages').update({extracted_data:{...prior,...meta,...senderDetails(oldMessage.payload?.headers)}}).eq('id',existing.data.id).eq('athlete_user_id',userId);
       if(!saved.error)backfilled++;
      }
     }
    }
    continue;
   }
   const mr=await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(item.id)}?format=full`,{headers:{Authorization:`Bearer ${accessToken}`},cache:'no-store'});
   if(!mr.ok){persistenceFailures++;continue} const m=await mr.json() as any;
   const from=emailFrom(header(m.payload?.headers,'From')); if(!from)continue;
   // Match canonical contacts first, but also recognize athlete-supplied
   // email addresses scoped to this athlete's active coach relationships.
   // Never promote those private addresses into the shared coach directory.
   const coachRes=await admin.from('college_coaches')
    .select('id,college_id,first_name,last_name,email,contact_verification_needed,lifecycle_status')
    .ilike('email',from).limit(20);
   let coach:any=null;
   if(coachRes.data?.length){
    const coachIds=coachRes.data.map((x:any)=>x.id);
    const tracked=await admin.from('athlete_coaches').select('coach_id')
     .eq('athlete_user_id',userId).is('archived_at',null).in('coach_id',coachIds);
    const trackedIds=new Set((tracked.data||[]).map((x:any)=>x.coach_id));
    coach=coachRes.data.find((x:any)=>trackedIds.has(x.id)&&x.lifecycle_status==='active'&&!x.contact_verification_needed)||null;
   }
   if(!coach){
    const privateMatch=await admin.from('athlete_coaches').select('coach_id')
     .eq('athlete_user_id',userId).is('archived_at',null)
     .ilike('email_override',from).limit(2);
    // A shared mailbox can belong to multiple coaches. Never guess the
    // recipient if the athlete has assigned that address to two coaches.
    if(!privateMatch.error&&privateMatch.data?.length===1){
     const found=await admin.from('college_coaches')
      .select('id,college_id,first_name,last_name,email,contact_verification_needed,lifecycle_status')
      .eq('id',privateMatch.data[0].coach_id).maybeSingle();
     if(!found.error&&found.data?.lifecycle_status==='active'&&!found.data.contact_verification_needed)
      coach=found.data;
    }
   }
   if(!coach)continue; matched++;
   const subject=header(m.payload?.headers,'Subject'); const text=bodyText(m.payload).slice(0,12000); const urls=extractUrls(text); const meta=extractGmailAttachmentMetadata(m.payload);
   if(/^\s*(fwd|fw):/i.test(subject)||/^\s*-{2,}\s*forwarded message/i.test(text))continue;
   let intel=classify(subject,text); if(!intel.summary)continue;
   // Use the existing relationship history to avoid treating an acknowledgement as a brand-new invitation.
   if(intel.intent==='camp_invitation'||intel.intent==='visit_invitation'){
    const prior=await admin.from('interactions').select('id,type,email_subject,email_type,note,date,created_at').eq('athlete_user_id',userId).eq('coach_id',coach.id).lt('created_at',new Date(Number(m.internalDate||Date.now())).toISOString()).order('created_at',{ascending:false}).limit(12);
    const context=(prior.data||[]).map((x:any)=>`${x.type||''} ${x.email_subject||''} ${x.email_type||''} ${x.note||''}`).join('\n').toLowerCase();
    const current=(subject+'\n'+text).toLowerCase();
    const acknowledgement=/(excited|looking forward|glad|happy).*(come|coming|visit|campus|camp)|see you|can't wait|looking forward to seeing/.test(current);
    const alreadyPlanned=/(pre.?camp|pre.?visit|upcoming visit|attend|attending|registered|registration|coming to|visit|camp)/.test(context);
    if(acknowledgement&&alreadyPlanned)intel={...intel,intent:'visit_confirmation',nextAction:'Prepare for visit',actionRequired:true,confidence:0.9};
   }
   const receivedAt=m.internalDate?new Date(Number(m.internalDate)).toISOString():new Date().toISOString();
   const coachName=[coach.first_name,coach.last_name].filter(Boolean).join(' ')||'Coach';
   const sameDay=await admin.from('interactions').select('id,note,email_subject,created_at').eq('athlete_user_id',userId).eq('coach_id',coach.id).eq('type','Email Received').eq('date',receivedAt.slice(0,10)).limit(20);
   // Reuse an existing manually logged email only when it is not already tied to a Gmail message.
   // Two separate Gmail message IDs are two separate received emails, even if the text is identical.
   const existingInteractionIds=(sameDay.data||[]).map((x:any)=>x.id);
   const {data:linkedGmail}=existingInteractionIds.length?await admin.from('gmail_recruiting_messages').select('interaction_id').eq('athlete_user_id',userId).in('interaction_id',existingInteractionIds):{data:[] as any[]};
   const linkedIds=new Set((linkedGmail||[]).map((x:any)=>x.interaction_id));
   const target=normalizeForMatch(intel.summary); const normalizedSubject=normalizeForMatch(subject); const duplicate=(sameDay.data||[]).find((x:any)=>{if(linkedIds.has(x.id))return false;const n=normalizeForMatch(x.note||'');const s=normalizeForMatch(x.email_subject||'');return s===normalizedSubject&&n&&target&&(n.includes(target.slice(0,120))||target.includes(n.slice(0,120))) });
   if(duplicate){const linked=await admin.from('gmail_recruiting_messages').insert({athlete_user_id:userId,interaction_id:duplicate.id,coach_id:coach.id,college_id:coach.college_id,gmail_message_id:item.id,gmail_thread_id:m.threadId||null,received_at:receivedAt,subject:subject||null,recruiting_intent:intel.intent,summary:intel.summary,action_required:intel.actionRequired,next_action:intel.nextAction,confidence:intel.confidence,extracted_data:{urls,...meta,...senderDetails(m.payload?.headers)}});if(linked.error)persistenceFailures++;continue}
   const interaction=await admin.from('interactions').insert({athlete_user_id:userId,actor_user_id:userId,college_id:coach.college_id,coach_id:coach.id,type:'Email Received',initiated_by:'Coach',date:receivedAt.slice(0,10),source:'automatic',email_subject:subject||null,email_type:intel.intent,email_content:cleanMessage(text,subject),note:intel.summary}).select('id').single();
   if(interaction.error){persistenceFailures++;continue}
   const stored=await admin.from('gmail_recruiting_messages').insert({athlete_user_id:userId,interaction_id:interaction.data.id,coach_id:coach.id,college_id:coach.college_id,gmail_message_id:item.id,gmail_thread_id:m.threadId||null,received_at:receivedAt,subject:subject||null,recruiting_intent:intel.intent,summary:intel.summary,action_required:intel.actionRequired,next_action:intel.nextAction,confidence:intel.confidence,extracted_data:{urls,...meta,...senderDetails(m.payload?.headers)}});
   if(stored.error){persistenceFailures++;await admin.from('interactions').delete().eq('id',interaction.data.id);continue}
   if(intel.nextAction){
    const stepUpdate=await admin.from('athlete_coaches').update({next_step:intel.nextAction,last_contact_date:receivedAt.slice(0,10)}).eq('athlete_user_id',userId).eq('coach_id',coach.id);if(stepUpdate.error)persistenceFailures++;
   }
   logged++;
  }
  if(persistenceFailures)return NextResponse.json({error:'Some Gmail messages could not be safely synchronized. Retry required.',retryable:true,matched,logged,persistenceFailures},{status:503});
  const checkpoint=await admin.from('google_workspace_connections').update({gmail_last_synced_at:new Date().toISOString()}).eq('user_id',userId);if(checkpoint.error)return NextResponse.json({error:'Gmail messages processed but sync checkpoint could not be saved.',retryable:true},{status:503});
  return NextResponse.json({ok:true,matched,logged,attachmentMetadataBackfilled:backfilled});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Could not sync incoming Gmail.'},{status:500})}
}
