# Phase 6 UX Audit — Commercial Readiness & Product Polish

Date: 2026-09-11

## Evidence standard

Phase 5 explicitly left rendered browser/device, degraded-network, large-data, and permission validation open. Phase 6 treats those as commercial readiness gates rather than assuming responsive source code proves them.

Current audit combines the Phase 5 canonical inventory with Phase 6 source/architecture review, production build evidence, and a completed physical iPhone 14 / Safari pass. Scores are not upgraded merely because a screen previously scored well. Android and desktop-browser physical/rendered evidence remain open until tested.

**Phase 6 acceptance floor: 9.5/10.** Anything below 9.5 remains open, is remediated, and is rescored before the phase can close. No rounding up.

## Completed Phase 6 hardening

### Build/deploy reliability
- Added global `app/loading.tsx` and recoverable `app/error.tsx` behavior earlier in Phase 6.
- Fixed the Athlete Home responsive syntax regression before deployment.
- Fixed the Parent navigation prefix bug so only one navigation section is active at a time.
- Exact build/deployment verification remains required after the final Phase 6 head commit.

### College Fit Insights
- Replaced bespoke loading/error states with shared ProductUI state patterns.
- Added explicit Supabase error handling so failed requests no longer masquerade as empty data.
- Added recoverable Try Again behavior.
- Added meaningful zero-player and no-filter-match empty states.
- Standardized metrics and page framing with shared Phase 5 patterns.

### Athlete Connections
- Master-school pagination now throws on data failure instead of silently returning a partial/empty list.
- Relationship, coach, and master-coach request failures now render an explicit recoverable error state instead of `[]`.
- Legitimate empty Connections remain distinct from load failure.
- Physical iPhone QA found Stop Pursuing too visually quiet; destructive archive actions now use persistent red emphasis rather than hover-only emphasis.

### Events
- Physical iPhone QA found clipped search/filter copy on the Events screen.
- Mobile search and filter typography has been tightened while preserving comfortable tap-target heights.
- Compact mobile filter treatment is reusable rather than Events-only.
- Calendar-connected confirmations are treated as one-time acknowledgement content rather than permanent page chrome; actual calendar-loading warnings remain persistent when relevant.

### Find Schools
- Physical iPhone QA found recommendation-section headings too close in hierarchy to school-card headings.
- Mobile section headings now use a distinct red uppercase treatment so the beginning of a recommendation group is obvious on a phone.

### Public landing page
- Physical iPhone QA found oversized button typography and awkward hero wrapping.
- Mobile buttons now use smaller typography while maintaining 44px tap targets.
- Hero copy now preserves one sentence per line for “Your recruiting.”, “Your relationships.”, and “Your next move.” on phone widths.

### Owner View As / permissions
Static review confirms:
- Owner preview only activates after active organization Owner membership is verified.
- Preview context is preserved on internal navigation.
- Forms are globally blocked in preview mode.
- Mutation-labelled controls are blocked and surface the canonical read-only feedback.
- Parent navigation is permission-aware and support-oriented.
- Middleware prevents Parent access to athlete/staff-only route families and prevents Athlete/Staff cross-role route access outside approved preview context.
- Sole Owner database protection exists in migration history and remains a DB-level rule rather than a hidden-control convention.

### Onboarding
Static review confirms:
- Profile Essentials remains the setup gate.
- Tour is five steps: Recruiting History → Find Schools → Connections → Game Plan → Journey.
- Step progress is stored locally and resumes later.
- Explore does not erase the stored step.
- Continue/Skip is explicit.
- Completion clears the saved tour step and returns to Athlete Home.
- Optional recruiting/contact details are explicitly non-blocking.
- Getting Started Tour remains available from the Athlete account menu.

## Physical iPhone 14 / Safari evidence

A real-device pass was completed on iPhone 14 using Safari in portrait orientation.

Athlete/Player findings were captured with screenshots and remediated:
- Find Schools section hierarchy
- Stop Pursuing affordance
- Events persistent calendar notice treatment
- Events/search/filter clipped mobile text
- landing-page button typography and hero wrapping

Parent/Guardian review found no additional issues. Parent navigation remained single-selected and no athlete mutation/contact controls were reported as exposed.

This is valid physical-device evidence for iPhone 14 / Safari only. The remediation batch still requires successful exact-head build/deployment confirmation and a quick production regression spot-check before the iPhone findings are considered closed.

## Remaining Phase 6 findings

### P1 — Large organization/reporting datasets
Exports uses a deliberately bounded client query of up to 10,000 interactions and builds reports in-browser. This prevents unbounded loading, but the 10k path remains a commercial stress point because report generation and multiple derived reports share the same browser-resident interaction set.

Before Phase 6 closes at a 9.5 standard, this must have evidence from a representative large dataset. If the 10k stress pass causes noticeable blocking, memory pressure, incomplete reporting, or misleading truncation, the export path must be further changed rather than scored up.

### P1 — Additional degraded-network evidence
College Fit Insights and Athlete Connections now distinguish failure from empty data. Other Tier A client-heavy workflows still require controlled failed/slow-network evidence before receiving a 9.5 Loading/Error Recovery score. A source review alone does not prove runtime recovery behavior.

### P1 — Remaining browser/device evidence
Android Chrome and the desktop browser matrix remain external validation requirements. iPhone 14 / Safari is no longer open as an untested device category, but its remediation batch still needs post-deploy spot verification.

## Role-level Phase 6 status

These are current evidence scores, not aspirational close scores.

| Role | Product coherence | Permission model | Empty/new user | Degraded network | Large data | Mobile | Phase status |
|---|---:|---:|---:|---:|---:|---:|---|
| Athlete | 9.7 | 9.5 | 9.5 | 9.2 | 9.4 | 9.5* | Open: runtime + post-fix mobile spot-check |
| Parent / Guardian | 9.7 | 9.5 | 9.5 | 9.1 | 9.4 | 9.5 | Open: runtime evidence |
| Advisor | 9.5 | 9.5 | 9.5 | 9.3 | 9.1 | 9.2 | Open: Exports + rendered evidence |
| Owner / Admin | 9.5 | 9.5 | 9.5 | 9.2 | 9.0 | 9.2 | Open: org-scale + rendered evidence |

`*` Athlete mobile is provisionally 9.5 based on physical-device findings plus remediation; it remains open until the deployed fixes receive a production spot-check.

Anything below 9.5 remains a Phase 6 remediation target. These values are deliberately not rounded up.

## Canonical screen priorities

### Tier A — revenue/retention critical
Athlete Home, Find Schools, Connections, School relationship, Coach relationship, Game Plan, Journey, Events/Event Prep, Recruiting Health, Parent Support Center, Player 360°, Advisor Home, Advisor Connections, Organization, Recruiting Board, onboarding/account creation.

These require rendered happy-path, empty-state, permission, and mobile regression coverage.

### Tier B — important supporting workflows
Videos, Messages, Fit Profile, Compare, Profile, Manage Access, Settings, Player Activity, Tasks, Insights, Exports, College Fit Export, Owner Preview.

These require rendered smoke coverage plus targeted edge-state testing.

### Tier C — compatibility/public
Landing, auth recovery pages, Privacy, Terms, redirects/aliases.

These require navigation, mobile, accessibility, and redirect correctness.

## Ruthless simplification findings

Keep:
- canonical Home → Connections → Game Plan → Journey → Events loop
- Recruiting Health as explainable guidance
- Player 360° as staff/parent drill-down
- Event Prep before/during/after workflow
- role-specific language: Next Moves for athlete, Tasks for staff

Avoid adding:
- another communication inbox
- duplicate analytics cards that do not change a decision
- separate parent mutation workflows
- additional Journey stages inferred from activity
- parallel navigation destinations for the same concept

Simplify when touching a screen:
- one page purpose
- one visually dominant action per decision region
- secondary actions quieter
- filters grouped and scoped
- long forms grouped by purpose
- dense staff data starts with “what needs attention?” rather than raw totals

## Remaining external validation before Phase 6 can close

1. Post-deploy iPhone 14 / Safari spot-check of the remediated screens.
2. Actual Android Chrome pass on representative hardware.
3. Desktop Chrome, Edge, Firefox, Safari rendered pass.
4. Keyboard-only pass and screen-reader spot checks.
5. Seeded large-organization dataset stress pass, including 10k-interaction reporting.
6. Controlled slow/failing-network pass on Tier A workflows.
7. Brand-new account onboarding from signup through first meaningful recruiting action.
8. Final exact-head GitHub build success and production deployment confirmation.

These remain open until evidence exists. Phase 6 is not complete merely because the implementation is strong.
