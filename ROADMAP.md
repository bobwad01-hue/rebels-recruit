# Rebels Recruit Running Roadmap

Last updated: 2026-09-11

Purpose: canonical handoff/backlog for work discussed but not fully built, deployed, or physically validated. Use with `PROJECT_HANDOFF.md` and `RELEASE_CANDIDATE_AUDIT.md` when starting a new conversation.

## P0 - Legal, consent, and launch readiness

### Terms, Privacy, age, and account lifecycle
Status: SUBSTANTIALLY BUILT; COUNSEL/FINAL POLICY QA REMAINS.

Built:
- Rebels Recruit-owned `/terms` and `/privacy` pages and versioned current document records.
- Required clickwrap at signup and blocking reacceptance for existing users/current-version changes.
- Immutable acceptance evidence with document versions, timestamp, context/method, user agent, and server-observed IP where available.
- Owner/Admin Legal Acceptance report + CSV at `/organization/legal-acceptance`.
- Athlete self-service signup requires age-13-or-older affirmation; immutable age attestation evidence is stored.
- Account deletion request/cancel workflow is available from Settings. Requests do not automatically destroy data.
- Support/audit foundation for lifecycle issues.

Before commercial launch:
- Have counsel review/finalize Terms and Privacy.
- Confirm 13+ self-service policy and review state minor/privacy requirements in addition to COPPA.
- Define retention periods for account data, legal acceptance evidence, audit records, and completed deletion requests.
- Define deletion SLA and exceptions required for legal/security obligations.
- Test password signup, Google signup, existing-user reacceptance, policy-version update, age gate, deletion request/cancel, and legal export end-to-end in production.

### Release-candidate QA
Status: IN PROGRESS. See `RELEASE_CANDIDATE_AUDIT.md`.

- Real-device/browser QA: iPhone Safari, Android Chrome, desktop Chrome/Edge.
- Test widths 375, 430, 768, 1024, 1280, ~1500.
- Persona flows: Maia athlete; Maia parent; advisor 3 players; advisor 30 players; Owner 100+ players; brand-new player; imported-but-unclaimed player; two-organization athlete; parent with two daughters.
- Force query failures across major surfaces and verify empty vs no-access vs failed vs partially-unavailable states.
- Continue CTA/language audit whenever UI changes.

## P1 - Reliability and scale hardening

### Reliability audit
Status: MAJOR SURFACES HARDENED; FORCED-FAILURE REGRESSION QA REMAINS.

Completed in current pass:
- Manage Access and Family Access distinguish load failures, partial profile failures, mutation failures, permission/auth failure, and genuine empty states.
- Legal Acceptance and Support Cases preserve useful partial data when supporting datasets fail.
- Account deletion status distinguishes failure from no request.
- Athlete Home, Advisor Home, Events, Activity, Connections, Recruiting Health, Messages, Videos, imports, School Fit Insights and Parent Journey now use explicit failure/partial-data states where applicable instead of silently presenting failed queries as empty data.
- Report Center isolates dataset failures so unaffected reports remain usable.
- Permanent CI language audit and synthetic scale guard run before every production build.

Remaining:
- Force-failure regression QA across the hardened surfaces and remaining Parent/Owner edge paths.
- Continue replacing all-or-nothing loads when future features add optional supporting datasets.

### Spreadsheet import/export security
Status: REMEDIATION BUILT; END-TO-END FILE QA REMAINS.

Completed:
- Removed the vulnerable `xlsx` / SheetJS dependency from application imports and exports.
- Spreadsheet parsing and XLSX generation now use `exceljs-hardened`.
- Athlete and organization recruiting-history imports accept `.xlsx` and `.csv`; legacy binary `.xls` is intentionally no longer accepted.
- Added a 10 MB client-side upload limit before workbook parsing.
- CSV parsing preserves quoted fields and embedded line breaks.
- XLSX date cells continue to preserve exact/month/year/unknown recruiting-date semantics when imported.
- Server-side interaction export cleans historical import keys and uses School terminology.

Remaining:
- Regression-test representative `.xlsx` and `.csv` imports, quoted CSV fields, Excel date cells, malformed files, 10 MB rejection, and every XLSX export in production.
- Review remaining transitive npm audit findings separately; do not use `npm audit fix --force` without compatibility/security review.

### Exports / Report Center
Status: STRUCTURAL HARDENING BUILT; LARGE-SCALE VALIDATION REMAINS.

- Validate every CSV and XLSX report end-to-end with realistic data.
- Load-test large recruiting histories and 100+ player organizations.
- Verify historical date precision survives CSV/XLSX round-trip.
- Consider server/database-side report generation if browser generation becomes a bottleneck.

### Performance / scale
Status: SYNTHETIC CI GUARD ADDED; REAL LOAD TESTING REMAINS.

- CI now runs `npm run test:scale` with 100 athletes, 50,000 interactions, 2,000 athlete-school relationships, and 1,200 athlete-coach relationships.
- Production query indexes were added for athlete reminders, parent access, organization advisor assignments, and athlete-event status (`20260911230500_release_candidate_query_indexes.sql`).
- Test Advisor Home with 30+ real/safe fixture players and Owner/Admin with 100+.
- Test athlete with 500+ interactions and large Report Center exports.
- Advisor Home still loads up to 4,000 interactions and performs repeated browser-side filtering. Move expensive organization intelligence/history aggregation server/database-side before large-org scale is called proven.

### Multi-organization end-to-end validation
Status: ARCHITECTURE RE-VERIFIED; REAL TWO-ORG FIXTURE REMAINS.

- `organization_members` supports multiple active organizations per user.
- `can_access_athlete()` requires active shared organization membership/authorized advisor access.
- Canonical athlete recruiting data is athlete-owned, so leaving one organization does not delete recruiting history.
- Production currently has no user with >1 active organization membership. Run the travel + high-school fixture in `RELEASE_CANDIDATE_AUDIT.md` before calling this production-proven.

### Parent multi-athlete validation
Status: AUTHORIZATION LOGIC RE-VERIFIED; REAL TWO-ATHLETE FIXTURE REMAINS.

- Parent context selects only active authorized athlete links; unauthorized requested athlete IDs are not accepted.
- Production currently has zero `parent_guardian_access` rows, so two-athlete behavior still requires a real/safe fixture test.

## P1 - Operational readiness

Status: FOUNDATION BUILT; WORKFLOW QA REMAINS.

Built:
- In-app support case creation from Settings.
- Diagnostic categories for missing athlete, wrong organization access, missing import history, Google disconnect, wrong team, parent access, account deletion, and other.
- Limited diagnostic snapshots capture memberships/counts/connection state without copying recruiting-message content.
- Owner/Admin diagnostics page at `/organization/support`.
- `SUPPORT_PLAYBOOK.md` defines investigation and least-destructive repair procedures.

Remaining:
- Add staff case status/resolution controls if support volume warrants them.
- Test every support scenario end-to-end and verify audit trail.
- Define external support contact/SLA/escalation ownership before commercial launch.

## P1 - Integrations

### X API / X developer integration
Status: NOT COMPLETE. Developer-portal setup was started.

- Finish X developer project/app configuration and production credentials.
- Define exact product use case/scopes before implementation.
- Implement OAuth/token storage server-side if user-authorized access is required.
- Add least-privilege scopes, revocation/disconnect, failure states and auditability.
- Confirm X API plan/rate limits/costs.
- Core recruiting workflow must not depend on X availability.

### Google / Gmail / Calendar hardening
Status: PARTIALLY BUILT; FINAL SECURITY/PRODUCTION QA REMAINS.

- Gmail send remains athlete-owned and send-only.
- Finish production OAuth hardening/verification as required by Google.
- Validate token refresh, revoked consent, reconnect, failure handling and account switching.
- Validate Calendar integration across creation/editing and disconnect/reconnect states.
- Preserve manual fallback paths.

### Future communication intelligence
Status: DEFERRED.

- Consider inbound email detection only if product/privacy value justifies broader scopes.
- Automatic activity suggestions, meaningful-contact detection, cadence reminders.
- Message Center enhancements: unread counts, previews, timestamps, search, archive/mute, Next Step creation and deep links.

## P2 - Product intelligence and workflow

### Advisor-side Smart Next Steps
Status: DEFERRED.
- Extend deterministic/explainable Smart Next Step logic to advisor workflows without silently changing athlete Journey decisions.

### Event intelligence expansion
Status: CORE WORKFLOW BUILT; CONTINUE QA/ENRICHMENT.
- Test Before -> During -> After across camps, visits and showcases.
- Verify debrief edits never duplicate Journey activity.

### Coach relationship completion
Status: CORE FLOW BUILT; CONTINUE QA.
- Final QA of multi-coach email recipient timeline display.
- Continue missing-coach prompts; never auto-attach a guessed coach.

## P2 - Commercial / operational readiness

- Counsel review of Terms/Privacy/minor policy.
- Final data retention/deletion policy and support SLA.
- Review privacy/security implications of parent/org access, Gmail, X, and imported history.
- Revisit infrastructure plan before large commercial organizations if Vercel Hobby limits remain disruptive.

## Completed but still worth regression-testing

- Player-owned multi-organization architecture and leave-org revocation.
- Imported/unclaimed player architecture and verified-email claim flow.
- Parent multi-athlete selector/persistent context.
- Parent Journey authorized feed and explicit failure state.
- Multi-coach email CC relationship tracking.
- Recruiting Health deterministic workflow score.
- Event Prep workflow and event-linked Next Steps.
- Athlete/Parent/Advisor/Owner navigation and Phase 7/7.5 language simplification.
- Report Center structural failure isolation/date-precision work.
- Global user-facing terminology changed to Next Step / Next Steps. Public benefit message: "Know what to do next."
- Spreadsheet parser/export security migration away from SheetJS, with hardened XLSX handling and upload-size limits.

## Roadmap maintenance rule

Whenever a feature, integration, QA item, legal/compliance requirement, deferred idea, or deployment gap is discussed and not completed, add it here. When completed, move it to Completed with commit/migration/deployment reference where useful. Never call an item deployed until production deployment is verified.
