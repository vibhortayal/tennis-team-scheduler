# AGENTS.md — Tennis Team Scheduler

## Repository and branch safety

- Repository: `vibhortayal/tennis-team-scheduler`
- Primary branch: `main`.
- Never commit directly to `main`.
- Create focused feature or fix branches from current `main`.
- Before editing, inspect the current relevant files and the target branch.
- Keep changes minimal, scoped, and backward-compatible.
- Avoid unrelated refactors in feature or bug-fix work.
- Do not create, edit, delete, commit, push, merge, deploy, create pull requests, create issues, change settings, or apply database migrations unless the user explicitly requests the exact action and explicitly confirms after reviewing the proposed change.

## Local development

- Assume macOS with `zsh` and Antigravity IDE unless the user specifies another environment.
- Use repository-relative paths and state the working directory in command instructions when useful.
- This repository uses npm, as shown by `package-lock.json`.
- Do not assume scripts exist. Inspect `package.json` before recommending commands.
- Prefer repository-defined scripts and project-local tools over global installations.

## Security and secrets

- Never read, reveal, reproduce, edit, or commit `.env`, `.env.*`, credential files, API keys, tokens, passwords, SSH/private keys, or secret configuration.
- Do not ask for secret values.
- A Supabase service-role key is secret and server-only. Never use it in browser/client code.
- Public browser configuration such as a Supabase URL or anon-key reference may be discussed only as configuration concepts, never as sensitive values.
- Never add provider or deployment credentials to source files, tests, examples, logs, or documentation.

## Supabase and database changes

- Treat Supabase migrations, Row Level Security policies, triggers, functions, and database constraints as security- and data-sensitive.
- Prefer additive, backward-compatible, reversible migrations.
- Do not modify already-deployed migrations; add a new migration.
- Never run destructive Supabase commands or apply migrations without explicit approval.
- For every schema, query, role, team-membership, or auth change, review:
  - authorization and ownership,
  - tenancy/team isolation,
  - input validation,
  - RLS policies,
  - existing data compatibility,
  - trigger/function effects,
  - rollback strategy.
- Do not call a table or workflow secure unless its access paths and RLS policies have been inspected.

## Domain-specific guidance

- Team and player changes may affect availability, matches, smart scheduling, and standings.
- Availability behavior must account for date boundaries, recurring days, time windows, mode/kind semantics, and timezone handling.
- Scheduling changes must preserve rest-day and team eligibility rules.
- Score changes may affect database-side standings logic. Validate both client score parsing and database-trigger effects.
- Team withdrawal or movement must preserve historical data and prevent invalid future scheduling where intended.

## Testing and validation

- Run only commands defined in the current `package.json` or documented in the repository.
- Extend unit tests for changed pure business logic.
- Run availability tests after availability or schedule-eligibility changes.
- Run scoring tests after score, result, or standings changes.
- Run team tests after team, player, roster, validation, withdrawal, or movement changes.
- Add or update end-to-end tests when a user-facing workflow changes and the project has browser-test support.
- For Supabase/RLS changes, define and execute an explicit allow/deny access matrix in a non-production environment.

## Required change proposal format

Before recommending an implementation, provide:

1. Concise plan
2. Affected files
3. Database and RLS impact
4. Test/validation plan
5. Risks and assumptions

When practical, provide a unified diff before making edits.

## Approval gates

- Show the final proposed diff before committing.
- Ask for explicit approval before commit, push, pull-request creation, database migration execution, deployment, or production configuration changes.
- Do not deploy directly to production by default.
- Prefer branch/PR preview deployments for validation when configured.

## Implementation report

After an approved implementation, report:

- Branch name
- Changed files
- Migration status
- Validation results
- Commit SHA
- Pull request URL, if applicable
- Limitations and follow-up risks
