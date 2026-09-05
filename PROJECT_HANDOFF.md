# Rebels Recruit Project Handoff

## Product
Rebels Recruit is a softball recruiting CRM for athletes, recruiting advisors/coaches, and organization leadership. The product helps users manage college and coach relationships, interactions, reminders, events, exports, and now social-media recruiting activity.

Brand: **REBELS RECRUIT**. REBELS is red, RECRUIT is black. Shared tagline inside the app: **Your relationships. Your journey.** Public landing-page headline: **Your recruiting. Your relationships. Your journey.**

## Stack
- Next.js 15 App Router
- React 19
- TypeScript
- Tailwind CSS
- Supabase Auth + Postgres + RLS
- Vercel deployment
- GitHub repo: `bobwad01-hue/rebels-recruit`
- Supabase project: `oopjkpguqkelbmujppgy`
- Production app: `https://rebels-recruit.vercel.app/`

## Roles
- athlete: athlete/player view only
- advisor: advisor/coach staff view
- admin/owner: organization-level staff access

Athletes cannot access advisor, organization, or export views. Staff cannot access athlete-only pages. Events are shared.

## Core Data
Existing tables include profiles, organizations, organization_members, teams, team_members, athlete_profiles, athlete_colleges, colleges, college_coaches, athlete_coaches, interactions, reminders, events, athlete_events, questionnaires, notes, notifications, audit_log, and athlete_advisor_assignments.

Interactions permanently store follow-up state with `follow_up_due_date` and `follow_up_completed_at`, so deleting a reminder does not erase activity history. Reminder completion/reopen behavior is supported.

## Social Media Foundation
Added provider-independent social architecture for X, Instagram, and TikTok:
- `social_accounts`: connected account metadata
- `social_account_secrets`: private OAuth access/refresh tokens, owner-only RLS
- `social_posts`: post history and engagement metrics
- `social_connections`: followers/following with follow-back state and recruiting category
- `social_events`: future-ready social engagement timeline

RLS is enabled on all social tables. Athletes can access their own records; staff access is governed by the existing `can_access_athlete()` relationship model. OAuth secrets are kept in a separate table so staff queries of normal social-account metadata do not expose tokens.

## X Integration
The X integration is scaffolded for OAuth 2.0 Authorization Code with PKCE and user-context API access.

Routes:
- `/api/social/x/connect` starts OAuth
- `/api/social/x/callback` exchanges the authorization code, saves the account, and performs an initial sync
- `/api/social/x/sync` refreshes the currently connected account's X data

The sync currently imports:
- X profile
- Up to 20 recent posts
- Up to 100 followers
- Up to 100 accounts the athlete follows
- Whether each tracked connection follows the athlete and/or is followed by the athlete

The UI is at `/social` and includes:
- Connected X account status
- Last post with timestamp
- Posting history
- Followers tracked
- Following tracked
- Accounts not followed back
- Recruiting-category filters
- Recruiting Social Feed
- Instagram/TikTok future placeholders

The Home dashboard includes a Social Media preview with X connection status, follower/following counts, last post, and college-coach connection count.

### X environment variables required for live OAuth
Add these to Vercel and local development when ready:
- `X_CLIENT_ID`
- `X_CLIENT_SECRET`
- `X_REDIRECT_URI` = `https://rebels-recruit.vercel.app/api/social/x/callback`

The X developer application must have the appropriate OAuth 2.0 settings, callback URL, and API access plan/scopes. Current implementation requests `tweet.read users.read follows.read offline.access`.

X API access is plan-dependent. The X developer documentation currently exposes v2 followers and user-post endpoints, and notes that enrollment in the relevant API access plans is required.

## Current User-Tested Features
Confirmed working by user:
- Signup/sign-in
- My Profile editing
- Add College
- Add Coach
- Coach title dropdown
- Quick Log Interaction
- Follow-up options: 1, 3, 5, 7, 10, 14, 30 days
- Reminder completion
- Reminder reopen/uncomplete
- Reminder deletion while retaining Activity history
- Activity timeline
- Activity sorting by date and creation order

Recently added and should be tested:
- Dashboard key information is clickable
- Social Media navigation
- Social Media dashboard
- X OAuth connection flow once X credentials/API access are configured

## Important Known Issues / Future Work
1. Dashboard greeting currently uses server runtime timezone. If it is wrong for Kansas users, change it to America/Chicago or client-local time.
2. `app/activity/[id]/page.tsx` should use the permanent interaction follow-up fields (`follow_up_due_date`, `follow_up_completed_at`) rather than relying on reminder rows for historical completion state.
3. Social sync currently replaces the stored X follower/following/post snapshot on refresh. A future version should preserve historical snapshots and create social_events for changes.
4. Social connections should be enriched against existing college coaches/colleges so the app can automatically recognize college coaches and programs.
5. Add a dedicated social engagement timeline showing coach follows, athlete follows, posts, likes, replies, and other recruiting-relevant events.
6. Add Instagram and TikTok integrations using the same provider-independent tables.
7. Consider scheduled background syncing once the social APIs and account volumes justify it.
8. Review and improve existing Supabase security-advisor warnings, especially mutable search paths and security-definer function exposure. These warnings predate the social feature except where noted.
9. Keep package versions pinned and maintain the lockfile.

## Recent Commits
- `315a98fe00237792b9a2e4129dd3fc7b17e8dd35` Add social media dashboard preview
- `c8c12b22b8447be71ad866948a24772bf38c369e` Restrict social media to athlete view
- `f1ddc6f8a183dc94bf391241ca11f285973e9306` Add Social Media navigation
- `ce4473f5909fbd2ff6f2fd7f245d676ab23efa1c` Sync X data from social dashboard
- `f87b9472f7b009d8ac2b77142eafe340b9d10e48` Add X social data sync endpoint
- `d521f87c821539fe79b16acd6183f1d1e85fe303` Add X OAuth callback and initial sync
- `44252b24246dd4f9217401919d872c46c3094b4a` Add X OAuth connection start
- `e976d735049a09da6790cf2c3d2a8dd3d14dfe2e` Add social recruiting dashboard
- `5e81927997bc83adef8ea56b73818834ea38c8ff` Make dashboard data clickable
- `2f7b6f096c635dd6b190d3b67cc0a9a49efa2e81` Sort Activity by date and creation order

## Development Rules
- For Supabase schema changes, use a migration and verify with a SQL query.
- Never expose Supabase service-role credentials to the browser.
- Never use user-editable `user_metadata` for authorization.
- Preserve the athlete/advisor/organization role boundaries.
- When updating an existing GitHub file, fetch it first and use its current blob SHA.
- Vercel deploys automatically from `main` when Git integration is active.
- Before major new work, read this file first.
