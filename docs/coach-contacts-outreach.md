# Coach Contacts and Outreach — Locked Behavior

- Adding a school to the athlete recruiting pipeline **never** inserts coach contacts. Display the school's active canonical softball coaching staff as available choices, head coach first.
- An athlete chooses **Add to My Contacts** for any individual coach. This creates or restores an athlete-scoped `athlete_coaches` relationship without creating an interaction or marking outreach. Coach email is not required.
- **Not Contacted** means the coach is saved but no coach-directed communication has been logged. **Contacted** means actual email, phone, text, message, or meeting outreach is logged, or a legitimate last-contact date exists. It does not imply a reply.
- **Email** is available directly from school staff without first saving the coach. After Gmail confirms a successful send, save or restore the primary coach and any CC coaches in the athlete's contacts and record the last-contact date. A failed Gmail send must not add contacts.
- When the canonical coach email is missing, allow the athlete to type an email in the composer. **Save this address for later** is an explicit add-to-contacts action, but it does not count as outreach. An email sent to the typed address saves the coach as Contacted after Gmail succeeds.
- Athlete-entered emails belong in `athlete_coaches.email_override`, never `college_coaches.email`. Queue them for Super Owner verification. Coach source conflicts (`contact_verification_needed`) remain blocked for Gmail outreach.
- Never replace existing relationship notes, ratings, recruiting stage, reminders, or school targets when adding or emailing a coach. Keep archived contact history and restore the contact if the athlete actively emails them.
- Keep the coach's canonical record separate from the athlete's contacts and the school's recruiting journey. Do not auto-create or restore a school target just because an email was sent.
- Log successful Gmail sends in `interactions` and `interaction_recipients`, preserving exact recipient addresses.

## QA scenarios

1. Add William Jewell College. Emma Ryan and Makaela Carr are shown, but neither is in My Contacts automatically.
2. Click Add to My Contacts for Emma. She appears under My Coach Contacts with **Not Contacted**. Undo restores the previous state.
3. Click Email for Makaela without adding her. A successful Gmail send automatically adds her as **Contacted** and logs activity; canceling or failing Gmail does not.
4. Open a coach without a canonical email. Type an address and click Save for later. The coach becomes **Not Contacted**, the address is private and flagged for verification. A later successful send makes them **Contacted**.
5. CC a second coach. A successful send adds/restores both coach contacts, preserves prior notes and ratings, and marks both as contacted.
6. Adding a new coach with no email requires only a school, first name and last name; verification remains pending. No global contact email is published without approval.
7. An unverified source/contact conflict blocks Gmail, while simply missing email does not.
