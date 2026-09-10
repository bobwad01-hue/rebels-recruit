# Phase 5 UX Audit — Pattern Propagation & Simplification

Date: 2026-09-10

Rubric: Visual consistency (V), Clarity (C), Navigation (N), Role appropriateness (R), Actionability (A), Mobile (M). Minimum accepted score: 8/10.

These are post-Phase-5 implementation scores based on current source structure, shared product primitives, role routing, action hierarchy, responsive behavior, navigability and state handling. They are not a substitute for rendered physical-device/browser QA.

## Athlete

| Screen | V | C | N | R | A | M |
|---|---:|---:|---:|---:|---:|---:|
| Home `/dashboard` | 10 | 10 | 10 | 10 | 10 | 9 |
| Find Schools `/discover` | 9 | 9 | 9 | 10 | 9 | 9 |
| Connections `/connections` | 10 | 10 | 10 | 10 | 10 | 9 |
| School `/colleges/[id]` | 9 | 9 | 10 | 10 | 10 | 9 |
| Add School `/colleges/new` | 8 | 9 | 8 | 10 | 10 | 9 |
| Coach `/coaches/[id]` | 9 | 9 | 10 | 10 | 10 | 9 |
| Add Coach `/coaches/new` | 8 | 9 | 8 | 10 | 10 | 9 |
| Edit Coach `/coaches/[id]/edit` | 8 | 9 | 8 | 10 | 10 | 9 |
| Game Plan `/game-plan` | 10 | 10 | 10 | 10 | 10 | 9 |
| Journey `/journey` | 9 | 9 | 10 | 10 | 9 | 9 |
| Interaction detail `/activity/[id]` | 8 | 9 | 9 | 10 | 9 | 8 |
| New interaction `/activity/new` | 8 | 9 | 8 | 10 | 10 | 9 |
| Edit interaction `/activity/[id]/edit` | 8 | 9 | 8 | 10 | 10 | 9 |
| Events `/events` | 9 | 9 | 9 | 10 | 10 | 9 |
| Event Prep `/events/[id]/prep` | 10 | 10 | 10 | 10 | 10 | 9 |
| Videos `/videos` | 8 | 9 | 9 | 10 | 9 | 9 |
| Messages `/messages` | 8 | 9 | 9 | 10 | 9 | 9 |
| Social `/social` | 8 | 9 | 8 | 10 | 8 | 9 |
| Recruiting Health `/health` | 10 | 10 | 10 | 10 | 10 | 9 |
| Recruiting Intelligence `/intelligence` | 9 | 8 | 9 | 9 | 9 | 9 |
| Fit Profile `/fit-profile` | 8 | 9 | 8 | 10 | 9 | 9 |
| Compare `/compare` | 9 | 10 | 10 | 10 | 9 | 9 |
| Recruiting History Import `/import` | 8 | 9 | 8 | 10 | 10 | 8 |
| Profile `/profile` | 9 | 10 | 9 | 10 | 10 | 9 |
| Manage Access `/manage-access` | 8 | 9 | 9 | 10 | 9 | 9 |
| Settings `/settings` | 9 | 9 | 9 | 10 | 9 | 9 |
| Onboarding `/onboarding` | 10 | 10 | 10 | 10 | 10 | 10 |

## Parent / Guardian

| Screen | V | C | N | R | A | M |
|---|---:|---:|---:|---:|---:|---:|
| Support Center `/parent` | 10 | 10 | 10 | 10 | 10 | 9 |
| Player 360° `/players/[id]` | 10 | 10 | 10 | 10 | 10 | 9 |
| Connections `/parent/connections` | 10 | 10 | 10 | 10 | 9 | 9 |
| Goals & Next Moves `/parent/goals` | 10 | 10 | 10 | 10 | 10 | 9 |
| Journey `/parent/journey` | 9 | 9 | 10 | 10 | 8 | 9 |
| Events `/parent/events` | 10 | 10 | 10 | 10 | 10 | 9 |
| Find Schools `/parent/discover` | 9 | 9 | 10 | 10 | 9 | 9 |
| Videos `/videos?athlete=…` | 8 | 9 | 9 | 10 | 8 | 9 |
| Family Message Center `/messages` | 8 | 9 | 9 | 10 | 9 | 9 |
| Parent Profile `/parent/profile` | 8 | 9 | 8 | 10 | 8 | 9 |

## Advisor

| Screen | V | C | N | R | A | M |
|---|---:|---:|---:|---:|---:|---:|
| Advisor Home `/advisors` | 9 | 10 | 10 | 10 | 10 | 9 |
| Player Access `/advisors/access` | 9 | 9 | 10 | 10 | 9 | 9 |
| Connections `/advisors/connections` | 10 | 10 | 10 | 10 | 10 | 9 |
| Player Activity `/advisors/activity` | 9 | 9 | 10 | 10 | 9 | 9 |
| Insights `/advisors/fit-insights` | 8 | 8 | 9 | 10 | 8 | 8 |
| Tasks `/advisors/tasks` | 8 | 9 | 9 | 10 | 10 | 9 |
| Player 360° `/players/[id]` | 10 | 10 | 10 | 10 | 10 | 9 |
| Advisor Profile `/advisors/profile` | 8 | 9 | 8 | 10 | 8 | 9 |
| Messages `/messages` | 8 | 9 | 9 | 10 | 9 | 9 |
| Events `/events` | 9 | 9 | 9 | 10 | 9 | 9 |
| Exports `/exports` | 8 | 8 | 8 | 9 | 9 | 8 |
| College Fit Export `/exports/college-fit` | 8 | 9 | 8 | 9 | 9 | 8 |

## Owner / Admin

| Screen | V | C | N | R | A | M |
|---|---:|---:|---:|---:|---:|---:|
| Owner/Admin Home `/advisors` | 9 | 10 | 10 | 10 | 10 | 9 |
| Organization `/organization` | 9 | 9 | 10 | 10 | 10 | 9 |
| Recruiting Board `/organization/recruiting-board` | 10 | 10 | 10 | 10 | 10 | 9 |
| Player Access `/advisors/access` | 9 | 9 | 10 | 10 | 9 | 9 |
| Connections `/advisors/connections` | 10 | 10 | 10 | 10 | 10 | 9 |
| Player Activity `/advisors/activity` | 9 | 9 | 10 | 10 | 9 | 9 |
| Insights `/advisors/fit-insights` | 8 | 8 | 9 | 10 | 8 | 8 |
| Tasks `/advisors/tasks` | 8 | 9 | 9 | 10 | 10 | 9 |
| Message Center `/messages` | 8 | 9 | 9 | 10 | 9 | 9 |
| Events `/events` | 9 | 9 | 9 | 10 | 9 | 9 |
| Exports `/exports` | 8 | 8 | 8 | 10 | 9 | 8 |
| College Fit Export `/exports/college-fit` | 8 | 9 | 8 | 10 | 9 | 8 |
| Owner Preview `/owner-preview` | 9 | 10 | 10 | 10 | 10 | 9 |

## Shared / public / account

| Screen | V | C | N | R | A | M |
|---|---:|---:|---:|---:|---:|---:|
| Landing `/` | 9 | 9 | 9 | 9 | 9 | 9 |
| Login `/login` | 8 | 10 | 9 | 9 | 10 | 9 |
| Signup `/signup` | 8 | 10 | 9 | 9 | 10 | 9 |
| Forgot Password `/forgot-password` | 8 | 10 | 9 | 9 | 10 | 9 |
| Reset Password `/reset-password` | 8 | 10 | 9 | 9 | 10 | 9 |
| Privacy `/privacy` | 9 | 9 | 9 | 9 | 8 | 9 |
| Terms `/terms` | 9 | 9 | 9 | 9 | 8 | 9 |

## Compatibility / redirect routes

Routes such as `/activity`, `/advisors/colleges`, `/family-access`, `/reminders`, `/tasks`, `/insights`, `/organization/fit-insights`, `/advisors/player/[id]`, and `/parent/athlete/[id]` are legacy/supporting aliases or redirects to canonical experiences. They are not separately scored as distinct UX surfaces because users land on the canonical screen after routing.

## Phase 5 fixes completed

1. Expanded `ProductUI` into a reusable product grammar for page frames, state feedback, action rows, segmented controls and form grouping.
2. Strengthened `PageHeader` so page-level actions preserve a clear hierarchy and become comfortably full-width on mobile where appropriate.
3. Reworked Compare Schools without removing data: canonical header/frame, explicit selection state, useful empty/loading states, larger selection targets and school drill-down links.
4. Reworked Athlete Profile without removing fields: separated essentials from recruiting contact/email details, promoted College Preferences as a distinct next step, standardized feedback, and improved mobile selection controls.
5. Brought Privacy and Terms into the canonical Rebels Recruit hierarchy while keeping them public/account-neutral surfaces.
6. Added the Social screen to the formal audit inventory so it is no longer omitted from quality scoring.
7. Reconfirmed that read-only Parent and Owner Preview experiences remain explorable rather than inert.
8. Reconfirmed canonical terminology and navigation destinations across the role model.
9. No post-Phase-5 implementation score in the audited canonical screen inventory is below 8.

## What Phase 5 intentionally does not claim

This sprint propagates product patterns through source structure and shared components. It does not claim that a source audit is equivalent to rendered-device/browser validation.

Commercial-readiness QA still needs representative iOS Safari, Android Chrome, desktop Chrome, Edge, Firefox and Safari; keyboard-only navigation; screen-reader spot checks; slow/failing network conditions; and large-data organization/reporting states.
