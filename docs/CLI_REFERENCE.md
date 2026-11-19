# CLI reference

Normal use needs `ai-setup init` and `ai-setup update`. This reference covers maintenance and older interfaces.

## Guided init options

- `init --dry-run` prints a read-only JSON preview. Review its `blockers` field before applying.
- `init --no-launch` installs normally and leaves onboarding for later.
- `init --guided --tracking=mixed --agents=codex` supplies choices to the complete initializer. Tracking also accepts `shared` or `local-only`.
- Existing tracking and agent selection are preserved. Changing either requires separate review. Local-only appends reviewed ignore rules and refuses already tracked private files. It never removes files from the Git index.
- For compatibility, the original paired `--tracking` and `--agents` options without `--guided` still use minimal initialization. This older interface accepts `tracked` rather than `shared`.
- Run `--help-all` to list every command. Exit code 1 reports an error or doctor finding; unsupported commands exit with code 2.

`doctor` is a read-only diagnostic for setup files, basic manifest structure, and local Markdown links. It cannot prove that agents follow instructions. `init --dry-run` previews file operations; neither command interprets conflicting instructions as an AI agent would.

The following sections retain published and compatibility behavior. They are not extra steps required by the new guided initializer.

## Published Quickstart and compatibility flow

With Node.js 22.18 or newer, run this from the project:

```sh
npx -y @zeeshanjamshed/ai-workflow-kit quickstart
```

Review the repository root, tracking policy, paths to add, and existing instruction files that will receive a rule section. Type `apply` once to approve the setup. Add `--dry-run` for the same preview without project writes. The npm `-y` flag answers npm’s install prompt. Quickstart still waits for `apply`. New setups default to mixed tracking, which keeps knowledge, decisions, and handoffs Git-ignored. Existing setups keep their tracking policy and installed baseline.

Quickstart sets up missing shared files, the five recommended engineering modules, and native instruction entry points for Claude Code, Codex, and Cursor. It installs guided onboarding skills for Claude Code and Codex. Existing custom rules, skills, knowledge, and instruction text are preserved. Resolve semantic instruction conflicts before approving. A conflicting activation section or privacy policy blocks the operation.

If interrupted, rerun `ai-setup quickstart` to review and approve the saved plan. A successful run prints a backup ID. `ai-setup rollback <backup-id>` previews reversal and refuses if any affected file changed afterward. Review rollback carefully because it removes kit-created files from that run. Individual setup commands are still available below.

Start a fresh Claude Code or Codex session in the project and run the **guided-project-onboarding** skill. The agent examines the actual code and proposes useful knowledge. Saving that knowledge needs separate approval.

## Compatibility setup presets

These preset commands remain available for compatibility. Normal setup uses `init` and requires no preset selection.

```sh
ai-setup setup
ai-setup setup --preset=minimal --no-onboarding --dry-run
ai-setup setup --preset=quickstart --onboarding
ai-setup full --no-onboarding --dry-run
ai-setup full --onboarding
```

- **Minimal** installs shared safety and approval instructions and native entry points.
- **Quickstart** installs the five concise modules. The original `ai-setup quickstart` still defaults to installing onboarding skills.
- **Full Engineering** installs the detailed standards and four workflows. Native entry points point to a short index, and agents load the relevant detail on demand. See the [specification coverage checklist](https://github.com/zeeshanjamshed/ai-workflow-kit/blob/main/docs/PRESET_COVERAGE.md).

Interactive setup asks for the preset, skill installation, and tracking for new projects. Non-interactive preset options default to mixed tracking for new projects and omit onboarding unless you pass `--onboarding`. Existing tracking and agent selection are preserved. Changing either requires separate review. Omission leaves any already-installed skills in place. All presets preview changes and require typing `apply`. Dry runs make no project writes.

To upgrade Quickstart, preview with `ai-setup full --dry-run`. Full keeps the old modules on disk, replaces the stock activation links with the Full index, and keeps links to previously selected customized modules. It preserves existing instruction text and stops at conflicting Full paths. The owner reviews any conflicts in meaning. Presets add to existing setups and do not downgrade them. Rerun `ai-setup setup` after an interruption to review and resume the saved transaction. Save the printed backup ID for rollback.

Onboarding skill installation prepares Claude Code and Codex for a later session. An agent must inspect the real project, and saving its proposed knowledge requires separate approval.

## Legacy initialization options

The original paired flags retain their minimal, add-only behavior for existing scripts. Use plain `init` for the new guided complete setup. For example:

```sh
ai-setup init --tracking=mixed --agents=codex
```

To use both flags with the complete guided flow, add `--guided`.

Choose a tracking policy and optional Claude, Codex, or Cursor entry points. Inspect the preview, which shows exact proposed contents and paths. Type `apply` to approve that plan. Any other response leaves the project untouched. For an exact read-only preview, use `init --dry-run --tracking=mixed --agents=codex`. An empty `--agents=` selects no entry points.

- **Tracked** leaves new setup records eligible to commit and share.
- **Mixed** leaves setup eligible to share and ignores the `.ai/knowledge/`, `.ai/decisions/`, and `.ai/tasks/` directories.
- **Local-only** ignores the new `.ai/` records. In a Git repository, any new root or Cursor entry point must already be ignored and untracked. Choose no entry points if existing ignore rules do not cover them. Local records need independent backups.

Initialization creates missing files and preserves existing instructions, skills, and project knowledge in place. It makes no Git commits or changes to existing files, so there are no overwritten originals to back up. Reconcile existing custom instructions manually. An incompatible privacy rule or an unrecognized manifest blocks initialization. If interrupted, rerun `init` to review and approve the saved plan. The journal remains available for inspection, and a completed manifest makes reruns a no-op. Real agent discovery and approval behavior are verified in a later phase.

## Updates, backups, and installation

From an initialized project, use `ai-setup update --dry-run` to compare the installed baseline, local files, and the current bundled version. The update checks manifest hashes and works offline. It replaces an unchanged kit file when the bundled default changes and preserves local edits when that default stays the same. If both sides changed, or a managed file is missing, the update stops for review. Existing unmanaged rules, skills, knowledge, and decisions stay in place.

- `ai-setup update` shows the plan and waits for `apply`. Use `ai-setup --version` to check the installed CLI version before selecting an explicit update version.
- `ai-setup pin <version>` pins the installed or current bundled version. Use `ai-setup pin none` to unpin. Both require approval.
- `ai-setup repair` can restore missing managed files from the installed baseline after approval. It preserves existing files.
- `ai-setup rollback <backup-id>` previews the inverse operation and requires approval. It refuses to overwrite subsequent edits. If interrupted, rerun `ai-setup update` to review and resume the pending operation.

Backups and the recovery journal stay in the ignored `.ai/update-backups/` directory. They contain the before and after contents of files in the operation. Keep secrets out of setup files. Close other editors and avoid concurrent setup operations while applying changes. The current bundle recognizes setup versions 0.1.0, 0.2.0, 0.3.0, 0.4.0, 0.4.1, 0.4.2, 0.4.3, 0.4.4, 0.4.5, 0.4.6, and 0.4.7. It upgrades to its own version and leaves version downgrades to rollback.

### Optional global installation

Run `npm install --global @zeeshanjamshed/ai-workflow-kit`, then use `ai-setup quickstart` from your project. A global install keeps `ai-setup` available for later commands and agent sessions.

### Local development and offline installation

Use Node.js 22.18 or newer. In a checkout of the reviewed kit commit, build the local tarball and install it once with the npm used by your agent shell.

```sh
npm ci --ignore-scripts
npm pack
npm install --global --offline --ignore-scripts ./zeeshanjamshed-ai-workflow-kit-0.4.7.tgz
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

Project knowledge, decisions, custom skills, and recorded exceptions remain project-owned. Starting with the local v0.4.4 candidate, new setup transactions record bundled rules and onboarding skills in the managed manifest. Updates can also adopt recognized stock assets from older setups. Customized legacy assets are preserved and recorded as project-owned exceptions. Managed assets use the same three-way conflict checks, repair, backups, and rollback as baseline files. A file changed both locally and centrally blocks the update for review. Updates preserve installed component choices and do not install omitted onboarding skills.

## Agent instructions, skills, and handoffs

New setups can generate Claude Code’s `CLAUDE.md`, Codex’s `AGENTS.md`, or a Cursor project rule. Claude imports the shared permissions file. Codex loads `AGENTS.md` and reads shared context on demand. Cursor can use the same `AGENTS.md` when present, or a kit-generated always-applied rule for Cursor-only setups. Existing entries remain authoritative and need manual reconciliation where they differ. Completed older setups stay intact, and interrupted Phase 4 setups resume with their original templates.

Run `ai-setup skills` from the project or relevant subdirectory to inventory `SKILL.md` paths in `.claude/skills`, `.agents/skills`, and `.cursor/skills` in project scope and under the current home directory. The inventory shows filesystem candidates, including third-party skills at those paths. It does not execute skills or resolve plugin, managed, synced, or disabled entries. Verify actual availability in the agent UI.

Use `ai-setup context` to find project knowledge, decisions, and task handoffs. Use `ai-setup context <task-id>` to read one task with current Git context. For approved handoff writes, use `.ai/tasks/<task-id>.md` and record scope, approvals, affected files, Git branch and commit, verified findings, tests, blockers, and next action. Keep secrets out and verify claims against Git and code before continuing. Ignored and uncommitted records need an explicit sharing mechanism.

### Verify an agent in a disposable project

1. Initialize a disposable Git repository with the relevant adapter enabled. Add a harmless unique phrase to the fixture’s shared permissions, a sample skill in its native directory, and a task record.
2. Start a fresh agent session in the fixture using its native safe settings. Ask it to report the phrase, identify the skill, and resume the task. Check that it reads the task, inspects Git, and distinguishes evidence from assumptions.
3. Ask for a write without granting approval. Check that the agent asks first and that the fixture stays unchanged. Record the runtime version, permissions, and observed result. Repeat with existing custom instructions to check preservation and precedence.

Prompt instructions guide behavior. Native sandbox and permission settings provide enforcement. Automated checks cover generated files and CLI behavior. Current authenticated agent trials remain for the owner; earlier observations are recorded in the release history.

References: [Claude Code instructions](https://code.claude.com/docs/en/memory), [Claude Code skills](https://code.claude.com/docs/en/skills), [Codex instructions](https://learn.chatgpt.com/docs/agent-configuration/agents-md), [Codex skills](https://learn.chatgpt.com/docs/build-skills), [Cursor rules](https://cursor.com/docs/rules), and [Cursor skills](https://cursor.com/docs/skills).

## Coordinate parallel work

From the target checkout, run `ai-setup coordinate status` before editing. Use `coordinate claim <task> <agent> <path> [path...]` to claim files or directories, or quote `"*"` for a repository-wide claim. Type `apply` after reviewing the plan. Keep the returned ownership token private. Use it with `coordinate renew <task> <token>` or `coordinate release <task> <token> [.ai/tasks/<id>.md]`.

Claims last one hour. Stale claims still block overlapping work until you confirm the old writer stopped and explicitly approve `coordinate takeover <task> <agent> <path> [path...]`. A crashed metadata writer may leave `write.lock` in the reported coordination directory. Clear the empty lock directory manually only after confirming no writer is running.

Pass `--worktree` from an explicitly created linked worktree. The command never creates branches or worktrees. Same-clone worktrees share advisory ownership through Git’s common directory. Separate clones and working-file edits are independent. Share durable handoffs through an approved Git or other sync step, and verify the recorded commit, local changes, and handoff before acting. Coordination never authorizes project writes.

CI checks Node.js 22 and 24 on Linux, macOS, and Windows, runs strict type checks and fixture tests, verifies offline package installation, and audits npm dependencies. See the [project plan](https://github.com/zeeshanjamshed/ai-workflow-kit/blob/main/docs/PROJECT_PLAN.md) for observed results. Workflow fixtures exercise CLI boundaries and handoffs. Live agent behavior is checked separately.

## Specification

Read the [master specification](https://github.com/zeeshanjamshed/ai-workflow-kit/blob/main/docs/SPECIFICATION.md) for the approved requirements, proposed structures, safety boundaries, and acceptance criteria.

## Development approach

Implementation will be incremental and reviewed before each stage. The first stable `v1.0.0` release will follow testing across new, existing, and AI-configured projects.

The repository is licensed under the [MIT License](../LICENSE). See [Releasing AI Workflow Kit](https://github.com/zeeshanjamshed/ai-workflow-kit/blob/main/docs/RELEASING.md) for versioning, checks, and owner approval before publishing future versions.

## Interactive terminal controls

Use arrow keys to move, Space to toggle agents, and Enter to confirm a selection. Setup and launch confirmations default to No. Ctrl+C cancels the current prompt and exits with status 130. Already approved setup changes remain saved if onboarding launch is cancelled. Custom commands and aliases use a text input.

Interactive setup and update show compact summaries. Use `--dry-run` to inspect the complete update data. Piped input and dumb terminals retain the plain input protocol. `NO_COLOR` disables colour while keeping interactive controls. The CLI reports an older installed baseline separately from its own version; rerunning `init` does not silently upgrade that baseline.
