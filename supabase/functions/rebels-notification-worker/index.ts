import postgres from 'npm:postgres@3.4.5';
import webpush from 'npm:web-push@3.6.7';

const sql = postgres(Deno.env.get('SUPABASE_DB_URL')!, { max: 1, prepare: false });
const VAPID_PUBLIC_KEY = 'BMBT6hH2_JTlpzZwVR3P2WWHov3-htCifqaJXDKBb77SiQvTClLPzGhvqw9G6rio-aYhiXfhapWhIEOm5BO9dgI';
const VAPID_SUBJECT = 'https://rebels-recruit.vercel.app';

async function getSecret(name: string) {
  const rows = await sql<{ decrypted_secret: string }[]>`select decrypted_secret from vault.decrypted_secrets where name = ${name} limit 1`;
  return rows[0]?.decrypted_secret ?? null;
}

async function queueDueNotifications() {
  await sql`
    insert into public.notifications (user_id,title,body,kind,url,data,dedupe_key)
    select r.owner_user_id,
      case when r.due_date < current_date then 'Overdue recruiting reminder' else 'Recruiting reminder due today' end,
      r.title,'reminder','/reminders',jsonb_build_object('reminder_id',r.id),
      'reminder-due:'||r.id::text||':'||r.due_date::text
    from public.reminders r
    where r.status='open' and r.owner_user_id is not null and r.due_date<=current_date
    on conflict (user_id,dedupe_key) do nothing
  `;

  await sql`
    insert into public.notifications (user_id,title,body,kind,url,data,dedupe_key)
    select t.assigned_to_user_id,
      case when t.due_date < current_date then 'Overdue recruiting task' else 'Recruiting task due today' end,
      t.title,'task','/advisors/tasks',jsonb_build_object('task_id',t.id),
      'task-due:'||t.id::text||':'||t.due_date::text
    from public.advisor_tasks t
    where t.status='open' and t.assigned_to_user_id is not null and t.due_date is not null and t.due_date<=current_date
    on conflict (user_id,dedupe_key) do nothing
  `;
}

function preferenceEnabled(kind:string,prefs:Record<string,boolean>){
  if(kind==='message')return prefs.messages!==false;
  if(kind==='task')return prefs.tasks!==false;
  if(kind==='reminder')return prefs.reminders!==false;
  if(kind==='advisor_activity')return prefs.advisor_activity!==false;
  return true;
}

async function processNotification(notification:any){
  const prefsRows=await sql<any[]>`select messages,tasks,reminders,advisor_activity from public.notification_preferences where user_id=${notification.user_id} limit 1`;
  const prefs=prefsRows[0]??{};
  if(!preferenceEnabled(notification.kind,prefs)){
    await sql`update public.notifications set push_sent_at=now(),push_error=null where id=${notification.id}`;
    return {id:notification.id,sent:0,skipped:true};
  }

  const subscriptions=await sql<any[]>`select id,endpoint,p256dh,auth from public.push_subscriptions where user_id=${notification.user_id}`;
  if(!subscriptions.length){
    await sql`update public.notifications set push_sent_at=now(),push_error='No push subscription for this user' where id=${notification.id}`;
    return {id:notification.id,sent:0,skipped:true};
  }

  const payload=JSON.stringify({
    title:notification.title||'Rebels Recruit',
    body:notification.body||'You have a new recruiting update.',
    url:notification.url||'/dashboard',
    kind:notification.kind||'general',
    data:notification.data||{}
  });

  let sent=0;const errors:string[]=[];
  for(const subscription of subscriptions){
    try{
      await webpush.sendNotification(
        {endpoint:subscription.endpoint,keys:{p256dh:subscription.p256dh,auth:subscription.auth}},
        payload,
        {TTL:3600,urgency:notification.kind==='message'?'high':'normal'}
      );
      sent++;
      await sql`update public.push_subscriptions set last_seen_at=now(),updated_at=now() where id=${subscription.id}`;
    }catch(error:any){
      const status=Number(error?.statusCode||0);
      errors.push(String(error?.body||error?.message||error));
      if(status===404||status===410)await sql`delete from public.push_subscriptions where id=${subscription.id}`;
    }
  }

  await sql`update public.notifications set push_sent_at=now(),push_error=${errors.length?errors.slice(0,2).join(' | ').slice(0,1000):null} where id=${notification.id}`;
  return {id:notification.id,sent,errors:errors.length};
}

Deno.serve(async(req)=>{
  try{
    const configuredSecret=await getSecret('rebels_notification_cron_secret');
    if(!configuredSecret||req.headers.get('x-rebels-cron-secret')!==configuredSecret)return Response.json({error:'Unauthorized'},{status:401});
    const privateKey=await getSecret('rebels_vapid_private_key');
    if(!privateKey)return Response.json({error:'VAPID private key is not configured'},{status:500});
    webpush.setVapidDetails(VAPID_SUBJECT,VAPID_PUBLIC_KEY,privateKey);

    await queueDueNotifications();
    const body=await req.json().catch(()=>({}));
    const notificationId=body?.notification_id;
    const notifications=notificationId
      ? await sql<any[]>`select id,user_id,title,body,kind,url,data from public.notifications where id=${notificationId} and push_sent_at is null and scheduled_for<=now()`
      : await sql<any[]>`select id,user_id,title,body,kind,url,data from public.notifications where push_sent_at is null and scheduled_for<=now() order by created_at asc limit 100`;

    const results=[];
    for(const notification of notifications)results.push(await processNotification(notification));
    return Response.json({ok:true,processed:results.length,results});
  }catch(error:any){
    console.error('notification worker error',error);
    return Response.json({error:String(error?.message||error)},{status:500});
  }
});
