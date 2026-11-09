# AI Workflow Kit

A reusable, project-local AI engineering setup for Claude Code, Codex, Cursor, and other compatible coding agents.

> **Status:** Work in progress. The design baseline is approved, but the CLI and installer have **not been implemented or published**.

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

**These commands do not exist yet.** We'll build, test, and publish the CLI in later, separately approved steps.

## Specification

Read the [master specification](docs/SPECIFICATION.md) for the approved requirements, proposed structures, safety boundaries, and acceptance criteria.

## Development approach

Implementation will be incremental and reviewed before each stage. The first stable `v1.0.0` release will follow testing across new, existing, and AI-configured projects.

The repository is public, but **no open-source license has been selected yet**. We will decide that before a public release.
