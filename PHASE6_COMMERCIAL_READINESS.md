# Phase 6 — Commercial Readiness & Product Polish

Date: 2026-09-11

## Goal

Make Rebels Recruit commercially trustworthy without adding major product surface area. Phase 6 is a quality gate: prove the existing product works coherently across roles, devices, data volumes, permission boundaries, new-user states, and degraded network conditions; remove friction where the product asks users to think unnecessarily.

## Non-negotiable product rule

Do not add a feature merely to solve a presentation problem. Prefer, in order: remove, combine, clarify, reuse an existing primitive, then add only what remains necessary.

## Commercial readiness matrix

Every canonical screen is reviewed against:

1. Visual consistency
2. Clarity
3. Navigation
4. Role appropriateness
5. Actionability
6. Mobile behavior
7. Empty/new-user behavior
8. Loading/error recovery
9. Permission safety
10. Large-data resilience

No category may score below 8 before Phase 6 closes.

## Rendered QA viewports

Phone widths: 375px, 390px, 430px.
Desktop widths: 1280px and 1440px.

Target browser/device coverage for final external validation:
- iOS Safari
- Android Chrome
- desktop Chrome
- Edge
- Firefox
- Safari

Automated/emulated browser validation is useful evidence but must not be described as a physical-device test.

## Role journeys

### Athlete
New account/profile essentials → onboarding → Find Schools → add school → Connections → coach relationship → Game Plan/Next Move → Journey → Event Prep → Recruiting Health.

### Parent / Guardian
Support Center → Player 360° → Connections → Goals & Next Moves → Journey → Events → Find Schools/Videos where permitted. Parent remains support-oriented and cannot mutate athlete recruiting decisions or contact coaches.

### Advisor
Home → Player Access → Player 360° → Connections → Player Activity → Insights → Tasks → Events → Exports. The experience must answer who needs help, why, and what the advisor should do.

### Owner / Admin
Home → Organization → Recruiting Board → player drill-down → Connections/Activity → Insights/Tasks → Events/Exports. Owner View As is read-only QA context, never impersonation.

## New-user and empty-state gate

Test with:
- athlete with profile essentials only
- athlete with zero schools/coaches/activity/events/videos
- parent with no active athlete access
- advisor with zero assigned players
- organization with zero active athletes
- athlete with incomplete Fit Profile
- no upcoming events
- no Next Moves
- no exact-date activity

Each empty state must say what is missing, why it matters, and provide the next useful action when permissions allow. Read-only users get an exploration/support action rather than a mutation action.

## Degraded-network gate

Critical screens must have named loading states and recoverable error states. A failed request must not look like legitimate zero data. Retry/recovery should be available where a reload is not obvious. Loading should not create destructive layout jumps on core workflows.

## Large-data gate

Representative stress targets:
- 100+ athletes in organization views
- 100+ school relationships for staff aggregate views
- 500+ coach relationships
- 10,000 interaction rows in reporting/export paths
- long school/coach/player names
- large filter option sets

Dense data must not widen the viewport. Lists/tables need bounded rendering, filtering, pagination/virtualization, or an intentionally constrained result set when the data size can materially affect usability/performance.

## Permission gate

Verify server/database enforcement in addition to hidden UI controls for:
- Parent read-only restrictions
- Advisor assigned-player scope
- organization-wide access flag
- Admin vs Owner authority
- sole Owner protection
- Owner View As mutation blocking
- athlete ownership of Journey stage and recruiting decisions

A hidden button is not a permission boundary.

## Onboarding gate

A brand-new athlete must be able to:
1. create/sign in to an account
2. complete Profile Essentials
3. understand the five-step tour
4. Explore a step without losing tour progress
5. Continue/Skip intentionally
6. resume later from the account menu
7. complete onboarding and land on Home

Optional recruiting/contact details must not block entry into the product.

## Simplification gate

For every major screen ask:
- Is there one obvious primary purpose?
- Is there one obvious next action in each decision region?
- Can any explanatory copy be shortened without losing meaning?
- Can duplicate metrics/actions be removed?
- Can a bespoke card/control become a shared ProductUI primitive?
- Does a read-only role see controls it cannot use?
- Does the page expose internal implementation language instead of recruiting language?
- Does every apparently clickable entity actually navigate?

## Build/deployment gate

A Phase 6 change is not complete until the exact commit has a successful build. Production is not called live until the exact commit or a newer commit is confirmed deployed successfully.

## Phase 6 close criteria

Phase 6 closes only when:
- canonical screen audit is complete for all roles
- no score is below 8
- exact head commit builds successfully
- production deployment is confirmed
- browser/device validation results are explicitly separated into automated/emulated vs physical-device evidence
- unresolved commercial blockers are documented rather than hidden by scoring
