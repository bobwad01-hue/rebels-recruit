# Rebels Recruit

**Your recruiting. Your relationships. Your next move.**

College softball recruiting relationship management built with Next.js, Supabase and Vercel.

## MVP
- Supabase authentication with email/password and Google OAuth
- Responsive athlete dashboard and mobile navigation
- College recruiting board and college detail pages
- Quick Log Interaction with coach selection and follow-up reminders
- Interaction timeline and reminders
- Advisor and organization foundation views
- XLSX interaction export API
- Normalized multi-tenant database with Supabase RLS

## Architecture
Organization → Advisors → Athletes → Colleges → College Coaches → Relationships → Interactions / Reminders / Events / Notes.

Global colleges and coaches are separate from athlete-specific relationships so shared records stay clean while each athlete can maintain individual fit, status and relationship strength.

## Database
Supabase migrations are in `supabase/migrations/`. The schema includes organizations, memberships, teams, athlete/advisor assignments, athlete profiles, colleges, coaches, relationships, interactions, reminders, events, questionnaires, notes, notifications and audit logs.

## Development
Copy `.env.example` to `.env.local`, set the Supabase URL and publishable/anon key, install dependencies and run `npm run dev`.

## Roadmap
1. Full advisor/organization CRUD, invitations and athlete switcher
2. Coach relationship profiles, scores and next steps
3. Pipeline, events/camps and questionnaire tracking
4. Search/filtering and spreadsheet import
5. Organization analytics, momentum and audit UI
6. Gmail/Outlook/calendar/social integrations
