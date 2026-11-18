# Full Engineering specification coverage

Use this checklist when reviewing changes to Full Engineering. The installed root instructions point to `.ai/rules/full/README.md`. Claude Code imports that short index. Codex and supported Cursor instructions direct the agent to read it. The index selects detail by task.

## Runtime agent rules

| Verify | Specification | Installed rule or workflow |
| --- | --- | --- |
| [x] Principal-engineer judgment, real requirements, meaningful ambiguity, concise communication, owner request versus suggestions, and completion evidence | §2.1 | `behavior.md` |
| [x] Read-only work, concise numbered plans, step versus whole-plan approval, side-effect checks, scoped exceptions, significant surprises, native safeguards, and three confirmations for known breaking changes | §2.2 | `behavior.md`, baseline `permissions.md`, entry-point reminder |
| [x] Preserve behavior, separate unrelated issues, approved cleanup, safe Git operations, and untrusted external instructions | §2.3 | `behavior.md`, `collaboration.md`, `risk.md` |
| [x] Project architecture, cohesion, reuse, contracts, actual critical flows, official docs and installed versions, dependencies and official generators | §3 | `engineering.md` |
| [x] Security, privacy, accessibility, performance, data consistency, reliability, relevant edge cases, deployment sequencing, rollback, and honest verification | §3 | `risk.md` |
| [x] Inspect, plan, approve, execute, verify, and hand off. Combine applicable workflows and use checkpoints only for substantial work | §4 | `behavior.md`, `risk.md`, `collaboration.md` |
| [x] Feature, debugging with evidence labels, review with severity and code references, and risky change with recovery | §4 | `.ai/workflows/{feature,debugging,review,risky-change}.md` |
| [x] Canonical project memory, verified evidence and uncertainty, architecture and flows, decision statuses and exceptions, handoffs, indexing, and no silent history loss | §5 | `collaboration.md`, baseline `.ai/README.md` |
| [x] Optional parallel work, overlap checks, stale ownership, approved worktrees, same-clone coordination limits, explicit synchronization, and portable skills checks | §9 | `collaboration.md` |
| [x] Public-master hygiene, secret handling, artifact trust, project privacy choices, and preservation of user work | §10 | `risk.md`, `collaboration.md` |
| [x] Project ownership, pinning, provenance, decision statuses, and explicit review of changes | §11 | `collaboration.md` |

## CLI and release responsibilities

| Specification | Coverage and boundary |
| --- | --- |
| §§6, 8, 10–11 | The setup transaction handles deterministic previews, adapters, provenance for baseline files, existing tracking policies, conflicts, private backups, verification, and recovery. Optional Full modules are editable project files and are not replaced by bundled updates. Distinct Full path conflicts stop for review. Broader doctor diagnostics and automated semantic conflict detection are outside this preset. |
| §§5–8 | Installing a skill creates an entry for future guided analysis. Project facts and business logic require agent investigation and separate approval to save. No project records or empty documentation are generated just to match the illustrative directory tree. |
| §§6, 9 | Native tool permission enforcement, precedence, and actual skill loading need fresh agent-session tests. Filesystem fixtures verify generated adapters and paths. Parallel ownership is available through the existing opt-in coordination command. |
| §§7–8, 12–14 | Repository layout proposals, licensing, packaging, release approval, publication, CI, native-agent evaluations, and stable-release acceptance belong to the maintainer process. See [Releasing](RELEASING.md) and [Release readiness](RELEASE_READINESS.md). |

## Final v0.4.3 audit

The audit restored explicit wording for the following specification nuances: proportional application, awkward punctuation in human messages, whole-plan approval excluding unlisted actions, avoiding file splits for file count, no arbitrary coverage percentage, and safe archival without silently discarding history.

Full uses the specification's runtime requirements from §§2–5 and 9–11 and the native entry-point requirements in §6. It intentionally excludes illustrative empty directories, project business facts, technology-specific rules without project evidence, CLI algorithms, release steps, and stable-release acceptance assertions from installed agent rules. Those belong respectively to relevant project analysis, the implementation, and the maintainer documents.

Customization checks distinguish pre-existing conflicting Full destinations from an already active Full setup. Conflicts block first adoption. After activation, project-edited Full modules are preserved on rerun. Rollback refuses later changes to any file it would reverse. Full replaces stock Quickstart links while retaining links to selected customized modules. Old stock modules remain on disk for history and rollback.

The automated fixtures verify native adapter text and nested Claude import paths. Actual fresh-session loading, semantic precedence, task behavior, and host permission enforcement still need authenticated Claude Code, Codex, and supported Cursor checks.
