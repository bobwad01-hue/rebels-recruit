import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(p)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const migration=read('supabase/migrations/20261016180000_team_admin_automatic_athlete_access.sql');
const athlete=read('app/manage-access/page.tsx');
const actions=read('app/manage-access/TeamAdminAccessActions.tsx');
const advisor=read('app/advisors/page.tsx');
const board=read('app/organization/recruiting-board/page.tsx');
const admin=read('components/TeamAdminPlayerAccess.tsx');
const roles=read('lib/access-role-grants.ts');
for(const key of ['athlete_team_admin_revocations','team_admin_can_access_athlete','my_team_admin_athlete_ids','can_access_athlete','can_edit_athlete','role = \'admin\' and staff.status = \'active\'']){
 assert(migration.includes(key),'Migration missing '+key);
}
assert(migration.includes('not exists (')&&migration.includes('denied.admin_user_id'),'Revocation must override automatic coverage');
assert(migration.includes('tm.team_id=t.id')||migration.includes('tm.team_id=t.id'),'Coverage must be tied to team membership');
assert(athlete.includes('Team Admin Access')&&athlete.includes('TeamAdminAccessActions'),'Athletes need visible Team Admin revocation controls');
assert(actions.includes("insert({athlete_user_id:user.id,admin_user_id:adminId})"),'Athletes must create their own revocation');
assert(actions.includes(".delete().eq('athlete_user_id',user.id)"),'Athletes must be able to restore access');
assert(advisor.includes("c.rpc('my_team_admin_athlete_ids')"),'Team Admin dashboard must use scoped athlete resolver');
assert(board.includes("c.rpc('my_team_admin_athlete_ids')"),'Recruiting HQ must use scoped athlete resolver');
assert(admin.includes("c.rpc('my_team_admin_athlete_ids')"),'Team Admin player list must use scoped athlete resolver');
assert(roles.includes('role === "admin" ? "advisor" : role'),'Team Admin should get organization context without org-wide Admin privileges');
console.log('Team Admin automatic coverage and athlete revocation source smoke tests passed.');
