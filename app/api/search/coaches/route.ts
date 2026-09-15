import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase-server';
const PAGE_SIZE=20;
export async function GET(req:NextRequest){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)return NextResponse.json({items:[]},{status:401});
 const q=(req.nextUrl.searchParams.get('q')||'').trim().replace(/[%_,()]/g,' ').slice(0,80);
 const collegeId=(req.nextUrl.searchParams.get('collegeId')||'').trim();
 const page=Math.max(0,Number(req.nextUrl.searchParams.get('page')||0)||0);
 if(q.length<2&&!collegeId)return NextResponse.json({items:[],hasMore:false});
 let query=supabase.from('college_coaches').select('id,college_id,first_name,last_name,title,email,phone,instagram_url,colleges(id,name,state)').order('last_name').order('first_name');
 if(collegeId)query=query.eq('college_id',collegeId);
 if(q.length>=2)query=query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,title.ilike.%${q}%,email.ilike.%${q}%`);
 const from=page*PAGE_SIZE;const {data,error}=await query.range(from,from+PAGE_SIZE);
 if(error)return NextResponse.json({items:[],error:'Search unavailable.'},{status:500});
 const rows=data||[];return NextResponse.json({items:rows.slice(0,PAGE_SIZE),hasMore:rows.length>PAGE_SIZE},{headers:{'Cache-Control':'private, max-age=30, stale-while-revalidate=120'}});
}
