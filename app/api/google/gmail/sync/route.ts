import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase-server';
import {createAdminClient} from '@/lib/supabase-admin';
import {getGoogleAccessToken} from '@/lib/google-workspace';

type Header={name?:string;value?:string};
type GmailPart={mimeType?:string;body?:{data?:string};parts?:GmailPart[]};
function header(headers:Header[]|undefined,name:string){return headers?.find(h=>h.name?.toLowerCase()===name.toLowerCase())?.value||''}
function emailFrom(value:string){return (value.match(/<([^>]+)>/)?.[1]||value).trim().toLowerCase()}
function decode(data?:string){if(!data)return '';try{return Buffer.from(data.replace(/-/g,'+').replace(/_/g,'/'),'base64').toString('utf8')}catch{return ''}}
function bodyText(p:GmailPart|undefined):string{if(!p)return '';if(p.mimeType==='text/plain'&&p.body?.data)return decode(p.body.data);for(const x of p.parts||[]){const v=bodyText(x);if(v)return v}return ''}
function cleanMessage(body:string,subject:string){
 const raw=(body||subject).replace(/\r/g,'');
 const cut=raw.split(/\n(?:-{2,}\s*Forwarded message\s*-{2,}|On .+wrote:|From:\s|>)/i)[0];
 return cut.replace(/\s+/g,' ').trim();
}
function extractUrls(v:string){return [...new Set((v.match(/https?:\/\/[^\s<>]+/gi)||[]).map(x=>x.replace(/[),.;]+$/,'')))]}
function normalizeForMatch(v:string){return v.toLowerCase().replace(/https?:\/\/\S+/g,'').replace(/[^a-z0-9]+/g,' ').trim().slice(0,240)}
function classify(subject:string,body:string){
 const t=(subject+'\n'+body).toLowerCase();
 let intent='general_response',nextAction:string|null=null;
 if(/send (me|us).*(schedule|game times)|your schedule/.test(t)){intent='schedule_request';nextAction='Send game schedule'}
 else if(/camp|prospect day|clinic/.test(t)){intent='camp_invitation';nextAction='Review camp or clinic invitation'}
 else if(/phone call|zoom|facetime|call you|set up a call/.test(t)){intent='call_request';nextAction='Respond to call request'}
 else if(/visit|campus/.test(t)){intent='visit_invitation';nextAction='Review visit invitation'}
 else if(/we('ll| will) (be|watch)|coming to watch|plan to watch/.test(t)){intent='event_attendance';nextAction='Confirm event details'}
 else if(/offer|scholarship/.test(t)){intent='offer_related';nextAction='Review coach message'}
 else if(/roster (is )?full|no roster|not recruiting|no need/.test(t)){intent='roster_status';nextAction='Review recruiting status'}
 else if(/send (me|us)|please send|can you send/.test(t)){intent='information_request';nextAction='Send requested information'}
 const clean=cleanMessage(body,subject);\n const summary=clean.replace(/https?:\/\/[^\s<>]+/gi,'').replace(/\s+(Coach|Thanks|Thank you|Best|Sincerely)[ ,].*$/i,'').replace(/\s+/g,' ').trim().slice(0,500);
 return {intent,summary,nextAction,actionRequired:!!nextAction,confidence:nextAction?0.8:0.55};
}
export async function POST(req:NextRequest){
 const c=await createClient(); const {data:{user}}=await c.auth.getUser();
 if(!user)return NextResponse.json({error:'Please sign in again.'},{status:401});
 try{
  const {accessToken,grantedScopes}=await getGoogleAccessToken(user.id,'gmail');
  if(!grantedScopes.includes('gmail.readonly'))return NextResponse.json({error:'Reconnect Gmail to enable incoming coach email intelligence.',reconnectRequired:true},{status:409});
  const list=await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages?labelIds=INBOX&maxResults=50',{headers:{Authorization:`Bearer ${accessToken}`},cache:'no-store'});
  const listing=await list.json() as {messages?:{id:string}[];error?:{message?:string}};
  if(!list.ok)throw new Error(listing.error?.message||'Could not read Gmail.');
  const admin=createAdminClient(); let logged=0,matched=0;
  for(const item of listing.messages||[]){
   const existing=await admin.from('gmail_recruiting_messages').select('id').eq('athlete_user_id',user.id).eq('gmail_message_id',item.id).maybeSingle();
   if(existing.data)continue;
   const mr=await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(item.id)}?format=full`,{headers:{Authorization:`Bearer ${accessToken}`},cache:'no-store'});
   if(!mr.ok)continue; const m=await mr.json() as any;
   const from=emailFrom(header(m.payload?.headers,'From')); if(!from)continue;
   const coachRes=await admin.from('college_coaches').select('id,college_id,first_name,last_name,email').ilike('email',from).limit(2);
   if(!coachRes.data?.length)continue; const coach=coachRes.data[0]; matched++;
   const subject=header(m.payload?.headers,'Subject'); const text=bodyText(m.payload).slice(0,12000); const urls=extractUrls(text);
   if(/^\s*(fwd|fw):/i.test(subject)||/^\s*-{2,}\s*forwarded message/i.test(text))continue;
   const intel=classify(subject,text); if(!intel.summary)continue;
   const receivedAt=m.internalDate?new Date(Number(m.internalDate)).toISOString():new Date().toISOString();
   const coachName=[coach.first_name,coach.last_name].filter(Boolean).join(' ')||'Coach';
   const sameDay=await admin.from('interactions').select('id,note,created_at').eq('athlete_user_id',user.id).eq('coach_id',coach.id).eq('type','Email Received').eq('date',receivedAt.slice(0,10)).limit(20);
   const target=normalizeForMatch(intel.summary); const duplicate=(sameDay.data||[]).find((x:any)=>{const n=normalizeForMatch(x.note||'');return n&&target&&(n.includes(target.slice(0,120))||target.includes(n.slice(0,120))) });
   if(duplicate){await admin.from('gmail_recruiting_messages').insert({athlete_user_id:user.id,interaction_id:duplicate.id,coach_id:coach.id,college_id:coach.college_id,gmail_message_id:item.id,gmail_thread_id:m.threadId||null,received_at:receivedAt,subject:subject||null,recruiting_intent:intel.intent,summary:intel.summary,action_required:intel.actionRequired,next_action:intel.nextAction,confidence:intel.confidence,extracted_data:{urls}});continue}
   const interaction=await admin.from('interactions').insert({athlete_user_id:user.id,actor_user_id:user.id,college_id:coach.college_id,coach_id:coach.id,type:'Email Received',initiated_by:'Coach',date:receivedAt.slice(0,10),note:intel.summary}).select('id').single();
   if(interaction.error)continue;
   const stored=await admin.from('gmail_recruiting_messages').insert({athlete_user_id:user.id,interaction_id:interaction.data.id,coach_id:coach.id,college_id:coach.college_id,gmail_message_id:item.id,gmail_thread_id:m.threadId||null,received_at:receivedAt,subject:subject||null,recruiting_intent:intel.intent,summary:intel.summary,action_required:intel.actionRequired,next_action:intel.nextAction,confidence:intel.confidence,extracted_data:{urls}});\n   if(stored.error){await admin.from('interactions').delete().eq('id',interaction.data.id);continue}
   if(intel.nextAction){
    await admin.from('athlete_coaches').update({next_step:intel.nextAction,last_contact_date:receivedAt.slice(0,10)}).eq('athlete_user_id',user.id).eq('coach_id',coach.id);
   }
   logged++;
  }
  await admin.from('google_workspace_connections').update({gmail_last_synced_at:new Date().toISOString()}).eq('user_id',user.id);
  return NextResponse.json({ok:true,matched,logged});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Could not sync incoming Gmail.'},{status:500})}
}
