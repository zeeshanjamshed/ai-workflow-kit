# Project plan

Current work follows the [agreed simplification](SIMPLIFICATION.md). **v0.4.7 is published on npm.** The owner approved work on `main`, release preparation, commits, pushes, and publication. Git tags and GitHub release creation remain separate actions.

| Phase | Outcome                                                                 | Status   |
| ----- | ----------------------------------------------------------------------- | -------- |
| 1     | Complete shared rules and approved requirements                         | Complete |
| 2     | Managed rule and skill updates, preservation, and recovery              | Complete |
| 3     | Guided `init`, tracking choices, and optional onboarding launch         | Complete |
| 4     | Final review, documentation cleanup, package checks, and trial guide    | Complete |
| 5     | CLI architecture, asset snapshots, quality checks, and release workflow | Complete |

Phase 4 is approved on November 19. It also isolates fixture commits from personal Git signing settings and closes a local-only tracking gap for existing skills. Initialization refuses agent-selection changes that would leave its recorded provenance inconsistent.

## Earlier v0.4.6 verification

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

## Approved terminal UI follow-up

The owner approved Clack-based terminal prompts on November 19. Scope includes menus, multiple-agent selection, custom alias input, compact previews, colour support, safe cancellation, and preservation of piped input and dry-run output. Work remains local and unpublished; no commit, push, or new release is included in this approval.

Clack 1.9.0 is MIT licensed and supports the kit's Node.js range. npm bundles its six runtime packages to preserve offline tarball installation with an empty cache. Existing v0.4.6 snapshots are unchanged. The other project's reported rule-block conflict has only been explained from the report and CLI code; no files in that project have been inspected or changed.

Verification passed `npm run verify`, including all 81 tests, formatting, lint, types, immutable assets, build, inventory of 99 package files, and offline installation with an empty npm cache. Local candidate SHA-256: `3025028d8a462c05171e9095331f88d32153f5953531956f51f52af20c2f93f2`. Dependency installation reported zero audit vulnerabilities.

Real macOS terminal checks covered arrow-key and Space selection, default-No setup approval with no file writes, Ctrl+C cancellation with exit 130, colour and NO_COLOR, approved setup, custom alias input with launch declined, and a compiled package installed offline from its archive. A disposable v0.4.2 project retained its baseline and displayed the explicit upgrade notice. Windows and Linux interactive terminals and hosted CI for these local changes remain unverified. No authenticated agent was launched.

## Approved v0.4.7 release

The owner approved committing, pushing, and publishing the terminal UI changes on November 19. The UI implementation is committed as `4c7d198`. Release preparation generated v0.4.7 and its immutable snapshot. The owner plans the first live trial in a project with no existing AI rules or setup. Previous v0.4.6 contents remain frozen. Local checks and hosted release verification are required before publishing through the protected npm environment.

Local v0.4.7 verification passed all 81 tests, format/lint/types/assets, build, inventory of 100 files, and offline installation using an empty npm cache. Candidate SHA-256: `737d16ecef4625a533ff897cdeec4ea4ad19d3b4f64efec039aaddd920028116`. Workflow syntax passed actionlint. Hosted verification and protected-environment approval remain before publication.

## Published v0.4.7

The owner approved publication and the protected npm environment. Release source: `815908b6980688b7790a5a42429cc80996e1c1ec`. All six [CI jobs](https://github.com/zeeshanjamshed/ai-workflow-kit/actions/runs/44552093671) and all six archive tests passed. One macOS archive job remained queued for ten minutes; a targeted retry preserved the original archive and completed outputs, then passed. [The publication workflow](https://github.com/zeeshanjamshed/ai-workflow-kit/actions/runs/44552339261) completed successfully.

npm confirms v0.4.7 as `latest` with provenance. The downloaded archive matches SHA-256 `737d16ecef4625a533ff897cdeec4ea4ad19d3b4f64efec039aaddd920028116` and its approved SHA-512 integrity. Installation and CLI smoke checks passed against that registry download using an empty npm cache. The archive contains 100 allowlisted files, including the bundled prompt dependencies and eleven immutable baselines.

The first archive download returned 404 after metadata appeared. A subsequent standard npm download succeeded and was verified; no duplicate publication was attempted. No Git tag or GitHub release was created. The owner's live trial in a project without AI setup remains next.
