# Tennis Team Scheduler

A Supabase + Next.js starter for scheduling doubles tennis matches. Any rostered player may propose a slot; a slot is confirmed only after every named participant explicitly approves.

## Included

- Postgres schema, constraints, RLS, and secure RPCs
- The seven teams from the supplied roster as seed data
- Pending-proposal dashboard UI
- Database-enforced unanimous approval and conflict checks
- Reminder/notification data model

## Local setup

1. Create a Supabase project and copy its URL and anonymous key.
2. Run `supabase/migrations/001_initial.sql` in the Supabase SQL Editor.
3. Create a Next.js app around these files or copy this repository into one, then install: `npm install next react react-dom @supabase/ssr @supabase/supabase-js`.
4. Copy `.env.example` to `.env.local` and set both public values.
5. Run `npm run dev`.

## Scheduling rule

A proposal has one response row per active player on both teams. `respond_to_proposal` writes only the signed-in player’s response. After every approval it invokes `try_confirm_proposal`; confirmation occurs only when every participant status is `approved`. The function checks for overlap on the court, either team, and each named player again immediately before confirmation.

For a date/time change, expire or cancel the old proposal and create a new proposal. This always starts a fresh approval cycle.

## Production checklist

- Configure Supabase Auth (magic-link email or Google).
- Create player profiles after sign-in and link them to `team_members`.
- Add an Edge Function or cron job to deliver pending-response reminders.
- Add an email provider and optional SMS opt-in; store notification delivery status.
- Add a service-role-only admin interface for fixtures, rosters, courts, and results.


## Code style

Formatting is enforced with Prettier and ESLint. A Husky pre-commit hook runs lint-staged to auto-fix staged files, CI checks format/lint/build, and the autofix bot formats pull requests automatically.
