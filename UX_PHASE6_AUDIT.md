# Phase 6 UX Audit — Commercial Readiness & Product Polish

Date: 2026-09-11

## Evidence standard

Phase 5 explicitly left rendered browser/device, degraded-network, large-data, and permission validation open. Phase 6 treats those as commercial readiness gates rather than assuming responsive source code proves them.

Current audit combines the Phase 5 canonical inventory with a Phase 6 source/architecture review. Scores below are not upgraded merely because a screen previously scored well. Physical-device claims remain open until tested on actual hardware.

## Findings requiring Phase 6 attention

### P0 — Build/deploy reliability
The responsive Athlete Home change exposed a syntax failure in `WeeklyRecruitingMomentum.tsx`. That source defect has been corrected. Phase 6 requires exact-commit build success before a change is considered complete.

### P1 — Degraded-network semantics
Several client-heavy screens still collapse some request failures into empty arrays or generic unavailable states. Commercial behavior must distinguish “there is no data” from “we could not load the data.” Critical role dashboards and decision screens should provide a named loading state plus recoverable error state.

### P1 — Large organization/reporting datasets
Exports intentionally fetch up to 10,000 interactions and build reports client-side. That is acceptable for current scale but is a defined stress point. Organization analytics/reporting must be tested with representative large datasets before commercial scale is claimed.

### P1 — Staff Insights polish
College Fit Insights remains one of the least-propagated staff screens: it uses bespoke metrics/loading/error layout rather than the strongest shared Phase 5 product grammar. Functionality is useful, but the commercial polish target is to bring it to the same clarity/state behavior as Athlete Home, Connections, and Player 360°.

### P1 — Physical device/browser evidence
Source-responsive confidence is not physical-device validation. 375/390/430 phone widths and the browser matrix remain an explicit external validation requirement.

## Role-level Phase 6 status

| Role | Product coherence | Permission model | Empty/new user | Degraded network | Large data | Mobile | Status |
|---|---:|---:|---:|---:|---:|---:|---|
| Athlete | 10 | 9 | 9 | 8 | 9 | 9 | Strong; rendered regression pass required |
| Parent / Guardian | 10 | 9 | 9 | 8 | 9 | 9 | Strong; permission regression pass required |
| Advisor | 9 | 9 | 8 | 8 | 8 | 8 | Commercially credible; Insights/Exports are polish targets |
| Owner / Admin | 9 | 9 | 8 | 8 | 8 | 8 | Strong core; organization-scale validation required |

No role-level score is below 8, but an 8 indicates an active validation/polish target, not “finished forever.”

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

## Test scenarios

### New athlete
Profile Essentials only; zero recruiting data; onboarding resume/skip/explore; first school; first coach; first activity; first Next Move; first event.

### Parent
No access; pending access; active limited permissions; active broad permissions; confirm no athlete mutation/contact actions.

### Advisor
Zero assignments; one athlete; many athletes; assigned-only scope; task/activity drill-down; export scope.

### Owner/Admin
Empty organization; 100+ athletes; View As Athlete/Parent/Advisor; sole Owner protection; organization-wide vs assigned scope.

### Network
Offline/failed Supabase request, slow response, failed auxiliary API call, retry/reload, no false empty state.

### Content stress
Very long names/notes, 100+ schools, 500+ coaches, 10k interactions, many filter values, no horizontal viewport widening.

## Current score interpretation

The product remains around the 9/10 commercial-product range in source/product coherence. Phase 6 is not intended to inflate that number. Its purpose is to replace assumptions with evidence and eliminate commercial blockers discovered by rendered and stress testing.

## Remaining external validation before Phase 6 can be declared fully closed

1. Actual iOS Safari test on representative iPhone.
2. Actual Android Chrome test on representative Android phone.
3. Desktop Chrome, Edge, Firefox, Safari rendered pass.
4. Keyboard-only pass and screen-reader spot checks.
5. Seeded large-organization dataset stress pass.
6. Controlled slow/failing-network pass.
7. Brand-new account onboarding from signup through first meaningful recruiting action.

These are deliberately not marked complete from source inspection alone.
