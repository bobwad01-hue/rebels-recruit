import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase-server';

const PAGE_SIZE=20;
const FIELDS='id,name,division,city,state,conference,school_type';
export async function GET(req:NextRequest){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)return NextResponse.json({items:[]},{status:401});
 const id=(req.nextUrl.searchParams.get('id')||'').trim().slice(0,80);
 if(id){
  const {data,error}=await supabase.from('colleges').select(FIELDS).eq('id',id).maybeSingle();
  if(error)return NextResponse.json({items:[],error:'School unavailable.'},{status:500});
  return NextResponse.json({items:data?[data]:[],hasMore:false},{headers:{'Cache-Control':'private, max-age=300, stale-while-revalidate=600'}});
 }
 const q=(req.nextUrl.searchParams.get('q')||'').trim().replace(/[%_,()]/g,' ').slice(0,80);
 const page=Math.max(0,Number(req.nextUrl.searchParams.get('page')||0)||0);
 if(q.length<2)return NextResponse.json({items:[],hasMore:false});
 const from=page*PAGE_SIZE;
 const {data,error}=await supabase.from('colleges').select(FIELDS).or(`name.ilike.%${q}%,city.ilike.%${q}%,state.ilike.%${q}%,division.ilike.%${q}%,conference.ilike.%${q}%`).order('name').range(from,from+PAGE_SIZE);
 if(error)return NextResponse.json({items:[],error:'Search unavailable.'},{status:500});
 const rows=data||[];
 return NextResponse.json({items:rows.slice(0,PAGE_SIZE),hasMore:rows.length>PAGE_SIZE},{headers:{'Cache-Control':'private, max-age=30, stale-while-revalidate=120'}});
}
