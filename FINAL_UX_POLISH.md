# Final UX Polish Standard

This pass standardizes the last-mile experience across Rebels Recruit.

## Mobile rhythm and tap targets
- Shared PageFrame spacing is the default page rhythm.
- Mobile icon controls and primary actions use at least 44px tap targets.
- Dense action clusters stack on small screens instead of squeezing horizontally.
- Long workflows use a sticky mobile action only when one clear action should remain available while scrolling.

## Success feedback
- Use `announceSuccess` for in-place mutations.
- Use `announceSuccessAfterReload` when the workflow reloads after a successful mutation.
- Success feedback is brief, non-blocking, and announced through an ARIA live region.
- Existing inline context may remain when it contains useful detail, but silent successful mutations should be avoided.

## Loading
- Route transitions use the shared application skeleton in `app/loading.tsx`.
- Client-loaded screens that initially have no stable content should use `LoadingPanel` rather than rendering empty metrics or zero states before data arrives.
- Skeletons preserve approximate content shape and respect reduced-motion preferences.

## Empty states
A true empty state should answer three things: what is missing, why it matters, and the single most useful next action. Caught-up states are different and should not manufacture a task.

## Hierarchy and duplication
- One dominant action per decision region.
- The same metric or recommendation should not be repeated on the same screen unless the second appearance changes the decision context.
- Home is the summary layer; detail screens should add context rather than repeat Home.
- Secondary explanation should be progressively disclosed when it is not required for the first decision.
