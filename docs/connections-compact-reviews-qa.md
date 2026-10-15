# Connections — Compact school/coach presentation and reviews

## Behavior
- School Relationships cards are max 1000px wide on desktop, centered; school detail and Recruiting Journey remain in the header. Mobile fills the available width.
- Saved and available coaches use the same compact single-row design, max 700px on desktop, stacking naturally on narrow screens. Email Coach is for saved connections only. Available staff still requires explicit Add Connection.
- School cards show a subtle review action beside the school name. Saved coach rows show a review action near the coach title. Available staff has no extra review action: their profile still provides review access.
- A published athlete-review summary shows athlete-only average rating and count, e.g. ★ 4.6 (5). Do not mix athlete scores with parent/advisor scores. The review dialog shows the existing separated athlete, parent and advisor insights.
- The action says Review School / Review Coach when the signed-in athlete has not completed a review, or Edit My Review when they have. If viewing an athlete through owner preview, the action is View Reviews and must not submit a review on behalf of the athlete.
- If there are no published athlete reviews, show no empty "No RLTNL Reviews" badge. The Review action is still available to the athlete.
- Review submission is based on a genuine experience, including a camp or showcase. Contacted status is not a prerequisite. Review submission must not create a coach connection, mark a coach contacted, change a school stage, or send email.
- The existing SchoolReviewForm and CoachReviewForm remain the only writers of review records; opening the dialog mounts their existing review workflow on demand.
- After the review dialog closes, refresh the summary and review completion state.
- Review summary and review completion are fetched in batches, not a separate query for every coach card.

## Acceptance
1. Maia's Graceland (3 saved coaches) and Ottawa (1 saved, 2 available) fit in the narrower cards; actions remain usable at desktop and iPhone widths.
2. Graceland's Contacted / Not Contacted statuses are unchanged, and Email Coach is still limited to saved connections.
3. A school with zero reviews shows Review School without a "No Reviews" badge. Submit a genuine review and close: action becomes Edit My Review.
4. A saved coach with zero reviews shows Review Coach. Submit a review from a camp or showcase without any logged outreach: Contacted status stays unchanged.
5. A coach with published athlete reviews shows athlete-only score/count. Opening shows existing athlete/parent/advisor sections; after reviewing, Edit My Review appears.
6. Available coaches have only Add Connection; clicking their names still opens the profile, where review access remains.
7. Owner preview shows View Reviews, not Review / Edit My Review. No reviews are written for the previewed athlete.
8. View All 43 Schools does not initiate one review-summary request per card.
9. Keyboard Escape and Close dismiss the review dialog, and review links remain keyboard accessible.
10. School recruiting journey and archived/restored state are unchanged; no database migration or bulk data update is involved.
