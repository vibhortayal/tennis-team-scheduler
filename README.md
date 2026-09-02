# Tennis Team Scheduler

A Next.js dashboard for managing doubles tennis matches across the supplied Group A and Group B rosters. The app reads and writes match records through the Supabase REST API and calculates standings in the browser.

## Features

- Dashboard with the next scheduled match, overdue matches, upcoming matches, recent results, and cancelled matches.
- Group and status filters, plus filtering by team.
- Schedule and edit matches with date, time, court, status, result, and cancellation reason fields.
- Score entry for best-of-three matches. Completed matches require two winning sets, and each recorded set must have a winner.
- Smart Scheduling suggestions based on opponent availability and configurable rest-day gaps.
- Standings ranked by points, net score rate, match wins, and team number.
- Player picker that highlights the selected team and controls Smart Scheduling eligibility.

## Requirements

- Node.js with npm.
- A Supabase project with a REST-accessible `dashboard_matches` table.
- The `dashboard_matches` table should expose these fields: `id`, `matchup`, `match_date`, `match_time`, `court`, `status`, `result`, `cancellation_reason`, and `league_group`.

## Local setup

Install dependencies from the repository root:

```bash
npm install
```

Create `.env.local` with the Supabase project URL and a public key:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-public-key
```

`NEXT_PUBLIC_SUPABASE_ANON_KEY` is also supported for projects that use the older variable name. Do not put a service-role key in a `NEXT_PUBLIC_` variable.

Start the development server:

```bash
npm run dev
```

The app is available at `http://localhost:3000` by default.

## Project commands

```bash
npm run lint       # Run ESLint
npm run build      # Create a production build
npm run start      # Serve the production build
npm run format     # Check Prettier formatting
npm run format:fix # Apply Prettier formatting
```

## Data and migrations

The frontend currently uses the `dashboard_matches` REST endpoint and does not call the proposal RPCs. Migration `001_initial.sql` creates the earlier proposal-oriented tables (`fixtures`, `match_proposals`, participants, responses, and notifications). Migration `002_standings_trigger.sql` defines the standings trigger for `dashboard_matches` and `team_standings`, but those dashboard tables are not created by the current migrations.

Before applying migration 002, provide the dashboard tables and their required permissions in Supabase. This is an honor-based tournament: the player picker stores the selected roster identity in local storage, and availability is intentionally public so participants can coordinate without accounts.

## Roster

The roster is defined in `app/teams.ts`:

- Group A: Teams 2, 5, 7, 9, 11, and 12.
- Group B: Teams 1, 3, 4, 6, 8, 10, and 13.

The default view is Group A when no player is selected. Selecting a player switches the relevant dashboard, scheduling, and standings context to that player's group.
