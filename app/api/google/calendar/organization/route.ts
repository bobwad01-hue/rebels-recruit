import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase-server';
import {createAdminClient} from '@/lib/supabase-admin';
import {getGoogleAccessToken} from '@/lib/google-workspace';

type CalendarItem={id:string;summary?:string;primary?:boolean;accessRole?:string;timeZone?:string};
type CalendarListResponse={items?:CalendarItem[];error?:{message?:string}};
type GoogleEvent={id:string;summary?:string;description?:string;location?:string;htmlLink?:string;start?:{date?:string;dateTime?:string};end?:{date?:string;dateTime?:string};extendedProperties?:{private?:Record<string,string>}};
type EventsResponse={items?:GoogleEvent[];error?:{message?:string};nextPageToken?:string};

type Source={organizationId:string;organizationName:string;calendarId:string;calendarName:string;timeZone?:string|null;connectedByUserId:string};

async function memberRows(c:any,userId:string,adminsOnly=false){
  let q=c.from('organization_members').select('organization_id,role,status,organizations(id,name)').eq('user_id',userId).eq('status','active');
  if(adminsOnly)q=q.in('role',['owner','admin']);
  const {data,error}=await q;
  if(error)throw new Error('Could not load organization access.');
  return data||[];
}

async function latestSource(admin:any,organizationId:string,organizationName:string):Promise<Source|null>{
  const {data,error}=await admin.from('audit_log')
    .select('action,metadata,created_at')
    .eq('organization_id',organizationId)
    .eq('entity_type','organization_google_calendar')
    .order('created_at',{ascending:false})
    .limit(1)
    .maybeSingle();
  if(error||!data||data.action!=='organization_google_calendar_set')return null;
  const m=(data.metadata||{}) as Record<string,any>;
  if(!m.calendar_id||!m.connected_by_user_id)return null;
  return {organizationId,organizationName,calendarId:String(m.calendar_id),calendarName:String(m.calendar_name||'Rebels Calendar'),timeZone:m.time_zone||null,connectedByUserId:String(m.connected_by_user_id)};
}

async function listCalendars(accessToken:string){
  const res=await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=250',{headers:{Authorization:`Bearer ${accessToken}`},cache:'no-store'});
  const data=await res.json() as CalendarListResponse;
  if(!res.ok)throw new Error(data.error?.message||'Google Calendar list could not be loaded.');
  return (data.items||[]).filter(x=>x.id&&x.accessRole&&x.accessRole!=='freeBusyReader');
}

function orgInfo(row:any){
  const org=Array.isArray(row.organizations)?row.organizations[0]:row.organizations;
  return {id:row.organization_id,name:org?.name||'Organization'};
}

export async function GET(req:NextRequest){
  const c=await createClient();
  const {data:{user}}=await c.auth.getUser();
  if(!user)return NextResponse.json({error:'Please sign in again.'},{status:401});
  const admin=createAdminClient();

  try{
    if(req.nextUrl.searchParams.get('mode')==='setup'){
      const rows=await memberRows(c,user.id,true);
      const organizations=rows.map(orgInfo);
      if(!organizations.length)return NextResponse.json({organizations:[],calendars:[],sources:[],canManage:false});
      const {accessToken}=await getGoogleAccessToken(user.id,'calendar');
      const calendars=await listCalendars(accessToken);
      const sources=(await Promise.all(organizations.map((o:any)=>latestSource(admin,o.id,o.name)))).filter(Boolean);
      return NextResponse.json({canManage:true,organizations,calendars:calendars.map(x=>({id:x.id,name:x.summary||x.id,primary:Boolean(x.primary),accessRole:x.accessRole,timeZone:x.timeZone||null})),sources});
    }

    const rows=await memberRows(c,user.id,false);
    const organizations=rows.map(orgInfo);
    const sources=(await Promise.all(organizations.map((o:any)=>latestSource(admin,o.id,o.name)))).filter(Boolean) as Source[];
    const now=new Date();
    const min=new Date(now);min.setDate(min.getDate()-90);
    const max=new Date(now);max.setFullYear(max.getFullYear()+2);
    const events:any[]=[];
    const warnings:string[]=[];

    for(const source of sources){
      try{
        const {accessToken}=await getGoogleAccessToken(source.connectedByUserId,'calendar');
        let pageToken:string|undefined;
        do{
          const p=new URLSearchParams({singleEvents:'true',orderBy:'startTime',timeMin:min.toISOString(),timeMax:max.toISOString(),maxResults:'2500'});
          if(pageToken)p.set('pageToken',pageToken);
          const res=await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(source.calendarId)}/events?${p}`,{headers:{Authorization:`Bearer ${accessToken}`},cache:'no-store'});
          const data=await res.json() as EventsResponse;
          if(!res.ok)throw new Error(data.error?.message||'Calendar events could not be loaded.');
          for(const e of data.items||[]){
            if(e.extendedProperties?.private?.rrManaged==='true')continue;
            const start=e.start?.date||e.start?.dateTime||'';
            if(!start)continue;
            events.push({id:`google:${source.organizationId}:${e.id}`,googleEventId:e.id,organizationId:source.organizationId,organizationName:source.organizationName,calendarName:source.calendarName,name:e.summary||'Calendar event',date:start.slice(0,10),start:e.start,end:e.end,location:e.location||null,description:e.description||null,url:e.htmlLink||null,source:'organization_google_calendar',readOnly:true});
          }
          pageToken=data.nextPageToken;
        }while(pageToken);
      }catch(error){warnings.push(`${source.organizationName}: ${error instanceof Error?error.message:'Calendar unavailable.'}`)}
    }
    events.sort((a,b)=>String(a.date).localeCompare(String(b.date)));
    return NextResponse.json({events,sources:sources.map(s=>({organizationId:s.organizationId,organizationName:s.organizationName,calendarName:s.calendarName})),warnings});
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:'Organization Calendar could not be loaded.'},{status:500});
  }
}

export async function POST(req:NextRequest){
  const c=await createClient();
  const {data:{user}}=await c.auth.getUser();
  if(!user)return NextResponse.json({error:'Please sign in again.'},{status:401});
  let payload:any;try{payload=await req.json()}catch{return NextResponse.json({error:'Invalid request.'},{status:400})}
  const organizationId=String(payload?.organizationId||'');
  const calendarId=String(payload?.calendarId||'');
  if(!organizationId||!calendarId)return NextResponse.json({error:'Organization and calendar are required.'},{status:400});
  try{
    const rows=await memberRows(c,user.id,true);
    const row=rows.find((r:any)=>r.organization_id===organizationId);
    if(!row)return NextResponse.json({error:'Only an organization owner or admin can choose the organization calendar.'},{status:403});
    const {accessToken}=await getGoogleAccessToken(user.id,'calendar');
    const calendars=await listCalendars(accessToken);
    const selected=calendars.find(x=>x.id===calendarId);
    if(!selected)return NextResponse.json({error:'That Google Calendar is not available to this account.'},{status:400});
    const org=orgInfo(row);
    const admin=createAdminClient();
    const {error}=await admin.from('audit_log').insert({organization_id:organizationId,actor_user_id:user.id,action:'organization_google_calendar_set',entity_type:'organization_google_calendar',entity_id:organizationId,metadata:{calendar_id:selected.id,calendar_name:selected.summary||selected.id,time_zone:selected.timeZone||null,connected_by_user_id:user.id,read_only_import:true}});
    if(error)throw new Error('Could not save the organization calendar selection.');
    return NextResponse.json({ok:true,source:{organizationId,organizationName:org.name,calendarId:selected.id,calendarName:selected.summary||selected.id,timeZone:selected.timeZone||null}});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Could not save organization calendar.'},{status:500})}
}

export async function DELETE(req:NextRequest){
  const c=await createClient();
  const {data:{user}}=await c.auth.getUser();
  if(!user)return NextResponse.json({error:'Please sign in again.'},{status:401});
  let payload:any;try{payload=await req.json()}catch{return NextResponse.json({error:'Invalid request.'},{status:400})}
  const organizationId=String(payload?.organizationId||'');
  try{
    const rows=await memberRows(c,user.id,true);
    if(!rows.some((r:any)=>r.organization_id===organizationId))return NextResponse.json({error:'Only an organization owner or admin can remove the organization calendar.'},{status:403});
    const admin=createAdminClient();
    const {error}=await admin.from('audit_log').insert({organization_id:organizationId,actor_user_id:user.id,action:'organization_google_calendar_removed',entity_type:'organization_google_calendar',entity_id:organizationId,metadata:{removed_by_user_id:user.id}});
    if(error)throw new Error('Could not remove the organization calendar selection.');
    return NextResponse.json({ok:true});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Could not remove organization calendar.'},{status:500})}
}
