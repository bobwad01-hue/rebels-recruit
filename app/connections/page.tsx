import AppShell from '@/components/AppShell';
import ConnectionsBoard from '@/components/ConnectionsBoard';
import PageHeader from '@/components/PageHeader';
import {EmptyState,PageFrame,StatePanel} from '@/components/ProductUI';
import {createClient} from '@/lib/supabase-server';
import {resolveOwnerPreview} from '@/lib/owner-preview';
import {contactedCoachIdsFromInteractions} from '@/lib/coach-contact-status';

export default async function Connections({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const supabase=await createClient();
 const {data:{user},error:authError}=await supabase.auth.getUser();
 if(authError)return <AppShell><PageFrame size="5xl"><StatePanel tone="error" title="Connections unavailable" description="We could not verify your account. Refresh the page and try again."/></PageFrame></AppShell>;
 const sp=await searchParams;
 const initialSearch=typeof sp.search==='string'?sp.search.slice(0,160):'';
 const preview=user?await resolveOwnerPreview(supabase,user.id,sp):{active:false,role:null,athleteId:null};
 const athleteId=preview.active&&preview.role==='athlete'&&preview.athleteId?preview.athleteId:user?.id;
 if(!athleteId)return <AppShell><PageFrame size="5xl"><StatePanel tone="error" title="Sign in to review Connections" description="Your recruiting relationships are available after you sign in."/></PageFrame></AppShell>;
 const [colleges,coaches,actions,memberships,athleteProfile,contactInteractions]=await Promise.all([
  supabase.from('athlete_colleges').select('id,athlete_user_id,status,fit_rating,created_at,archived_at,archived_reason,colleges(id,name,division,state,city,conference,website,logo_url)').eq('athlete_user_id',athleteId).order('created_at',{ascending:false}),
  supabase.from('athlete_coaches').select('id,relationship_rating,last_contact_date,next_step,created_at,college_id,archived_at,archived_reason,colleges(id,name,state,city,division,conference,website,logo_url),college_coaches(id,first_name,last_name,title,email,phone,contact_verification_needed)').eq('athlete_user_id',athleteId).order('created_at',{ascending:false}),
  supabase.from('gmail_recruiting_messages').select('interaction_id,coach_id,college_id,recruiting_intent,next_action,action_due_date,action_state,action_required,action_updated_at,received_at').eq('athlete_user_id',athleteId).eq('action_required',true).order('received_at',{ascending:false}),
  supabase.from('organization_members').select('organization_id').eq('user_id',athleteId).eq('role','athlete').eq('status','active').limit(1),
  supabase.from('athlete_profiles').select('class_year').eq('user_id',athleteId).maybeSingle(),
  supabase.from('interactions').select('coach_id,type,interaction_recipients(coach_id)').eq('athlete_user_id',athleteId).order('created_at',{ascending:false}).limit(2000)
 ]);
 if(colleges.error||coaches.error||actions.error){console.error('Connections relationship load failed',colleges.error||coaches.error||actions.error);return <AppShell><PageFrame size="5xl"><StatePanel tone="error" title="Connections could not be loaded" description="We could not load your recruiting relationships. Your data has not been changed. Refresh the page and try again."/></PageFrame></AppShell>}
 // The shared staff directory is separate from athlete_coaches. Load available
 // official/canonical staff for tracked schools without creating relationships.
 const trackedSchoolIds=[...new Set((colleges.data||[]).map((r:any)=>{
  const school=Array.isArray(r.colleges)?r.colleges[0]:r.colleges;
  return school?.id as string|undefined;
 }).filter((id):id is string=>Boolean(id)))];
 const availableStaff=trackedSchoolIds.length
  ?await supabase.from('college_coaches')
    .select('id,college_id,first_name,last_name,title,email,verification_status,contact_verification_needed,role_category,staff_sort_order')
    .in('college_id',trackedSchoolIds).eq('lifecycle_status','active')
    .order('last_name',{ascending:true}).limit(1000)
  :{data:[],error:null};
 if(availableStaff.error)console.error('Connections available staff load failed',availableStaff.error);
 if(contactInteractions.error)console.error('Connections contact status load failed',contactInteractions.error);
 const initialContactedCoachIds=contactedCoachIdsFromInteractions(contactInteractions.data||[]);
 const orgId=memberships.data?.[0]?.organization_id||'';const classYear=Number(athleteProfile.data?.class_year||0);const yearsAway=classYear?classYear-new Date().getFullYear():null;const recruitingStage=yearsAway===null?'build':yearsAway>=4?'explore':yearsAway===3?'build':yearsAway===2?'recruit':'decide';
 const noRelationships=(colleges.data||[]).length===0&&(coaches.data||[]).length===0;
 if(noRelationships)return <AppShell><PageFrame><PageHeader eyebrow="YOUR RECRUITING RELATIONSHIPS" title="Connections" subtitle="Keep the schools you are pursuing and the coaches you know in one place."/><div className="mt-5"><EmptyState title="Start with one school" description="Add the first school you want to pursue. Once it is in Connections, you can add coaches, log conversations, and see what to do next." href="/colleges/new" actionLabel="Add Your First School"/></div></PageFrame></AppShell>;
 return <AppShell><PageFrame><PageHeader eyebrow="YOUR RECRUITING RELATIONSHIPS" title="Connections" subtitle="Track target schools, save individual coach contacts, and see which coaches you have actually contacted."/><div className="mt-5"><ConnectionsBoard athleteId={athleteId} initialColleges={colleges.data||[]} initialCoaches={coaches.data||[]} initialAvailableCoaches={availableStaff.data||[]} initialActions={actions.data||[]} initialContactedCoachIds={initialContactedCoachIds} initialSearch={initialSearch} recruitingStage={recruitingStage}/></div></PageFrame></AppShell>;
}
