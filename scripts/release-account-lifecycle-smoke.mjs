import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const migration = read("supabase/migrations/20261009161257_platform_account_lifecycle.sql");
const api = read("app/api/platform/accounts/lifecycle/route.ts");
const directory = read("app/api/platform/accounts/route.ts");
const ui = read("app/platform-admin/accounts/page.tsx");
const middleware = read("middleware.ts");
const suspendedPage = read("app/account-suspended/page.tsx");

assert.match(migration, /ADD COLUMN IF NOT EXISTS account_status/, "Account suspension has a durable database state");
assert.match(migration, /protect_profile_account_lifecycle/, "User profile updates cannot undo an administrative suspension");
assert.match(migration, /current_user NOT IN \('service_role', 'postgres'\)/, "Only privileged service role may change suspension");
assert.match(api, /\.eq\("role", "super_owner"\)/, "Only Super Owners may manage lifecycle");
assert.match(api, /targetId === user\.id/, "Super Owners cannot suspend or delete themselves");
assert.match(api, /if \(platformRole\)/, "Other Super Owners are protected");
assert.match(api, /last active Admin\/Owner/, "Last organization Admin is protected");
assert.match(api, /admin\.auth\.admin\.updateUserById/, "Suspend and restore change Supabase Auth access");
assert.match(api, /876000h/, "Suspension bans future Auth sessions");
assert.match(api, /banDuration = action === "suspend" \? "876000h" : "none"/, "Restore reverses Auth ban");
assert.match(api, /body\.confirmText !== "DELETE"/, "Deletion requires explicit DELETE confirmation");
assert.match(api, /admin\.auth\.admin\.deleteUser\(targetId\)/, "Deletion uses Supabase Auth hard delete");
assert.match(api, /platform_account_deleted/, "Deletion is audited");
assert.match(api, /platform_account_suspended/, "Suspension is audited");
assert.match(api, /platform_account_restored/, "Restoration is audited");
assert.match(directory, /account_status,suspended_at,suspension_reason/, "Directory reads account lifecycle status");
assert.match(directory, /last_sign_in_at/, "Account detail shows last sign-in for unknown accounts");
assert.match(ui, /Suspend account/, "Super Owner UI exposes suspension");
assert.match(ui, /Restore account/, "Super Owner UI exposes restoration");
assert.match(ui, /Permanently delete/, "Deletion has a confirmation modal");
assert.match(ui, /Account status/, "Directory has account status filter");
assert.match(middleware, /sessionProfile\?\.account_status==='suspended'/, "Existing sessions are blocked on all app routes");
assert.match(middleware, /pathname\.startsWith\('\/api\/'\)/, "Suspended API requests receive 403");
assert.match(suspendedPage, /Account access suspended/, "Suspended user sees a clear explanation");

console.log("Platform account lifecycle security smoke checks passed.");
