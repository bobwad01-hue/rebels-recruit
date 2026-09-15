# Rebels Recruit Performance Architecture

## Hard mobile budgets
- LCP: < 2.5s
- INP: < 200ms
- CLS: < 0.10

`WebVitalsMonitor` records these metrics by route in `performance_vitals`. Over-budget samples are indexed for fast review.

## Highest-priority routes
The first performance review should rank real field data, with these high-complexity surfaces watched first:
1. `/advisors` — organization-wide relationship/activity aggregation.
2. `/organization` — command-center aggregation.
3. `/dashboard` — athlete home fan-out across recruiting sources.
4. `/connections` — relationship board and school/coach joins.
5. `/game-plan` — reminders, plans, schools and event preparation.

Do not treat this ordering as permanent. Once field samples accumulate, rank by p75 LCP/INP/CLS and over-budget rate.

## Architecture rules
- Never download the college or coach directory for autocomplete. Use `/api/search/colleges` and `/api/search/coaches` with debounced, bounded typeahead.
- Default search page size is 20; paginate instead of unbounded client arrays.
- Fetch independent dashboard sources concurrently.
- Select only fields rendered or required for derived intelligence.
- Cap timeline/activity datasets and provide drill-down pages for history.
- Prefer optimistic local state for reversible mutations; rollback on error.
- Reserve red for primary action, urgency and recruiting momentum.
- Prefer typography, whitespace and dividers over nested bordered cards.

## Database
The performance migration adds targeted indexes for active athlete relationships, event dates, organization role lookups, notifications, and Web Vitals reporting. Existing indexes already cover core athlete/date, reminder/status/due-date, game-plan period and advisor task access patterns.
