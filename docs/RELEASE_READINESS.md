# Release readiness

**v0.4.6 is published and verified on npm as `latest`.** The owner approved publication and GitHub environment review. The downloaded registry archive matches the approved SHA-256, and installation and CLI smoke tests passed. npm exposes provenance for this version. The owner deferred live agent trials until after publication.

## Current behavior

- Guided `init` installs the complete rules and one logical onboarding skill in the selected native locations.
- Existing instructions, skills, and project knowledge are preserved. Semantic consolidation requires agent investigation and owner approval.
- Managed rules and skills support identified-version updates, conflicts, repair, backups, rollback, and interruption recovery.
- Local-only setup previews Git ignores and blocks already tracked private files.
- Claude and Codex launch with an initial prompt after separate confirmation. Custom Bash/Zsh aliases are supported. Windows and unsupported custom shells receive a manual handoff.
- Older scripted initialization options and compatibility commands remain available.

## Verification

Local `npm run verify` passed formatting, lint, type checking, asset snapshots, all 79 automated tests, build, inventory checks, and offline installation and CLI smoke checks on macOS with Node.js 24.14.1. Workflow syntax passed actionlint. npm audit reported zero vulnerabilities. Fixture commits do not need the owner's signing agent. See the [project plan](PROJECT_PLAN.md) for the artifact checksum and results.

All six hosted checks passed for the release commit on Linux, macOS, and Windows with Node.js 22 and 24. All six archive tests also passed before publication. Historical CI and owner observations are preserved in [release history](RELEASE_HISTORY.md); they do not verify this candidate.

## Remaining checks

Run the [owner trials](TRIALS.md), including fresh-session instruction loading, approval boundaries, onboarding, existing skill preservation, update, and rollback. Record actual agent versions and native permissions. These trials remain unverified. Any Git tag or GitHub release requires separate approval.

## Registry confirmation

[The publication run](https://github.com/zeeshanjamshed/ai-workflow-kit/actions/runs/44523486284) reports failure because its final registry check timed out after the publish command succeeded. Subsequent independent checks confirmed v0.4.6, the `latest` tag, matching archive contents, and provenance. No duplicate publication was attempted. Future verification uses fresh registry reads and a longer bounded wait. See the [project plan](PROJECT_PLAN.md) for exact evidence and checksums.

Follow [the maintainer release guide](RELEASING.md) for future releases. Instruction text does not enforce native permissions.

## v0.4.7 preparation

The owner approved the terminal UI release. Local verification passed all 81 tests, static checks, immutable assets, build, inventory of 100 files, and offline installation with an empty npm cache. The release includes arrow-key menus, agent checkboxes, default-No confirmations, safe cancellation, compact previews, custom alias input, and clearer old-baseline notices. Hosted release checks and the npm environment approval must pass before publication. The owner plans the first live trial in a project without existing AI setup.
