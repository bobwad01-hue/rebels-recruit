import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase-server';

const api='https://api.x.com/2';
async function xGet(path:string,token:string){const res=await fetch(`${api}${path}`,{headers:{Authorization:`Bearer ${token}`},cache:'no-store'});const json=await res.json();if(!res.ok)throw new Error(json?.detail||json?.title||`X API error ${res.status}`);return json;}

export async function GET(request:Request){
  const url=new URL(request.url);const code=url.searchParams.get('code');const state=url.searchParams.get('state');const error=url.searchParams.get('error');
  const cookieStore=await cookies();const expectedState=cookieStore.get('x_oauth_state')?.value;const verifier=cookieStore.get('x_oauth_verifier')?.value;cookieStore.delete('x_oauth_state');cookieStore.delete('x_oauth_verifier');
  if(error)return NextResponse.redirect(new URL(`/social?error=${encodeURIComponent(error)}`,request.url));
  if(!code||!state||state!==expectedState||!verifier)return NextResponse.redirect(new URL('/social?error=x_oauth_state',request.url));
  const clientId=process.env.X_CLIENT_ID;const clientSecret=process.env.X_CLIENT_SECRET;const redirectUri=process.env.X_REDIRECT_URI||new URL('/api/social/x/callback',request.url).toString();
  if(!clientId||!clientSecret)return NextResponse.redirect(new URL('/social?error=x_config',request.url));
  const body=new URLSearchParams({code,grant_type:'authorization_code',redirect_uri:redirectUri,code_verifier:verifier});
  const tokenRes=await fetch('https://api.x.com/2/oauth2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',Authorization:`Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`},body,cache:'no-store'});const tokenJson=await tokenRes.json();
  if(!tokenRes.ok)return NextResponse.redirect(new URL(`/social?error=${encodeURIComponent(tokenJson?.error_description||'x_token_exchange')}`,request.url));
  const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.redirect(new URL('/login',request.url));
  try{
    const me=await xGet('/users/me?user.fields=profile_image_url,description,public_metrics',tokenJson.access_token);const xUser=me.data;
    const {data:account,error:accountError}=await supabase.from('social_accounts').upsert({athlete_user_id:user.id,provider:'x',provider_user_id:xUser.id,username:xUser.username,display_name:xUser.name,profile_image_url:xUser.profile_image_url||null,profile_url:`https://x.com/${xUser.username}`,status:'connected',last_synced_at:new Date().toISOString()},{onConflict:'athlete_user_id,provider'}).select('id').single();
    if(accountError||!account)throw new Error(accountError?.message||'Could not save X account');
    const {error:secretError}=await supabase.from('social_account_secrets').upsert({social_account_id:account.id,athlete_user_id:user.id,access_token:tokenJson.access_token,refresh_token:tokenJson.refresh_token||null,expires_at:tokenJson.expires_in?new Date(Date.now()+tokenJson.expires_in*1000).toISOString():null,updated_at:new Date().toISOString()},{onConflict:'social_account_id'});if(secretError)throw new Error(secretError.message||'Could not save X connection credentials');
    const requests=[['posts',`/users/${xUser.id}/tweets?max_results=20&tweet.fields=created_at,public_metrics`],['followers',`/users/${xUser.id}/followers?max_results=100&user.fields=profile_image_url,public_metrics`],['following',`/users/${xUser.id}/following?max_results=100&user.fields=profile_image_url,public_metrics`]] as const;
    const results=await Promise.all(requests.map(async([name,path])=>{try{return {name,data:await xGet(path,tokenJson.access_token),error:null as string|null};}catch(e:any){return {name,data:null,error:e?.message||`X ${name} request failed`};}}));
    const failed=results.filter(r=>r.error);const posts=results.find(r=>r.name==='posts')!.data?.data||[];const followers=results.find(r=>r.name==='followers')!.data?.data||[];const following=results.find(r=>r.name==='following')!.data?.data||[];
    await supabase.from('social_posts').delete().eq('social_account_id',account.id);if(posts.length)await supabase.from('social_posts').insert(posts.map((p:any)=>({social_account_id:account.id,athlete_user_id:user.id,provider_post_id:p.id,text:p.text||null,posted_at:p.created_at||null,post_url:`https://x.com/${xUser.username}/status/${p.id}`,like_count:p.public_metrics?.like_count||0,reply_count:p.public_metrics?.reply_count||0,repost_count:p.public_metrics?.retweet_count||0,view_count:p.public_metrics?.impression_count||0})));
    const followingIds=new Set(following.map((u:any)=>u.id));const followerIds=new Set(followers.map((u:any)=>u.id));const merged=new Map<string,any>();followers.forEach((u:any)=>merged.set(u.id,{...u,follows_athlete:true,athlete_follows:followingIds.has(u.id)}));following.forEach((u:any)=>merged.set(u.id,{...u,follows_athlete:followerIds.has(u.id),athlete_follows:true}));
    await supabase.from('social_connections').delete().eq('social_account_id',account.id);const connections=Array.from(merged.values());if(connections.length)await supabase.from('social_connections').insert(connections.map((u:any)=>({social_account_id:account.id,athlete_user_id:user.id,provider_user_id:u.id,username:u.username||null,display_name:u.name||null,profile_image_url:u.profile_image_url||null,profile_url:u.username?`https://x.com/${u.username}`:null,follows_athlete:!!u.follows_athlete,athlete_follows:!!u.athlete_follows,last_seen_at:new Date().toISOString()})));
    await supabase.from('social_accounts').update({status:failed.length?'connected_with_warnings':'connected',last_synced_at:new Date().toISOString()}).eq('id',account.id).eq('athlete_user_id',user.id);
    const warning=failed.length?failed.map(r=>`${r.name}: ${r.error}`).join(' | '):'';return NextResponse.redirect(new URL(`/social?connected=x${warning?`&sync_warning=${encodeURIComponent(warning)}`:''}`,request.url));
  }catch(e:any){return NextResponse.redirect(new URL(`/social?error=${encodeURIComponent(e?.message||'x_sync_failed')}`,request.url));}
}
