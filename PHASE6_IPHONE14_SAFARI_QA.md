# Phase 6 — iPhone 14 / Safari Physical QA

Date: 2026-09-11

Purpose: capture real-device evidence for Rebels Recruit on iPhone 14 using Safari. This is a focused commercial-readiness pass, not an exhaustive feature test.

## Test setup

- Device: iPhone 14
- Browser: Safari
- Orientation: portrait unless a step says otherwise
- Site: https://rebelsrecruit.com
- Use normal production data; do not create destructive test data just for QA.
- If anything looks wrong, capture a screenshot before navigating away.

## Pass 1 — Athlete

1. Open Athlete Home.
   - No horizontal page scrolling.
   - Main sections appear centered with even left/right padding.
   - Cards do not touch the viewport edge.
   - Bottom navigation does not cover content.
   - Header and bottom navigation remain stable while scrolling.

2. Open the mobile Menu.
   - Menu opens fully on screen.
   - Close button is easy to tap.
   - Menu scrolls if needed without moving the page behind it.
   - Closing returns cleanly to the same page.

3. Open Find Schools.
   - Search input does not zoom Safari when tapped.
   - Search icon/text spacing looks correct.
   - Filters fit the phone width.
   - No dropdown or card causes horizontal overflow.

4. Open Connections.
   - School/coach cards fit cleanly.
   - Long school or coach names wrap instead of widening the page.
   - Tapping a school/coach opens the expected relationship context.
   - Back navigation returns to the same place cleanly.

5. Open Game Plan.
   - Next Moves are easy to scan.
   - Primary action is obvious.
   - Buttons are comfortably tappable and do not collide.

6. Open Journey.
   - Timeline remains aligned.
   - Month labels, timeline rail, and cards do not overlap.
   - Expanding an entry works with one tap.
   - Filters remain usable on mobile.

7. Open Events and one Event Prep workflow.
   - Event cards fit without overflow.
   - Prep/debrief sections expand naturally.
   - Sticky/mobile navigation does not cover the bottom of forms or actions.

8. Tap into at least one text input or textarea.
   - Safari keyboard does not hide the active field or primary action in an unusable way.
   - Page does not unexpectedly zoom.
   - Dismissing the keyboard leaves the page positioned sensibly.

## Pass 2 — Parent / Guardian

1. Open Parent Home.
   - Only Home is selected in navigation.
   - Support Center hierarchy is clear.
   - “How You Can Help Next” is prominent without looking like an athlete mutation control.

2. Open Connections, Goals & Next Moves, Journey, and Events.
   - Exactly one navigation destination appears selected at a time.
   - Parent can explore school/player/event context.
   - No Add, Pass, Stop Pursuing, contact-coach, or athlete decision controls are exposed.

3. Open Player 360°.
   - Page is readable without sideways scrolling.
   - Dense sections stack naturally.
   - Links remain usable in read-only context.

## Pass 3 — General Safari behavior

1. Rotate once to landscape and back to portrait.
   - Layout recovers without clipped content or stuck overlays.

2. Use Safari Back/Forward between two major screens.
   - Active navigation stays correct.
   - No duplicate selection appears.

3. Refresh a major screen.
   - Loading state is understandable.
   - The page settles without severe layout jump.

4. Temporarily switch away from Safari and return.
   - Open menu/modal state does not leave the page unusable.

5. Scan for:
   - horizontal scrolling
   - clipped text
   - overlapping buttons
   - controls smaller than a comfortable finger target
   - content hidden behind bottom navigation
   - Safari input zoom
   - sticky headers covering content
   - modals wider/taller than the usable viewport

## Report format

For each issue, send:
- screen name
- what you tapped
- what happened
- screenshot
- whether it is repeatable

If no issue is found in a pass, report that pass as “No issues found.”

## Evidence rule

Only this real-device run can be recorded as iPhone 14 / Safari physical-device validation. Source inspection, desktop responsive mode, or emulation do not count as physical-device evidence.
