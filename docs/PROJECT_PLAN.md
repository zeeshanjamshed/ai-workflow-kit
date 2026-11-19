# Project plan

Current work follows the [agreed simplification](SIMPLIFICATION.md). **v0.4.6 is published on npm.** The owner approved work on `main`, release preparation, commits, pushes, and publication. Git tags and GitHub release creation remain separate actions.

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
- The release includes 65 allowlisted files and no runtime package dependencies.
- Ten immutable release baselines retain every supported ordered adapter and tracking variant.
- Release preparation tests cover version updates, immutable snapshots, dirty-tree refusal, and no commits or tags. Artifact tests reject tampering and disabled publication.
- npm audit reported zero vulnerabilities across runtime and development dependencies.
- Workflow syntax passed actionlint. All six hosted platform checks and release archive tests passed before publication.
- Final review covered command compatibility, preservation, atomic writes, recovery, package assets, artifact identity, and publication boundaries.

Previous v0.4.5 candidate tarball SHA-256: `2e21d15ae1d5fd054017ee4b73c2e7a3eb5988b22d842361238fc1d792fa393d`.

The [architecture](ARCHITECTURE.md) separates strict option parsing, read-only planning, transaction application, and editable Markdown assets. The [release guide](RELEASING.md) documents the single version source, release preparation, protected environment, and npm trusted publishing.
The implementation and release preparation are committed and pushed. npm publication is verified. Authenticated agent trials have not been performed. The owner deferred live agent trials until after publication. Historical templates and backups remain supported. Earlier user-facing docs were consolidated into the CLI reference; historical records were preserved rather than discarded.

## Remaining owner checks

- Run the [short trials](TRIALS.md) in new, existing, and AI-configured disposable projects.
- Review any requested Git tag or GitHub release separately. The npm package is already published.

No authenticated agent trial or deployment is included in the automated checks. Native agent permissions provide enforcement; instruction text does not guarantee it.

Earlier milestone results and approvals are preserved in [implementation history](IMPLEMENTATION_HISTORY.md). Release observations are in [release history](RELEASE_HISTORY.md). The [release-readiness report](RELEASE_READINESS.md) tracks the current gates. The repository is MIT licensed.

## Release preparation checkpoints

The owner approved the remaining release preparation on November 19 and deferred live agent trials until after publication. npm reported v0.4.3 as its public version at the start of preparation. The implementation commit is `dc7e6b2`. The release preparation command generated v0.4.6, its immutable snapshot, and dated changelog notes. Hosted verification subsequently passed for the release commit.

Local v0.4.6 verification passed all 79 tests, format/lint/types/assets, a clean build, inventory of 65 files, and offline installation. Before the final README correction, tarball SHA-256 was `67bd864773c674c29adfceff43d864734e02646f96b6945fcc4552a70b1a2692`. The GitHub `npm` environment now requires owner review, allows only the `main` branch, and disables administrator bypass. The owner confirmed the npm trusted publisher is configured. The publication variable is enabled; actual publication still requires an explicit workflow run and protected-environment approval.

Hosted checks confirmed Linux and macOS on Node.js 22 and 24. Windows exposed checkout line-ending conversion and a release-script repository-path comparison. The fixes preserve LF in Git checkouts and ask Git whether the package is at its repository root. Windows temporary directories can have short and long path aliases, so filesystem path string comparison is unsuitable here. A regression case rejects packages nested inside another repository. Both changes retain all frozen asset contents. Full hosted verification of these fixes passed.

## Published v0.4.6

The owner approved publication and the protected GitHub environment on November 19. Release commit: `57a947496fdaaba31f48daf1d31775e2e5ccd3a5`. All six platform tests passed in [the publication run](https://github.com/zeeshanjamshed/ai-workflow-kit/actions/runs/44523486284).

The npm registry confirms v0.4.6 as `latest` with provenance. Its downloaded tarball matches SHA-256 `4f4df3010f05abcca5f47bf257772df1a24a582540327dce7a54286b8c42cb7c`, and offline installation and CLI smoke tests passed using those published bytes.

The publish command succeeded, but the workflow's registry confirmation timed out before the version became visible. The run therefore reports failure. Registry checks with a fresh cache subsequently confirmed publication; no second publish was attempted. The maintainer verification helper now refreshes registry metadata, allows a longer bounded wait, fails immediately on integrity mismatches, and reports uncertainty without republishing. Regression tests cover delayed visibility, a different archive, and persistent unavailability. These scripts are not shipped in the npm package.

The maintainer follow-up passed format/lint/types/asset checks and all 80 local tests. It changes release tooling and records only; the published package bytes remain the verified archive above.
