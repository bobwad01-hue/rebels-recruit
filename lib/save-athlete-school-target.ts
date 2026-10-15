import type {createClient} from '@/lib/supabase-browser';

type Client=ReturnType<typeof createClient>;

export type SchoolTargetSaveResult={
  id:string;
  action:'created'|'restored'|'already-active';
};

/**
 * Adds a recruiting school without ever duplicating or overwriting an athlete's
 * existing journey. A previously archived school is restored in place, so its
 * stage, ratings, notes and related history survive.
 */
export async function saveAthleteSchoolTarget(
  client:Client,
  {athleteId,collegeId,status='Researching',fitRating=null}:{
    athleteId:string;
    collegeId:string;
    status?:string;
    fitRating?:number|null;
  }
):Promise<SchoolTargetSaveResult>{
  if(!athleteId||!collegeId)throw new Error('Sign in and select a school before adding it.');

  const findExisting=async()=>{
    const {data,error}=await client.from('athlete_colleges')
      .select('id,archived_at')
      .eq('athlete_user_id',athleteId)
      .eq('college_id',collegeId)
      .maybeSingle();
    if(error)throw error;
    return data;
  };

  const restoreOrConfirm=async(existing:{id:string;archived_at:string|null}):Promise<SchoolTargetSaveResult>=>{
    if(!existing.archived_at)return {id:existing.id,action:'already-active'};
    const {data,error}=await client.from('athlete_colleges')
      .update({archived_at:null,archived_reason:null})
      .eq('id',existing.id)
      .eq('athlete_user_id',athleteId)
      .select('id')
      .single();
    if(error)throw error;
    return {id:data.id,action:'restored'};
  };

  const existing=await findExisting();
  if(existing)return restoreOrConfirm(existing);

  const {data,error}=await client.from('athlete_colleges')
    .insert({athlete_user_id:athleteId,college_id:collegeId,status,fit_rating:fitRating})
    .select('id')
    .single();
  if(!error&&data)return {id:data.id,action:'created'};

  // If another tab or device added the school after our lookup, reconcile the
  // unique-key collision rather than leaving a seemingly unresponsive button.
  if(error?.code==='23505'){
    const concurrent=await findExisting();
    if(concurrent)return restoreOrConfirm(concurrent);
  }
  throw error||new Error('The school could not be added. Please try again.');
}
