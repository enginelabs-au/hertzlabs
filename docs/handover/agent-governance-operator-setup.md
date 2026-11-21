# Agent governance operator setup

Human-only controls that sit outside the in-repo agent policy. Agents must not request secret values here, and this file does not authorize any production or remote mutation.

## GitHub

- Protect the default branch and require the `agent-governance` workflow to pass before merge.
- Restrict who can edit `AGENTS.md`, `.cursor/hooks/`, `.cursor/hooks.json`, `.cursor/cli.json`, `.cursor/permissions.json`, `.cursor/sandbox.json`, `.cursorignore`, `.githooks/`, and `.github/workflows/agent-governance.yml`.
- Keep deploy and database credentials in CI or the provider dashboard, never in the repository.

## Provider controls

Record required environment-variable names only; values stay in the owner's secret manager.

- Vercel: production deploys through Git integration or an owner-run CLI session.
- Supabase: `db push` and migration repair through an owner-run session or CI.
- Other providers: add the same pattern when the project adopts them.

## Status

Until the owner completes these controls, treat them as not configured; repository-local hooks and permissions are the only enforcement in place.
