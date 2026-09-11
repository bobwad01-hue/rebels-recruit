# Rebels Recruit Release Candidate Audit

Last updated: 2026-09-11

This is the working release-candidate audit for reliability, language, multi-organization behavior, multi-athlete parent behavior, legal/account lifecycle, scale, and operational readiness. A feature is not marked production-proven solely because its source architecture is correct.

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
- Report Center already isolates dataset failures.
- Parent Journey already uses an authorized feed and distinguishes failure from empty.
- Parent Connections already preserves successfully loaded school/coach data when the other relationship dataset fails.
- Manage Access distinguishes authentication failure, advisor-request load failure, partial advisor-profile failure, family-access load failure, family-profile partial failure, and true empty states.
- Family access mutations show explicit save failures rather than silently reloading stale state.
- Account deletion status explicitly distinguishes a failed status check from no deletion request.
- Legal Acceptance report preserves partial results and identifies unavailable supporting datasets.
- Support Cases page distinguishes permission, roster failure, case-load failure, partial profile failure, and true empty states.
- Athlete Organizations distinguishes authentication, membership load failure, imported-history matching failure, true empty membership, and mutation failures.
- Parent Athlete Switcher distinguishes parent-access failure from a true single/no-athlete state and only accepts active authorized athlete IDs.
- Advisor Tasks isolates organization membership, roster, player-profile, saved-group, group-membership, task-load and mutation failures.
- Athlete Activity now distinguishes signed-out/access failure, activity-load failure, partial timezone failure, true empty activity, and a 500-record display bound.
- Advisor Activity now distinguishes no staff/player access, roster/assignment failure, partial player-profile failure, activity-load failure, true empty scope, and a 1,500-record display bound.
- Connections now keeps existing athlete school/coach relationships usable when the supporting school or coach search catalog fails.
- Recruiting Health now calculates from available datasets when supporting data is partially unavailable, warns that the score may be incomplete, and only blocks the page when all required recruiting datasets fail.

### Reliability work still requiring page-by-page regression QA
Athlete Home, Advisor Home, Owner Command Center, Events, Messages, Videos, imports, and remaining Parent pages should be exercised with forced query failures. Existing pages that use large `Promise.all` loads must be checked for all-or-nothing behavior and converted to isolated results where needed.

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

### CTA/language work completed in this pass
- Athlete Activity now uses `Log Activity`, `Edit Activity`, and `Delete Activity`, and uses `School` rather than generic College labeling.
- Advisor Activity now uses `Review Player 360°`, `Review School`, `Review Coach Relationship`, and `Review Activity Details` rather than generic Open/View labels.
- Connections uses review-oriented relationship language and continues to use School terminology.
- Recruiting Health now uses `Review My Next Steps`, `Review This Factor`, `Review Your Schools`, `Review Coach Relationships`, and `Prepare for Upcoming Events`.
- Advisor Tasks uses clearer mutation language such as `Save Player Group` and `Mark Next Steps Complete`.

The remaining CTA sweep should continue through Athlete Home, Advisor Home, Game Plan, Events, Messages, Videos, imports, and remaining organization/admin surfaces. Do not blind-replace internal status values such as `open`.

## Multi-organization pressure test

### Verified architecture
- `organization_members` permits multiple organizations per user and uniquely constrains membership per `(organization_id,user_id)` rather than per user.
- `can_access_athlete()` grants organization access only when both the viewer and athlete have active membership in the same organization, with role/organization-view rules applied.
- Canonical athlete recruiting records are athlete-owned rather than organization-owned.
- Leaving one organization therefore removes that shared-organization access without deleting the athlete's canonical schools, coaches, Journey, events, Next Steps, or videos.

### Production fixture limitation
The current production dataset has no user with more than one active organization membership. A real travel + high-school persona therefore cannot yet be called production-proven.

### Required fixture test before commercial launch
1. Athlete joins Travel Org A and High School Org B.
2. Both memberships are active simultaneously.
3. Owner/Admin A can access athlete while Owner/Admin B can access athlete.
4. Athlete leaves A.
5. A immediately loses athlete access.
6. B retains access.
7. Athlete retains canonical recruiting data.
8. Organization-specific assignments/import permissions from A no longer grant access.
9. Rejoining A does not duplicate canonical recruiting records.

## Parent multi-athlete pressure test

### Verified architecture
- Parent context only selects from active `parent_guardian_access` rows.
- A requested athlete ID that is not in the parent's active rows is not accepted; context falls back to an authorized athlete.
- The parent athlete switcher stores the selected authorized athlete and writes the athlete ID to the URL.

### Production fixture limitation
Production currently has zero `parent_guardian_access` rows, so a real parent-with-two-athletes fixture is not available.

### Required fixture test
1. Parent has active access to Athlete A and Athlete B.
2. Switch A -> B on Parent Home.
3. Navigate Connections, Goals & Next Steps, Journey, Events, Find Schools, and Videos.
4. Confirm every page remains on B.
5. Paste an unauthorized athlete ID into the URL and confirm no unauthorized data is shown.
6. Revoke B access and confirm B disappears immediately while A remains usable.

## Scale and performance

Current production data is too small to prove commercial scale: approximately 12 profiles, 123 interactions, 70 athlete-school relationships, and 74 athlete-coach relationships at the time of this audit.

A synthetic CI smoke test now creates:
- 100 athletes
- 50,000 interactions
- 2,000 athlete-school relationships
- 1,200 athlete-coach relationships

It validates basic aggregation correctness, a 5-second aggregation budget, and a 512 MB heap budget. This is a regression guard, not a substitute for database/browser load testing.

Known scale risk: Advisor Home currently loads up to 4,000 interactions into the browser and performs repeated in-memory filtering. This should move toward database/server-side aggregation before large organizations are considered fully scale-proven.

Additional bounded-view warnings now exist on Athlete Activity (500 most recent records) and Advisor Activity (1,500 most recent records) so a limit cannot silently masquerade as complete history.

## Legal and account lifecycle

Implemented foundation:
- Versioned Terms and Privacy documents.
- Immutable legal acceptance events with exact versions, timestamp, context, method, user agent, and server-observed IP where available.
- Existing-account reacceptance gate when current versions change.
- Athlete signup age-13-or-older affirmation.
- Immutable age-attestation audit records.
- Account deletion request/cancel workflow. Submission does not immediately destroy data.
- Owner/Admin Legal Acceptance report with CSV export.

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

The support snapshot records limited diagnostic facts such as active organization memberships, relationship counts, parent-link counts, and Google connection state. It does not copy recruiting message/note content into the diagnostic snapshot.

Owner/Admin support diagnostics are available at `/organization/support`. Legal acceptance audit is available at `/organization/legal-acceptance`.

See `SUPPORT_PLAYBOOK.md` for the investigation sequence and safety rules.
