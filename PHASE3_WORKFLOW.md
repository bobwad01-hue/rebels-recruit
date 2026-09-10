# Phase 3 — Workflow Convergence

Date: 2026-09-10

Phase 3 turns Events, communication, weekly goals and role support into connected recruiting workflows rather than isolated features.

## Canonical workflow rules

### Events are recruiting workflows, not calendar entries
A relevant camp, visit, showcase or recruiting event should move through a consistent loop:

1. Review school/coach context.
2. Handle pre-event coach outreach.
3. Arrive ready with a simple plan.
4. Debrief what happened.
5. Create/complete the appropriate follow-up Next Move.

Marking an event `Going` already creates the automatic pre-arrival email reminder. Phase 3 adds a shared role-aware workflow model so the same event has an athlete, parent and staff interpretation.

### Athlete role
The athlete owns coach communication, Journey decisions and follow-up execution. Event Prep is an action workspace: relationship context, coach outreach, readiness, debrief and follow-up all connect.

The first saved event debrief adds the exact-date Journey record. Editing the same debrief does not create duplicate Journey entries. When the athlete indicates follow-up is needed, Event Prep creates an `event_followup` Next Move for the following day if one is not already open.

### Parent / Guardian role
Parents support readiness without taking over. Their event workflow translates athlete actions into support actions: logistics, protecting preparation time, asking whether outreach is covered, encouraging a debrief and helping the athlete protect follow-up time. Parent views remain non-mutating and navigable.

### Advisor / Owner / Admin role
Staff use events as coaching checkpoints. Upcoming attendance should lead to Player 360° and relationship context so staff can verify preparation and follow-up rather than treating event attendance as passive reporting.

### Weekly goals
Weekly Recruiting Goals should be focused, not exhaustive. The canonical experience shows up to three high-value priorities. Goals are generated from current recruiting context and use role-aware destinations:
- Athlete → direct action surface.
- Parent → support/read-only context.
- Advisor/Owner/Admin → Player 360° or staff context.

Momentum continues to count meaningful recruiting behavior, not logins or page views.

### Communication
Rebels Recruit does not replace Gmail, phone, text or social channels. Communication is contextualized inside the recruiting workflow. Pre-event outreach uses the existing Coach Action Bar and the `Before Camp / Visit` email starter directly from Event Prep. Successful Gmail sends remain auto-logged.

### Role convergence principle
The same recruiting fact should have different role-appropriate meaning:
- Athlete: `Email coaches before UCM.`
- Parent: `Check that pre-event outreach is covered; help with logistics and readiness.`
- Advisor: `Confirm outreach and post-event debrief are planned.`
- Owner/Admin: `See attendance and staff/player follow-through at the organization level.`

## Phase 3 implementation
- Added `lib/event-recruiting-workflow.ts` as shared event workflow logic.
- Added `components/EventWorkflowPanel.tsx` as a shared role-aware workflow surface.
- Rebuilt Event Prep around before/during/after recruiting workflow.
- Event debrief now closes the loop into Journey + follow-up Next Move without duplicating the first debrief interaction on edits.
- Parent Events now exposes a support workflow and preserves contextual navigation.
- Advisor event attendance cards now surface individual Player 360° drill-downs and coaching checkpoints.
- Weekly Recruiting Goals are limited to three priorities and route by role.

## Guardrails
- No Journey stage is inferred from event attendance, outreach, or debrief.
- Only exact-date interactions affect recency/momentum/stale calculations.
- Parents do not send coach communication or mutate athlete recruiting decisions.
- Advisors can support/assign work but do not silently change athlete Journey stages.
- Event workflows should reduce repeated manual checking, not create duplicate task systems.
