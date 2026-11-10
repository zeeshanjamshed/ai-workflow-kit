# AI Workflow Kit

A reusable, project-local AI engineering setup for Claude Code, Codex, Cursor, and other compatible coding agents.

> **Status:** Work in progress. The read-only CLI is available from this repository. The installer and npm release are pending.

## What we're building

- **Consistent engineering standards:** Clean, secure, maintainable code, with project-aware practices and no unnecessary complexity.
- **Approval-first workflow:** Investigate safely, propose a short plan, and request approval before writing code, data, or external state.
- **Shared project knowledge:** Architecture, decisions, tasks, relevant skills, and handoffs are kept within each project, not trapped in an individual agent session.
- **Safe adoption:** Support new projects, mature codebases, and existing AI configurations without overwriting important work.
- **Multi-agent compatibility:** Shared rules and knowledge with lightweight agent-specific entry points and optional parallel coordination.
- **Independent projects:** Each initialized project owns its setup and can selectively review master updates.

## Planned commands

| Command | Intended behavior |
| --- | --- |
| `ai-setup init` | Discover a project, propose a safe setup, and apply approved steps |
| `ai-setup init --dry-run` | Preview without modifying the project |
| `ai-setup update` | Review proposed improvements from a newer master release |
| `ai-setup doctor` | Read-only consistency and health checks |

Run the read-only commands from a checkout with Node.js 22.18 or newer.

```sh
npm run ai-setup -- doctor
npm run ai-setup -- init --dry-run
npm test
```

To inspect another project, run `node /absolute/path/to/ai-workflow-kit/packages/cli/src/main.ts doctor` from that project's directory. Both commands emit JSON. Doctor exits with code 1 if it finds issues or inspection fails. Unsupported commands exit with code 2.

Discovery reports local signals such as Git state, project markers, declared framework versions, and agent paths. The dry run lists candidate paths and flags existing files for review. Doctor checks common instruction entry points, basic manifest validity, and local Markdown links. Confirm agent behavior, rule conflicts, and project-specific context separately. Apply-mode initialization and updates are pending.

## Specification

Read the [master specification](docs/SPECIFICATION.md) for the approved requirements, proposed structures, safety boundaries, and acceptance criteria.

## Development approach

Implementation will be incremental and reviewed before each stage. The first stable `v1.0.0` release will follow testing across new, existing, and AI-configured projects.

The repository is public, but **no open-source license has been selected yet**. We will decide that before a public release.
