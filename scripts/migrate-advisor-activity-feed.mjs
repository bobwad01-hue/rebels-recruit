import fs from 'node:fs';
const path='app/advisors/page.tsx';
let source=fs.readFileSync(path,'utf8');
const old="c.from('interactions').select('id,athlete_user_id,coach_id,college_id,type,date,date_precision,date_year,date_month,created_at,note,initiated_by,colleges(id,name),college_coaches(id,first_name,last_name)').in('athlete_user_id',accessible).order('date',{ascending:false,nullsFirst:false}).order('created_at',{ascending:false}).limit(4000)";
const replacement="c.rpc('get_staff_recruiting_activity',{target_organization_id:me.organization_id,max_rows:4000})";
if(!source.includes(old)) throw new Error('Expected Advisor Home interaction query was not found. Refusing unsafe migration.');
source=source.replace(old,replacement);
fs.writeFileSync(path,source);
console.log('Advisor Home recruiting activity now uses the authorized staff feed RPC.');