# Phase 2 — Action & Intelligence

Date: 2026-09-10

Phase 2 makes the existing product materially simpler by turning summary information into explainable, role-aware action. It does not add a new feature family; it strengthens Home dashboards, Recruiting Health, Recruiting Intelligence, Next Moves, Player 360° and Connections.

## Canonical product rules

1. **Recruiting Health is one score everywhere.** Athlete Home, Recruiting Health, Player 360° and the Organization Recruiting Board must use the same deterministic `buildRecruitingIntelligence` engine. No page may invent a second health formula.
2. **Recruiting Health must be explainable.** The user can see the factors that move the score, the score effect of each factor and where to go to improve it. Health is a process-health signal, not a prediction that a player will be recruited.
3. **Exact-date rules remain strict.** Month/year/unknown-date history remains visible as history but never drives recency, cadence, momentum or stale-contact calculations.
4. **Journey stage remains athlete-owned.** Activity, email, events and intelligence never automatically infer or advance a recruiting stage.
5. **Every summary should drill down.** Metrics, signals, milestones, school/coach names, events and Next Moves open the underlying context whenever a safe destination exists.
6. **Read-only is navigable, not inert.** Parents can explore approved context but cannot make athlete recruiting decisions or contact coaches on the athlete's behalf.
7. **Next Moves are the athlete action layer.** Reminders, advisor tasks, event preparation and relationship follow-up may have different sources, but athletes see a coherent Next Moves experience with source, why/context, due information and an obvious action.
8. **Staff uses Tasks.** Advisors/Owners/Admins may assign Tasks; they do not masquerade as athlete-owned Next Moves.
9. **Context must survive navigation.** Staff and parent school/coach links preserve athlete context. Owner Preview must preserve preview context where supported.
10. **Connections is the relationship workspace.** User-facing language is Schools and Coaches; database names may remain `colleges` internally.
11. **No color creep.** Product surfaces stay White / Rebels Red / Black / Gray, with semantic green only for genuine success/positive confirmation.
12. **Positive progress belongs beside warnings.** Dashboards should show momentum and progress as well as stale/overdue signals.

## Phase 2 implementation completed

- Unified Recruiting Health around `buildRecruitingIntelligence` and exposed its factor breakdown/formula.
- Rebuilt `/health` as the canonical transparent explanation of Recruiting Health.
- Athlete Home health, metric cards, priority signal, milestones and section summaries now drill into underlying context.
- Player 360° metric cards, intelligence signals, Journey activity, Connections and upcoming events are role-aware and navigable for Athlete, Parent, Advisor, Owner and Admin.
- Smart Next Moves now shows source/context, uses palette-safe priority styling, formats dates clearly, links event preparation directly, and supports role/preview URL transforms.
- Parent Support Center progress cards and priority support card now drill into the approved source context.
- Parent Goals & Next Moves now makes each read-only item explorable without giving the parent athlete actions.
- Staff Connections now avoids ambiguous shared school/coach detail routes and exposes explicit athlete-specific relationship drill-downs.
- Parent Connections now explains the support role, formats exact-contact dates and improves empty states.
- Organization Recruiting Board now uses the same Recruiting Health engine as Athlete/Player 360° and its top metrics filter the board directly.
- Athlete Game Plan now uses the canonical page hierarchy, distinguishes Readiness from Recruiting Health, improves empty states and makes the route from setup fundamentals to Health explicit.
- Athlete Connections now explicitly describes itself as the relationship workspace.

## Metric distinction

**Recruiting Health** is the deterministic whole-process score used by Athlete Home, `/health`, Player 360° and the Organization Recruiting Board. It currently considers school progress, active coach relationships, recent exact-date meaningful activity and urgent/open-priority penalties.

**Recruiting Pulse** remains a relationship-engagement measure used in staff/relationship intelligence surfaces. It should not be presented as interchangeable with Recruiting Health. Future UI changes should preserve that distinction if both metrics remain in the product.

## Definition of done for Phase 2

- No targeted Action & Intelligence screen has a rubric score below 8 in the static implementation audit.
- Health is consistent and explainable.
- Summary cards expose a useful destination instead of dead-end information.
- Parent actions remain support-oriented.
- Staff actions remain specific and assignable.
- Next Move context is visible and navigable.
- Relationship navigation preserves athlete context.
- Mobile scores are implementation scores only; real-device/browser validation remains a later Quality sprint requirement.
