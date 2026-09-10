# Phase 5 — Pattern Propagation & Simplification

Date: 2026-09-10

Phase 5 takes the strongest product decisions established in Phases 1–4 and makes them the default grammar of Rebels Recruit. The goal is not to remove capability. The goal is to reduce the amount of UI interpretation required to use that capability.

## Product outcome

Rebels Recruit should feel materially simpler while retaining the same recruiting power.

The platform now has a known set of successful patterns. Phase 5 stops treating those patterns as page-specific solutions and turns them into reusable product rules.

## 1. One page hierarchy

Authenticated product pages should use the same hierarchy whenever practical:

1. Rebels-red uppercase context eyebrow.
2. Strong page title.
3. One short explanatory sentence.
4. One clearly prioritized page-level action when needed.
5. Content grouped into purposeful cards/sections.

`PageHeader` is the canonical page header. Phase 5 strengthens its mobile action behavior so primary actions become full-width at small widths instead of creating narrow or competing controls.

## 2. Shared product primitives

`components/ProductUI.tsx` is the canonical home for reusable product presentation patterns.

Phase 5 adds and standardizes:

- `PageFrame` — consistent responsive page width and outer spacing.
- `SectionHeader` — consistent section hierarchy and optional section action.
- `MetricCard` — canonical metric treatment, navigable when a drill-down exists.
- `PriorityCard` — canonical high-priority/next-action treatment.
- `EmptyState` — explains what is missing, why it matters, and what the user can do next.
- `StatePanel` — named info/success/warning/error feedback with recovery context.
- `FilterBar` — consistent filter grouping.
- `ActionRow` — predictable primary/secondary action layout.
- `SegmentedControl` — compact mode/tab switching without inventing page-specific tab styles.
- `FormSection` — groups related form fields into understandable chunks.
- `EntityLink` — explicit navigability for players, schools and coaches.

New feature work should extend these primitives before creating a new one-off pattern.

## 3. Progressive simplification

The platform keeps its underlying power, but complexity should be revealed only when it helps the current decision.

Permanent rules:

- One obvious primary action per decision region.
- Secondary actions remain available but visually quieter.
- Large forms are grouped by purpose rather than presented as one uninterrupted field wall.
- Filters explain the scope they change.
- A comparison or analytics screen should explain what to select before showing dense data.
- Read-only roles remain fully explorable; mutation restrictions must not remove useful context.
- Tables and dense analytics should provide entity links back to the underlying relationship context.

## 4. Pattern propagation fixes in this sprint

### Shared shell

`PageHeader` now applies consistent mobile action sizing and keeps the content/action hierarchy stable across roles.

### Shared UI library

`ProductUI` now contains the Phase 5 layout, feedback, action, segmented-control and form-grouping primitives so future pages do not need to recreate them.

### Compare Schools

`/compare` was one of the clearest remaining legacy-layout screens. Phase 5 now gives it:

- canonical `PageHeader` and `PageFrame`;
- a direct route back to Connections;
- explicit 0–4 selection state;
- a clear requirement to select at least two schools;
- canonical loading/empty states;
- 44px school-selection controls;
- school names in the comparison table linked to full school relationship context;
- clearer separation between school selection and dense comparison data.

The underlying comparison data is unchanged.

### Athlete Profile

`/profile` retained all existing data but previously presented most of it as one large card. Phase 5 now groups the same capability into:

- Profile Essentials;
- Recruiting Contact & Email Profile;
- a distinct College Preferences priority card;
- canonical success/warning feedback;
- canonical page hierarchy and responsive page frame;
- larger position-selection targets with pressed-state semantics.

No profile fields were removed.

### Privacy / Terms

The shared legal-page component now uses the same brand hierarchy, responsive spacing, readable section typography and mobile tap targets as the product while preserving public-page separation from the authenticated app.

## 5. Terminology propagation

Canonical terminology remains:

- Connections, not CRM.
- Schools in user-facing copy where practical.
- Next Moves for athlete actions.
- Tasks for staff-assigned work.
- Journey for athlete activity/history.
- Player 360° for the canonical player detail experience.

Old route names may remain for compatibility, but navigation and visible language should follow the canonical vocabulary.

## 6. Navigation propagation

Anything that looks explorable should lead somewhere useful when permissions allow it.

- player → Player 360°;
- school → school relationship/context;
- coach → coach relationship;
- event → event/event prep;
- metric → filtered or underlying detail;
- warning/signal → underlying entity or action;
- Next Move/Task → actionable context.

Phase 5 specifically closes the comparison-table dead end by linking compared school names back to school context.

## 7. State propagation

Every meaningful loading, empty or error state should answer the user’s next question.

- Loading: name what is being loaded.
- Empty: say what is missing and why it matters.
- Error: explain the recovery path or next useful destination.
- Success: confirm the user’s action without creating a new competing workflow.

`StatePanel` and `EmptyState` are the preferred reusable implementations.

## 8. Mobile simplification

Phase 5 preserves the Phase 4 mobile baseline and adds a stronger rule: page-level primary actions should not become cramped desktop controls on phones.

Mobile implementation scores continue to represent responsive-code confidence, not unperformed physical-device testing.

## 9. Definition of done

Every audited screen is rescored for:

- Visual consistency /10
- Clarity /10
- Navigation /10
- Role appropriateness /10
- Actionability /10
- Mobile /10

Any score below 8 must be fixed before Phase 5 is complete.

The Phase 5 audit is recorded in `UX_PHASE5_AUDIT.md`.
