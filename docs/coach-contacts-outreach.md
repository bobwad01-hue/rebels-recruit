# Coach Contacts and Outreach — Locked Behavior

- Adding a school to the athlete recruiting pipeline **never** inserts coach contacts. Display the school's active canonical softball coaching staff as available choices, head coach first.
- **Available Coaches** appear as distinct, compact cards with **Add to My Contacts**. Do **not** offer an Email action on an available coach. Show My Coach Contacts separately and hide the Other Coach Contacts section when empty.
- An athlete explicitly chooses **Add to My Contacts** for an individual coach. This creates or restores an athlete-scoped `athlete_coaches` relationship without creating an interaction or marking outreach. Coach email is not required.
- **Not Contacted** means the coach is saved but no coach-directed communication has been logged. **Contacted** means actual email, phone, text, message, or meeting outreach is logged, or a legitimate last-contact date exists. It does not imply a reply.
- **Email** is only available for a coach in the athlete's **active My Contacts**. A direct link to a coach's profile must show **Add to My Contacts** before displaying the email composer. The Gmail send API must enforce this for the primary coach **and every CC coach**, regardless of UI, including old bookmarks and direct API requests.
- A successful Gmail send updates the last-contact date and logs activity for **already-saved** coach contacts. It must **never** automatically create or restore a coach contact. A failed send must not change contact status.
- When the canonical coach email is missing, an athlete who has **already added the coach** can type an email in the composer. **Save this address for later** updates the athlete-scoped email override without marking outreach. Sending an email updates Contacted status only after Gmail succeeds.
- Athlete-entered emails belong in `athlete_coaches.email_override`, never `college_coaches.email`. Queue them for Super Owner verification. Coach source conflicts (`contact_verification_needed`) remain blocked for Gmail outreach.
- Never replace existing relationship notes, ratings, recruiting stage, reminders, or school targets when adding or emailing a coach. Archived contacts must be **explicitly restored** before sending.
- Keep the coach's canonical record separate from the athlete's contacts and the school's recruiting journey. Do not auto-create or restore a school target when emailing.
- Log successful Gmail sends in `interactions` and `interaction_recipients`, preserving exact recipient addresses.

## QA scenarios

1. Add William Jewell College. Emma Ryan and Makaela Carr appear as available coaches, head coach first. Neither is in My Contacts automatically and neither has an Email button.
2. Click Add to My Contacts for Emma. She moves to My Coach Contacts with **Not Contacted**, and **Email Coach** appears. Undo restores the previous state.
3. Open Makaela's profile directly while not saved. The email composer is hidden and **Add to My Contacts** is offered. Sending directly to the Gmail API is rejected before any Gmail call.
4. Click Email for Emma after saving her. A successful Gmail send logs activity and updates her to **Contacted**. A failed Gmail send does not.
5. For a coach with no canonical email, first add the coach. Then type and save an address; the private address is queued for verification without counting outreach. A later successful send marks Contacted.
6. CC a second coach not in My Contacts: the Gmail API rejects the send. After explicitly adding both coaches, a successful send logs both recipients and updates their contact dates without changing notes or ratings.
7. Adding a new coach with no email requires only a school, first name and last name; verification remains pending. No global contact email is published without approval.
8. A source/contact conflict blocks Gmail, while simply missing email does not block it after a coach is added.
9. The Other Coach Contacts section is absent when empty; it is present only for genuinely unassigned coach contacts.
