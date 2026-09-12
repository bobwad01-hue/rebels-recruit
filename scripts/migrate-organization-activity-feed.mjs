import fs from 'node:fs';
const path='app/organization/OrganizationCommandCenter.tsx';
let source=fs.readFileSync(path,'utf8');
const stateOld="[msg,setMsg]=useState(''),[loading,setLoading]=useState(true);";
const stateNew="[msg,setMsg]=useState(''),[loading,setLoading]=useState(true),[loadError,setLoadError]=useState(''),[partialWarning,setPartialWarning]=useState(''),[activityAvailable,setActivityAvailable]=useState(true);";
if(!source.includes(stateOld)) throw new Error('Organization Command Center state anchor not found.');
source=source.replace(stateOld,stateNew);
const start=source.indexOf(' async function load(){');
const end=source.indexOf('\n useEffect(()=>{load()},[]);',start);
if(start<0||end<0) throw new Error('Organization Command Center load function anchors not found.');
const replacement=` async function load(){
  setLoading(true);setLoadError('');setPartialWarning('');setActivityAvailable(true);
  const {data:{user},error:authError}=await c.auth.getUser();
  if(authError){setLoadError('We could not verify your account. Refresh the page and try again.');setLoading(false);return}
  if(!user){setLoading(false);return}
  const membershipResult=await c.from('organization_members').select('*').eq('user_id',user.id).eq('status','active').limit(20);
  if(membershipResult.error){setLoadError('Organization access could not be loaded. Refresh the page and try again.');setLoading(false);return}
  const membershipRows=membershipResult.data||[];
  const m=membershipRows.find((x:any)=>['owner','admin'].includes(x.role))||membershipRows.find((x:any)=>x.organization_view_access)||membershipRows[0];
  setMe(m);if(!m){setLoading(false);return}
  const memberResult=await c.from('organization_members').select('*').eq('organization_id',m.organization_id);
  if(memberResult.error){setLoadError('The organization roster could not be loaded. Refresh the page and try again.');setLoading(false);return}
  const ms=memberResult.data||[];setMembers(ms);
  const ids=ms.map((x:any)=>x.user_id);
  const profileResult=ids.length?await c.from('profiles').select('id,full_name,email,app_role,advisor_type,created_at').in('id',ids):{data:[] as any[],error:null};
  const warnings:string[]=[];
  if((profileResult as any).error)warnings.push('some player and staff names');
  setProfiles((profileResult as any).data||[]);
  const athleteIds=ms.filter((x:any)=>x.role==='athlete'&&x.status==='active').map((x:any)=>x.user_id);
  if(!athleteIds.length){setColleges([]);setCoaches([]);setActivity([]);setTasks([]);setReminders([]);if(warnings.length)setPartialWarning('Some information is temporarily unavailable: '+warnings.join(', ')+'.');setLoading(false);return}
  const [ac,co,ints,ts,rs]=await Promise.all([
    c.from('athlete_colleges').select('id,athlete_user_id,status,fit_rating,college_id,colleges(id,name,division,state,conference)').in('athlete_user_id',athleteIds),
    c.from('athlete_coaches').select('id,athlete_user_id,coach_id,college_id,last_contact_date,next_step,colleges(id,name),college_coaches(id,first_name,last_name,title,email)').in('athlete_user_id',athleteIds),
    c.rpc('get_staff_recruiting_activity',{target_organization_id:m.organization_id,max_rows:2000}),
    c.from('advisor_tasks').select('id,athlete_user_id,created_by_user_id,status,due_date,title').in('athlete_user_id',athleteIds),
    c.from('reminders').select('id,athlete_user_id,status,due_date,title').in('athlete_user_id',athleteIds)
  ]);
  const take=(result:any,label:string)=>{if(result.error){warnings.push(label);return []}return result.data||[]};
  setColleges(take(ac,'school relationships'));setCoaches(take(co,'coach relationships'));
  if(ints.error){setActivity([]);setActivityAvailable(false);warnings.push('recruiting activity')}else{const rows=ints.data||[];setActivity(rows);if(rows.length===2000)warnings.push('older recruiting activity beyond the 2,000 most recent records')}
  setTasks(take(ts,'assigned Next Steps'));setReminders(take(rs,'follow-ups'));
  if(warnings.length)setPartialWarning('Some information is temporarily unavailable: '+warnings.join(', ')+'. The command center is using the information that could be loaded.');
  setLoading(false)
}`;
source=source.slice(0,start)+replacement+source.slice(end);
source=source.replace("const stale=athletes.filter(a=>{const d=lastByPlayer.get(a.user_id);return !d||(Date.now()-new Date(`${d}T12:00:00`).getTime())/86400000>14});","const stale=activityAvailable?athletes.filter(a=>{const d=lastByPlayer.get(a.user_id);return !d||(Date.now()-new Date(`${d}T12:00:00`).getTime())/86400000>14}):[];");
source=source.replace("if(loading)return <div className=\"card p-10 text-center muted\">Loading organization...</div>;","if(loading)return <div className=\"card p-10 text-center muted\">Loading organization...</div>;\n if(loadError)return <div role=\"alert\" className=\"card p-6 border-red-200 bg-red-50\"><div className=\"font-black\">Organization information is temporarily unavailable</div><p className=\"text-sm mt-2 text-red-700\">{loadError}</p><button className=\"btn mt-4\" onClick={load}>Try Again</button></div>;");
source=source.replace("return <><div className=\"flex gap-2 overflow-x-auto pb-2 mb-5 -mx-1 px-1\">","return <>{partialWarning&&<div role=\"status\" className=\"mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold\">{partialWarning}</div>}<div className=\"flex gap-2 overflow-x-auto pb-2 mb-5 -mx-1 px-1\">");
source=source.replace("{metric('Recorded Activity',activity.length,'activity')}","{metric('Recorded Activity',activityAvailable?activity.length:'—','activity')}");
source=source.replace("{metric('Need Follow-Up',stale.length,'players')}","{metric('Need Follow-Up',activityAvailable?stale.length:'—','players')}");
source=source.replace("<ActivityRows rows={activity.slice(0,12)} pm={pm}/>","{activityAvailable?<ActivityRows rows={activity.slice(0,12)} pm={pm}/>:<div className=\"rounded-xl border border-amber-200 bg-amber-50 p-4 mt-4 text-sm font-semibold\">Recruiting activity is temporarily unavailable, so recent activity and follow-up signals are not being shown as zero.</div>}");
fs.writeFileSync(path,source);
console.log('Organization Command Center now uses the authorized activity feed and protects against false-empty activity states.');