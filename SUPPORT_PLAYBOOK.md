# Rebels Recruit Support Playbook

Last updated: 2026-09-11

Use this playbook before changing production data. Preserve athlete ownership of recruiting data and use the least-destructive fix.

## Safety rules

- Never delete recruiting history to solve an access problem.
- Never grant organization access by matching a name alone.
- Verify user IDs, verified email, organization membership, and status before changing access.
- Treat athlete data as canonical and organization access as revocable.
- Preserve import provenance and historical date precision.
- Do not expose another athlete's information while investigating a support case.
- Record material support/access changes in the audit trail.
- Sole Owner protection remains in force.

## "My daughter disappeared"

1. Confirm the reporter is signed in to the expected Parent account.
2. Inspect active `parent_guardian_access` rows for the parent.
3. Confirm the expected athlete link is active, not pending/revoked/declined.
4. Confirm the athlete profile still exists.
5. Check the parent's selected athlete context and remove stale local selection only after authorization is confirmed.
6. If the link was revoked, do not restore it without athlete authorization.
7. Never recreate the athlete or copy recruiting data as the first fix.

## "The wrong organization has access"

1. Inspect active organization memberships for the athlete and reporter.
2. Identify the shared organization that grants access.
3. Inspect advisor assignments and organization-view access.
4. Confirm whether the athlete intentionally joined that organization.
5. Revoke only the incorrect organization membership/assignment/access path.
6. Verify other organization memberships remain active.
7. Verify canonical schools, coaches, Journey, events, Next Steps, and videos remain intact.

## "My imported history is missing"

1. Confirm the athlete account and exact verified email used for the import.
2. Inspect imported/unclaimed-player records and import provenance.
3. Confirm the import claim/materialization workflow completed.
4. Check date precision and historical import keys before assuming rows are duplicates.
5. Never invent historical dates from `created_at`.
6. Do not re-import blindly. Re-importing can create duplicate history if the original materialization succeeded partially.

## "Google disconnected"

1. Inspect the Google Workspace connection state and timestamps captured in the support case.
2. Determine whether the connection is absent, revoked, stale, or only Calendar is disconnected.
3. Ask the user to reconnect only after confirming the stored connection state.
4. Preserve manual email/calendar fallback paths.
5. Do not claim Gmail inbox access. Rebels Recruit's Gmail integration is intentionally send-only unless product scope changes later.

## "I joined the wrong team"

1. Confirm all active organization memberships.
2. Identify the incorrect membership.
3. Use the normal Leave Organization flow when possible.
4. Confirm the correct organization remains active.
5. Confirm canonical recruiting data remains in the athlete account.
6. Confirm organization-specific assignments no longer grant access from the organization that was left.

## Parent access problem

1. Confirm parent and athlete user IDs.
2. Inspect the exact `parent_guardian_access` row and status.
3. Check permissions separately from link status.
4. Revoke/restore only with athlete authorization.
5. Test the requested athlete ID against the parent's active links before showing any data.

## Account deletion

1. Confirm an open `account_deletion_requests` record exists.
2. Confirm the request belongs to the authenticated user.
3. Review active organization memberships, parent links, imported history, Google connections, and legal/audit obligations.
4. Do not delete automatically from a support message.
5. Follow the counsel-approved retention/deletion policy once finalized.
6. Mark the request processing/completed only when the actual deletion workflow has been performed and verified.

## Escalation evidence

A useful escalation should include:
- support case reference
- reporter user ID
- affected athlete/user ID if known
- active organization membership state
- parent-link state if relevant
- import provenance if relevant
- Google connection state if relevant
- exact error/failure state
- what the user expected to happen
- what changed, by whom, and when

Do not include passwords, OAuth tokens, access tokens, or unnecessary recruiting-message content in support notes.
