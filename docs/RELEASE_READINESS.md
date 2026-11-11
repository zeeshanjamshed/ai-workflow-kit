# Release readiness

**Decision: hold v1.0.0.** The 0.4.2 package built from this checkout is a local pilot candidate. Keep npm publication, a release tag, and general distribution gated. The license is pending owner approval.

## Evidence against the specification

| Criteria | Evidence and remaining work |
| --- | --- |
| 1–4 | Disposable starter, established, existing-AI, and nested monorepo fixtures cover initialization, preservation, reruns, and interruption recovery. Guided onboarding now proposes evidence-backed knowledge, supports opt-in native skills and selectable engineering rules, and preserves v0.3.0 provenance. Verified architecture and critical-flow capture by a live agent is outstanding. |
| 5–8 | Fixture checks cover read-only inspection, approval prompts, feature ownership, debugging handoffs, review and high-risk boundaries. Live instruction loading, approval behavior, representative agent workflows, and cross-agent resumption remain unverified. Codex was signed out and previously hit a sandbox startup failure. Claude Code and Cursor were unavailable. |
| 9–11 | Fixtures cover worktree overlap and separate-clone isolation, updates, conflicts, rollback, pins, interrupted operations, and filesystem skill discovery without executing content. Installed skill behavior, native rule loading in fresh agent sessions, and precedence still need live checks. Automated tests verify activation previews, preservation of custom rules and native entry-point contents, repeat activation, and rollback. |
| 12 | The Linux pilot built and installed the tarball offline and exercised the installed CLI. The Phase 8 Windows regression was addressed by canonicalizing the Git root and working directory before walking nested skill locations. The regression assertion checks the exact agent, scope, and portable path. The fix matrix passed Linux and Windows on Node.js 22 and 24 and macOS on Node.js 22. macOS with Node.js 24 was cancelled in that run. The v0.4.0 onboarding milestone passed all six hosted jobs on Linux, macOS, and Windows with Node.js 22 and 24. Local verification passed strict TypeScript checks, all 34 tests, package creation, offline installation, and CLI smoke checks. npm audit reported zero vulnerabilities. The one-time GitHub package invocation failed in the Mac pilot. v0.4.1 uses a persistent offline tarball installation and verifies CLI resolution by name from a separate checkout. |
| 13–14 | Type checks, regression tests, npm audit, CI, and documentation are in place. Finish a user-facing walkthrough, license selection, release checklist review, and final distribution hygiene review before approving a release. |

[Phase 8 fix matrix](https://github.com/zeeshanjamshed/ai-workflow-kit/actions/runs/42870861645) · [v0.4.0 onboarding matrix](https://github.com/zeeshanjamshed/ai-workflow-kit/actions/runs/43011069944)

## v0.4.1 Mac pilot fixes

Strict TypeScript checks, all 35 automated tests, packaging, and offline global-prefix installation passed. The package smoke test resolves `ai-setup` through PATH from a separate checkout. npm audit reported zero vulnerabilities. A disposable v0.3.0 → v0.4.0 → v0.4.1 run preserved custom instructions and a customized engineering module, activated five selected rules, and kept repeated activation and skill installation unchanged. All six hosted jobs passed on Linux, macOS, and Windows with Node.js 22 and 24. [Pilot fix CI](https://github.com/zeeshanjamshed/ai-workflow-kit/actions/runs/43024729395)

Live agent verification remains pending. A fresh read-only Codex run failed before instruction loading because the sandbox helper could not start bubblewrap. Codex was signed out, and Claude Code and Cursor were unavailable. Repeat on an authenticated disposable project and confirm instruction loading, rule use during ordinary tasks, and approval behavior.

## v0.4.2 one-command quickstart

Quickstart adds a combined dry-run, one approval, native adapter activation, and an ignored journal with recovery and rollback. Guided project analysis and knowledge approval are separate. Strict TypeScript checks, all 39 tests, packaging, and offline CLI installation passed. npm audit reported zero vulnerabilities. Fixtures cover fresh and custom setups, declining approval, interrupted recovery, rollback, monorepo root targeting, and safe repeats. A disposable project initialized using the v0.4.1 tarball kept its original manifest through quickstart and proposed no edits on rerun. Authenticated fresh-session agent behavior remains pending.

## Candidate checks

Run `npm ci --ignore-scripts`, `npm run typecheck`, `npm test`, `npm pack`, `npm run test:package`, and `npm audit --audit-level=high`. Review the tarball inventory and compare the candidate’s source commit with the hosted CI run. Use disposable checkouts for live-agent verification and record tool version, sandbox mode, observed approval behavior, and any files changed.
