# Phase 7 — Premium Experience & Simplification

Date: 2026-09-11

## Goal

Make Rebels Recruit feel unusually easy, calm, responsive, human, and intelligent without adding major product surface area. The interface should get quieter as Rebels Recruit gets smarter.

Phase 7 begins after Phase 6 commercial-readiness hardening and uses Phase 6 evidence as its baseline. This is not a feature sprint. Existing recruiting power remains intact unless a workflow is intentionally simplified without removing necessary capability.

## Rebels Recruit Experience Standard

Every canonical screen must answer within roughly five seconds on a phone:

1. Where am I?
2. What matters here?
3. Why does it matter?
4. What should I do next?
5. Where do I go for more detail?
6. Can I understand all of that without scanning unnecessary UI?

If a screen cannot answer those questions, simplify its hierarchy before adding anything.

## Product principles

### 1. Quiet intelligence
Prefer a small number of high-confidence priorities over more cards, scores, alerts, or dashboards. The ideal experience increasingly answers: “These are the three things that matter today.”

### 2. Progressive disclosure
Show the most important information and action first. Keep secondary information easy to discover but visually quieter. Do not expose ten choices merely because ten choices exist.

### 3. One dominant action per decision region
Each card/section should have an obvious purpose and one visually dominant action when an action is needed. Secondary actions remain available but should not compete.

### 4. Human recruiting language
Prefer language a good recruiting advisor would use over software/database language. Explain the implication, not merely the metric. Do not make deterministic data sound predictive.

### 5. Meaningful feedback
Every user action should feel acknowledged. Use subtle loading, saving, success, error, hover, focus, tap, accordion, and transition states. Avoid decorative animation that delays work.

### 6. Meaningful celebration only
Tastefully recognize real recruiting milestones such as first coach response, first meaningful relationship, first visit, first offer, commitment, or completion of a meaningful weekly goal. Do not gamify logins, page views, or trivial actions.

### 7. A healthy “nothing to do” state
Never manufacture work to keep a dashboard populated. When an athlete is genuinely caught up, say so clearly and positively.

### 8. Contextual education
Teach sophisticated concepts when they first matter, then get out of the way. Examples: Journey stage, exact-date activity, Recruiting Health, relationship momentum, and why logging interactions matters.

### 9. Personalization by recruiting maturity
A new athlete and a mature recruit may share navigation but should not be forced into identical information density. Use existing context to prioritize relevant guidance without hiding core capability.

### 10. Remove before adding
For every proposed improvement ask, in order: can it be removed, combined, shortened, demoted, progressively disclosed, or implemented with an existing shared primitive? Add a new UI pattern only when those options fail.

## Workstreams

### A. Micro-interactions and perceived quality
- Consistent pressed/hover/focus states.
- Named saving/loading states for meaningful actions.
- Subtle success confirmation that does not interrupt the workflow.
- Predictable accordion/disclosure transitions.
- Skeletons only where they reduce perceived layout shift; otherwise use clear named loading states.
- Respect reduced-motion preferences.
- No animation should block navigation or mutation.

### B. Visual hierarchy audit
Use Athlete Home as the quality benchmark, not as a template to duplicate blindly. Review every canonical screen for eyebrow/title/subtitle/action hierarchy, spacing, card density, dominant action, and mobile scanability.

Priority scrutiny: Advisor Insights, Exports, organization reporting, Player 360°, school relationship pages, long forms, and any dense table/filter surface.

### C. Progressive disclosure
- Collapse secondary detail behind purposeful disclosure when it is not needed for the first decision.
- Keep important warnings/actions visible.
- Do not hide relationship context merely to make a page shorter.
- Long forms should be grouped by purpose and optional sections should be clearly optional.

### D. Language pass
Replace generic software copy with concise recruiting language where supported by deterministic data. Examples:
- Avoid “No records found.” Explain what is missing and the next useful action.
- Prefer “This relationship may need attention” to raw recency alone when the underlying deterministic rules support that interpretation.
- Keep Recruiting Health explainable; never imply admissions/recruiting prediction.

### E. Progress storytelling
Improve the visual comprehension of Journey, relationship momentum, Recruiting Health, Recruiting Board, and meaningful milestones. Favor timelines, context, change, and next action over decorative scores.

### F. Meaningful milestone recognition
Define a small milestone set. Recognition should be brief, accessible, non-blocking, and never childish. Parent/advisor recognition should respect role boundaries and athlete ownership.

### G. Caught-up states
When no meaningful Next Move is currently due, provide a calm positive state such as “You’re in a good spot this week,” plus optional exploration rather than inventing urgency.

### H. Contextual education
Add short first-use explanations/tooltips/disclosures only where users need a concept to make a decision. Avoid tutorial clutter and repeated explanations.

### I. Duplicate-information removal
Audit each screen for repeated metrics, warnings, actions, explanatory copy, and navigation. One fact should not appear multiple times on the same screen unless the second occurrence changes the decision context.

### J. Recruiting-maturity personalization
Use existing stage/context carefully to prioritize content. Do not infer Journey stage from activity. Do not remove user control or make black-box recommendations.

## Role-specific experience targets

### Athlete
Feels like a recruiting advisor in the athlete’s pocket: clear priorities, relationship context, next action, and visible progress without anxiety-producing gamification.

### Parent / Guardian
Feels informed and useful without becoming the athlete. Emphasize context, support, and “How You Can Help,” while retaining full exploration within permissions.

### Advisor
Starts with who needs attention, why, and what to do. Dense data and reporting remain available after the decision layer rather than before it.

### Owner / Admin
Starts with organizational health, exceptions, bottlenecks, and staff focus. Aggregate totals are secondary unless they change a decision.

## Premium visual/interaction rules

- Preserve the canonical Rebels red/black/white visual language.
- Semantic colors remain semantic; do not decorate with status colors.
- Cards should earn their borders/backgrounds; avoid card-inside-card visual noise.
- Mobile is the clarity test: no horizontal viewport widening and no desktop action clusters squeezed onto phones.
- Interactive elements must look interactive; inert information must not masquerade as a control.
- Read-only remains fully navigable.
- Every apparently navigable entity should lead to useful context.
- Empty/loading/error/success states use shared ProductUI patterns where practical.

## Scoring rubric

Every canonical screen is scored after implementation on:
- Visual consistency /10
- Clarity /10
- Navigation /10
- Role appropriateness /10
- Actionability /10
- Mobile /10
- Perceived polish /10
- Simplicity /10
- Language /10
- Progressive disclosure /10

Anything below 8 is fixed before Phase 7 closes. Scores are evidence-based and are not inflated to avoid remediation.

## Guardrails

Do not:
- add another inbox
- create duplicate analytics for presentation
- add meaningless gamification
- infer Journey stage from activity
- convert deterministic Recruiting Health into a prediction score
- give Parent athlete mutation/contact controls
- bury critical actions for the sake of minimalism
- add animation that slows work
- remove useful capability merely to improve a screenshot

## Completion criteria

Phase 7 closes when:
1. Every canonical role/screen has been reviewed against the Experience Standard.
2. Micro-interaction patterns are consistent and accessible.
3. Dense screens use progressive disclosure and clear hierarchy.
4. User-facing language has received a recruiting-language pass.
5. Duplicate information/actions have been removed or justified.
6. Meaningful caught-up and milestone states are implemented where appropriate.
7. Existing data is used for contextual prioritization without black-box prediction.
8. No rubric category is below 8.
9. Exact head commit builds successfully.
10. Production deployment is confirmed before being called live.

## Sequence

Finish Phase 6 first, including the iPhone 14 / Safari physical-device pass. Then execute Phase 7 in controlled batches so commercial-readiness fixes are not mixed with broad experience changes before validation is complete.
