# Rebels Recruit Project Handoff

Last updated: 2026-09-11

Use this with `ROADMAP.md` and `RELEASE_CANDIDATE_AUDIT.md` when continuing development.

## Product

Rebels Recruit is a softball recruiting relationship and decision platform. It is not intended to be another coach-discovery marketplace or generic CRM. The core loop is:

**Activity -> Relationship context -> Intelligence -> Next Step -> Action -> New activity**

The product should help each role answer:
- Athlete: Who am I pursuing? What happened? What matters? What should I do next?
- Parent: How is recruiting going? Where can I help?
- Advisor: Who needs me today? Why? What should I do?
- Owner/Admin: How is the organization doing? What problems deserve attention?

Core principle: **Rebels Recruit should feel simpler as it becomes more powerful.**

## Production stack

- Next.js 15 App Router
- React 19
- TypeScript
- Tailwind CSS
- Supabase Auth + Postgres + RLS
- GitHub repo: `bobwad01-hue/rebels-recruit`
- Supabase project: `oopjkpguqkelbmujppgy`
- Production domain: `https://rebelsrecruit.com`
- Vercel project/team: `rebels-recruit` / `rebelsrecruit`
- `main` auto-deploys when Vercel Hobby build capacity is available.

Do not claim a commit is deployed until its exact Vercel status, or a newer equivalent deployment, is confirmed successful. GitHub Actions proves compile/test status but not production deployment by itself.

## Canonical terminology

- Use **Connections**, not CRM.
- Use **School / Schools** in generic user-facing copy, not College / Colleges. Actual institution names remain unchanged.
- Use **Next Step / Next Steps**, not Next Move / Next Moves.
- Parent navigation label: **Goals & Next Steps**.
- Athlete Activity canonical route: `/journey`; `/activity` remains legacy/supporting.
- Player detail canonical route: `/players/[id]` and is presented as **Player 360°**.
- Recruiting Health is a workflow check, not a talent grade or recruiting prediction.
- User-facing application copy should not use em dashes.
- Prefer action-specific CTAs such as `Email Coach`, `Log Activity`, `Add School`, `Assign Next Step`, `Prepare for Event`, and `Review Relationship`.

Internal identifiers such as `colleges`, `college_id`, `next_moves`, and legacy route names may remain for stability.

## Roles and ownership

### Athlete
Owns recruiting decisions and recruiting data. Athlete-owned canonical data includes schools, coaches, Journey/activity history, events, Next Steps, and videos.

### Parent / Guardian
Read-only/supportive by default. Parent access must come from active `parent_guardian_access` authorization. Read-only must remain navigable and useful without exposing athlete mutation actions.

### Advisor
May access athletes through an active advisor assignment or through organization membership/organization-view permission as allowed by `can_access_athlete()`.

### Owner / Admin
Organization-level access. Sole Owner protection prevents accidental removal, suspension, or demotion of the final active Owner.

## Multi-organization architecture

Athlete accounts and recruiting records belong to the athlete, not to an organization.

- An athlete can belong to multiple organizations simultaneously, such as travel + high school.
- Membership is independent per `(organization_id,user_id)`.
- Leaving one organization removes that organization's access but does not delete athlete-owned recruiting data or affect other memberships.
- Imported history retains source/provenance internally.
- Organization access is revocable.
- Do not claim/attach an athlete by name alone. Verified email, invitation, code, or another explicit authorized path is required.
- Imported players may exist as pending/unclaimed records before an account exists.
- Exact verified-email claim can connect imported history later.

### Important 2026-09-11 release fix

New accounts are now **organization-neutral by default**. The previous auth trigger automatically inserted every new account into the oldest organization. That violated player-owned multi-org isolation and was removed in live migration:

`20260912002613_stop_automatic_default_organization_membership`

Organization access must now come from an explicit join, approved import claim, invitation, or other authorized workflow.

The same trigger fix preserves `parent` as a valid signup profile role; password-based Parent signup is no longer silently converted to Athlete.

## Authorization validation

Core server/database rule: `can_access_athlete(target_athlete_id)`.

Release QA now includes:
- CI fixture for two-org athlete leave/rejoin behavior.
- CI fixture for Parent with two athletes and unauthorized-ID rejection.
- CI fixture for Advisor with 30 assigned athletes.
- CI fixture for Owner with 100 athletes.
- CI fixture for brand-new athlete and imported-but-unclaimed athlete.
- Rollback-only production-schema transaction confirming multi-org access/revocation, Parent access/revocation, Advisor-30 access, and Owner-100 access.

The rollback-only production test left zero QA auth users and zero QA organizations behind.

Real authenticated browser personas are still required before multi-org/multi-athlete/large-org behavior is called fully production-proven.

## Recruiting Journey

Canonical stages:

**Researching -> Target School -> Contacted -> Engaged -> Interested -> Visit/Camp -> Offer -> Committed**

Database legacy enum values may differ (`Target`, `Recruiting Interest`, etc.) and must be normalized for user-facing Journey language.

Journey stage must **never** be inferred automatically from activity.

Historical recruiting activity may have exact/month/year/unknown date precision. Only exact-date activity should count toward recency/cadence/momentum. Never invent historical dates from `created_at`.

Use `cleanDisplayNote()` to strip internal historical import keys from UI/export display.

## Recruiting Health

Deterministic and explainable. Athlete Home, `/health`, Player 360°, and Recruiting Board should use consistent logic.

Recruiting Board health score semantic bands:
- 80+ green
- 65-79 amber/yellow
- 50-64 orange
- under 50 red

Board copy: **Recruiting Health is a workflow check, not a talent grade.**

Keep relationship-specific recruiting pulse/relationship health conceptually separate from overall Recruiting Health.

## Weekly Goals / Momentum

- Limit to roughly 3 meaningful priorities.
- Weekly counts include exact-date meaningful recruiting activity, completed Next Steps, and completed advisor tasks.
- Month/year/unknown historical activity does not count toward current weekly momentum.
- Weekly counts should be drillable so the athlete can see what counted.
- Do not gamify logins or page views.

## Communication

Do not build another Gmail.

- Coach communication stays in channels coaches use.
- Gmail connection is athlete-owned and intentionally send-only (`gmail.send`), with no inbox-reading scope.
- Successful sends auto-log recruiting activity.
- `CoachActionBar` supports relationship review, Email, Text, Call, Log Activity, and Reminder.
- Emailing one coach can CC other known coaches at the same school.
- CC recipients are validated as same-school coaches, stored in `interaction_recipients`, and relationship recency syncs to athlete-coach relationships.

Future inbound communication detection should only be considered if broader scopes/privacy tradeoffs justify it.

## Events

Event Prep is a core recruiting workflow.

- Marking a relevant event Going creates `Email coaches before {event}` due 2 days before, or today if closer.
- Event Prep connects pre-event outreach, relationship context, readiness, debrief, and follow-up.
- First debrief creates Journey activity; later edits must not duplicate Event Debrief activity.
- Follow-up-needed can create an `event_followup` Next Step.
- Parent Events translates workflow into `How You Can Help`.
- Advisor event attendance supports player drill-down/coaching checkpoints.

## Parent experience

Primary routes:
- `/parent`
- `/parent/connections`
- `/parent/goals`
- `/parent/journey`
- `/parent/events`
- `/parent/discover?athlete=...`
- `/videos?athlete=...`

Parent athlete context must persist only among active authorized athlete IDs. Unauthorized athlete IDs in the URL must never switch Parent context.

## Advisor / Owner experience

Advisor navigation priorities:
- Home
- Connections
- Activity
- Insights
- Events
- Message Center
- Player Access
- Exports

Owner/Admin navigation priorities:
- Home
- Recruiting Board
- Connections
- Insights
- Activity
- Organization
- Events
- Message Center
- Player Access
- Exports

Advisor Home should answer Who / Why / What. Owner/Admin should emphasize exceptions and organization health rather than raw data volume.

Known scale risk: Advisor Home currently loads up to 4,000 interactions into the browser and performs repeated in-memory filtering. Move expensive organization intelligence/history aggregation server/database-side before large organizations are considered fully scale-proven.

## Legal / account lifecycle

Live foundation includes:
- `/terms` and `/privacy`.
- versioned `legal_document_versions`.
- immutable `user_legal_acceptances` evidence.
- required signup clickwrap.
- current-version reacceptance for existing users.
- athlete 13+ self-service signup affirmation and immutable age attestation.
- account deletion request/cancel workflow.
- Owner/Admin legal acceptance report + CSV.

Current product policy: athlete self-service signup is 13+. Under-13 athlete accounts are not supported unless a future counsel-reviewed COPPA flow is intentionally built.

Counsel/business decisions still required before commercial launch:
- final Terms/Privacy wording.
- state-specific minor/privacy review.
- retention periods.
- which legal/audit records survive deletion and for how long.
- deletion SLA and lawful/security exceptions.

## Support / operational readiness

Users can create diagnostic support cases from Settings for missing athletes, organization access, missing imports, Google connection problems, wrong-team membership, Parent access, deletion, and other issues.

Support system includes:
- limited diagnostic snapshots without copying recruiting-message content.
- organization-specific routing.
- Parent-aware organization routing through actively linked athletes.
- Owner/Admin organization switcher.
- Open / Investigating / Resolved / Reopen workflow.
- investigation/resolution notes.
- immutable `support_case_events` history.
- organization membership and Parent-access audit events.

Release QA found and fixed a PostgreSQL `min(uuid)` error in support auto-routing:

`20260912002423_fix_support_case_auto_routing`

Single-organization auto-routing, Parent routing, support resolution/reopen, legal acceptance, and deletion request/cancel were transactionally validated against the production schema and rolled back. No QA support records remained.

See `SUPPORT_PLAYBOOK.md`.

A platform-level workflow for general support cases from users with no organization remains an operational decision before commercial launch; organization-scoped Owner/Admin queues do not substitute for a platform support owner.

## Spreadsheet import/export

- Legacy vulnerable SheetJS/`xlsx` dependency removed.
- XLSX handling uses `exceljs-hardened`.
- Imports accept `.xlsx` and `.csv`; legacy `.xls` intentionally unsupported.
- 10 MB client-side upload limit before parsing.
- CI verifies XLSX round-trip, CSV embedded quotes/newlines, month/year date preservation, malformed XLSX rejection, and a 5,000-row workbook workload.
- Server export cleans historical import keys and uses School terminology.

Current CI blocks high-severity production dependency audit findings. A moderate transitive `uuid` advisory remains through `exceljs-hardened`; do not run `npm audit fix --force` blindly.

## Reliability standard

Every major page must distinguish:
1. genuine empty data.
2. no access.
3. required load failure.
4. partial supporting-data failure.

One failed supporting query should not blank an otherwise useful page. Mutation failures should not silently look successful.

Major Athlete, Parent, Advisor, Events, Connections, Recruiting Health, Messages, Videos, imports, Support, and Report Center surfaces have been hardened. Forced-failure regression testing remains a release gate.

## CI release guards

`.github/workflows/build.yml` runs:
- `npm audit --omit=dev --audit-level=high`
- `npm run audit:language`
- `npm run test:fixtures`
- `npm run test:spreadsheets`
- `npm run test:scale`
- `npm run build`

Synthetic scale guard currently covers 100 athletes, 50,000 interactions, 2,000 athlete-school relationships, and 1,200 athlete-coach relationships.

## Deployment status guidance

The app commit `6a2cb6bfdefdd0e299185fbee4434a4c2502dc54` was confirmed successful in both GitHub Actions and Vercel. Subsequent changes through the current work primarily mirror live Supabase migrations and update QA documentation. The database migrations themselves are already live; Vercel may still rate-limit documentation/migration-only commits.

Never claim a later commit is deployed unless its Vercel status is verified.

## Development rules

- Inspect current code before editing.
- For GitHub `update_file`, use the current blob SHA.
- Make Supabase schema/function changes with migrations and mirror each migration into `supabase/migrations/`.
- Never expose Supabase service-role credentials to the browser.
- Never use editable user metadata as the final source of authorization.
- Preserve athlete ownership of recruiting data and revocable organization access.
- Never auto-claim imported athlete history by name alone.
- Journey stage is athlete-controlled; do not infer it from activity.
- Do not invent historical dates.
- Do not call source-complete work production-deployed without exact deployment verification.
- Keep `ROADMAP.md` current for unfinished work.
- Read `RELEASE_CANDIDATE_AUDIT.md` before calling release-candidate work complete.
