# Project plan

Current work follows the [agreed simplification](SIMPLIFICATION.md). The local candidate is **v0.4.6**. Work is approved directly on `main`; release preparation, commits, pushes, and a non-publishing workflow trial are approved. Publication remains separate.

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
- The candidate includes 65 allowlisted files and no runtime package dependencies.
- Ten immutable release baselines retain every supported ordered adapter and tracking variant.
- Release preparation tests cover version updates, immutable snapshots, dirty-tree refusal, and no commits or tags. Artifact tests reject tampering and disabled publication.
- npm audit reported zero vulnerabilities across runtime and development dependencies.
- Workflow syntax passed actionlint. Hosted execution remains pending an approved commit and push.
- Final review covered command compatibility, preservation, atomic writes, recovery, package assets, artifact identity, and publication boundaries.

Previous v0.4.5 candidate tarball SHA-256: `2e21d15ae1d5fd054017ee4b73c2e7a3eb5988b22d842361238fc1d792fa393d`.

The [architecture](ARCHITECTURE.md) separates strict option parsing, read-only planning, transaction application, and editable Markdown assets. The [release guide](RELEASING.md) documents the single version source, release preparation, protected environment, and npm trusted publishing.
The implementation is committed. Release preparation is in progress; publication and authenticated agent launches have not been performed. The owner deferred live agent trials until after publication. Historical templates and backups remain supported. Earlier user-facing docs were consolidated into the CLI reference; historical records were preserved rather than discarded.

## Remaining owner checks

- Run the [short trials](TRIALS.md) in new, existing, and AI-configured disposable projects.
- Check the current commit's hosted CI on Linux, macOS, and Windows with Node.js 22 and 24 after an approved commit and push.
- Configure the protected GitHub `npm` environment and npm trusted publisher using the [release guide](RELEASING.md).
- Prepare dated release notes from a clean checkout, review the exact release artifact, and obtain separate publication and release-tag approval.

No authenticated agent trial or deployment is included in the automated checks. Native agent permissions provide enforcement; instruction text does not guarantee it.

Earlier milestone results and approvals are preserved in [implementation history](IMPLEMENTATION_HISTORY.md). Release observations are in [release history](RELEASE_HISTORY.md). The [release-readiness report](RELEASE_READINESS.md) tracks the current gates. The repository is MIT licensed.

## Release preparation

The owner approved the remaining release preparation on November 19 and deferred live agent trials until after publication. npm reports v0.4.3 as its current public version. The implementation commit is `dc7e6b2`. The release preparation command generated v0.4.6, its immutable snapshot, and dated changelog notes. Hosted verification is pending the release commit.

Local v0.4.6 verification passed all 79 tests, format/lint/types/assets, a clean build, inventory of 65 files, and offline installation. Tarball SHA-256: `67bd864773c674c29adfceff43d864734e02646f96b6945fcc4552a70b1a2692`. The GitHub `npm` environment now requires owner review, allows only the `main` branch, and disables administrator bypass. The owner confirmed the npm trusted publisher is configured. The publication variable is enabled; actual publication still requires an explicit workflow run and protected-environment approval.

Hosted checks confirmed Linux and macOS on Node.js 22 and 24. Windows exposed checkout line-ending conversion and a release-script repository-path comparison. The fixes preserve LF in Git checkouts and compare canonical filesystem paths. Both changes retain all frozen asset contents. Full hosted verification of the corrected commit is pending.
