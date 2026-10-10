import {createServerClient} from '@supabase/ssr';import {NextResponse,type NextRequest} from 'next/server';
export async function middleware(request:NextRequest){let response=NextResponse.next({request});const supabase=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{cookies:{getAll:()=>request.cookies.getAll(),setAll:(cs)=>{cs.forEach(({name,value})=>request.cookies.set(name,value));response=NextResponse.next({request});cs.forEach(({name,value,options})=>response.cookies.set(name,value,options))}}});const pathname=request.nextUrl.pathname;if(/\.[a-zA-Z0-9]+$/.test(pathname)&&!pathname.startsWith('/api/'))return response;if(pathname==='/api/google/gmail/push'||pathname==='/api/google/gmail/sync'||pathname==='/api/cron/college-softball-staff')return response;if(pathname==='/intelligence'||pathname.startsWith('/intelligence/')){const url=request.nextUrl.clone();url.pathname=pathname.replace(/^\/intelligence/,'/insights');return NextResponse.redirect(url,308)}const {data:{user}}=await supabase.auth.getUser();
const {data:sessionProfileRaw}=user
  ?await supabase.rpc('current_account_access').maybeSingle()
  :{data:null};
const sessionProfile=sessionProfileRaw as {app_role?:string;account_status?:string;registration_status?:string}|null;
if(user&&sessionProfile?.account_status==='suspended'){
  if(pathname==='/account-suspended')return response;
  if(pathname.startsWith('/api/'))return NextResponse.json(
    {error:'This account is suspended. Contact RLTNL support.'},
    {status:403,headers:{'Cache-Control':'no-store'}},
  );
  return NextResponse.redirect(new URL('/account-suspended',request.url));
}
// Invite-only registration: no pending account may access app pages or
// service-role APIs before a real team or staff relationship is established.
// Auth callback, legal acceptance, and the join endpoint remain accessible.
if(user&&sessionProfile?.registration_status!=='active'){
  const pendingApiAllowed=pathname==='/api/join'||pathname==='/api/legal/accept'
    ||pathname==='/api/staff-invite';
  if(pathname.startsWith('/api/')&&!pendingApiAllowed){
    return NextResponse.json(
      {error:'A valid organization or team invitation is required before this account can use RLTNL Recruiting.'},
      {status:403,headers:{'Cache-Control':'no-store'}},
    );
  }
  const pendingPageAllowed=pathname==='/'||pathname==='/privacy'||pathname==='/terms'
    ||pathname==='/invitation-required'||pathname==='/account-suspended'
    ||pathname==='/legal/accept'||pathname==='/reset-password'
    ||pathname.startsWith('/auth/')||/^\/join\/[^/]+\/?$/.test(pathname);
  if(pendingPageAllowed||pendingApiAllowed)return response;
  if(pathname==='/login'||pathname==='/signup'){
    const token=request.nextUrl.searchParams.get('join_token');
    if(token)return NextResponse.redirect(new URL('/join/'+encodeURIComponent(token),request.url));
  }
  return NextResponse.redirect(new URL('/invitation-required',request.url));
}
const publicPaths=['/','/privacy','/terms','/account-suspended','/invitation-required'];const isPublicPath=publicPaths.includes(pathname)||pathname.startsWith('/login')||pathname.startsWith('/signup')||pathname.startsWith('/auth')||pathname.startsWith('/forgot-password')||pathname.startsWith('/reset-password');const isJoinLink=/^\/join\/[^/]+\/?$/.test(pathname);const publicInviteLookup=request.method==='GET'&&(pathname==='/api/join'||pathname==='/api/staff-invite');if(!user&&isJoinLink){const url=new URL('/signup',request.url);url.searchParams.set('join_token',decodeURIComponent(pathname.split('/')[2]));return NextResponse.redirect(url)}if(!user&&!isPublicPath&&!publicInviteLookup)return NextResponse.redirect(new URL('/login',request.url));if(user&&(pathname==='/login'||pathname==='/signup')){const token=request.nextUrl.searchParams.get('join_token');if(token)return NextResponse.redirect(new URL('/join/'+encodeURIComponent(token),request.url));const role=sessionProfile?.app_role||'athlete';return NextResponse.redirect(new URL(role==='athlete'?'/dashboard':role==='parent'?'/parent':'/advisors',request.url))}if(user){const role=sessionProfile?.app_role||'athlete';const previewRole=request.nextUrl.searchParams.get('previewRole');if(['athlete','parent','advisor','admin'].includes(String(previewRole))){const{data:platform}=await supabase.from('platform_roles').select('role').eq('user_id',user.id).eq('role','super_owner').maybeSingle();if(platform)return response}const isStaff=role==='advisor'||role==='admin'||role==='owner';const staffOnly=['/advisors','/organization','/exports'];const athleteOnly=['/dashboard','/profile','/colleges','/connections','/discover','/activity','/reminders','/social','/tasks','/manage-access','/family-access','/advisor-requests','/game-plan'];const parentOnly=['/parent'];const sharedAuthenticated=['/messages','/settings'];const parentForbidden=['/dashboard','/profile','/connections','/discover','/activity','/reminders','/social','/tasks','/manage-access','/family-access','/advisor-requests','/game-plan','/fit-profile','/compare','/events','/insights'];if(sharedAuthenticated.some(x=>pathname===x||pathname.startsWith(x+'/')))return response;if(role==='athlete'&&staffOnly.some(x=>pathname===x||pathname.startsWith(x+'/')))return NextResponse.redirect(new URL('/dashboard',request.url));if(role==='athlete'&&parentOnly.some(x=>pathname===x||pathname.startsWith(x+'/')))return NextResponse.redirect(new URL('/dashboard',request.url));if(role==='parent'&&staffOnly.some(x=>pathname===x||pathname.startsWith(x+'/')))return NextResponse.redirect(new URL('/parent',request.url));if(role==='parent'&&parentForbidden.some(x=>pathname===x||pathname.startsWith(x+'/')))return NextResponse.redirect(new URL('/parent',request.url));if(role==='parent'&&(pathname.startsWith('/colleges/')||pathname.startsWith('/coaches/')||pathname==='/videos')&&!request.nextUrl.searchParams.get('athlete'))return NextResponse.redirect(new URL('/parent',request.url));const staffRelationshipRoute=(pathname.startsWith('/colleges/')||pathname.startsWith('/coaches/'))&&(request.nextUrl.searchParams.get('staff')==='1'||!!request.nextUrl.searchParams.get('athlete'));if(isStaff&&athleteOnly.some(x=>pathname===x||pathname.startsWith(x+'/'))&&!staffRelationshipRoute)return NextResponse.redirect(new URL('/advisors',request.url));if(isStaff&&parentOnly.some(x=>pathname===x||pathname.startsWith(x+'/')))return NextResponse.redirect(new URL('/advisors',request.url))}return response}
export const config={matcher:['/((?!api/google/gmail/(?:push|sync)|_next/static|_next/image|favicon.ico).*)']};
