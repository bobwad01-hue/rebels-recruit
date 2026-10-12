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
const parentImportReadOnly=read('supabase/migrations/20261012180000_parent_import_read_only.sql');
assert.ok(!parentHome.includes('href="/import"'),'Parent Home does not offer a recruiting-history import action');
assert.ok(importPage.includes("if(accessLoading||role==='parent'||loadError)"),'Parent import UI is blocked before upload controls render');
assert.ok(importPage.includes("if(accessLoading||role==='parent'||loadError||!me)"),'Parent import mutation handler rejects parent access');
for(const policy of ['parents import linked college relationships','parents import linked coach relationships','parents import linked interactions']){
  assert.ok(parentImportReadOnly.includes('DROP POLICY IF EXISTS "'+policy+'"'),'Parent import RLS exception is removed: '+policy);
}
assert.match(player360,/Suggested Recruiting Follow-Ups/,'Player 360 names suggestions distinctly from assigned tasks');
assert.match(player360,/These are not assigned Next Steps or overdue reminders/,'Parent suggestions explain their distinction');
assert.ok(player360.includes('parentHref("/parent/goals")'),'Player 360 links parents to actual Next Steps');
console.log('Parent read-only import and suggested follow-up regression checks passed');
