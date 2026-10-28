# Production-gated Reply-To test (limited to two test accounts)

This test uses the **existing production Google OAuth credentials**. It does not require duplicating OAuth or token encryption secrets to Vercel Preview. The feature is **off by default**, applies only to a new, single-recipient message from an exact signed-in test athlete ID to an exact test coach email, and does not modify ordinary sends.

## Required Production environment variables (server-side only)

- \`RLTNL_REPLY_TO_PROD_TEST_ENABLED=true\`
- \`RLTNL_REPLY_TO_PROD_TEST_USER_ID=<UUID of Sara's test account>\`
- \`RLTNL_REPLY_TO_PROD_TEST_RECIPIENT=rdwaddell01@gmail.com\`
- \`RLTNL_REPLY_TO_PROD_TEST_ADDRESS=replies@vexeiistaa.resend.app\`

**Do not enable these until the PR has been reviewed and the production deployment is ready.** Do not alter Google OAuth, Gmail read scope, or token encryption variables. All four must be configured in Production and the application redeployed before a test. If any are missing or do not match, the ordinary sender remains unchanged.

## Manual test

1. From Sara's account on rltnl.com, compose a **new** email to the test coach, without CCs. Do not use a previous conversation.
2. In the coach's Gmail inbox, inspect the received message's original headers and click Reply **without sending**. Confirm the recipient is \`replies@vexeiistaa.resend.app\`.
3. Send a short reply from the coach's Gmail; confirm it arrives in Resend Receiving.
4. Check Sara's Gmail and the RLTNL conversation: this phase **does not** auto-forward or log the reply, and existing Gmail readonly may still sync the reply if it reaches Sara through another path.
5. Send a normal email to a different test recipient and confirm there is no Reply-To override. Do not email real college coaches for this test.
6. Disable the experiment by setting \`RLTNL_REPLY_TO_PROD_TEST_ENABLED=false\` and redeploy. No code rollback is necessary to disable the header.

## Limitations

The coach reply will be delivered to the Resend test address **instead of Sara's Gmail**; automatic forwarding and persistence are not implemented. This is a routing experiment, not a complete alternative to Gmail readonly. The branch-based Preview prototype is separate and is not intended for production deployment.
