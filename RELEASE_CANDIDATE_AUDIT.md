# Rebels Recruit Release Candidate Audit

Last updated: 2026-09-11

This is the working release-candidate audit for reliability, language, multi-organization behavior, multi-athlete parent behavior, legal/account lifecycle, scale, and operational readiness. A feature is not marked production-proven solely because its source architecture or synthetic fixture is correct.

## Current release state

- `main` release-candidate code has completed the full GitHub Actions pipeline successfully after the Support multi-organization type fix.
- Vercel successfully deployed commit `6a2cb6bfdefdd0e299185fbee4434a4c2502dc54`; later migration-mirror/doc commits must still be checked individually before they are called deployed.
- Production currently has 1 organization, a maximum of 10 active athletes in an organization, 1 advisor, 0 athletes with multiple active organization memberships, 0 parents with two or more active athlete links, 123 interactions total, and a current maximum of 121 interactions for one athlete.
- Because production does not yet contain the larger/multi-context personas, automated fixtures and rollback-only production-schema transactions are used as regression guards while real authenticated browser fixture validation remains open.

## Reliability standard

Every major surface must distinguish these states:

1. **Nothing here yet**: the request succeeded and the result is genuinely empty.
2. **No access**: the signed-in user is not authorized for the requested data or action.
3. **Could not load**: a required request failed. Never render this as an empty list.
4. **Partially unavailable**: one supporting dataset failed while other useful data remains available.

Rules:
- A failed supporting dataset must not blank an otherwise useful page.
- Mutation failures must say that the prior data/access remains unchanged when that is true.
- Empty-state copy must only render after a successful query.
- Read-only users should retain navigation and drill-down wherever their permissions allow.
- Support diagnostics should capture state, not sensitive message content.

### Reliability work completed in this pass
- Report Center isolates dataset failures.
- Parent Journey uses an authorized feed and distinguishes failure from empty.
- Parent Connections preserves successfully loaded school/coach data when the other relationship dataset fails.
- Manage Access distinguishes authentication failure, advisor-request load failure, partial advisor-profile failure, family-access load failure, family-profile partial failure, and true empty states.
- Family access mutations show explicit save failures rather than silently reloading stale state.
- Account deletion status explicitly distinguishes a failed status check from no deletion request.
- Legal Acceptance report preserves partial results and identifies unavailable supporting datasets.
- Support Cases distinguishes permission, case-load failure, partial profile/history failure, true empty states, and organization context.
- Athlete Organizations distinguishes authentication, membership load failure, imported-history matching failure, true empty membership, and mutation failures.
- Parent Athlete Switcher distinguishes parent-access failure from a true single/no-athlete state and only accepts active authorized athlete IDs.
- Advisor Tasks isolates organization membership, roster, player-profile, saved-group, group-membership, task-load and mutation failures.
- Athlete Activity distinguishes signed-out/access failure, activity-load failure, partial timezone failure, true empty activity, and a 500-record display bound.
- Advisor Activity distinguishes no staff/player access, roster/assignment failure, partial player-profile failure, activity-load failure, true empty scope, and a 1,500-record display bound.
- Connections keeps existing athlete school/coach relationships usable when the supporting school or coach search catalog fails.
- Recruiting Health calculates from available datasets when supporting data is partially unavailable, warns that the score may be incomplete, and only blocks the page when all required recruiting datasets fail.
- Athlete Home, Advisor Home, Events, Messages, Videos, imports, School Fit Insights, and Parent Journey have explicit partial/failure handling where supporting data can fail independently.

### Reliability work still requiring regression QA
- Force query failures across the hardened major surfaces and remaining Parent/Owner edge paths.
- Continue replacing all-or-nothing loads whenever future features add optional supporting datasets.
- Physically validate failure-state layout and recovery actions on mobile and desktop.

## Language and CTA standard

User-facing actions should describe the action or destination. Preferred examples:
- Email Coach
- Log Activity
- Add School
- Assign Next Step
- Prepare for Event
- Review Relationship
- Review Journey
- Message Player
- Find Schools

Avoid generic action labels such as `Open`, `View`, `Take Action`, and `Open Context` when a specific verb is available. Avoid implementation language such as `exact-date`. Recruiting Health must be described as a workflow check, not a talent grade or recruiting prediction.

The canonical user-facing term is **Next Step / Next Steps**. Internal identifiers such as `next_step`, `next_moves`, and legacy anchors may remain for stability.

### CTA/language work completed
- Athlete Activity uses `Log Activity`, `Edit Activity`, and `Delete Activity`, and uses `School` rather than generic College labeling.
- Advisor Activity uses `Review Player 360°`, `Review School`, `Review Coach Relationship`, and `Review Activity Details` rather than generic Open/View labels.
- Connections uses review-oriented relationship language and School terminology.
- Recruiting Health uses `Review My Next Steps`, `Review This Factor`, `Review Your Schools`, `Review Coach Relationships`, and `Prepare for Upcoming Events`.
- Advisor Tasks uses clearer mutation language such as `Save Player Group` and `Mark Next Steps Complete`.
- A permanent CI language audit blocks known regressions including `Next Move`, `Open Context`, `Take Action`, `Open Messages`, and technical exact-date wording.

Continue the CTA sweep whenever user-facing UI changes. Do not blind-replace internal status values such as `open`.

## Persona and access validation

`npm run test:fixtures` now exercises the following release personas on every CI run:

- Athlete with simultaneous Travel + High School organization memberships.
- Leave one organization while preserving the other organization and all canonical recruiting data.
- Safe rejoin without duplicate membership identity or recruiting data.
- Parent with two athletes, persistent Parent navigation context, unauthorized athlete-ID rejection, and immediate fallback after revocation.
- Advisor with 30 assigned athletes and no organization-wide access.
- Owner with 100 athletes in one organization.
- Cross-organization access denial for Advisor and Owner personas.
- Brand-new athlete true-empty state.
- Imported-but-unclaimed athlete requiring exact verified-email match rather than name matching, with provenance preserved after claim.

These are deterministic authorization/regression fixtures. They do not replace authenticated browser testing against a safe Supabase environment.

### Rollback-only production-schema authorization test

A transaction was run against the real production schema and rolled back completely. It verified:
- both organization Owners could access a two-org athlete before one membership was left.
- the left organization immediately lost access while the other retained access.
- Parent access to two linked athletes succeeded and unrelated-athlete access failed.
- revoking one Parent link immediately removed that athlete authorization.
- an Advisor could access exactly 30 assigned athletes.
- an Owner could access all 100 athletes in the test organization.

A follow-up query confirmed zero QA auth users and zero QA organizations remained after rollback.

## Multi-organization pressure test

### Verified architecture and automated/schema fixtures
- `organization_members` permits multiple organizations per user and uniquely constrains membership per `(organization_id,user_id)` rather than per user.
- `can_access_athlete()` grants organization access only when both the viewer and athlete have active membership in the same organization, with role/organization-view rules applied.
- Canonical athlete recruiting records are athlete-owned rather than organization-owned.
- Automated CI verifies Travel + High School membership, leave-one-org revocation, preservation of the other org, preservation of canonical data, and safe rejoin.
- Rollback-only production-schema QA independently verifies the shared-organization authorization behavior.
- Support cases are explicitly organization-scoped, including Parent-aware routing through organizations belonging to linked athletes.

### Production fixture limitation
Production currently has no real user with more than one active organization membership. A real authenticated Travel + High School browser persona therefore cannot yet be called fully production-proven.

## Parent multi-athlete pressure test

### Verified architecture and automated/schema fixtures
- Parent context only selects from active `parent_guardian_access` rows.
- A requested athlete ID that is not in the parent's active rows is not accepted; context falls back to an authorized athlete.
- The parent athlete switcher stores the selected authorized athlete and writes the athlete ID to the URL.
- CI verifies two-athlete switching across Parent routes and immediate fallback after one athlete link is revoked.
- Rollback-only production-schema QA independently verifies two active links, unrelated-athlete denial, and immediate revocation behavior.

### Production fixture limitation
Production currently has no real parent with two active athlete links, so authenticated browser behavior is not yet fully production-proven.

## Scale and performance

Current production data is too small to prove commercial scale: the largest organization currently has 10 active athletes, and the largest individual recruiting history currently has 121 interactions.

Synthetic CI creates:
- 100 athletes
- 50,000 interactions
- 2,000 athlete-school relationships
- 1,200 athlete-coach relationships

It validates basic aggregation correctness, a 5-second aggregation budget, and a 512 MB heap budget. The persona fixture additionally verifies 30-player Advisor and 100-player Owner access rules. A rollback-only production-schema test independently verified the same 30/100 authorization path through the real `can_access_athlete()` function. These are regression guards, not substitutes for browser load testing.

Known scale risk: Advisor Home currently loads up to 4,000 interactions into the browser and performs repeated in-memory filtering. This should move toward database/server-side aggregation before large organizations are considered fully scale-proven.

Additional bounded-view warnings exist on Athlete Activity (500 most recent records) and Advisor Activity (1,500 most recent records) so a limit cannot silently masquerade as complete history.

## Spreadsheet import/export validation

Automated CI validates:
- XLSX write/read round trip.
- CSV embedded quote escaping and quoted multiline notes.
- month-only and year-only recruiting date preservation.
- malformed XLSX rejection.
- 5,000-row workbook generation/read performance.
- the explicit 10 MB client-side import guard boundary.

Real production UI tests are still required for athlete import, team import, every major Report Center CSV/XLSX export, malformed upload messaging, and 10 MB rejection behavior.

## Dependency security

- Production dependency CI fails at `npm audit --omit=dev --audit-level=high`.
- The previous high-severity PostCSS finding was mitigated through a safe package override rather than a forced major Next.js upgrade.
- Current remaining audit findings are moderate transitive findings under `exceljs-hardened`/`uuid`; npm reports no direct fix through that dependency path.
- Do not use `npm audit fix --force` without compatibility and security review.

## Legal and account lifecycle

Implemented foundation:
- Versioned Terms and Privacy documents.
- Immutable legal acceptance events with exact versions, timestamp, context, method, user agent, and server-observed IP where available.
- Existing-account reacceptance gate when current versions change.
- Athlete signup age-13-or-older affirmation.
- Immutable age-attestation audit records.
- Account deletion request/cancel workflow. Submission does not immediately destroy data.
- Owner/Admin Legal Acceptance report with CSV export.

### Lifecycle bugs found and fixed during release QA

**Default organization auto-enrollment:** the auth-user trigger previously inserted every new account into the oldest organization automatically. That violated player-owned multi-organization isolation and also meant newly created accounts were not organization-neutral. Migration `20260912002613_stop_automatic_default_organization_membership.sql` removes automatic organization membership. Organization access now requires an explicit join, approved import claim, invitation, or other authorized workflow.

**Parent signup role:** the same trigger previously allowed only `athlete` or `advisor`, silently converting password-based Parent signup metadata to `athlete`. The migration now preserves `parent` as a valid profile role.

Rollback-only production-schema QA confirmed a newly inserted Parent test account received `app_role='parent'` and zero automatic organization memberships.

### Transactional lifecycle QA

Rollback-only production-schema QA also verified:
- current legal acceptance changes from false to true after acceptance.
- repeated account-deletion requests are idempotent while one is active.
- deletion cancellation succeeds once and does not falsely succeed a second time.
- support cases auto-route when exactly one authorized organization exists.
- Owner/Admin can move a support case through Investigating -> Resolved -> Open.
- support status/note actions create immutable support-case events.
- a Parent can route a support case through an organization belonging to an actively linked athlete.

A follow-up query confirmed zero QA auth users, organizations, and support cases remained after rollback.

Product policy for release candidate: athlete self-service signup is 13+. Under-13 athlete accounts are not supported unless a future counsel-reviewed COPPA parental-consent flow is intentionally built.

Still requires counsel/business approval before commercial launch:
- Final Terms and Privacy wording.
- State-specific minor/privacy review.
- Retention periods for active, closed, and deletion-requested accounts.
- Which legal/audit records must survive account deletion and for how long.
- Formal deletion SLA and exceptions for legal/security obligations.

## Operational readiness

Users can create a diagnostic support case from Settings for:
- missing athlete/player
- wrong organization access
- missing imported history
- Google disconnect
- wrong team/organization
- parent access
- account deletion
- other issues

Operational controls include:
- organization-scoped support-case routing rather than reporter-membership inference.
- Parent-aware routing to organizations belonging to actively linked athletes.
- Owner/Admin organization switcher for staff who support more than one organization.
- Open -> Investigating -> Resolved workflow with reopen support.
- internal investigation/resolution notes.
- immutable support-case event history.
- audit logging for organization-membership and Parent/Guardian-access changes.
- tightened audit-log read policy so organization-null audit entries are not broadly readable.

Release QA found that the original single-organization auto-route branch used `min(uuid)`, which PostgreSQL does not support. Migration `20260912002423_fix_support_case_auto_routing.sql` replaces that branch with a count plus single-row selection. Rollback-only production-schema QA now confirms single-organization auto-routing succeeds.

The support snapshot records limited diagnostic facts such as active organization memberships, relationship counts, parent-link counts, and Google connection state. It does not copy recruiting message/note content into the diagnostic snapshot.

Owner/Admin support diagnostics are available at `/organization/support`. Legal acceptance audit is available at `/organization/legal-acceptance`.

See `SUPPORT_PLAYBOOK.md` for the investigation sequence and safety rules.

## Remaining human/device release gates

- Real authenticated two-organization athlete.
- Real authenticated Parent with two athletes.
- Real/safe Advisor organization with ~30 athletes.
- Real/safe Owner organization with 100+ athletes.
- Athlete with 500+ real/safe interactions.
- End-to-end spreadsheet imports/exports in deployed production.
- Forced backend failure QA on hardened surfaces.
- iPhone Safari, Android Chrome, desktop Chrome, and Edge.
- Counsel approval of Terms, Privacy, minor policy, retention/deletion policy, and deletion SLA.
