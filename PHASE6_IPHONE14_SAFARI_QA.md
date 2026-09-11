# Phase 6 — iPhone 14 / Safari Physical QA

Date: 2026-09-11

Purpose: capture real-device evidence for Rebels Recruit on iPhone 14 using Safari. This is a focused commercial-readiness pass, not an exhaustive feature test.

## Test setup

- Device: iPhone 14
- Browser: Safari
- Orientation: portrait
- Site: https://rebelsrecruit.com
- Production data was used.
- Screenshots were captured for issues before changes were made.

## Physical-device result

Status: **Completed with findings.**

The Athlete/Player pass found several mobile polish issues. The Parent/Guardian pass found no additional issues. Findings were treated as Phase 6 defects and remediated before rescoring.

## Athlete / Player findings

### Find Schools — section hierarchy
Observed: recommendation section headers such as **Academic + Athletic Fit** were too close in size and color to college names, making the start of a new section harder to recognize on a phone.

Remediation:
- Recommendation section headers now use a distinct mobile treatment with smaller uppercase red text and increased semantic separation from school-card titles.

### Connections — Stop Pursuing action
Observed: **Stop Pursuing** appeared too subdued in gray for an available action.

Remediation:
- Destructive archive/stop-pursuing actions now use a persistent red treatment rather than relying on hover, which does not exist as a useful affordance on touch devices.

### Events — calendar-connected notice
Observed: the organization-calendar confirmation should not remain a recurring piece of page content after the user has already seen it.

Remediation:
- Calendar-connected notices use local one-time acknowledgement state and auto-dismiss after first display for that connection/signature.
- Existing persistent warning behavior remains reserved for actual calendar-loading problems.

### Events — clipped mobile filter/search text
Observed:
- Search placeholder text was clipped.
- Dropdown labels were clipped on iPhone 14.
- The Add Event college search showed the same class of problem.

Remediation:
- Added a universal mobile search-control typography rule.
- Added a compact filter treatment for narrow controls.
- Events search and filter controls use the compact mobile treatment.
- Mobile search placeholders across the app use smaller responsive text while preserving accessible control height.

### Public landing page — oversized buttons and hero wrapping
Observed:
- Header and hero button text was too large and wrapped awkwardly.
- “Your recruiting. Your relationships. Your next move.” did not preserve one sentence per line.

Remediation:
- Mobile button typography was reduced globally while preserving 44px tap targets.
- Landing-page buttons use explicit no-wrap treatment where practical.
- The hero uses responsive clamp sizing and no-wrap spans so each sentence occupies its own line on phone widths.

## Parent / Guardian result

Physical iPhone 14 / Safari review of the Parent experience found **no additional issues**. In particular:
- Parent navigation did not show the previously reported duplicate-active-state issue.
- Read-only navigation remained usable.
- No athlete mutation/contact controls were reported as exposed.
- No additional mobile layout defects were reported.

## Validation notes

This test is valid physical-device evidence for iPhone 14 / Safari only. It does not substitute for Android Chrome or desktop-browser validation.

The remediations above still require successful exact-head build/deployment confirmation and a quick production regression spot-check after deployment before the iPhone findings are considered closed.

## Evidence rule

Only this real-device run is recorded as iPhone 14 / Safari physical-device validation. Source inspection, desktop responsive mode, or emulation do not count as physical-device evidence.
