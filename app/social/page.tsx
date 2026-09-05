'use client'

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, ExternalLink, Instagram, RefreshCw, Users, X } from 'lucide-react';
import AppShell from '@/components/AppShell';
import PageHeader from '@/components/PageHeader';
import { createClient } from '@/lib/supabase-browser';

type Account={id:string;provider:string;username:string|null;display_name:string|null;profile_image_url:string|null;profile_url:string|null;status:string;last_synced_at:string|null};
type Post={id:string;text:string|null;posted_at:string|null;post_url:string|null;like_count:number;reply_count:number;repost_count:number;view_count:number;is_recruiting_related:boolean;is_tournament_related:boolean};
type Connection={id:string;username:string|null;display_name:string|null;profile_image_url:string|null;profile_url:string|null;follows_athlete:boolean;athlete_follows:boolean;category:string;college_id:string|null;coach_id:string|null};

const categoryLabel=(value:string)=>({college_coach:'College Coach',college_program:'College Program',softball_organization:'Softball Organization',player:'Player',other:'Other'}[value]||'Other');
const formatDate=(value:string|null)=>value?new Date(value).toLocaleString([], {month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'}):'—';

export default function SocialPage(){
  const supabase=createClient();
  const [account,setAccount]=useState<Account|null>(null);
  const [posts,setPosts]=useState<Post[]>([]);
  const [connections,setConnections]=useState<Connection[]>([]);
  const [loading,setLoading]=useState(true);
  const [refreshing,setRefreshing]=useState(false);
  const [filter,setFilter]=useState('all');
  const [error,setError]=useState<string|null>(null);

  const load=async()=>{
    setError(null);
    const {data:{user}}=await supabase.auth.getUser();
    if(!user){setLoading(false);return;}
    const [a,p,c]=await Promise.all([
      supabase.from('social_accounts').select('id,provider,username,display_name,profile_image_url,profile_url,status,last_synced_at').eq('athlete_user_id',user.id).eq('provider','x').maybeSingle(),
      supabase.from('social_posts').select('id,text,posted_at,post_url,like_count,reply_count,repost_count,view_count,is_recruiting_related,is_tournament_related').eq('athlete_user_id',user.id).order('posted_at',{ascending:false}).limit(20),
      supabase.from('social_connections').select('id,username,display_name,profile_image_url,profile_url,follows_athlete,athlete_follows,category,college_id,coach_id').eq('athlete_user_id',user.id).order('created_at',{ascending:false}).limit(500)
    ]);
    if(a.error||p.error||c.error)setError('We could not load your social data yet.');
    setAccount(a.data||null);setPosts((p.data||[]) as Post[]);setConnections((c.data||[]) as Connection[]);setLoading(false);
  };
  useEffect(()=>{load()},[]);
  const refresh=async()=>{setRefreshing(true);if(account){const response=await fetch('/api/social/x/sync',{method:'POST'});if(!response.ok){const body=await response.json().catch(()=>null);setError(body?.error||'X could not be refreshed.')}}await load();setRefreshing(false)};
  const filtered=useMemo(()=>filter==='all'?connections:connections.filter(c=>c.category===filter),[connections,filter]);
  const followers=connections.filter(c=>c.follows_athlete);
  const following=connections.filter(c=>c.athlete_follows);
  const notFollowingBack=following.filter(c=>!c.follows_athlete);
  const lastPost=posts[0];
  const engagement=posts.reduce((sum,p)=>sum+p.like_count+p.reply_count+p.repost_count,0);

  return <AppShell><div className="max-w-7xl mx-auto px-5 md:px-8 py-6">
    <PageHeader title="Social Media" subtitle="Keep your recruiting presence and coach connections in one place." action={<button onClick={refresh} className="btn btn-outline" disabled={refreshing}><RefreshCw size={17} className={refreshing?'animate-spin':''}/> Refresh</button>}/>
    {error&&<div className="mb-5 rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>}
    <section className="card p-5 mb-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3"><div className="h-11 w-11 rounded-full bg-black text-white flex items-center justify-center"><X size={22}/></div><div><div className="font-black text-lg">X</div><div className="muted text-sm">Your recruiting activity on X</div></div></div>
        {account?<div className="flex flex-wrap items-center gap-3"><span className={`inline-flex items-center gap-1.5 text-sm font-bold ${account.status==='needs_reauth'?'text-red-600':''}`}>{account.status==='connected'?<CheckCircle2 size={17}/>:<RefreshCw size={16}/>} {account.status==='connected'?'Connected':'Needs reauthorization'} {account.username&&`@${account.username}`}</span><Link href={account.profile_url||'#'} target="_blank" className="text-sm font-bold inline-flex items-center gap-1">View profile <ExternalLink size={14}/></Link></div>:<Link href="/api/social/x/connect" className="btn btn-red"><X size={17}/> Connect X</Link>}
      </div>
      {!account&&<div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm muted">Connect your X account to bring in your recent posts, followers, following, and recruiting-related activity. Live X access requires an approved X developer app and the required API access plan.</div>}
      {account&&<div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5"><div className="rounded-xl bg-slate-50 p-4"><div className="muted text-xs">Followers tracked</div><div className="font-black text-2xl mt-1">{followers.length}</div></div><div className="rounded-xl bg-slate-50 p-4"><div className="muted text-xs">Following tracked</div><div className="font-black text-2xl mt-1">{following.length}</div></div><div className="rounded-xl bg-slate-50 p-4"><div className="muted text-xs">Don’t follow back</div><div className="font-black text-2xl mt-1">{notFollowingBack.length}</div></div><div className="rounded-xl bg-slate-50 p-4"><div className="muted text-xs">Post engagement</div><div className="font-black text-2xl mt-1">{engagement}</div></div></div>}
      {account&&<div className="muted text-xs mt-4">Last synced {formatDate(account.last_synced_at)}</div>}
    </section>

    <div className="grid lg:grid-cols-3 gap-6">
      <section className="card p-5 lg:col-span-2"><div className="flex justify-between items-center"><div><h2 className="font-black text-lg">Recruiting Social Feed</h2><p className="muted text-sm">The latest social activity that matters to recruiting.</p></div><span className="text-xs muted">X</span></div>
        {loading?<div className="py-10 text-center muted">Loading social activity…</div>:!account?<div className="py-12 text-center"><Users size={28} className="mx-auto mb-3"/><div className="font-bold">Connect X to start tracking</div><p className="muted text-sm mt-1">Your social timeline will appear here.</p></div>:lastPost?<div className="mt-5 border rounded-xl p-4"><div className="flex items-center gap-2 text-sm font-bold"><Clock3 size={16}/> Last post</div><p className="mt-3 text-sm whitespace-pre-wrap">{lastPost.text||'Post text unavailable.'}</p><div className="muted text-xs mt-3">{formatDate(lastPost.posted_at)}</div><div className="flex flex-wrap gap-4 text-xs muted mt-3"><span>{lastPost.like_count} likes</span><span>{lastPost.reply_count} replies</span><span>{lastPost.repost_count} reposts</span>{lastPost.view_count>0&&<span>{lastPost.view_count} views</span>}</div>{lastPost.post_url&&<Link href={lastPost.post_url} target="_blank" className="inline-flex items-center gap-1 text-sm font-bold mt-4">Open post <ExternalLink size={14}/></Link>}</div>:<div className="py-12 text-center muted">No posts have been synced yet.</div>}
        {posts.length>1&&<div className="mt-6"><h3 className="font-bold">Posting history</h3><div className="mt-3 space-y-2">{posts.slice(1,8).map(p=><div key={p.id} className="border rounded-xl p-3"><div className="text-sm line-clamp-2">{p.text||'Post text unavailable.'}</div><div className="muted text-xs mt-2">{formatDate(p.posted_at)} · {p.like_count} likes · {p.reply_count} replies · {p.repost_count} reposts</div></div>)}</div></div>}
      </section>

      <section className="card p-5"><div><h2 className="font-black text-lg">Followers & Following</h2><p className="muted text-sm">See who is connected to you.</p></div>
        <div className="grid grid-cols-3 gap-2 mt-4"><div className="rounded-xl bg-slate-50 p-3 text-center"><div className="font-black text-lg">{followers.length}</div><div className="muted text-[11px]">Followers</div></div><div className="rounded-xl bg-slate-50 p-3 text-center"><div className="font-black text-lg">{following.length}</div><div className="muted text-[11px]">Following</div></div><div className="rounded-xl bg-slate-50 p-3 text-center"><div className="font-black text-lg">{notFollowingBack.length}</div><div className="muted text-[11px]">No follow back</div></div></div>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">{[['all','All'],['college_coach','Coaches'],['college_program','Programs'],['softball_organization','Organizations'],['player','Players']].map(([v,l])=><button key={v} onClick={()=>setFilter(v)} className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold ${filter===v?'bg-slate-900 text-white':'bg-slate-100 text-slate-600'}`}>{l}</button>)}</div>
        <div className="mt-4 space-y-3 max-h-[520px] overflow-auto">{filtered.length?filtered.slice(0,50).map(c=><div key={c.id} className="flex gap-3 items-center"><div className="h-9 w-9 rounded-full bg-slate-100 overflow-hidden shrink-0">{c.profile_image_url&&<img src={c.profile_image_url} alt="" className="h-full w-full object-cover"/>}</div><div className="min-w-0 flex-1"><div className="font-bold text-sm truncate">{c.display_name||c.username||'X user'}</div><div className="muted text-xs truncate">{c.username?`@${c.username}`:''} · {categoryLabel(c.category)}</div></div><div className="text-right text-[11px] font-bold">{c.follows_athlete&&c.athlete_follows?'Follows back':c.athlete_follows?'Not following back':c.follows_athlete?'Follows you':'—'}</div></div>):<div className="py-8 text-center muted text-sm">No matching connections yet.</div>}</div>
      </section>
    </div>

    <section className="card p-5 mt-6"><div className="flex items-center gap-3"><div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center"><Instagram size={19}/></div><div><h2 className="font-black">Instagram & TikTok</h2><p className="muted text-sm">Coming next in the same Social Media system.</p></div></div><div className="grid md:grid-cols-2 gap-4 mt-4"><div className="rounded-xl border p-4"><div className="font-bold">Instagram</div><p className="muted text-sm mt-1">Posts, followers, following and recruiting engagement.</p></div><div className="rounded-xl border p-4"><div className="font-bold">TikTok</div><p className="muted text-sm mt-1">Posting history, audience growth and recruiting activity.</p></div></div></section>
  </div></AppShell>
}
