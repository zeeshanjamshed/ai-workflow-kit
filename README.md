# AI Workflow Kit

A reusable, project-local AI engineering setup for Claude Code, Codex, Cursor, and other compatible coding agents.

> **Status:** Work in progress. The CLI is available from this repository for read-only checks, previews, and approved project initialization. The npm release is pending.

## What we're building

- **Consistent engineering standards:** Clean, secure, maintainable code, with project-aware practices and no unnecessary complexity.
- **Approval-first workflow:** Investigate safely, propose a short plan, and request approval before writing code, data, or external state.
- **Shared project knowledge:** Architecture, decisions, tasks, relevant skills, and handoffs are kept within each project, not trapped in an individual agent session.
- **Safe adoption:** Support new projects, mature codebases, and existing AI configurations without overwriting important work.
- **Multi-agent compatibility:** Shared rules and knowledge with lightweight agent-specific entry points and optional parallel coordination.
- **Independent projects:** Each initialized project owns its setup and can selectively review master updates.

## Commands

| Command | Behavior |
| --- | --- |
| `ai-setup init` | Discover a project, propose a safe setup, and apply approved steps |
| `ai-setup init --dry-run` | Preview without modifying the project |
| `ai-setup update` | Planned. Review proposed improvements from a newer master release |
| `ai-setup doctor` | Read-only consistency and health checks |

Run these commands from a checkout with Node.js 22.18 or newer.

```sh
npm run ai-setup -- doctor
npm run ai-setup -- init --dry-run
npm test
```

To inspect another project, run `node /absolute/path/to/ai-workflow-kit/packages/cli/src/main.ts doctor` from that project's directory. Both commands emit JSON. Doctor exits with code 1 if it finds issues or inspection fails. Unsupported commands exit with code 2.

Discovery reports local signals such as Git state, project markers, declared framework versions, and agent paths. The dry run lists candidate paths and flags existing files for review. Doctor checks common instruction entry points, basic manifest validity, and local Markdown links. Confirm agent behavior, rule conflicts, and project-specific context separately. Updates are planned.

## Initialize a project

From the target project's directory, run the CLI from your kit checkout:

```sh
node /absolute/path/to/ai-workflow-kit/packages/cli/src/main.ts init
```

Choose a tracking policy and optional Claude, Codex, or Cursor entry points. Inspect the preview, which shows exact proposed contents and paths. Type `apply` to approve that plan. Any other response leaves the project untouched. For an exact read-only preview, use `init --dry-run --tracking=mixed --agents=codex`. An empty `--agents=` selects no entry points.

- **Tracked** leaves new setup records eligible to commit and share.
- **Mixed** leaves setup eligible to share and ignores the `.ai/knowledge/`, `.ai/decisions/`, and `.ai/tasks/` directories.
- **Local-only** ignores the new `.ai/` records. In a Git repository, any new root or Cursor entry point must already be ignored and untracked. Choose no entry points if existing ignore rules do not cover them. Local records need independent backups.

Initialization creates missing files and preserves existing instructions, skills, and project knowledge in place. It makes no Git commits or changes to existing files, so there are no overwritten originals to back up. Reconcile existing custom instructions manually. An incompatible privacy rule or an unrecognized manifest blocks initialization. If interrupted, rerun `init` to review and approve the saved plan. The journal remains available for inspection, and a completed manifest makes reruns a no-op. Real agent discovery and approval behavior are verified in a later phase.

## Specification

Read the [master specification](docs/SPECIFICATION.md) for the approved requirements, proposed structures, safety boundaries, and acceptance criteria.

## Development approach

Implementation will be incremental and reviewed before each stage. The first stable `v1.0.0` release will follow testing across new, existing, and AI-configured projects.

The repository is public, but **no open-source license has been selected yet**. We will decide that before a public release.
