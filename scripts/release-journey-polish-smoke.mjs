import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');
const parent = read('app/parent/journey/page.tsx');
const athlete = read('app/journey/page.tsx');
const shared = read('components/JourneyEntryContent.tsx');
const migration = read('supabase/migrations/20261012210000_parent_journey_details.sql');

assert.match(parent,/rpc\('get_parent_journey_details'/,'Parent Journey must load authorized detailed feed');
assert.match(parent,/parentCan\(ctx,'view_activity'\)/,'Parent Journey must check approved connection');
assert.match(parent,/<JourneyEntryDetails entry=\{x\}/,'Parent Journey uses shared structured details');
assert.match(parent,/<JourneyEntryPreview entry=\{x\}/,'Parent Journey shows collapsed context');
assert.match(parent,/className="btn py-2 px-3 text-sm"><School/,'Parent school links remain');
assert.doesNotMatch(parent,/\.from\('interactions'\)\.(insert|update|delete)/,'Parent Journey must remain read-only');
assert.doesNotMatch(parent,/\/activity\/.*\/edit/,'Parent Journey must not expose edit actions');

assert.match(athlete,/<JourneyEntryDetails entry=\{i\}/,'Athlete Journey uses same structured details');
assert.match(athlete,/<JourneyEntryPreview entry=\{i\}/,'Athlete Journey shows collapsed context');
assert.match(athlete,/\/activity\/'\+i.id\+'\/edit'/,'Athlete retains editing controls');
assert.match(athlete,/onClick=\{\(\)=>remove\(i.id\)\}/,'Athlete retains delete controls');
assert.match(athlete,/<RecruitingActionCard /,'Athlete keeps recruiting intelligence actions');

assert.match(shared,/whitespace-pre-wrap/,'Recorded email paragraphs must be preserved');
assert.match(shared,/No message body was recorded/,'Do not invent missing email bodies');
assert.match(shared,/Coaches\\s\+spoken\\s\+with/,'Debriefs must recognize coaches spoken with');
assert.match(shared,/Event Debrief/,'Debrief layout must use recorded fields');
assert.match(migration,/parent_can_view_athlete\(target_athlete_id, 'view_activity'\)/,'RPC must verify approved athlete access');
assert.match(migration,/revoke all on function public\.get_parent_journey_details\(uuid\) from public, anon/,'RPC must not allow anonymous calls');
assert.match(migration,/grant execute on function public\.get_parent_journey_details\(uuid\) to authenticated/,'Approved signed-in users must be able to call RPC');
assert.match(migration,/i\.email_subject, i\.email_type, i\.email_content/,'RPC must supply structured email data');

console.log('Journey polish and Parent read-only regression checks passed.');
