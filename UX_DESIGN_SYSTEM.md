# Rebels Recruit UX System

The athlete Home experience is the canonical visual and interaction reference for the entire application.

## Visual hierarchy
Every authenticated page should use: red uppercase context eyebrow → strong black page/section title → muted explanatory copy → content. Use `PageHeader` for page-level hierarchy and `SectionHeader` for major in-page sections.

## Shared primitives
Use `components/ProductUI.tsx` for new and refactored screens:
- `SectionHeader`
- `MetricCard` (use `href` whenever underlying detail exists)
- `PriorityCard`
- `EmptyState`
- `FilterBar`
- `EntityLink`

## Navigation rule
If an entity, metric, signal, warning, summary, event, school, coach, player, Next Move, pipeline stage, or activity has meaningful underlying information, it must be explorable subject to role permissions. Read-only means non-mutating, not inert.

Canonical destinations:
- Player → `/players/[id]`
- School relationship → `/colleges/[id]` with athlete context when staff/parent context requires it
- Coach relationship → `/coaches/[id]` with athlete context when required
- Athlete Journey → `/journey`
- Staff Player Activity → `/advisors/activity`
- Parent Journey → `/parent/journey?athlete=[id]`
- Athlete Next Moves → `/game-plan`
- Parent Goals / Next Moves → `/parent/goals?athlete=[id]`
- Events → role-appropriate Events view / event prep

Preserve `athlete`, `previewRole`, and `previewAthlete` query context when moving through parent/staff preview surfaces.

## Cards
White cards, subtle neutral border, 18px radius. Priority/action cards may use the light Rebels Red treatment. Avoid decorative color. Semantic green is reserved for genuine success/positive confirmation.

## Filters
Use a consistent labeled filter bar. Mobile collapses to one column. Inputs and buttons must be at least 44px high on small screens.

## Timelines
Athlete Journey, Parent Journey, and Staff Player Activity share one visual language: month separators, vertical rail, event/activity marker, expandable cards, consistent category pills, school/coach/player entity links, exact-date distinction, and filters. Imported history must be labeled and must never expose historical import keys.

## Empty states
Never show a dead blank panel or only “No data.” Explain what is missing and provide the most useful next action when the role is allowed to take one.

## Role behavior
- Athlete: owns recruiting decisions and coach outreach.
- Parent/Guardian: support-oriented, permission-aware, read-only for athlete recruiting decisions, but fully navigable.
- Advisor: action-oriented around assigned/accessible athletes; Player 360° is canonical drill-down.
- Admin: organization administration and support, except protected owner controls.
- Owner: organization-wide visibility and administration; sole owner cannot be suspended, deleted, or demoted.

## Accessibility
All interactive cards must be keyboard reachable. Use visible Rebels Red focus rings. Avoid nested interactive surfaces. Respect reduced motion. Buttons/inputs use mobile-friendly tap targets.
