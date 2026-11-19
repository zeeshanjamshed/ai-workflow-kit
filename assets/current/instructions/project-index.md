# Project context

Start with [project permissions](rules/permissions.md) and preserve existing project instructions.

- Keep verified project facts in `knowledge/`. Include evidence or code references and mark assumptions.
- Keep material decisions in `decisions/`. Include status, rationale, and alternatives.
- Keep resumable work in `tasks/<id>.md`. Record status, scope and approvals, affected paths, Git branch and commit, verified findings, tests, blockers, and the next step.
- Use `ai-setup context` to list records and `ai-setup context <id>` to read a handoff. Verify claims against the current checkout before acting.

Keep secrets out of records. Update them only within the approved scope. Ignored or uncommitted records are local to this checkout.
