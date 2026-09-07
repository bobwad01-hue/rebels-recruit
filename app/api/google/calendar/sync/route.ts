import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase-server';
import {getGoogleAccessToken} from '@/lib/google-workspace';

type EntityType='event'|'reminder';
type CalendarEvent={id?:string;summary?:string;extendedProperties?:{private?:Record<string,string>};error?:{message?:string}};

type CalendarList={items?:CalendarEvent[];error?:{message?:string}};

function nextDay(date:string){
  const d=new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate()+1);
  return d.toISOString().slice(0,10);
}

function calendarKey(entityType:EntityType,entityId:string){return `${entityType}:${entityId}`}

async function findManagedEvent(accessToken:string,key:string){
  const params=new URLSearchParams({privateExtendedProperty:`rrEntity=${key}`,maxResults:'5',singleEvents:'true'});
  const res=await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,{headers:{Authorization:`Bearer ${accessToken}`},cache:'no-store'});
  const data=await res.json() as CalendarList;
  if(!res.ok)throw new Error(data.error?.message||'Google Calendar could not be searched.');
  return (data.items||[]).find(item=>item.extendedProperties?.private?.rrManaged==='true')||null;
}

async function loadEntity(c:any,userId:string,entityType:EntityType,entityId:string){
  if(entityType==='event'){
    const {data,error}=await c.from('events').select('id,name,type,date,location,registration_url,college_id,colleges(name)').eq('id',entityId).maybeSingle();
    if(error||!data)throw new Error('Recruiting event could not be found.');
    if(!data.date)throw new Error('Recruiting event needs a date before it can sync.');
    const college=Array.isArray(data.colleges)?data.colleges[0]:data.colleges;
    return {
      summary:data.name,
      location:data.location||undefined,
      description:[data.type,college?.name,data.registration_url?'Registration / info: '+data.registration_url:null,'Managed by Rebels Recruit.'].filter(Boolean).join('\n'),
      start:{date:data.date},
      end:{date:nextDay(data.date)},
      extendedProperties:{private:{rrManaged:'true',rrEntity:calendarKey(entityType,entityId),rrUserId:userId}}
    };
  }

  const {data,error}=await c.from('reminders').select('id,owner_user_id,title,due_date,status,colleges(name),college_coaches(first_name,last_name)').eq('id',entityId).eq('owner_user_id',userId).maybeSingle();
  if(error||!data)throw new Error('Reminder could not be found.');
  if(!data.due_date)throw new Error('Reminder needs a due date before it can sync.');
  const college=Array.isArray(data.colleges)?data.colleges[0]:data.colleges;
  const coach=Array.isArray(data.college_coaches)?data.college_coaches[0]:data.college_coaches;
  const coachName=[coach?.first_name,coach?.last_name].filter(Boolean).join(' ');
  return {
    summary:data.title,
    description:[college?.name,coachName,'Recruiting follow-up managed by Rebels Recruit.'].filter(Boolean).join('\n'),
    start:{date:data.due_date},
    end:{date:nextDay(data.due_date)},
    extendedProperties:{private:{rrManaged:'true',rrEntity:calendarKey(entityType,entityId),rrUserId:userId}}
  };
}

export async function POST(req:NextRequest){
  const c=await createClient();
  const {data:{user}}=await c.auth.getUser();
  if(!user)return NextResponse.json({error:'Please sign in again.'},{status:401});

  let payload:any;
  try{payload=await req.json()}catch{return NextResponse.json({error:'Invalid request.'},{status:400})}
  const entityType=payload?.entityType as EntityType;
  const entityId=String(payload?.entityId||'');
  if(!['event','reminder'].includes(entityType)||!entityId)return NextResponse.json({error:'Event or reminder is required.'},{status:400});

  try{
    const eventBody=await loadEntity(c,user.id,entityType,entityId);
    const {accessToken}=await getGoogleAccessToken(user.id,'calendar');
    const key=calendarKey(entityType,entityId);
    const existing=await findManagedEvent(accessToken,key);
    const url=existing?.id
      ?`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(existing.id)}`
      :'https://www.googleapis.com/calendar/v3/calendars/primary/events';
    const res=await fetch(url,{method:existing?.id?'PATCH':'POST',headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json'},body:JSON.stringify(eventBody),cache:'no-store'});
    const data=await res.json() as CalendarEvent;
    if(!res.ok||!data.id)return NextResponse.json({error:data.error?.message||'Google Calendar could not save the event.'},{status:502});
    return NextResponse.json({ok:true,action:existing?'updated':'created',googleEventId:data.id});
  }catch(error){
    const message=error instanceof Error?error.message:'Google Calendar sync failed.';
    const status=/not connected/i.test(message)?409:500;
    return NextResponse.json({error:message},{status});
  }
}

export async function DELETE(req:NextRequest){
  const c=await createClient();
  const {data:{user}}=await c.auth.getUser();
  if(!user)return NextResponse.json({error:'Please sign in again.'},{status:401});

  let payload:any;
  try{payload=await req.json()}catch{return NextResponse.json({error:'Invalid request.'},{status:400})}
  const entityType=payload?.entityType as EntityType;
  const entityId=String(payload?.entityId||'');
  if(!['event','reminder'].includes(entityType)||!entityId)return NextResponse.json({error:'Event or reminder is required.'},{status:400});

  try{
    if(entityType==='reminder'){
      const {data}=await c.from('reminders').select('id').eq('id',entityId).eq('owner_user_id',user.id).maybeSingle();
      if(!data)return NextResponse.json({error:'Reminder could not be found.'},{status:404});
    }
    const {accessToken}=await getGoogleAccessToken(user.id,'calendar');
    const existing=await findManagedEvent(accessToken,calendarKey(entityType,entityId));
    if(!existing?.id)return NextResponse.json({ok:true,deleted:false});
    const res=await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(existing.id)}`,{method:'DELETE',headers:{Authorization:`Bearer ${accessToken}`},cache:'no-store'});
    if(!res.ok&&res.status!==404){
      let data:any={};try{data=await res.json()}catch{}
      return NextResponse.json({error:data.error?.message||'Google Calendar could not delete the event.'},{status:502});
    }
    return NextResponse.json({ok:true,deleted:true});
  }catch(error){
    const message=error instanceof Error?error.message:'Google Calendar delete failed.';
    const status=/not connected/i.test(message)?409:500;
    return NextResponse.json({error:message},{status});
  }
}
