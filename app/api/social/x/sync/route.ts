import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

const api='https://api.x.com/2';
async function xGet(path:string,token:string){const res=await fetch(`${api}${path}`,{headers:{Authorization:`Bearer ${token}`},cache:'no-store'});const json=await res.json();if(!res.ok)throw new Error(json?.detail||json?.title||`X API error ${res.status}`);return json;}

export async function POST(request:Request){
  const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
  const {data:account}=await supabase.from('social_accounts').select('id,provider_user_id,username,status').eq('athlete_user_id',user.id).eq('provider','x').maybeSingle();
  if(!account)return NextResponse.json({error:'X is not connected'},{status:400});
  const {data:secret}=await supabase.from('social_account_secrets').select('access_token,refresh_token,expires_at').eq('social_account_id',account.id).maybeSingle();
  if(!secret?.access_token)return NextResponse.json({error:'X connection needs setup'},{status:400});
  try{
    const token=secret.access_token;const me=await xGet(`/users/${account.provider_user_id}?user.fields=profile_image_url,description,public_metrics`,token);
    const requests=[['posts',`/users/${account.provider_user_id}/tweets?max_results=20&tweet.fields=created_at,public_metrics`],['followers',`/users/${account.provider_user_id}/followers?max_results=100&user.fields=profile_image_url,public_metrics`],['following',`/users/${account.provider_user_id}/following?max_results=100&user.fields=profile_image_url,public_metrics`]] as const;
    const results=await Promise.all(requests.map(async([name,path])=>{try{return {name,data:await xGet(path,token),error:null as string|null};}catch(e:any){return {name,data:null,error:e?.message||`X ${name} request failed`};}}));
    const failed=results.filter(r=>r.error);const posts=results.find(r=>r.name==='posts')!.data?.data||[];const followers=results.find(r=>r.name==='followers')!.data?.data||[];const following=results.find(r=>r.name==='following')!.data?.data||[];
    await supabase.from('social_accounts').update({username:me.data?.username||account.username,display_name:me.data?.name||null,profile_image_url:me.data?.profile_image_url||null,status:failed.length?'connected_with_warnings':'connected',last_synced_at:new Date().toISOString()}).eq('id',account.id).eq('athlete_user_id',user.id);
    if(!results.find(r=>r.name==='posts')!.error){await supabase.from('social_posts').delete().eq('social_account_id',account.id);if(posts.length)await supabase.from('social_posts').insert(posts.map((p:any)=>({social_account_id:account.id,athlete_user_id:user.id,provider_post_id:p.id,text:p.text||null,posted_at:p.created_at||null,post_url:`https://x.com/${me.data?.username||account.username}/status/${p.id}`,like_count:p.public_metrics?.like_count||0,reply_count:p.public_metrics?.reply_count||0,repost_count:p.public_metrics?.retweet_count||0,view_count:p.public_metrics?.impression_count||0})));}
    if(!results.find(r=>r.name==='followers')!.error||!results.find(r=>r.name==='following')!.error){const followingIds=new Set(following.map((u:any)=>u.id));const followerIds=new Set(followers.map((u:any)=>u.id));const merged=new Map<string,any>();followers.forEach((u:any)=>merged.set(u.id,{...u,follows_athlete:true,athlete_follows:followingIds.has(u.id)}));following.forEach((u:any)=>merged.set(u.id,{...u,follows_athlete:followerIds.has(u.id),athlete_follows:true}));await supabase.from('social_connections').delete().eq('social_account_id',account.id);const connections=Array.from(merged.values());if(connections.length)await supabase.from('social_connections').insert(connections.map((u:any)=>({social_account_id:account.id,athlete_user_id:user.id,provider_user_id:u.id,username:u.username||null,display_name:u.name||null,profile_image_url:u.profile_image_url||null,profile_url:u.username?`https://x.com/${u.username}`:null,follows_athlete:!!u.follows_athlete,athlete_follows:!!u.athlete_follows,last_seen_at:new Date().toISOString()})));}
    if(failed.length)return NextResponse.json({ok:false,error:`X sync completed with errors: ${failed.map(r=>`${r.name}: ${r.error}`).join(' | ')}`,posts:posts.length,followers:followers.length,following:following.length},{status:502});
    return NextResponse.json({ok:true,posts:posts.length,followers:followers.length,following:following.length});
  }catch(e:any){await supabase.from('social_accounts').update({status:'needs_reauth'}).eq('id',account.id).eq('athlete_user_id',user.id);return NextResponse.json({error:e?.message||'X sync failed'},{status:502});}
}
