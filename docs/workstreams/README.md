# Task workstreams

Use one directory per substantive task:

```text
docs/workstreams/<task-id>/
  manifest.md
  <canonical-role-id>/
    charter.md
    plan.md
    evidence.md
    handoff.md
    artifacts/
  delivery/
    owner-handoff.md
```

Use a stable lowercase kebab-case task ID, preferably `YYYYMMDD-<short-slug>`. Create folders only for activated roles. The manifest must record every canonical role as `required` or `skipped` with evidence-based reasoning.

Each activated role completes its charter and `plan.md` before role-specific execution, records reproducible claims in `evidence.md`, and closes with `handoff.md`. A downstream role starts only from a materialized predecessor handoff with a supported verdict. Do not store secrets, private credentials, raw sensitive production data, or fabricated evidence in workstream files.

Canonical role behavior and stage gates are defined in `.cursor/instructions/ROLES.md`.
