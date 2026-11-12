# Release readiness

**Decision: hold v1.0.0.** v0.4.2 is publicly available on npm under the MIT License with copyright © 2026 Zeeshan Jamshed. The stable release and its tag remain gated.

## Evidence against the specification

| Criteria | Evidence and remaining work |
| --- | --- |
| 1–4 | Automated fixtures cover fresh, mature, existing-AI, and monorepo initialization; custom-file preservation; reruns; and interruption recovery. Guided onboarding proposes evidence-backed project knowledge. In the owner-reported Mac pilot, Claude reviewed an established project and recognized existing knowledge without overwriting it. Full v0.4.2 onboarding from a fresh setup remains to be observed. |
| 5–8 | Automated fixtures cover read-only checks, approvals, feature/debug/review/high-risk scenarios, and handoffs. On the owner's Mac, fresh Claude and Codex sessions using v0.4.1 reported loading all five engineering modules and the onboarding skill. Claude proposed a scoped documentation change and then performed it following approval; Codex independently verified the result without writing. An earlier disposable test demonstrated Codex-to-Claude task resumption. These are manual, user-transcribed observations, not proof of native permission enforcement or coverage of all work types. Cursor, stronger negative-approval/high-risk tests, and fresh-session agent use after v0.4.2 quickstart remain open. |
| 9–11 | Automated fixtures cover coordination in worktrees, isolation across clones, updates, conflicts, rollback, pins, interruptions, and skill discovery. The Mac pilot confirmed discovery of both installed onboarding skill paths and reported native rule loading. Skill precedence when custom instructions conflict, live concurrent-agent coordination, and an actual Mac rollback are not yet exercised. |
| 12 | CI and package smoke tests run on Linux, macOS, and Windows with Node.js 22 and 24; all six hosted jobs passed on the final v0.4.2 commit. On the owner's Mac (Node.js 24.14.1), v0.4.1 and v0.4.2 reviewed tarballs installed globally offline and `ai-setup --version` resolved correctly. A one-time GitHub-based npx invocation failed earlier. The documented persistent tarball install succeeds; the owner verified the pinned public npm version command. A registry-backed Quickstart dry run passed in a disposable Git checkout without project writes. |
| 13–14 | Strict TypeScript checks, 39 automated tests, packaging, offline installation, npm audit with zero reported vulnerabilities, and hosted CI passed for v0.4.2. Finish a concise end-user walkthrough and obtain explicit owner sign-off for the stable release. |

[Phase 8 fix matrix](https://github.com/zeeshanjamshed/ai-workflow-kit/actions/runs/42870861645) · [v0.4.0 onboarding matrix](https://github.com/zeeshanjamshed/ai-workflow-kit/actions/runs/43011069944)

## v0.4.1 Mac pilot fixes

Strict TypeScript checks, all 35 automated tests, packaging, and offline global-prefix installation passed. The package smoke test resolved `ai-setup` through PATH from a separate checkout; npm audit reported zero vulnerabilities. A disposable v0.3.0 → v0.4.0 → v0.4.1 upgrade preserved custom instructions and a customized engineering module, activated five selected rules, and kept repeated activation and skill installation unchanged. All six hosted jobs passed on Linux, macOS, and Windows with Node.js 22 and 24. [Pilot fix CI](https://github.com/zeeshanjamshed/ai-workflow-kit/actions/runs/43024729395).

Isolated development-environment live-agent checks could not run: Codex was signed out and its sandbox helper failed; Claude Code and Cursor were unavailable in that environment. Subsequent user-reported authenticated Mac sessions supplied useful Claude and Codex observations (below). Cursor and native enforcement remain unverified.

## v0.4.2 one-command quickstart

Quickstart adds a combined dry-run, one approval, native adapter activation, and an ignored recovery journal and backup. Guided project analysis and approval to save knowledge remain separate. Strict TypeScript checks, 39 tests, packaging, and offline CLI installation passed; npm audit reported zero vulnerabilities. Fixtures cover fresh and custom setups, declined approval, interrupted recovery, rollback, monorepo root targeting, and safe repeats. A disposable project initialized using the v0.4.1 tarball retained its manifest through quickstart, and rerunning proposed no edits.

[v0.4.2 quickstart CI: all six jobs passed](https://github.com/zeeshanjamshed/ai-workflow-kit/actions/runs/43055259129) on commit [`d1e0e6d`](https://github.com/zeeshanjamshed/ai-workflow-kit/commit/d1e0e6d0e2748331f685a0def1bb041a2a6e75a7). Fresh-session agent behavior *after* v0.4.2 quickstart remains pending.

## User-reported macOS pilot (November 11–12, 2026)

The owner provided terminal transcripts and Claude/Codex responses from an existing project. The repository commit and hosted CI run have been independently checked; the agent observations below are user-reported manual tests, not captured native permission traces or a reproducible security audit. Agent statements alone do not prove that unauthorized writes are technically impossible.

- **CLI and rule loading:** A v0.4.1 tarball installed globally with Node.js 24.14.1, and `ai-setup --version` returned `0.4.1`. In fresh sessions, both Claude and Codex identified the five engineering modules, the project approval instructions, and the guided onboarding skill. The CLI was accessible through PATH.
- **Guided onboarding and bounded edits:** Claude reviewed six existing knowledge files, proposed records with source excerpts, and stopped when the add-only save command encountered existing destinations. After a natural-language approval, Claude reported editing only the agreed architecture knowledge file and declined to run an unapproved build or commit. The documentation merge remains manual.
- **Cross-agent verification:** In an earlier disposable pilot, Codex created a task handoff that Claude resumed after checking Git. Later, Codex located Claude's architecture documentation change, checked it against the current code, reported two qualifications, and made no changes.
- **v0.4.2 Quickstart:** The owner built and installed the reviewed v0.4.2 tarball globally offline; `ai-setup --version` returned `0.4.2`. `ai-setup quickstart --dry-run` on the already-initialized project preserved `tracked` policy, proposed rule links in `AGENTS.md` and `CLAUDE.md`, and kept 12 existing files. The owner approved the run; the CLI reported verification and a rollback backup ID. A second dry-run printed `Setup is already complete.`

**Limits:** Agent versions, exact sandbox settings, and native file-permission events were not fully captured. There was no fresh authenticated Claude/Codex run following the v0.4.2 quickstart activation.

## v0.4.2 npm distribution

The v0.4.2 package is configured for public npm access under the MIT License. The executable, Node.js requirement, and compiled-file allowlist are unchanged. The README documents the public npm command and offline tarball installation. The preparation checks passed strict TypeScript, all 39 tests, and an isolated offline install that ran the npm-installed `ai-setup` launcher. npm audit reported zero vulnerabilities. The tarball contains 12 compiled CLI modules, `package.json`, `README.md`, and `LICENSE`. The inventory matched the expected files, and a scan found no common credential patterns. The owner confirmed that `npx -y @zeeshanjamshed/ai-workflow-kit@0.4.2 --version` returned `0.4.2` after the registry became responsive. A separate registry check returned v0.4.2 and its integrity value. The pinned Quickstart dry run left a disposable checkout clean. [Public package](https://www.npmjs.com/package/@zeeshanjamshed/ai-workflow-kit/v/0.4.2).

## Remaining v1.0.0 gates

1. Run a reproducible v0.4.2 live-agent acceptance pass (normal task, no-approval boundary, bounded approval, higher-risk safeguard behavior, and instruction/skill precedence). Test Cursor in a supported configuration or explicitly document what is not supported. Treat native agent sandbox and permission controls as the enforcement layer, not prompts alone.
2. Verify the supported installation path for the v1.0.0 candidate in a disposable checkout.
3. Complete the end-user walkthrough and final release checklist. Obtain separate explicit owner approvals for the stable version, npm publication, and any release tag. Follow the [maintainer release guide](RELEASING.md) for future versions.

## Candidate checks

Run `npm ci --ignore-scripts`, `npm run typecheck`, `npm test`, `npm pack`, `npm run test:package`, and `npm audit --audit-level=high`. Review the tarball inventory and compare the candidate source commit with its hosted CI run. Use disposable checkouts for remaining live-agent evaluations and record tool version, sandbox mode, observed approval behavior, and changed paths.
