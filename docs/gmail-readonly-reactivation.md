# RLTNL Recruiting — Gmail read-only reactivation plan

Status: PAUSED. Gmail sending remains active. Do not re-enable restricted Gmail access before Google verification, security review, and business approval.

## Reusable prompt for a future ChatGPT build session

Continue development in the existing RLTNL Recruiting app (GitHub `bobwad01-hue/rebels-recruit`, Vercel `rebels-recruit`, Supabase). The Gmail read-only feature was intentionally suspended on October 28, 2026 to avoid the pre-revenue restricted-scope security assessment expense. We retained the original inbound code and historical recruiting records. Restore the functionality **only after** we have reviewed current Google OAuth verification and CASA requirements, secured approval to incur any costs, and confirmed the business needs it.

Goals:
1. Preserve `gmail.send`, outgoing activity logging, coach contact updates, and normal athlete Gmail identity.
2. Review the current Google Workspace OAuth consent screen and restricted-scope approval requirements. Determine whether `gmail.readonly` is still the best scope and whether alternatives can deliver a trustworthy experience without a restricted scope.
3. Restore `gmail.readonly` to the OAuth authorization and callback scope lists only after verification approval. Require existing users to explicitly reconnect and grant the additional permission; never assume their prior consent remains valid.
4. Review and reactivate the central gate `lib/gmail-feature-mode.ts`, `app/api/google/gmail/sync/route.ts`, `app/api/google/gmail/watch/route.ts`, `app/api/google/gmail/push/route.ts`, `app/api/cron/gmail-watch/route.ts`, `lib/gmail-inbound.ts`, and the browser sync integration. Restore the Gmail cron in `vercel.json` only when monitoring is approved.
5. Restore the Gmail read-dependent thread-continuation and sent-history recovery flows only with correct permissions, security checks, and an accurate user interface. Preserve historical records, user/athlete ownership, coach matching, deduplication, retry-safe checkpoints, and role restrictions.
6. Review privacy disclosures, data retention, minors' protections, least-privilege scope use, and Google API Services User Data Policy compliance.
7. Review Google Pub/Sub watch/topic/subscription credentials, authenticated webhook delivery, renewal cron, rate limits, quotas, and failure alerts.
8. Update Gmail Settings, Coach Emails, Alerts, Journey, and coach relationship screens to explain automatic monitoring accurately. Do not imply a reply was captured unless it was actually imported.
9. Run all smoke, security, unit, and end-to-end tests on Preview. Test Gmail send, receive, thread continuation, missed notifications, retries, disconnected/revoked tokens, duplicate delivery, and multi-athlete isolation. Deploy only after approval.
10. Reassess the Resend Reply-To prototype. Do not silently reroute coach replies or confuse recipients. The pilot's `RLTNL_REPLY_TO_PROD_TEST_ENABLED` flag must stay false unless a separate approved experiment explicitly needs it.

Before writing code, inspect the current repository and deployment; do not assume the 2026 file paths or Google policies are unchanged. Produce a clear cost/verification decision and a rollback plan.

## Send-only transition notes

- New OAuth requests: `gmail.send` only.
- Inbox monitoring, watch renewal, Pub/Sub-triggered syncing, browser syncing, sent-message backfill, and read-dependent thread continuation: paused.
- Outgoing Gmail messages: continue through Gmail send API, recorded in RLTNL.
- Coach replies: go to the athlete's real Gmail address.
- Previously imported coach messages: retained for history.
- Previously granted restricted permissions may remain on old Google refresh tokens until users reconnect/revoke; application-level disabling does not revoke Google consent.
- Google Cloud Console OAuth consent/data access settings and Google's verification case must be updated separately by the project owner.
