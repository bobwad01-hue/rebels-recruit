import {NextRequest,NextResponse} from 'next/server';
import {OAuth2Client} from 'google-auth-library';
import {createAdminClient} from '@/lib/supabase-admin';

const verifier=new OAuth2Client();

async function verifyPubSub(req:NextRequest){
 const expectedEmail=process.env.GOOGLE_PUBSUB_PUSH_SERVICE_ACCOUNT?.trim().toLowerCase();
 const audience=(process.env.GOOGLE_PUBSUB_PUSH_AUDIENCE||'https://rebelsrecruit.com/api/google/gmail/push').trim();
 // Keep the existing subscription working until authenticated delivery is configured.
 // Once the service-account env var is present, every push must carry a valid Google OIDC token.
 if(!expectedEmail)return true;
 const auth=req.headers.get('authorization')||'';
 if(!auth.startsWith('Bearer '))return false;
 try{
  const ticket=await verifier.verifyIdToken({idToken:auth.slice(7),audience});
  const claim=ticket.getPayload();
  return Boolean(claim&&claim.email_verified&&claim.email?.toLowerCase()===expectedEmail);
 }catch(error){
  console.error('Gmail push authentication failed',error);
  return false;
 }
}

export async function POST(req:NextRequest){
 try{
  if(!(await verifyPubSub(req)))return NextResponse.json({error:'Unauthorized push request.'},{status:401});
  const body=await req.json(),raw=body?.message?.data;
  if(!raw)return NextResponse.json({ok:true});
  const payload=JSON.parse(Buffer.from(raw,'base64url').toString('utf8'));
  const email=String(payload.emailAddress||'').toLowerCase(),historyId=String(payload.historyId||'');
  if(!email||!historyId)return NextResponse.json({ok:true});
  const admin=createAdminClient();
  const{data:p}=await admin.from('profiles').select('id,email').ilike('email',email).limit(1);
  const userId=p?.[0]?.id;
  if(!userId)return NextResponse.json({ok:true});
  const syncUrl=new URL('/api/google/gmail/sync',req.nextUrl.origin);
  const sync=await fetch(syncUrl,{method:'POST',headers:{'Content-Type':'application/json','x-gmail-push-user':userId,'x-gmail-push-secret':process.env.GMAIL_PUSH_SECRET||''},cache:'no-store',redirect:'manual'});
  if(!sync.ok){const detail=await sync.text().catch(()=> '');console.error('Gmail push sync failed',sync.status,detail);return NextResponse.json({error:'sync failed'},{status:500})}
  await admin.from('google_workspace_connections').update({gmail_history_id:historyId,gmail_last_synced_at:new Date().toISOString()}).eq('user_id',userId);
  return NextResponse.json({ok:true});
 }catch(e){console.error('Gmail push failed',e);return NextResponse.json({error:'push failed'},{status:500})}
}
