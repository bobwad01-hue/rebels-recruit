# Coach Connections and Outreach — Locked Behavior

## Naming and information architecture
- **Coach Connections** is the only athlete-facing name for saved athlete-coach relationships. Do not present "My Coach Contacts" as a second object or section.
- **Available Coaches** are active directory coaches not yet saved by the athlete. They are not connections, and they cannot be emailed through RLTNL until explicitly added.
- **My Coach Connections** are the athlete's active `athlete_coaches` rows, whether added from a school listing, Find Coaches search, or a coach profile. A saved connection is initially **Not Contacted** unless legitimate prior outreach history exists.
- **Schools** in Connections are `athlete_colleges` recruiting targets. A coach connection is independent: adding a coach must not create, restore, or alter a school target or recruiting journey stage.
- Connections provides separate **Find Schools** and **Find Coaches** entry points. Find Coaches searches the shared directory by coach name or school, using bounded live queries instead of loading the entire directory.
- A school detail page lists both the athlete's saved coach connections and **Available Coaches** with **Add Connection** actions. Head coaches appear first.
- When a saved coach belongs to a tracked school, display it under that school's My Coach Connections. Coaches from schools not in the active school pipeline appear only in **Coach Connections Outside My Schools**. Never show the same coach twice in these two sections.
- If there are no schools or coach connections, the Connections empty state offers both Find Schools and Find Coaches.

## Data and Gmail rules
- An athlete explicitly chooses **Add Connection** for any individual coach. This creates or restores an athlete-scoped `athlete_coaches` row without creating an interaction or marking outreach. Coach email is not required.
- **Not Contacted** means no coach-directed communication has been logged. **Contacted** means actual email, phone, text, message, or meeting outreach is logged, or a legitimate last-contact date exists. It does not imply a reply.
- **Email Coach** is available only for a coach in the athlete's **active My Coach Connections**. A direct link to a coach's profile must show **Add Connection** before the email composer. The Gmail send API enforces this for the primary coach **and every CC coach**, including direct API requests.
- A successful Gmail send updates last-contact date and logs activity for **already-saved** coach connections. It never automatically creates or restores a coach connection.
- When canonical email is missing, an athlete who has **already added the coach** may enter and privately save an address. This does not mark outreach. An email send updates Contacted only after Gmail succeeds.
- Athlete-entered emails belong in `athlete_coaches.email_override`, never `college_coaches.email`. Queue for Super Owner verification. Coach source conflicts (`contact_verification_needed`) block Gmail outreach.
- Never replace existing relationship notes, ratings, recruiting stage, reminders, or school targets when adding or emailing a coach. Archived connections must be explicitly restored before sending.
- Log successful Gmail sends in `interactions` and `interaction_recipients`, preserving exact recipient addresses.

## QA scenarios
1. Empty Connections screen: both Find Schools and Find Coaches are available.
2. Search Find Coaches for a full coach name (e.g., Emma Ryan) and a school (e.g., William Jewell). Results show coach name, role, school, and Add Connection. School-name search works even if the coach's name does not match.
3. Add a coach through Find Coaches without tracking their school. It appears in Coach Connections Outside My Schools as Not Contacted; no `athlete_colleges` row is created.
4. Add a school. Its staff appear as Available Coaches, not saved automatically. Add a coach from the school card or school detail. It becomes My Coach Connections under that school without duplicate entries.
5. Open an unsaved coach profile directly. The composer is hidden; Add Connection appears. Direct Gmail API calls for unsaved coaches fail before any Gmail send.
6. Send an email to a saved coach. Successful Gmail send logs outreach and updates Contacted; failed Gmail send does not.
7. CC an unsaved coach. The composer lists only saved, eligible CC recipients, and the Gmail API rejects unsaved CC IDs.
8. Add a new unlisted coach with a school selection. Save creates only the coach connection, not a school recruiting target. Coach identity and proposed contact data require verification.
9. A source/contact conflict blocks Gmail, while simply missing email does not block outreach after a coach is added.
10. Coaches from tracked schools never also appear in the outside-my-schools list, including when filtering the school list.
