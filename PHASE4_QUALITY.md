# Phase 4 — Product Quality

Date: 2026-09-10

Phase 4 turns the quality decisions from Phases 1–3 into platform behavior instead of page-by-page conventions.

## 1. Mobile-first operating rules

- Athlete workflows must remain comfortable at phone widths; the product is expected to be used at camps, tournaments, in cars, and immediately after coach conversations.
- Inputs/selects use 16px text on small screens to prevent iOS zoom.
- Primary controls have at least a 44px mobile tap target.
- Cards use reduced mobile padding without changing hierarchy.
- Horizontal data surfaces retain momentum scrolling and must never force the whole page wider than the viewport.
- The fixed bottom navigation reserves safe-area space and the main content reserves room for it.
- Mobile navigation exposes the first four role-priority destinations and a full Menu rather than trying to fit every feature into the bottom bar.

## 2. Accessibility baseline

Every authenticated surface inherits:

- Skip-to-main-content navigation.
- A stable `main-content` landmark.
- Visible Rebels Red keyboard focus rings.
- `aria-current=page` on active navigation.
- Labeled mobile navigation controls.
- An accessible mobile navigation dialog that can be dismissed with Escape.
- Focus moves to the close control when the mobile menu opens.
- Reduced-motion support.
- 44px mobile touch targets for core controls.
- Search fields reserve their icon gutter globally.

Page-specific forms must continue to use real labels where the meaning cannot be inferred safely from surrounding structure.

## 3. Owner View-As QA mode

Owner preview is a QA context, not authentication impersonation.

Permanent rules:

1. Stored Owner authentication and permissions never change.
2. Athlete and Parent previews use the approved athlete context (currently Maia for Bob's owner QA flow).
3. Internal links automatically preserve `previewRole` and `previewAthlete`, including links rendered inside page content after load.
4. Preview mode is visibly labeled and includes Exit Preview.
5. Preview is read-only. Form submissions are blocked globally and mutation-style controls are intercepted while preview is active.
6. Navigation, accordions, filters and read-only exploration remain usable.
7. A blocked mutation produces visible feedback: `Preview is read only. Exit Preview to make changes.`
8. Parent preview remains support-oriented and never becomes a coach-contact surface.

## 4. Onboarding quality

The athlete Getting Started tour is resumable.

- Profile Essentials remain the only required setup gate.
- Tour steps remain: Recruiting History → Find Schools → Connections → Game Plan → Journey.
- The current step is stored locally so exploring another part of the app does not lose tour progress.
- Getting Started Tour is available from the Athlete account menu after setup.
- The tour explicitly tells athletes that optional steps can be completed later.
- Explore actions and Continue/Skip actions are visually distinct.
- Completion clears the resume point and returns to Athlete Home.

## 5. Empty/loading/error state standard

An empty state should answer three questions whenever action is possible:

1. What is missing?
2. Why does it matter?
3. What can I do next?

Use `.rr-empty-state` for canonical visual treatment. Read-only roles may receive a navigation/support action rather than a mutation action. Loading states should name the thing being loaded. Error states must explain the recovery path rather than only exposing a technical error.

## 6. Read-only does not mean inert

Parent and Owner-preview surfaces remain fully explorable. Entity names, metrics, cards and context should navigate wherever the viewer has permission. Only mutation is restricted.

## 7. Phase 4 mobile score meaning

The Phase 4 audit scores responsive implementation, interaction sizing, overflow behavior, input behavior and navigation architecture. We do not claim physical-device/browser validation without actually running that validation. A later commercial-readiness pass should still execute real Safari/Chrome/Edge/Firefox device/browser QA and record defects separately.
