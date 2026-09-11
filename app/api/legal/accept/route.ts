import {NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase-server';
import {createAdminClient} from '@/lib/supabase-admin';

const CONTEXTS=new Set(['signup','existing_account','reauth','policy_update']);

function clientIp(request:Request){
 const forwarded=request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
 return forwarded||request.headers.get('x-real-ip')||null;
}

export async function POST(request:Request){
 const supabase=await createClient();
 const{data:{user},error:authError}=await supabase.auth.getUser();
 if(authError||!user)return NextResponse.json({error:'Authentication required.'},{status:401});
 let body:any={};try{body=await request.json()}catch{}
 const context=CONTEXTS.has(String(body?.context))?String(body.context):'existing_account';
 const admin=createAdminClient();
 const{data:docs,error:docsError}=await admin.from('legal_document_versions').select('id,document_type,version').eq('is_current',true).in('document_type',['terms_of_service','privacy_policy']);
 if(docsError)return NextResponse.json({error:'Current legal documents could not be loaded.'},{status:500});
 const terms=(docs||[]).find((d:any)=>d.document_type==='terms_of_service'),privacy=(docs||[]).find((d:any)=>d.document_type==='privacy_policy');
 if(!terms||!privacy)return NextResponse.json({error:'Current legal documents are not configured.'},{status:503});
 const{data:existing}=await admin.from('user_legal_acceptances').select('id').eq('user_id',user.id).eq('terms_version_id',terms.id).eq('privacy_version_id',privacy.id).order('accepted_at',{ascending:false}).limit(1).maybeSingle();
 if(existing)return NextResponse.json({ok:true,acceptanceId:existing.id,alreadyAccepted:true});
 const{data,error}=await admin.from('user_legal_acceptances').insert({user_id:user.id,terms_version_id:terms.id,privacy_version_id:privacy.id,acceptance_context:context,acceptance_method:'clickwrap',user_agent:request.headers.get('user-agent'),ip_address:clientIp(request)}).select('id,accepted_at').single();
 if(error)return NextResponse.json({error:'Acceptance could not be recorded.'},{status:500});
 return NextResponse.json({ok:true,acceptanceId:data.id,acceptedAt:data.accepted_at});
}
