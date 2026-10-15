# Find Schools — Add / Restore Regression QA

## Root cause (2026-10-15)
The Find Schools `/discover` Add School action unconditionally inserted an `athlete_colleges` row. A previously archived school still owns the unique `(athlete_user_id,college_id)` key, so Postgres rejected the insert with a duplicate-key error. The UI swallowed that error. Example: Sara Smith's Buena Vista University target was archived; Southern Virginia University had no prior target, so adding it worked.

## Locked behavior
- Adding a **new** school creates one athlete-specific `athlete_colleges` row with initial stage `Researching` from Discover; the full Add School form can supply an explicit initial stage and fit rating.
- Adding a **previously archived** school restores the **same row** by clearing only `archived_at` and `archived_reason`. Preserve its existing recruiting stage, fit ratings, notes, original ID and related journey history. Never insert a duplicate.
- Adding a school already active in another tab/device should be idempotent and reconcile the UI to "Already added."
- Concurrent inserts that hit unique violation `23505` must re-read and reconcile the existing row, not silently fail.
- Any genuine lookup, insert or update failure must display an accessible error in Find Schools. Busy indicators clear after success or failure.
- Find Schools cards and Support Team recommendations use the same add handler. The `/colleges/new` form uses the same shared `saveAthleteSchoolTarget` helper.
- Saving a school never automatically creates coach connections, and restoring a school never resets its journey stage.

## Manual acceptance cases
1. As Sara Smith, search `buen` in Find Schools and click Add School on Buena Vista University. Expect success message "restored", school disappears from available list, and one active existing record in Connections. No duplicate, no changed stage/notes.
2. Search a never-added school, Add School. Expect "added", school appears in Connections.
3. With a school already active, try Add School in a stale tab. Expect "already in Connections", no duplicate or error.
4. Repeat archived and new school cases through the `/colleges/new` form; confirm the archived school is actually restored and original stage is preserved.
5. Force an API permission/network error; expect a visible error (not an inert button) and a usable retry.
6. Add from Support Team recommendation; same behavior and confirmation.
7. Verify school staff are still only available coaches; athlete must separately select Add Connection for any coach.

**Data safety:** Do not run a bulk update to restore archived schools. Only restore when the athlete explicitly selects Add School.
