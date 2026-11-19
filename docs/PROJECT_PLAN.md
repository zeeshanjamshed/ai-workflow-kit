# Project plan

Current work follows the [agreed simplification](SIMPLIFICATION.md). The local candidate is **v0.4.5**. Work is approved directly on `main`; commits and publication are not approved.

| Phase | Outcome                                                                 | Status   |
| ----- | ----------------------------------------------------------------------- | -------- |
| 1     | Complete shared rules and approved requirements                         | Complete |
| 2     | Managed rule and skill updates, preservation, and recovery              | Complete |
| 3     | Guided `init`, tracking choices, and optional onboarding launch         | Complete |
| 4     | Final review, documentation cleanup, package checks, and trial guide    | Complete |
| 5     | CLI architecture, asset snapshots, quality checks, and release workflow | Complete |

Phase 4 is approved on November 19. It also isolates fixture commits from personal Git signing settings and closes a local-only tracking gap for existing skills. Initialization refuses agent-selection changes that would leave its recorded provenance inconsistent.

## Final local verification

Completed November 19 on macOS with Node.js 24.14.1.

- `npm run verify` passed formatting, lint, type checking, asset validation, all 79 tests, clean build, package inventory, and offline installation of the exact archive.
- The candidate includes 64 allowlisted files and no runtime package dependencies.
- Nine immutable release baselines retain every supported ordered adapter and tracking variant.
- Release preparation tests cover version updates, immutable snapshots, dirty-tree refusal, and no commits or tags. Artifact tests reject tampering and disabled publication.
- npm audit reported zero vulnerabilities across runtime and development dependencies.
- Workflow syntax passed actionlint. Hosted execution remains pending an approved commit and push.
- Final review covered command compatibility, preservation, atomic writes, recovery, package assets, artifact identity, and publication boundaries.

Candidate tarball SHA-256: `2e21d15ae1d5fd054017ee4b73c2e7a3eb5988b22d842361238fc1d792fa393d`.

The [architecture](ARCHITECTURE.md) separates strict option parsing, read-only planning, transaction application, and editable Markdown assets. The [release guide](RELEASING.md) documents the single version source, release preparation, protected environment, and npm trusted publishing.
No commits, pushes, publication, authenticated agent launches, or deployments were performed. Historical templates and backups remain supported. Earlier user-facing docs were consolidated into the CLI reference; historical records were preserved rather than discarded.

## Remaining owner checks

- Run the [short trials](TRIALS.md) in new, existing, and AI-configured disposable projects.
- Check the current commit's hosted CI on Linux, macOS, and Windows with Node.js 22 and 24 after an approved commit and push.
- Configure the protected GitHub `npm` environment and npm trusted publisher using the [release guide](RELEASING.md).
- Prepare dated release notes from a clean checkout, review the exact release artifact, and obtain separate publication and release-tag approval.

No authenticated agent trial or deployment is included in the automated checks. Native agent permissions provide enforcement; instruction text does not guarantee it.

Earlier milestone results and approvals are preserved in [implementation history](IMPLEMENTATION_HISTORY.md). Release observations are in [release history](RELEASE_HISTORY.md). The [release-readiness report](RELEASE_READINESS.md) tracks the current gates. The repository is MIT licensed.
