# AI Workflow Kit

Your reusable AI engineering rules, project knowledge, and onboarding setup for Claude Code, Codex, and Cursor.

**Current checkout is an unpublished v0.4.6 candidate.** The registry currently serves v0.4.3. npm will not provide this new flow until it is released.

## Set up a project

With the candidate CLI installed, run this inside a new or existing project.

```sh
ai-setup init
```

It finds existing AI files, asks which agents you use and how to track the setup, then previews the complete rules and one onboarding skill. Type `apply` to install.

Existing instructions, skills, decisions, and knowledge stay in place. The agent handles their review and proposed consolidation during onboarding. It asks you to resolve conflicting instructions before changing them.

After setup, choose Claude, Codex, a custom command such as `claude-orca`, or later. Review the command and type `start` to launch onboarding. The agent reads the actual project and proposes useful knowledge. Saving or moving anything still needs your approval.

Custom Bash and Zsh aliases must be defined in shell startup files. Windows, unsupported custom shells, and piped sessions receive a manual handoff. See [launch details](docs/AGENT_LAUNCH.md).

## Choose what Git can share

| Choice             | Behavior                                                                    |
| ------------------ | --------------------------------------------------------------------------- |
| Shared             | Rules and project records are eligible to commit                            |
| Mixed, recommended | Rules are eligible to commit; knowledge, decisions, and handoffs stay local |
| Local-only         | Kit files are ignored; the installer previews changes to `.gitignore`       |

The CLI never commits or silently untracks files. Already tracked private files need separate review. Ignored knowledge needs your own backup or sharing process.

## Bring in new kit rules

Install the chosen newer CLI release, then run this in each initialized project.

```sh
ai-setup update
```

It compares the installed baseline, local files, and the bundled release. Review the changes and type `apply`. Project knowledge and recorded exceptions stay yours. Conflicting local and central edits stop for review.

The update uses the installed CLI's bundle and works offline. It does not fetch a newer release itself. Older setups can adopt recognized stock rules and skills; customized legacy files remain project-owned.

## Preview or recover

- `init --dry-run` shows proposed files without writes. Review any reported blockers.
- Rerun `init` to resume interrupted setup or return to onboarding.
- `init --no-launch` leaves onboarding for later.
- `rollback <backup-id>` reviews reversal of a setup or update. It refuses subsequent edits.
- `--help-all` lists maintenance and compatibility commands.

Keep the backup ID printed after a successful operation. Backups stay in the ignored `.ai/update-backups/` directory. Existing initialized projects keep their baseline until you approve `update`; tracking and agent-selection changes need separate review.

## Try this candidate

Use Node.js 22.18 or newer. From this kit checkout, build the package.

```sh
npm ci --ignore-scripts
npm pack
```

Follow the [short trial guide](docs/TRIALS.md) to install it in an isolated location and try new and existing projects. The candidate has no runtime dependencies. Coding-agent sessions use their own accounts and services.

The main setup lives in each project's `.ai/` directory. Small native instruction files point agents to shared rules and context. Each project keeps its own rules, exceptions, knowledge, decisions, and handoffs. Kit updates never authorize project work.

Agent instructions guide behavior. Native agent permissions and sandboxes provide enforcement. Real agent trials remain separate from automated CLI checks.

See the [CLI reference](docs/CLI_REFERENCE.md), [current project plan](https://github.com/zeeshanjamshed/ai-workflow-kit/blob/main/docs/PROJECT_PLAN.md), and [release readiness](https://github.com/zeeshanjamshed/ai-workflow-kit/blob/main/docs/RELEASE_READINESS.md) for details.

MIT licensed. Publishing, commits, and release tags require separate owner approval.
