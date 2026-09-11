# Rebels Recruit Running Roadmap

Last updated: 2026-09-11

Purpose: This is the canonical handoff/backlog for work discussed but not fully built, deployed, or physically validated. Update it whenever scope is added, completed, deferred, or materially changed. When starting a new ChatGPT conversation, export/share this file with PROJECT_HANDOFF.md.

## P0 - Legal, consent, and launch readiness

### Terms of Service + Privacy Policy acceptance
Status: IN PROGRESS. Database audit foundation built 2026-09-11; UI/enforcement and final legal documents remain.

- Publish Rebels Recruit Terms of Service and Privacy Policy on Rebels Recruit-owned URLs. Do not point production consent at a competitor's legal pages.
- Have counsel review/finalize both documents before launch.
- Signup must use affirmative clickwrap: unchecked checkbox with linked Terms of Service and Privacy Policy; account creation and Google signup cannot continue until checked.
- Existing accounts must be blocked by a one-time acceptance screen on their next authenticated entry until they accept the current versions.
- When either legal document changes materially, mark a new current version and require re-acceptance.
- Store immutable acceptance evidence: user ID, exact Terms version, exact Privacy version, acceptance timestamp, context/method, user agent, and where technically appropriate server-observed IP address.
- Build an Owner/Admin legal acceptance report/export for audit/legal requests. Do not expose this broadly to advisors.
- Preserve old document versions and acceptance records. Never overwrite historical acceptance evidence.
- Decide and document retention policy for legal acceptance records.
- Add age/date-of-birth strategy and legal review because the athlete audience includes minors. Determine whether Rebels Recruit will prohibit under-13 accounts or implement COPPA-compliant parental notice/verifiable consent if under-13 use is possible.
- Review state minor/privacy requirements in addition to COPPA before commercial launch.

Database foundation already live: `legal_document_versions`, `user_legal_acceptances`, `current_legal_documents()`, `has_current_legal_acceptance()`, `accept_current_legal_documents()`.

### Release-candidate QA
Status: NOT COMPLETE.

- Real-device/browser QA: iPhone Safari, Android Chrome, desktop Chrome/Edge.
- Test widths 375, 430, 768, 1024, 1280, ~1500 for orphan headings, forced breaks, clipped controls, uneven cards, whitespace, touch targets and sticky/fixed UI.
- Persona flows: Maia athlete; Maia parent; advisor 3 players; advisor 30 players; Owner 100+ players; brand-new player; imported-but-unclaimed player; two-organization athlete; parent with two daughters.
- Verify failure vs permission vs genuinely empty states across all major data surfaces.
- Continue CTA audit whenever new UI is added.

## P1 - Reliability and scale hardening

### Exports / Report Center
Status: STRUCTURAL HARDENING BUILT; LARGE-SCALE VALIDATION REMAINS.

- Validate every CSV and XLSX report end-to-end with realistic data.
- Load-test large recruiting histories and 100+ player organizations.
- Verify every report identifies unavailable datasets without killing unrelated reports.
- Verify historical date precision survives CSV/XLSX round-trip.
- Consider server/database-side report generation if browser-side generation becomes a scale bottleneck.

### Advisor / Owner scale
Status: NEEDS SCALE TESTING.

- Test Advisor Home with 30+ assigned players.
- Test Owner/Admin surfaces with 100+ players.
- Move expensive organization intelligence/history aggregation server/database-side where browser-side bounds become limiting.
- Ensure Action Queue remains fast and prioritized at larger scale.

### Multi-organization end-to-end validation
Status: ARCHITECTURE BUILT; REAL TWO-ORG PERSONA QA REMAINS.

- Validate athlete simultaneously belongs to travel + high school organizations.
- Both organizations see only permitted canonical player data.
- Leaving one organization immediately removes only that organization's access/assignments/import access.
- Athlete data, other organization memberships, schools, coaches, Journey, events, Next Moves and videos remain intact.
- Exercise owner/advisor users who themselves belong to multiple organizations and eliminate remaining single-membership assumptions.

## P1 - Product language / navigation

### Next Move -> Next Step terminology
Status: DECISION PENDING; NOT IMPLEMENTED.

- Evaluate changing user-facing `Next Move / Next Moves` to `Next Step / Next Steps` across the athlete, parent, advisor, owner/admin experience and public index page.
- Recommended direction as of 2026-09-11: `Next Step` is clearer and more universally understood, especially for athletes and parents new to recruiting; `Next Move` is more distinctive/strategic but slightly more branded and abstract.
- If approved, change user-facing copy consistently while leaving internal database/table/route identifiers unchanged unless there is a technical reason to migrate them.
- Audit headings, CTAs, reminders, advisor assignment language, reports/exports, public marketing copy, onboarding/help text and empty states in one coordinated sweep.

## P1 - Integrations

### X API / X developer integration
Status: NOT COMPLETE. Developer-portal setup was started.

- Finish X developer project/app configuration and production credentials.
- Define the exact product use case before requesting scopes: profile/link enrichment, recruiting/social activity, posting, or other approved workflow.
- Implement OAuth/token storage server-side if user-authorized X access is required.
- Add least-privilege scopes, revocation/disconnect, failure states and auditability.
- Confirm X API plan/rate limits/costs before making the integration a required product dependency.
- Do not make core recruiting workflow depend on X availability.

### Google / Gmail / Calendar hardening
Status: PARTIALLY BUILT; FINAL SECURITY/PRODUCTION QA REMAINS.

- Gmail send is intentionally athlete-owned and send-only; do not turn Rebels Recruit into another inbox.
- Finish production OAuth hardening/verification as required by Google.
- Validate token refresh, revoked consent, reconnect, failure handling and account switching.
- Validate Calendar integration across event creation/editing and disconnected/reconnected states.
- Preserve manual email/calendar fallback paths.

### Future communication intelligence
Status: DEFERRED.

- Inbound email detection only if product/privacy value justifies broader Gmail scopes.
- Automatic activity suggestions from communication.
- Meaningful-contact detection and cadence reminders.
- Stronger relationship intelligence based on communication context without black-box claims.
- Message Center enhancements: unread counts, previews, timestamps, search, archive/mute, task/Next Move creation and deep links.

## P2 - Product intelligence and workflow

### Advisor-side Smart Next Moves
Status: DEFERRED.

- Extend deterministic/explainable Smart Next Move logic to advisor workflows.
- Keep athlete ownership of recruiting decisions; advisor suggestions should support, not silently mutate, athlete Journey stage or decisions.

### Event intelligence expansion
Status: CORE WORKFLOW BUILT; CONTINUE QA/ENRICHMENT.

- Continue testing Before -> During -> After workflow across camps, visits and showcases.
- Verify debrief edits never duplicate Journey activity.
- Improve advisor event attendance/player drill-down where real usage identifies gaps.

### Coach relationship completion
Status: CORE FLOW BUILT; CONTINUE QA.

- Final QA of multi-coach email recipient timeline display.
- Continue missing-coach prompts when a school is added without a coach.
- Never auto-attach a guessed coach.

## P2 - Commercial / operational readiness

- Finalize production Terms of Service and Privacy Policy with counsel.
- Define data retention/deletion policy, account deletion workflow, and legal/audit export procedures.
- Review privacy/security implications of minors, parent access, organization access, Gmail, X and imported recruiting history.
- Establish support/escalation workflow for access disputes, mistaken organization claims and parent/athlete relationship changes.
- Revisit infrastructure plan before large commercial organizations if Vercel Hobby build/rate limits become operationally disruptive.

## Completed but still worth regression-testing

- Player-owned multi-organization architecture and leave-org revocation.
- Imported/unclaimed player architecture and verified-email claim flow.
- Parent multi-athlete selector/persistent context.
- Parent Journey authorized feed and explicit failure state.
- Multi-coach email CC relationship tracking.
- Recruiting Health deterministic workflow score.
- Event Prep workflow and event-linked Next Moves.
- Athlete/Parent/Advisor/Owner navigation and Phase 7/7.5 language simplification.
- Report Center structural failure isolation/date-precision work.

## Roadmap maintenance rule

Whenever a feature, integration, QA item, legal/compliance requirement, deferred idea, or deployment gap is discussed and not completed, add it here. When completed, move it to Completed with the commit/migration/deployment reference where useful. Do not call an item deployed until its production deployment is verified.