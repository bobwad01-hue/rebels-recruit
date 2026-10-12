import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const family=read('app/manage-access/FamilyAccessSection.tsx');
const page=read('app/manage-access/page.tsx');
const ctx=read('lib/parent-context.ts');
const calendar=read('app/api/calendar-subscriptions/route.ts');
const subscriptions=read('lib/calendar-subscriptions.ts');
const migration=read('supabase/migrations/20261012094500_parent_full_access.sql');
assert.doesNotMatch(family,/onChange=\{\(\)=>toggle\(/,'No granular parent toggles');
assert.match(family,/Full Parent \/ Guardian Access/,'Full access messaging');
assert.match(page,/full recruiting visibility/,'Athlete support team describes full access');
assert.match(ctx,/return !!ctx\}/,'Parent sections depend on active relationship, not individual flags');
assert.doesNotMatch(calendar,/permissions\?\.view_events===false/,'Subscribed events do not honor old event opt-outs');
assert.doesNotMatch(subscriptions,/permissions\?\.view_events!==false/,'Calendar subscriptions ignore old event flags');
assert.match(migration,/p.status = 'active'/,'Database requires active relationship');
assert.doesNotMatch(migration,/permission_key is null or/,'Database no longer checks section permissions');
console.log('Parent full-access smoke checks passed');

const parentHome=read('app/parent/page.tsx');
const preview=read('lib/calendar-preview.ts');
const rsvp=read('app/api/events/rsvp/route.ts');
const parentEvents=read('app/parent/events/page.tsx');
const parentConnect=read('app/parent/connect/page.tsx');
assert.match(subscriptions,/export async function athleteCalendarContext/,'Athlete calendar scope resolves active team roles and memberships');
assert.match(subscriptions,/activeTeamRoles\.has\(id\)/,'Revoked team roles do not grant calendar access');
assert.match(calendar,/await athleteCalendarContext\(parentAthlete\)/,'Parent calendar feed is scoped to the approved athlete');
assert.match(calendar,/if\(!access\)return fail/,'Unapproved parents cannot load athlete calendars');
assert.match(preview,/athleteCalendarContext\(athleteId\)/,'Super Owner parent preview uses team membership');
assert.match(rsvp,/await athleteCalendarContext\(parentAthlete\)/,'Attendance detail respects selected parent athlete');
assert.match(rsvp,/athleteScope\.organizationIds\.includes\(organizationId\)/,'Only active athletes can RSVP to their organizations');
assert.match(parentHome,/setOverview\(\{schools:schoolCount/,'Parent dashboard computes live summary metrics');
assert.match(parentHome,/sharedEventsPromise/,'Parent Home includes shared calendar events');
assert.match(parentEvents,/Parent \/ Guardian connection is not approved/,'No section-specific event permission language');
assert.doesNotMatch(parentConnect,/change permissions or revoke/,'Parent onboarding describes connection-wide revocation');
console.log('Parent event scope and dashboard smoke checks passed');

const signup = read('app/signup/page.tsx');
const appShell = read('components/AppShell.tsx');
const parentConnectPage = read('app/parent/connect/page.tsx');
const accessRequestPage = read('app/access-requests/page.tsx');
const accessRequestApi = read('app/api/access-requests/route.ts');
const parentGoals = read('app/parent/goals/page.tsx');
const parentConnections = read('app/parent/connections/page.tsx');
const parentJourney = read('app/parent/journey/page.tsx');
const player360 = read('app/players/[id]/page.tsx');
assert.doesNotMatch(signup,/No second code is needed/,'Signup should not explain redundant codes');
assert.match(appShell,/searchParams\.set\('athlete',parentAthlete\)/,'Parent navigation replaces existing athlete query instead of appending duplicates');
assert.match(parentConnectPage,/Only Athlete Can Restore/,'Revoked parent connections must not appear actionable');
assert.match(parentConnectPage,/duplicateAthleteKeys/,'Duplicate-name, duplicate-jersey test records are distinguished');
assert.match(accessRequestApi,/athlete_jersey_number: jerseyById/,'Access history includes jersey identifiers');
assert.match(accessRequestPage,/Roster record/,'Duplicate parent requests are distinguished');
assert.doesNotMatch(parentHome,/\['open','overdue','snoozed'\]/,'Overdue is not a valid reminder_status enum value');
assert.match(parentHome,/\.in\('status',\['open','snoozed'\]\)/,'Parent Home queries valid open reminder statuses');
assert.match(parentHome,/Some parent dashboard data could not be loaded/,'Parent Home surfaces partial data failures instead of silently showing zero');
for (const section of [parentGoals,parentConnections,parentJourney]) {
  assert.doesNotMatch(section,/has not granted access to/,'No legacy granular parent permission denial');
  assert.match(section,/Parent \/ Guardian connection is awaiting approval or has been revoked/,'Section access uses whole-connection language');
}
assert.match(player360,/parent \? "Tracked Events" : "Upcoming Events"/,'Parent Player 360 distinguishes tracked events from shared calendars');
assert.match(player360,/parent \? reminders\.filter/,'Parent Player 360 counts actual open reminders, not suggested next moves');
assert.match(parentEvents,/id="tracked-events"/,'Tracked events metric links to the correct section');
console.log('Parent restoration QA regression checks passed');

assert.doesNotMatch(player360,/setPermissions\(a\.permissions/,'Player 360 ignores legacy parent section flags once the relationship is active');


const importPage=read('app/import/page.tsx');
const parentImportRpc=read('supabase/migrations/20261012191500_parent_import_only_rpc.sql');
assert.ok(parentHome.includes('href={ph("/import")}'),'Parent Home preserves selected athlete when linking to Import History');
assert.match(parentHome,/Bring their recruiting history/,'Parent Home retains the recruiting-history import action');
assert.ok(importPage.includes("if(accessLoading||loadError||(role==='parent'&&!athletes.length))"),'Parent import UI is available only after approved access loads');
assert.ok(importPage.includes("if(accessLoading||loadError||!me||(role==='parent'&&!athletes.length))"),'Parent import handler requires approved athlete access');
assert.ok(importPage.includes("if(!athletes.some(a=>a.id===athleteId))"),'Parent import only submits rows for linked athletes');
assert.ok(importPage.includes("c.rpc('parent_import_recruiting_history_row'"),'Parent imports use server-side authorized RPC, not direct INSERT');
assert.ok(importPage.includes("requestedAthlete&&ids.includes(requestedAthlete)"),'Selected Parent athlete context must be authorized');
for(const policy of ['parents import linked college relationships','parents import linked coach relationships','parents import linked interactions']){
  assert.ok(parentImportRpc.includes('DROP POLICY IF EXISTS "'+policy+'"'),'Parent has no direct table INSERT exception: '+policy);
}
assert.match(parentImportRpc,/SECURITY DEFINER/,'Import uses server-side authorization');
assert.match(parentImportRpc,/pga.status = 'active'/,'Only approved, active parent relationships may import');
assert.match(parentImportRpc,/p.app_role = 'parent'/,'Import RPC requires Parent role');
assert.match(parentImportRpc,/ON CONFLICT \(athlete_user_id, college_id\) DO NOTHING/,'Import preserves existing athlete school relationships');
assert.match(parentImportRpc,/ON CONFLICT \(athlete_user_id, coach_id\) DO NOTHING/,'Import preserves existing coach relationships');
assert.doesNotMatch(parentImportRpc,/\bUPDATE public\.(athlete_colleges|athlete_coaches|interactions)\b/i,'Parent import RPC never updates existing recruiting records');
assert.doesNotMatch(parentImportRpc,/\bDELETE FROM public\.(athlete_colleges|athlete_coaches|interactions)\b/i,'Parent import RPC never deletes recruiting records');
assert.match(parentImportRpc,/GRANT EXECUTE ON FUNCTION public.parent_import_recruiting_history_row/,'Approved Parent RPC is callable by authenticated users');
assert.match(player360,/Suggested Recruiting Follow-Ups/,'Player 360 keeps suggestions distinct from actual Next Steps');
console.log('Parent import-only write permissions and follow-up labeling regression checks passed');
