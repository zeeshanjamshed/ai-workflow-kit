# Release readiness

**The v0.4.6 candidate is unpublished.** The registry currently serves v0.4.3. The owner approved release preparation, commits, pushes, and a workflow trial with publishing disabled. Publication and tags remain separate actions. The owner deferred live agent trials until after publication.

## Current behavior

- Guided `init` installs the complete rules and one logical onboarding skill in the selected native locations.
- Existing instructions, skills, and project knowledge are preserved. Semantic consolidation requires agent investigation and owner approval.
- Managed rules and skills support identified-version updates, conflicts, repair, backups, rollback, and interruption recovery.
- Local-only setup previews Git ignores and blocks already tracked private files.
- Claude and Codex launch with an initial prompt after separate confirmation. Custom Bash/Zsh aliases are supported. Windows and unsupported custom shells receive a manual handoff.
- Older scripted initialization options and compatibility commands remain available.

## Verification

Local `npm run verify` passed formatting, lint, type checking, asset snapshots, all 79 automated tests, build, inventory checks, and offline installation and CLI smoke checks on macOS with Node.js 24.14.1. Workflow syntax passed actionlint. npm audit reported zero vulnerabilities. Fixture commits do not need the owner's signing agent. See the [project plan](PROJECT_PLAN.md) for the artifact checksum and results.

Hosted verification of the release commit is pending. Historical CI and owner observations are preserved in [release history](RELEASE_HISTORY.md); they do not verify this candidate.

## Before release

1. Local automated and package verification is complete. Recheck if the candidate changes.
2. The owner deferred the [owner trials](TRIALS.md) until after publication. They remain unverified, including fresh-session instruction loading, approval boundaries, onboarding, existing skill preservation, update, and rollback. Record actual agent versions and native permissions.
3. After an approved commit and push, verify all six hosted jobs on that exact commit.
4. Configure the protected `npm` environment and npm trusted publisher. Prepare dated release notes from a clean checkout. The new workflow tests one archive across all six platform jobs before owner approval.
5. Review the version, package inventory, license, tarball checksum, and remaining limitations. Obtain separate explicit approval for publication and any release tag.

Follow [the maintainer release guide](RELEASING.md). No current result claims that instructions enforce native permissions or that an authenticated agent trial has passed.
