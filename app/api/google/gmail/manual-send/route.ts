import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase-server';
import {getGoogleAccessToken} from '@/lib/google-workspace';
import {renderEmailHtml} from '@/lib/email-html';
type Attachment={name:string;type:string;data:string;size?:number};
const cleanHeader=(value:string)=>value.replace(/[\r\n]+/g,' ').trim();
const b64Lines=(value:string)=>value.replace(/\s/g,'').match(/.{1,76}/g)?.join('\r\n')||'';

export async function POST(req:NextRequest){
 const c=await createClient();
 const {data:{user}}=await c.auth.getUser();
 if(!user)return NextResponse.json({error:'Please sign in again.'},{status:401});
 let p:any;try{p=await req.json()}catch{return NextResponse.json({error:'Invalid request.'},{status:400})}
 const collegeId=String(p?.collegeId||''),recipient=String(p?.recipientEmail||'').trim().toLowerCase();
 const recipientName=String(p?.recipientName||'').trim(),subject=String(p?.subject||'').trim();
 const body=String(p?.body||'').replace(/\r\n?/g,'\n');
 const bodyHtml=String(p?.bodyHtml||'');
 const attachments:Attachment[]=Array.isArray(p?.attachments)?p.attachments:[];
 if(collegeId&&!/^[0-9a-f-]{36}$/i.test(collegeId))return NextResponse.json({error:'Select a valid school.'},{status:400});
 if(recipient.length>254||!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(recipient))
  return NextResponse.json({error:'Enter a valid recipient email address.'},{status:400});
 if(!subject||subject.length>200||!body.trim()||body.length>20000||bodyHtml.length>100000||recipientName.length>120)
  return NextResponse.json({error:'A subject and message are required. Check the field lengths.'},{status:400});
 if(attachments.length>5)return NextResponse.json({error:'You can attach up to 5 files.'},{status:400});
 let totalBytes=0;
 for(const a of attachments){
  if(!a||typeof a.name!=='string'||typeof a.type!=='string'||typeof a.data!=='string'||a.name.length>255)
   return NextResponse.json({error:'Invalid email attachment.'},{status:400});
  if(!/^[A-Za-z0-9+/]*={0,2}$/.test(a.data)||a.data.length%4!==0)
   return NextResponse.json({error:'Invalid attachment data.'},{status:400});
  const bytes=Buffer.from(a.data,'base64').length;
  totalBytes+=bytes;
  if(bytes>2_500_000)return NextResponse.json({error:'Keep each attachment under 2.5 MB.'},{status:400});
 }
 if(totalBytes>3_000_000)return NextResponse.json({error:'Keep the combined attachment size under 3 MB.'},{status:400});
 if(collegeId){const {data:college,error:schoolError}=await c.from('colleges').select('id,name').eq('id',collegeId).maybeSingle();
 if(schoolError||!college)return NextResponse.json({error:'School not found.'},{status:404});}
 // This route is athlete-only. It never modifies the shared coach directory.
 const {data:roleRows}=await c.from('user_roles').select('role').eq('user_id',user.id);
 if(!(roleRows||[]).some((r:any)=>r.role==='athlete'))return NextResponse.json({error:'Only athletes can use this composer.'},{status:403});
 try{
  const {accessToken}=await getGoogleAccessToken(user.id,'gmail');
  const safeSubject=cleanHeader(subject);
  const mixed='rltnl_mixed_'+crypto.randomUUID().replace(/-/g,'');
  const alt='rltnl_alt_'+crypto.randomUUID().replace(/-/g,'');
  const html=renderEmailHtml(body,bodyHtml);
  const parts=[
   'To: '+recipient,'Subject: '+safeSubject,'MIME-Version: 1.0',
   'Content-Type: multipart/mixed; boundary="'+mixed+'"',
   '','--'+mixed,'Content-Type: multipart/alternative; boundary="'+alt+'"',
   '','--'+alt,'Content-Type: text/plain; charset="UTF-8"',
   'Content-Transfer-Encoding: 8bit','',body,
   '--'+alt,'Content-Type: text/html; charset="UTF-8"',
   'Content-Transfer-Encoding: 8bit','',
   '<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;color:#111;white-space:pre-wrap">'+html+'</div>',
   '--'+alt+'--'
  ];
  for(const a of attachments){
   const safeName=cleanHeader(a.name).replace(/["\\]/g,'_');
   parts.push('--'+mixed,
    'Content-Type: '+cleanHeader(a.type||'application/octet-stream')+'; name="'+safeName+'"',
    'Content-Transfer-Encoding: base64',
    'Content-Disposition: attachment; filename="'+safeName+'"',
    '',b64Lines(a.data));
  }
  parts.push('--'+mixed+'--','');
  const raw=Buffer.from(parts.join('\r\n'),'utf8').toString('base64url');
  const response=await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send',{
   method:'POST',headers:{Authorization:'Bearer '+accessToken,'Content-Type':'application/json'},
   body:JSON.stringify({raw}),cache:'no-store'
  });
  const sent=await response.json() as {id?:string;threadId?:string;error?:{message?:string}};
  if(!response.ok||!sent.id)return NextResponse.json({error:sent.error?.message||'Gmail could not send the message.'},{status:502});
  // Only after a confirmed send, save the school target. Do not create a coach.
  let schoolSaved=true;
  if(collegeId)try{
   const {data:existing,error:lookupError}=await c.from('athlete_colleges').select('id,archived_at')
    .eq('athlete_user_id',user.id).eq('college_id',collegeId).maybeSingle();
   if(lookupError)throw lookupError;
   if(existing?.archived_at){
    const r=await c.from('athlete_colleges').update({archived_at:null,archived_reason:null})
     .eq('id',existing.id).eq('athlete_user_id',user.id);if(r.error)throw r.error;
   }else if(!existing){
    const r=await c.from('athlete_colleges').insert({athlete_user_id:user.id,college_id:collegeId});
    if(r.error&&r.error.code!=='23505')throw r.error;
   }
  }catch(e){schoolSaved=false;console.error('[gmail/manual-send] School save failed after Gmail send',e)}
  // Preserve the exact recipient on the athlete's private activity record.
  const logged=await c.from('interactions').insert({
   athlete_user_id:user.id,actor_user_id:user.id,college_id:collegeId||null,coach_id:null,
   type:'Email Sent',initiated_by:'Athlete',date:new Date().toISOString().slice(0,10),
   source:'automatic',gmail_message_id:sent.id,gmail_thread_id:sent.threadId||null,
   gmail_recipient_email:recipient,email_subject:safeSubject,email_content:body,
   email_type:String(p?.emailPurpose||'custom').slice(0,60),note:[recipientName?'Recipient: '+recipientName:null,attachments.length?'Attachments: '+attachments.map(a=>a.name).join(', '):null].filter(Boolean).join(' · ')||null
  }).select('id').single();
  if(logged.error)console.error('[gmail/manual-send] Activity log failed after Gmail send',logged.error);
  return NextResponse.json({ok:true,messageId:sent.id,logged:!logged.error,schoolSaved,
   warning:logged.error?'Email sent, but activity could not be logged.':!schoolSaved?'Email sent, but the school could not be saved.':null});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Could not send email.'},{status:500})}
}
