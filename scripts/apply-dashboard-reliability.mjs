import fs from 'node:fs';

const file='app/dashboard/page.tsx';
let s=fs.readFileSync(file,'utf8');
const before=s;

s=s.replace(
  "const {data:{user}}=await supabase.auth.getUser();const sp=await searchParams;",
  "const {data:{user},error:authError}=await supabase.auth.getUser();if(authError)return <AppShell><div className=\"max-w-5xl mx-auto px-5 py-8\"><div role=\"alert\" className=\"card p-6 border-red-200 bg-red-50\"><div className=\"font-black text-lg\">Home could not be loaded</div><p className=\"text-sm mt-2 text-red-700\">We could not verify your account. Refresh the page and try again.</p></div></div></AppShell>;if(!user)return <AppShell><div className=\"max-w-5xl mx-auto px-5 py-8\"><div className=\"card p-6\"><div className=\"font-black text-lg\">Sign in to review your recruiting home</div><p className=\"muted text-sm mt-2\">Your recruiting snapshot is available after you sign in.</p></div></div></AppShell>;const sp=await searchParams;"
);

s=s.replace(
  "]);\nconst activeColleges=",
  "]);const sourceIssues=[colleges.error&&'school relationships',interactions.error&&'recruiting activity',reminders.error&&'reminders',profile.error&&'profile details',coachRelationships.error&&'coach relationships',tasks.error&&'advisor-assigned Next Steps',athleteEvents.error&&'events',invitations.error&&'advisor requests',milestoneRows.error&&'Journey milestones'].filter(Boolean) as string[];if((interactions.data||[]).length===200)sourceIssues.push('older recruiting activity beyond the 200 most recent records used for this snapshot');\nconst activeColleges="
);

s=s.replace(
  "const {data:advisorProfiles}=advisorIds.length?await supabase.from('profiles').select('id,full_name,email').in('id',advisorIds):{data:[]};",
  "const {data:advisorProfiles,error:advisorProfilesError}=advisorIds.length?await supabase.from('profiles').select('id,full_name,email').in('id',advisorIds):{data:[],error:null};if(advisorProfilesError)sourceIssues.push('advisor names');"
);

s=s.replace(
  'return <AppShell><div className="w-full min-w-0 max-w-7xl mx-auto px-4 sm:px-5 md:px-8 py-5 sm:py-6"><PageHeader',
  'return <AppShell><div className="w-full min-w-0 max-w-7xl mx-auto px-4 sm:px-5 md:px-8 py-5 sm:py-6">{sourceIssues.length>0&&<div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">Some information is temporarily unavailable: {sourceIssues.join(\', \')}. Your Home is using the recruiting information that could be loaded.</div>}<PageHeader'
);

if(s===before)throw new Error('Athlete Home reliability migration made no changes.');
if(!s.includes('sourceIssues'))throw new Error('Athlete Home reliability issue tracking was not installed.');
fs.writeFileSync(file,s);
console.log('Athlete Home reliability migration applied.');
