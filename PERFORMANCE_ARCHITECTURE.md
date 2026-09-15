# Rebels Recruit Performance Architecture

## Hard mobile budgets
- LCP: < 2.5s
- INP: < 200ms
- CLS: < 0.10

`WebVitalsMonitor` records stable route-aware metrics in `performance_vitals`.

## Measured production priorities — September 15, 2026
The first real production sample replaces the earlier architecture-only ranking. Sample counts are still small on several routes, so use these as action signals rather than long-term benchmarks.

1. `/advisors` LCP — p75 5,625ms across 6 samples; all 6 exceeded budget. This is the clearest current performance target.
2. `/legal/accept` LCP — p75 3,542ms across 2 samples. Low sample count; monitor before structural work.
3. `/events` CLS — p75 0.3 across 11 samples; all 11 exceeded the 0.10 budget. Prioritize stable reserved layout space.
4. `/game-plan` CLS — p75 0.3 across 2 samples. Monitor as samples accumulate.
5. `/dashboard` LCP — p75 2,228ms across 3 samples, with one over-budget sample. Currently inside budget at p75 but close enough to watch.

Healthy signals in the same sample: `/profile` LCP p75 ~1,008ms; `/profile` INP p75 136ms; `/journey` INP p75 48ms; `/advisors` INP p75 48ms. Interaction latency is generally healthy; loading and layout stability are the current bottlenecks.

## Architecture rules
- Never download the college or coach directory for autocomplete. Use bounded server typeahead.
- Paginate instead of building unbounded client arrays.
- Fetch independent dashboard sources concurrently.
- Select only fields rendered or required for derived intelligence.
- Cap timeline/activity datasets and provide drill-down pages for history.
- Prefer optimistic local state for reversible mutations, with persistence-aware rollback.
- Multi-row relationship mutations must compensate/rollback if a later write fails.
- Defer expensive analytics that are not part of the screen's primary workflow.
- Reserve red for primary action, urgency and recruiting momentum.
- Prefer typography, whitespace and dividers over nested bordered cards.

## Database query/index audit
Production indexes already cover the primary access patterns reviewed for athlete relationships, interactions, reminders, advisor tasks, events, organization membership and advisor assignments. No speculative duplicate indexes were added in this pass. The next database change should be driven by measured slow-query evidence rather than index count.

## Current product changes tied to these findings
- Connections now compensates multi-row archive failures and restores associated school state when a coach is restored.
- Connections uses divider-based rows rather than a grid of nested cards.
- Organization Home now makes Recruiting Board the dominant workflow and defers the 50KB+ client command center and its multi-query analytics until explicitly opened.
- Global polish adds quieter toolbars/surfaces, stronger focus treatment, restrained 180ms interactions and a signature red primary-action treatment while honoring reduced-motion preferences.
