import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase-server';

export const dynamic='force-dynamic';

export async function GET(req:NextRequest){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});

  const {data:platform}=await supabase.from('platform_roles').select('role').eq('user_id',user.id).eq('role','super_owner').maybeSingle();
  if(!platform)return NextResponse.json({error:'Super Owner access required.'},{status:403});

  const athleteId=req.nextUrl.searchParams.get('athleteId');
  if(!athleteId)return NextResponse.json({error:'Athlete context is required.'},{status:400});

  const {data:athlete}=await supabase.from('organization_members').select('organization_id').eq('user_id',athleteId).eq('role','athlete').eq('status','active').limit(1).maybeSingle();
  if(!athlete)return NextResponse.json({error:'Preview athlete is not an active organization athlete.'},{status:404});

  const {data:links,error:linkError}=await supabase.from('athlete_events').select('event_id').eq('athlete_user_id',athleteId);
  if(linkError)return NextResponse.json({error:'Could not load athlete event context.'},{status:500});
  const eventIds=(links||[]).map((x:any)=>String(x.event_id));

  const {data:allEvents,error:eventError}=await supabase.from('events').select('*,colleges(name,division)').order('date');
  if(eventError)return NextResponse.json({error:'Could not load recruiting events for this preview.'},{status:500});

  const orgId=String(athlete.organization_id||'');
  const linkedIds=new Set(eventIds);
  const events=(allEvents||[]).filter((row:any)=>linkedIds.has(String(row.id))||(orgId&&String(row.organization_id||'')===orgId));
  return NextResponse.json({events});
}
