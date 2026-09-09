import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase-server';

const MAX_DESTINATIONS_PER_REQUEST=49;
type MatrixElement={destinationIndex?:number;distanceMeters?:number;duration?:string;condition?:string;status?:{code?:number;message?:string}};
function parseSeconds(duration?:string){if(!duration)return null;const match=duration.match(/^([0-9]+(?:\.[0-9]+)?)s$/);if(!match)return null;const seconds=Number(match[1]);return Number.isFinite(seconds)?seconds:null}

export async function POST(req:NextRequest){
 const c=await createClient();const {data:{user}}=await c.auth.getUser();if(!user)return NextResponse.json({error:'Please sign in again.'},{status:401});
 const {data:athlete}=await c.from('athlete_profiles').select('home_zip').eq('user_id',user.id).maybeSingle();
 const zip=String(athlete?.home_zip||'').trim();const origin=zip?`${zip}, USA`:null;
 if(!origin)return NextResponse.json({configured:true,origin:null,times:{},error:'Add your home ZIP in My Profile to see driving times from home.'});
 const apiKey=process.env.GOOGLE_MAPS_API_KEY;if(!apiKey)return NextResponse.json({configured:false,origin,times:{},error:'Driving-time estimates are not configured yet.'});
 let body:any;try{body=await req.json()}catch{return NextResponse.json({error:'Invalid request.'},{status:400})}
 const raw=Array.isArray(body?.locations)?body.locations:[];const normalized:string[]=raw.map((v:any)=>String(v||'').trim()).filter(Boolean);const locations:string[]=[...new Set(normalized)].slice(0,500);if(!locations.length)return NextResponse.json({configured:true,origin,times:{}});
 const times:Record<string,{minutes:number;distanceMiles:number}>={};
 try{for(let start=0;start<locations.length;start+=MAX_DESTINATIONS_PER_REQUEST){const chunk=locations.slice(start,start+MAX_DESTINATIONS_PER_REQUEST);const res=await fetch('https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix',{method:'POST',headers:{'Content-Type':'application/json','X-Goog-Api-Key':apiKey,'X-Goog-FieldMask':'destinationIndex,status,condition,distanceMeters,duration'},body:JSON.stringify({origins:[{waypoint:{address:origin}}],destinations:chunk.map(location=>({waypoint:{address:location}})),travelMode:'DRIVE',routingPreference:'TRAFFIC_UNAWARE',regionCode:'us'}),cache:'no-store'});const data=await res.json() as MatrixElement[]|{error?:{message?:string}};if(!res.ok)throw new Error(!Array.isArray(data)&&data.error?.message?data.error.message:'Google Routes API request failed.');if(!Array.isArray(data))continue;for(const item of data){if(item.condition!=='ROUTE_EXISTS'||item.status?.code)continue;const index=item.destinationIndex,seconds=parseSeconds(item.duration);if(index==null||seconds==null)continue;const location=chunk[index];if(location)times[location]={minutes:Math.round(seconds/60),distanceMiles:Math.round(((item.distanceMeters||0)/1609.344)*10)/10}}}return NextResponse.json({configured:true,origin,times})}catch(error){return NextResponse.json({configured:true,origin,times:{},error:error instanceof Error?error.message:'Driving times could not be loaded.'},{status:502})}
}
