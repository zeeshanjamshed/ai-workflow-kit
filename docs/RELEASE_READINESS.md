# Release readiness

**The v0.4.5 candidate is local and unpublished.** The last public release recorded in this repository is v0.4.2. There is no approval to publish, tag, commit, or push this candidate.

## Current behavior

- Guided `init` installs the complete rules and one logical onboarding skill in the selected native locations.
- Existing instructions, skills, and project knowledge are preserved. Semantic consolidation requires agent investigation and owner approval.
- Managed rules and skills support identified-version updates, conflicts, repair, backups, rollback, and interruption recovery.
- Local-only setup previews Git ignores and blocks already tracked private files.
- Claude and Codex launch with an initial prompt after separate confirmation. Custom Bash/Zsh aliases are supported. Windows and unsupported custom shells receive a manual handoff.
- Older scripted initialization options and compatibility commands remain available.

## Verification

Local `npm run verify` passed formatting, lint, type checking, asset snapshots, all 79 automated tests, build, inventory of 64 package files, and offline installation and CLI smoke checks on macOS with Node.js 24.14.1. Workflow syntax passed actionlint. npm audit reported zero vulnerabilities. Fixture commits do not need the owner's signing agent. See the [project plan](PROJECT_PLAN.md) for the artifact checksum and results.

There is no hosted CI result for these uncommitted changes. Historical CI and owner observations are preserved in [release history](RELEASE_HISTORY.md); they do not verify this candidate.

## Before release

1. Local automated and package verification is complete. Recheck if the candidate changes.
2. Run the [owner trials](TRIALS.md), including fresh-session instruction loading, approval boundaries, onboarding, existing skill preservation, update, and rollback. Record actual agent versions and native permissions.
3. After an approved commit and push, verify all six hosted jobs on that exact commit.
4. Configure the protected `npm` environment and npm trusted publisher. Prepare dated release notes from a clean checkout. The new workflow tests one archive across all six platform jobs before owner approval.
5. Review the version, package inventory, license, tarball checksum, and remaining limitations. Obtain separate explicit approval for publication and any release tag.

Follow [the maintainer release guide](RELEASING.md). No current result claims that instructions enforce native permissions or that an authenticated agent trial has passed.
