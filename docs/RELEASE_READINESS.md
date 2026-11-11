# Release readiness

**Decision: hold v1.0.0.** The 0.4.1 package built from this checkout is a local pilot candidate. Keep npm publication, a release tag, and general distribution gated. The license is pending owner approval.

## Evidence against the specification

| Criteria | Evidence and remaining work |
| --- | --- |
| 1–4 | Disposable starter, established, existing-AI, and nested monorepo fixtures cover initialization, preservation, reruns, and interruption recovery. Guided onboarding now proposes evidence-backed knowledge, supports opt-in native skills and selectable engineering rules, and preserves v0.3.0 provenance. Verified architecture and critical-flow capture by a live agent is outstanding. |
| 5–8 | Fixture checks cover read-only inspection, approval prompts, feature ownership, debugging handoffs, review and high-risk boundaries. Live instruction loading, approval behavior, representative agent workflows, and cross-agent resumption remain unverified. Codex was signed out and previously hit a sandbox startup failure. Claude Code and Cursor were unavailable. |
| 9–11 | Fixtures cover worktree overlap and separate-clone isolation, updates, conflicts, rollback, pins, interrupted operations, and filesystem skill discovery without executing content. Installed skill behavior, native rule loading in fresh agent sessions, and precedence still need live checks. Automated tests verify activation previews, preservation of custom rules and native entry-point contents, repeat activation, and rollback. |
| 12 | The Linux pilot built and installed the tarball offline and exercised the installed CLI. The Phase 8 Windows regression was addressed by canonicalizing the Git root and working directory before walking nested skill locations. The regression assertion checks the exact agent, scope, and portable path. The fix matrix passed Linux and Windows on Node.js 22 and 24 and macOS on Node.js 22. macOS with Node.js 24 was cancelled in that run. The v0.4.0 onboarding milestone passed all six hosted jobs on Linux, macOS, and Windows with Node.js 22 and 24. Local verification passed strict TypeScript checks, all 34 tests, package creation, offline installation, and CLI smoke checks. npm audit reported zero vulnerabilities. The one-time GitHub package invocation failed in the Mac pilot. v0.4.1 uses a persistent offline tarball installation and verifies CLI resolution by name from a separate checkout. |
| 13–14 | Type checks, regression tests, npm audit, CI, and documentation are in place. Finish a user-facing walkthrough, license selection, release checklist review, and final distribution hygiene review before approving a release. |

[Phase 8 fix matrix](https://github.com/zeeshanjamshed/ai-workflow-kit/actions/runs/42870861645) · [v0.4.0 onboarding matrix](https://github.com/zeeshanjamshed/ai-workflow-kit/actions/runs/43011069944)

## Candidate checks

Run `npm ci --ignore-scripts`, `npm run typecheck`, `npm test`, `npm pack`, `npm run test:package`, and `npm audit --audit-level=high`. Review the tarball inventory and compare the candidate’s source commit with the hosted CI run. Use disposable checkouts for live-agent verification and record tool version, sandbox mode, observed approval behavior, and any files changed.
