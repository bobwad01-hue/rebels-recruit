import AppShell from '@/components/AppShell';
import ConnectionsBoard from '@/components/ConnectionsBoard';
import PageHeader from '@/components/PageHeader';
import {EmptyState,PageFrame,StatePanel} from '@/components/ProductUI';
import {createClient} from '@/lib/supabase-server';
import {resolveOwnerPreview} from '@/lib/owner-preview';
import AthleteTopFive from '@/components/AthleteTopFive';

export default async function Connections({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const supabase=await createClient();
 const {data:{user},error:authError}=await supabase.auth.getUser();
 if(authError)return <AppShell><PageFrame size="5xl"><StatePanel tone="error" title="Connections unavailable" description="We could not verify your account. Refresh the page and try again."/></PageFrame></AppShell>;
 const sp=await searchParams;
 const preview=user?await resolveOwnerPreview(supabase,user.id,sp):{active:false,role:null,athleteId:null};
 const athleteId=preview.active&&preview.role==='athlete'&&preview.athleteId?preview.athleteId:user?.id;
 if(!athleteId)return <AppShell><PageFrame size="5xl"><StatePanel tone="error" title="Sign in to review Connections" description="Your recruiting relationships are available after you sign in."/></PageFrame></AppShell>;
 const [colleges,coaches,actions,memberships]=await Promise.all([
  supabase.from('athlete_colleges').select('id,athlete_user_id,status,fit_rating,created_at,archived_at,archived_reason,colleges(id,name,division,state,city,conference)').eq('athlete_user_id',athleteId).order('created_at',{ascending:false}),
  supabase.from('athlete_coaches').select('id,relationship_rating,last_contact_date,next_step,created_at,college_id,archived_at,archived_reason,colleges(id,name,state,city,division,conference),college_coaches(id,first_name,last_name,title,email,phone)').eq('athlete_user_id',athleteId).order('created_at',{ascending:false}),
  supabase.from('gmail_recruiting_messages').select('interaction_id,coach_id,college_id,recruiting_intent,next_action,action_due_date,action_state,action_required,action_updated_at,received_at').eq('athlete_user_id',athleteId).eq('action_required',true).order('received_at',{ascending:false}),
  supabase.from('organization_members').select('organization_id').eq('user_id',athleteId).eq('role','athlete').eq('status','active').limit(1)
 ]);
 if(colleges.error||coaches.error||actions.error){console.error('Connections relationship load failed',colleges.error||coaches.error||actions.error);return <AppShell><PageFrame size="5xl"><StatePanel tone="error" title="Connections could not be loaded" description="We could not load your recruiting relationships. Your data has not been changed. Refresh the page and try again."/></PageFrame></AppShell>}
 const orgId=memberships.data?.[0]?.organization_id||'';let topFive:any[]=[];if(orgId){const r=await supabase.from('athlete_school_rankings').select('college_id,rank').eq('athlete_user_id',athleteId).eq('organization_id',orgId).eq('list_type','athlete_top').order('rank');topFive=r.data||[]}
 const schoolOptions=(colleges.data||[]).filter((x:any)=>!x.archived_at).map((x:any)=>({id:x.college_id,name:Array.isArray(x.colleges)?x.colleges[0]?.name:x.colleges?.name})).filter((x:any)=>x.id&&x.name);
 const noRelationships=(colleges.data||[]).length===0&&(coaches.data||[]).length===0;
 if(noRelationships)return <AppShell><PageFrame><PageHeader eyebrow="YOUR RECRUITING RELATIONSHIPS" title="Connections" subtitle="Keep the schools you are pursuing and the coaches you know in one place."/><div className="mt-5"><EmptyState title="Start with one school" description="Add the first school you want to pursue. Once it is in Connections, you can add coaches, log conversations, and see what to do next." href="/colleges/new" actionLabel="Add Your First School"/></div></PageFrame></AppShell>;
 return <AppShell><PageFrame><PageHeader eyebrow="YOUR RECRUITING RELATIONSHIPS" title="Connections" subtitle="See where each school and coach relationship stands, then act on the one that needs attention."/><div className="mt-5">{orgId&&<AthleteTopFive athleteId={athleteId} orgId={orgId} schools={schoolOptions} initial={topFive}/>}<ConnectionsBoard initialColleges={colleges.data||[]} initialCoaches={coaches.data||[]} initialActions={actions.data||[]}/></div></PageFrame></AppShell>;
}
