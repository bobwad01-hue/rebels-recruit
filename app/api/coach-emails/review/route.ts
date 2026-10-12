import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase-server';
export async function POST(req:NextRequest){
 const c=await createClient();
 const {data:{user}}=await c.auth.getUser();
 if(!user)return NextResponse.json({error:'Sign in required'},{status:401});
 const body=await req.json().catch(()=>null);
 const emailId=String(body?.emailId||'');
 if(!/^[a-f0-9-]{36}$/i.test(emailId))return NextResponse.json({error:'Invalid ID'},{status:400});
 const {data,error}=await c.from('gmail_recruiting_messages').update({reviewed_at:new Date().toISOString()}).eq('id',emailId).eq('athlete_user_id',user.id).select('id').maybeSingle();
 if(error)return NextResponse.json({error:'Unable to save review'},{status:500});
 if(!data)return NextResponse.json({error:'Email not found'},{status:404});
 return NextResponse.json({ok:true});
}
