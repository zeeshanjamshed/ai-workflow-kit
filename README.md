# AI Workflow Kit

A reusable, project-local AI engineering setup for Claude Code, Codex, Cursor, and other compatible coding agents.

> **Status:** v0.4.2 is [available on npm](https://www.npmjs.com/package/@zeeshanjamshed/ai-workflow-kit). The stable v1.0.0 release is on hold.

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
| `ai-setup quickstart` | Preview and apply the complete recommended setup with one approval |
| `ai-setup init` | Discover a project, propose a safe setup, and apply approved steps |
| `ai-setup init --dry-run` | Preview without modifying the project |
| `ai-setup update` | Compare bundled defaults with project files and apply approved changes |
| `ai-setup doctor` | Read-only consistency and health checks |

Run these commands from a checkout with Node.js 22.18 or newer.

```sh
npm run ai-setup -- doctor
npm run ai-setup -- init --dry-run
npm test
```

After installing the CLI, run `ai-setup doctor` from the target project. Both commands emit JSON. Doctor exits with code 1 if it finds issues or inspection fails. Unsupported commands exit with code 2.

Discovery reports local signals such as Git state, project markers, declared framework versions, and agent paths. The dry run lists candidate paths and flags existing files for review. Doctor checks common instruction entry points, basic manifest validity, and local Markdown links. Confirm agent behavior, rule conflicts, and project-specific context separately. Updates use the baseline bundled with the installed CLI.

## One-command quickstart

With Node.js 22.18 or newer, run this from the project:

```sh
npx -y @zeeshanjamshed/ai-workflow-kit quickstart
```

Review the repository root, tracking policy, paths to add, and existing instruction files that will receive a rule section. Type `apply` once to approve the setup. Add `--dry-run` for the same preview without project writes. The npm `-y` flag answers npm’s install prompt. Quickstart still waits for `apply`. New setups default to mixed tracking, which keeps knowledge, decisions, and handoffs Git-ignored. Existing setups keep their tracking policy and installed baseline.

Quickstart sets up missing shared files, the five recommended engineering modules, and native instruction entry points for Claude Code, Codex, and Cursor. It installs guided onboarding skills for Claude Code and Codex. Existing custom rules, skills, knowledge, and instruction text are preserved. Resolve semantic instruction conflicts before approving. A conflicting activation section or privacy policy blocks the operation.

If interrupted, rerun `ai-setup quickstart` to review and approve the saved plan. A successful run prints a backup ID. `ai-setup rollback <backup-id>` previews reversal and refuses if any affected file changed afterward. Review rollback carefully because it removes kit-created files from that run. Individual setup commands are still available below.

Start a fresh Claude Code or Codex session in the project and run the **guided-project-onboarding** skill. The agent examines the actual code and proposes useful knowledge. Saving that knowledge needs separate approval.

## Initialize a project

After installing the CLI, run this from the target project's directory:

```sh
ai-setup init
```

Choose a tracking policy and optional Claude, Codex, or Cursor entry points. Inspect the preview, which shows exact proposed contents and paths. Type `apply` to approve that plan. Any other response leaves the project untouched. For an exact read-only preview, use `init --dry-run --tracking=mixed --agents=codex`. An empty `--agents=` selects no entry points.

- **Tracked** leaves new setup records eligible to commit and share.
- **Mixed** leaves setup eligible to share and ignores the `.ai/knowledge/`, `.ai/decisions/`, and `.ai/tasks/` directories.
- **Local-only** ignores the new `.ai/` records. In a Git repository, any new root or Cursor entry point must already be ignored and untracked. Choose no entry points if existing ignore rules do not cover them. Local records need independent backups.

Initialization creates missing files and preserves existing instructions, skills, and project knowledge in place. It makes no Git commits or changes to existing files, so there are no overwritten originals to back up. Reconcile existing custom instructions manually. An incompatible privacy rule or an unrecognized manifest blocks initialization. If interrupted, rerun `init` to review and approve the saved plan. The journal remains available for inspection, and a completed manifest makes reruns a no-op. Real agent discovery and approval behavior are verified in a later phase.

## Updates, backups, and installation

From an initialized project, use `ai-setup update --dry-run` to compare the installed baseline, local files, and the current bundled version. The update checks manifest hashes and works offline. It replaces an unchanged kit file when the bundled default changes and preserves local edits when that default stays the same. If both sides changed, or a managed file is missing, the update stops for review. Existing unmanaged rules, skills, knowledge, and decisions stay in place.

- `ai-setup update` shows the plan and waits for `apply`. Use `--version=0.4.2` to select the current bundled release explicitly.
- `ai-setup pin <version>` pins the installed or current bundled version. Use `ai-setup pin none` to unpin. Both require approval.
- `ai-setup repair` can restore missing managed files from the installed baseline after approval. It preserves existing files.
- `ai-setup rollback <backup-id>` previews the inverse operation and requires approval. It refuses to overwrite subsequent edits. If interrupted, rerun `ai-setup update` to review and resume the pending operation.

Backups and the recovery journal stay in the ignored `.ai/update-backups/` directory. They contain the before and after contents of files in the operation. Keep secrets out of setup files. Close other editors and avoid concurrent setup operations while applying changes. The current bundle recognizes setup versions 0.1.0, 0.2.0, 0.3.0, 0.4.0, 0.4.1, and 0.4.2. It upgrades to its own version and leaves version downgrades to rollback.

### Optional global installation

Run `npm install --global @zeeshanjamshed/ai-workflow-kit`, then use `ai-setup quickstart` from your project. A global install keeps `ai-setup` available for later commands and agent sessions.

### Local development and offline installation

Use Node.js 22.18 or newer. In a checkout of the reviewed kit commit, build the local tarball and install it once with the npm used by your agent shell.

```sh
npm ci --ignore-scripts
npm pack
npm install --global --offline --ignore-scripts ./zeeshanjamshed-ai-workflow-kit-0.4.2.tgz
ai-setup --version
```

npm copies the compiled CLI into its global prefix. You can move or remove the build checkout after installation. On macOS and Linux the launcher is under `$(npm prefix -g)/bin`; on Windows it is directly under the directory printed by `npm prefix -g`. If `ai-setup --version` fails, put that executable directory on your user PATH or use the Node version manager's active environment. Restart Claude Code or Codex from a terminal where the version check succeeds. If you use multiple profiles or launch agents from an IDE, repeat the version check in each launch environment. A Node version manager may keep global packages separate per Node version.

The installed CLI has no runtime dependencies and works offline. Future kit builds can be installed the same way. The v0.4.0 baseline remains bundled so existing setups can preview upgrades and use their backups.

## Guided onboarding and engineering rules

From the target checkout, run `ai-setup onboard` and give its output to Claude Code or Codex. The inventory includes project and Git signals, up to 300 tracked paths, known instruction locations, and existing knowledge. The agent reads actual manifests, source, tests, and docs to trace relevant architecture and critical flows. Review its proposed facts, hypotheses, and open questions before saving anything.

- `ai-setup onboard install-skills both` previews native project skills for Claude and Codex. Use `claude` or `codex` for one. Restart the agent session and select the guided project onboarding skill.
- `ai-setup onboard save` accepts the JSON array shown by `onboard` on one input line. Each verified fact needs a tracked source path, line, and exact excerpt. The CLI checks the excerpt and stores the citation. Review the fact itself against the cited code. Enter `apply` after reviewing the exact additions. Use stable record IDs so reruns keep identical records and surface differences.
- `ai-setup rules minimal` keeps the essential setup. `ai-setup rules recommended` previews the five engineering modules. `ai-setup rules custom architecture testing` previews only the named modules.
- After reviewing the modules, run `ai-setup rules activate all --dry-run` to preview links for all five existing modules, or use `ai-setup rules activate architecture testing --dry-run` for a subset. Rerun without `--dry-run` and type `apply` after checking for conflicts. Existing v0.4.0 projects can activate the modules they already have, including customized versions.
- Activation appends a reversible section to existing native entry points. Claude Code uses imports. Codex loads the section through `AGENTS.md` (or `AGENTS.override.md` when present) and is instructed to read the selected files before planning. The kit's Cursor always-applied adapter can also point to them. Restart agents to pick up the entry-point changes and review nested or user-level instructions for precedence conflicts.
- `ai-setup rules` reports each module's presence, selected entry points, and whether its contents match the bundle or are project-owned. Modules remain editable project files. Activation leaves their contents and update provenance alone. Use `ai-setup rollback <backup-id>` to undo an activation if the affected instructions still match the approved change.

These additions require an initialized project. Preview them before applying, especially when existing instruction files might conflict. An existing target with different contents blocks the plan. The CLI flags file conflicts and lists existing instructions for review. The agent and project owner resolve conflicts in meaning. Generated setup guides point agents to the rule inventory. Use the activation preview to review changes to existing entry points.

Knowledge, optional skills, and selected modules are project-owned additions. The commands preserve existing files and honor the setup’s Git privacy policy. Customize modules with a separately approved edit. Kit updates leave these additions out of the managed manifest, so version changes and rollback do not replace them.

## Agent instructions, skills, and handoffs

New setups can generate Claude Code’s `CLAUDE.md`, Codex’s `AGENTS.md`, or a Cursor project rule. Claude imports the shared permissions file. Codex loads `AGENTS.md` and reads shared context on demand. Cursor can use the same `AGENTS.md` when present, or a kit-generated always-applied rule for Cursor-only setups. Existing entries remain authoritative and need manual reconciliation where they differ. Completed older setups stay intact, and interrupted Phase 4 setups resume with their original templates.

Run `ai-setup skills` from the project or relevant subdirectory to inventory `SKILL.md` paths in `.claude/skills`, `.agents/skills`, and `.cursor/skills` in project scope and under the current home directory. The inventory shows filesystem candidates, including third-party skills at those paths. It does not execute skills or resolve plugin, managed, synced, or disabled entries. Verify actual availability in the agent UI.

Use `ai-setup context` to find project knowledge, decisions, and task handoffs. Use `ai-setup context <task-id>` to read one task with current Git context. For approved handoff writes, use `.ai/tasks/<task-id>.md` and record scope, approvals, affected files, Git branch and commit, verified findings, tests, blockers, and next action. Keep secrets out and verify claims against Git and code before continuing. Ignored and uncommitted records need an explicit sharing mechanism.

### Verify an agent in a disposable project

1. Initialize a disposable Git repository with the relevant adapter enabled. Add a harmless unique phrase to the fixture’s shared permissions, a sample skill in its native directory, and a task record.
2. Start a fresh agent session in the fixture using its native safe settings. Ask it to report the phrase, identify the skill, and resume the task. Check that it reads the task, inspects Git, and distinguishes evidence from assumptions.
3. Ask for a write without granting approval. Check that the agent asks first and that the fixture stays unchanged. Record the runtime version, permissions, and observed result. Repeat with existing custom instructions to check preservation and precedence.

Prompt instructions guide behavior. Use the agent’s native sandbox and permissions for enforcement. Automated tests check generated files and read-only commands. Live verification is pending for Claude Code and Cursor, which were unavailable here. Codex CLI 0.167.0-alpha.4 was installed, but its isolated run could not load instructions because the filesystem sandbox helper could not build the bubblewrap command. The isolated profile was also signed out.

References: [Claude Code instructions](https://code.claude.com/docs/en/memory), [Claude Code skills](https://code.claude.com/docs/en/skills), [Codex instructions](https://learn.chatgpt.com/docs/agent-configuration/agents-md), [Codex skills](https://learn.chatgpt.com/docs/build-skills), [Cursor rules](https://cursor.com/docs/rules), and [Cursor skills](https://cursor.com/docs/skills).

## Coordinate parallel work

From the target checkout, run `ai-setup coordinate status` before editing. Use `coordinate claim <task> <agent> <path> [path...]` to claim files or directories, or quote `"*"` for a repository-wide claim. Type `apply` after reviewing the plan. Keep the returned ownership token private. Use it with `coordinate renew <task> <token>` or `coordinate release <task> <token> [.ai/tasks/<id>.md]`.

Claims last one hour. Stale claims still block overlapping work until you confirm the old writer stopped and explicitly approve `coordinate takeover <task> <agent> <path> [path...]`. A crashed metadata writer may leave `write.lock` in the reported coordination directory. Clear the empty lock directory manually only after confirming no writer is running.

Pass `--worktree` from an explicitly created linked worktree. The command never creates branches or worktrees. Same-clone worktrees share advisory ownership through Git’s common directory. Separate clones and working-file edits are independent. Share durable handoffs through an approved Git or other sync step, and verify the recorded commit, local changes, and handoff before acting. Coordination never authorizes project writes.

CI checks Node.js 22 and 24 on Linux, macOS, and Windows, runs strict type checks and fixture tests, verifies offline package installation, and audits npm dependencies. See the [project plan](docs/PROJECT_PLAN.md) for observed results. Workflow fixtures exercise CLI boundaries and handoffs. Live agent behavior is checked separately.

## Specification

Read the [master specification](docs/SPECIFICATION.md) for the approved requirements, proposed structures, safety boundaries, and acceptance criteria.

## Development approach

Implementation will be incremental and reviewed before each stage. The first stable `v1.0.0` release will follow testing across new, existing, and AI-configured projects.

The repository is licensed under the [MIT License](LICENSE). See [Releasing AI Workflow Kit](docs/RELEASING.md) for versioning, checks, and owner approval before publishing future versions.
