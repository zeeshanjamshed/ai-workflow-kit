# Release readiness

**Decision: hold v1.0.0.** The 0.3.0 package built from this checkout is a local pilot candidate. Keep npm publication, a release tag, and general distribution gated. The license is pending owner approval.

## Evidence against the specification

| Criteria | Evidence and remaining work |
| --- | --- |
| 1–4 | Disposable starter, established, existing-AI, and nested monorepo fixtures cover initialization, preservation, reruns, and interruption recovery. Verified architecture and critical-flow capture by a live agent is outstanding. |
| 5–8 | Fixture checks cover read-only inspection, approval prompts, feature ownership, debugging handoffs, review and high-risk boundaries. Live instruction loading, approval behavior, representative agent workflows, and cross-agent resumption remain unverified. Codex was signed out and previously hit a sandbox startup failure. Claude Code and Cursor were unavailable. |
| 9–11 | Fixtures cover worktree overlap and separate-clone isolation, updates, conflicts, rollback, pins, interrupted operations, and filesystem skill discovery without executing content. Installed skill behavior and precedence still need live checks. |
| 12 | The Linux pilot built and installed the tarball offline and exercised the installed CLI. The Phase 8 Windows regression was addressed by canonicalizing the Git root and working directory before walking nested skill locations. The regression assertion checks the exact agent, scope, and portable path. The fix matrix passed Linux and Windows on Node.js 22 and 24 and macOS on Node.js 22. macOS with Node.js 24 was queued at review. One-time package use remains pending. |
| 13–14 | Type checks, regression tests, npm audit, CI, and documentation are in place. Finish a user-facing walkthrough, license selection, release checklist review, and final distribution hygiene review before approving a release. |

[Phase 8 fix matrix](https://github.com/zeeshanjamshed/ai-workflow-kit/actions/runs/42870861645)

## Candidate checks

Run `npm ci --ignore-scripts`, `npm run typecheck`, `npm test`, `npm pack`, `npm run test:package`, and `npm audit --audit-level=high`. Review the tarball inventory and compare the candidate’s source commit with the hosted CI run. Use disposable checkouts for live-agent verification and record tool version, sandbox mode, observed approval behavior, and any files changed.
