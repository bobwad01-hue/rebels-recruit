import fs from 'node:fs';
const file='app/events/page.tsx';
let s=fs.readFileSync(file,'utf8');
const before=s;

s=s.replace(
  "[driveTimes,setDriveTimes]=useState<Record<string,DriveTime>>({}),[distanceError,setDistanceError]=useState('');",
  "[driveTimes,setDriveTimes]=useState<Record<string,DriveTime>>({}),[distanceError,setDistanceError]=useState(''),[loading,setLoading]=useState(true),[loadError,setLoadError]=useState(''),[partialWarning,setPartialWarning]=useState('');"
);

s=s.replace(
  "async function load(){const {data}=await c.from('events').select('*,colleges(name,division)').order('date');setRows(data||[])}",
  "async function load(){const {data,error}=await c.from('events').select('*,colleges(name,division)').order('date');if(error){setLoadError('Recruiting events could not be loaded. Refresh the page and try again.');setRows([]);return false}setRows(data||[]);return true}"
);

s=s.replace(
  "async function loadAllColleges(){let from=0;const all:any[]=[];while(true){const {data,error}=await c.from('colleges').select('id,name,division').order('name').range(from,from+999);if(error)break;const batch=data||[];all.push(...batch);if(batch.length<1000)break;from+=1000;if(from>=20000)break}setColleges(all)}",
  "async function loadAllColleges(){let from=0;const all:any[]=[];while(true){const {data,error}=await c.from('colleges').select('id,name,division').order('name').range(from,from+999);if(error){setPartialWarning(w=>[w,'School matching and division filters are temporarily unavailable.'].filter(Boolean).join(' '));setColleges(all);return}const batch=data||[];all.push(...batch);if(batch.length<1000)break;from+=1000;if(from>=20000){setPartialWarning(w=>[w,'School matching is using the first 20,000 directory records.'].filter(Boolean).join(' '));break}}setColleges(all)}"
);

s=s.replace(
  "async function loadOrgEvents(){try{const res=await fetch('/api/google/calendar/organization',{cache:'no-store'});let data:any={};try{data=await res.json()}catch{}if(res.ok){setOrgEvents(data.events||[]);setOrgSources(data.sources||[]);setOrgWarnings(data.warnings||[])}}catch{}}",
  "async function loadOrgEvents(){try{const res=await fetch('/api/google/calendar/organization',{cache:'no-store'});let data:any={};try{data=await res.json()}catch{}if(res.ok){setOrgEvents(data.events||[]);setOrgSources(data.sources||[]);setOrgWarnings(data.warnings||[])}else{setOrgEvents([]);setOrgSources([]);setOrgWarnings(['Organization calendar events are temporarily unavailable.'])}}catch{setOrgEvents([]);setOrgSources([]);setOrgWarnings(['Organization calendar events are temporarily unavailable.'])}}"
);

s=s.replace(
  "useEffect(()=>{(async()=>{const {data:{user}}=await c.auth.getUser();await Promise.all([load(),loadOrgEvents(),loadAllColleges()]);if(user){const {data}=await c.from('google_workspace_connections').select('calendar_connected,connected_at').eq('user_id',user.id).maybeSingle();setCalendarConnected(Boolean(data?.calendar_connected));setCalendarConnectedAt(data?.connected_at||'')}})()},[]);",
  "useEffect(()=>{(async()=>{setLoading(true);setLoadError('');setPartialWarning('');const {data:{user},error:authError}=await c.auth.getUser();if(authError){setLoadError('We could not verify your account. Refresh the page and try again.');setLoading(false);return}if(!user){setLoadError('Sign in to review and manage recruiting events.');setLoading(false);return}await Promise.all([load(),loadOrgEvents(),loadAllColleges()]);const calendarResult=await c.from('google_workspace_connections').select('calendar_connected,connected_at').eq('user_id',user.id).maybeSingle();if(calendarResult.error)setPartialWarning(w=>[w,'Google Calendar connection status is temporarily unavailable.'].filter(Boolean).join(' '));else{setCalendarConnected(Boolean(calendarResult.data?.calendar_connected));setCalendarConnectedAt(calendarResult.data?.connected_at||'')}setLoading(false)})()},[]);"
);

s=s.replace(
  "return <AppShell><div className=\"max-w-6xl mx-auto px-4 sm:px-5 md:px-8 py-5 sm:py-6\"><PageHeader title=\"Recruiting Events\" subtitle=\"Track camps, visits, calls, showcases, deadlines and other recruiting opportunities.\"/>",
  "return <AppShell><div className=\"max-w-6xl mx-auto px-4 sm:px-5 md:px-8 py-5 sm:py-6\"><PageHeader title=\"Recruiting Events\" subtitle=\"Track camps, visits, calls, showcases, deadlines and other recruiting opportunities.\"/>{loadError&&<div role=\"alert\" className=\"mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700\">{loadError}</div>}{partialWarning&&<div className=\"mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900\">Some information is temporarily unavailable. {partialWarning}</div>}{loading&&!loadError&&<div className=\"card p-6 mb-5 text-center muted\">Loading recruiting events...</div>}"
);

if(s===before)throw new Error('Events reliability migration made no changes.');
for(const marker of ['partialWarning','Recruiting events could not be loaded','Organization calendar events are temporarily unavailable'])if(!s.includes(marker))throw new Error(`Missing Events reliability marker: ${marker}`);
fs.writeFileSync(file,s);
console.log('Events reliability migration applied.');
