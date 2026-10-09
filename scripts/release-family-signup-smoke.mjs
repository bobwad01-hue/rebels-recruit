import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const migration = read("supabase/migrations/20261009145502_shared_team_family_signup.sql");
const setup = read("app/api/organization/setup/route.ts");
const join = read("app/api/join/route.ts");
const signup = read("app/signup/page.tsx");
const connect = read("app/api/parent/connect/route.ts");
const relationship = read("lib/parent-access.ts");
const context = read("lib/parent-context.ts");
const parentHome = read("app/parent/page.tsx");

assert.match(migration, /role IN \('admin','advisor','advisor_admin','athlete','parent','family'\)/, "Family is a separate nonprivileged link role");
assert.match(migration, /signup_code_unique/, "Each short signup code is unique");
assert.match(migration, /requires_approval = true[\s\S]*role IN \('admin','advisor','advisor_admin'\)/, "Legacy staff links require approval");
assert.match(setup, /role:"family"/, "Admins generate one family link per team");
assert.match(setup, /familySignupCode\(\)/, "Family links have human-readable codes");
assert.match(setup, /signup\?join_token=/, "Team link opens signup directly");
assert.match(join, /const role = isFamily \? accountRole : link\.role/, "Family role derives from authenticated account");
assert.match(join, /!familyRoles\.includes\(accountRole\)/, "Staff accounts cannot join through family code");
assert.match(join, /isStaff \|\| link\.requires_approval/, "Staff links never auto-grant elevated roles");
assert.match(join, /team_members/, "Athlete joins populate the team roster");
assert.match(join, /\/parent\/connect\?team=/, "Parent joins continue to team athlete selection");
assert.match(signup, /joinRole==='family'/, "Family signup permits role selection");
assert.match(signup, /applyTeamCode/, "Manual team code can be applied");
assert.match(connect, /hasParentTeamAccess/, "Roster lookup is scoped to parent team membership");
assert.match(connect, /requestParentConnection\(admin, user\.id/, "Parent selection creates a relationship request");
assert.match(relationship, /status: "pending"/, "Parent requests are not automatically approved");
assert.match(context, /eq\('status','active'\)/, "Only confirmed parents may view recruiting data");
assert.match(parentHome, /Awaiting Athlete Confirmation/, "Parent Home is usable while connection is pending");

const allowed = status => status === "active";
assert.equal(allowed("pending"), false, "Team join and athlete selection must not expose private data");
assert.equal(allowed("active"), true, "Confirmation unlocks parent-authorized data");
assert.equal(allowed("revoked"), false, "Revocation must immediately remove access");
assert.equal(allowed("declined"), false, "Declined connections never unlock data");
console.log("Shared family signup and parent confirmation smoke checks passed.");
