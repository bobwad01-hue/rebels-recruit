# Reply-To tracking prototype — preview only

## Status
Phase 1: **outbound Reply-To header experiment only**. No inbound webhook, Gmail forwarding, or coach-reply persistence has been deployed. Existing production Gmail integration is unchanged.

## Setup
1. Deploy branch \`preview/reply-to-tracking-prototype-20261028\` to a Vercel Preview environment.
2. Configure these variables **for Preview only**:
   - \`RLTNL_REPLY_TO_TEST_ENABLED=true\`
   - \`RLTNL_REPLY_TO_TEST_USER_ID=<UUID of test athlete's signed-in account>\`
   - \`RLTNL_REPLY_TO_TEST_RECIPIENT=<coach test inbox you control>\`
   - \`RLTNL_REPLY_TO_TEST_ADDRESS=<inbound receiving address you control>\`
3. The inbound receiving address must actually accept email (for example, a Resend receiving address or verified subdomain). Do not use an unconfigured address.
4. Redeploy Preview after changing environment variables. Send one email from the allowlisted athlete account to the allowlisted coach test address using the existing RLTNL Gmail compose UI.
5. In the coach test inbox, inspect message headers for \`Reply-To\`; click Reply and confirm delivery to the test receiving address. Compare behavior with Reply All and mobile clients.
6. Confirm that sends to any other coach recipient and sends from any other athlete **do not** receive the test Reply-To header.

## Next phase (not implemented)
- Stable signed webhook endpoint with raw-body verification, sender allowlisting, deduplication, safe text-only parsing and isolated test persistence.
- Capture reply and automatically deliver a clearly labeled copy to the athlete's Gmail via a verified sending domain, without impersonating the coach.
- Test whether Gmail reply-to-copy goes to the coach, whether the original thread is preserved, and whether any replies bypass RLTNL.
- Only after success: design production tenant-safe routing and migration away from Gmail readonly, subject to Google's verification requirements.

## Safety
- Feature flag is forced off outside Vercel Preview; user ID and recipient must match exactly.
- Do not remove \`gmail.readonly\` or change Google Cloud scopes during this experiment.
- No real athlete or coach accounts should be used for test sends.
- The experiment does not establish that the full two-way alternative works.
