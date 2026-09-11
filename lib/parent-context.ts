export type ParentViewContext={athleteId:string;permissions:Record<string,any>;preview:boolean;accessId?:string};
const ALL_PARENT_PREVIEW_PERMISSIONS={view_discovery:true,view_connections:true,view_activity:true,view_events:true,view_fit:true,view_progress:true,view_videos:true,view_game_plan:true,manage_calendar:false};
const STORAGE_KEY='rr-parent-athlete';
export async function resolveParentView(c:any,preferredAthleteId?:string|null):Promise<ParentViewContext|null>{
 const {data:{user}}=await c.auth.getUser();if(!user)return null;
 const sp=typeof window!=='undefined'?new URLSearchParams(window.location.search):new URLSearchParams();
 const previewRole=sp.get('previewRole'),previewAthlete=sp.get('previewAthlete');
 if(previewRole==='parent'&&previewAthlete){const{data:ownerMemberships}=await c.from('organization_members').select('organization_id,role').eq('user_id',user.id).eq('status','active');const ownerOrgIds=(ownerMemberships||[]).filter((m:any)=>m.role==='owner').map((m:any)=>m.organization_id);if(ownerOrgIds.length){const{data:t}=await c.from('organization_members').select('user_id,organization_id').in('organization_id',ownerOrgIds).eq('user_id',previewAthlete).eq('role','athlete').eq('status','active').limit(1);if(t?.length)return{athleteId:previewAthlete,permissions:ALL_PARENT_PREVIEW_PERMISSIONS,preview:true}}}
 const {data}=await c.from('parent_guardian_access').select('id,athlete_user_id,permissions').eq('parent_user_id',user.id).eq('status','active').order('created_at',{ascending:true});const rows=data||[];
 const queryAthlete=sp.get('athlete');const stored=typeof window!=='undefined'?window.localStorage.getItem(STORAGE_KEY):null;const requested=preferredAthleteId||queryAthlete||stored;const selected=requested?rows.find((x:any)=>String(x.athlete_user_id)===String(requested)):rows[0];if(!selected)return null;
 if(typeof window!=='undefined')window.localStorage.setItem(STORAGE_KEY,String(selected.athlete_user_id));
 return{athleteId:String(selected.athlete_user_id),permissions:selected.permissions||{},preview:false,accessId:selected.id};
}
export function parentCan(ctx:ParentViewContext|null,key:string){return !!ctx&&ctx.permissions?.[key]!==false}
