# AI Workflow Kit project plan

The [README](../README.md) describes the kit. The [approved specification](SPECIFICATION.md) defines the requirements and acceptance criteria. This roadmap tracks progress through the build phases in specification section 13.

| Phase | Milestone | Completion check | Status |
| --- | --- | --- | --- |
| 1 | Approve the design | Agree on the requirements, proposed layout, and CLI boundaries. | Done |
| 2 | Establish the repository | Publish the approved baseline, roadmap, and lightweight repository instructions. | Done. All four approved files are published on `main`. |
| 3 | Build the read-only CLI | Test deterministic discovery, `doctor`, and `init --dry-run` against representative projects. Verify that checks and previews leave project files and external state untouched. | Done. Four automated tests passed on Node.js 24, including file snapshots and restricted offline runs. |
| 4 | Initialize and adopt projects | Support fresh starters, established codebases, and existing AI setups. Verify previews, explicit approval, preservation, safe reruns, and recovery after interruption. | Done. Thirteen automated tests passed on Node.js 24. |
| 5 | Verify agent integration | Test real Claude Code and Codex instruction discovery and approval behavior, supported Cursor configurations if enabled, skills discovery, and resumable handoffs. | In verification. Eighteen automated tests passed on Linux with Node.js 24. Live agent checks are pending. |
| 6 | Support safe updates and distribution | Verify provenance, three-way updates, conflict handling, backups, rollback, repair, version pins, and known-version offline use. Test packaging on macOS, Linux, and Windows. | Implemented. Type checks and 26 tests passed on Linux with Node.js 22 and 24. Offline npm installation verified on Linux. macOS and Windows verification pending. |
| 7 | Prove workflows and coordination | Add CI and fixtures. Exercise feature, debug, review, and risky-change workflows, security checks, and same-clone parallel work. Document coordination limits across branches and clones. | Implemented. Local Linux tests and package smoke checks passed. Hosted matrix and live agent checks require verification. |
| 8 | Pilot and release | Pilot across project types, close gaps against specification section 12, and get approval for `v1.0.0` and npm publishing. | Planned |

## Tracking progress

- Keep one status per phase. Record a short note with the relevant commit, test result, or remaining blocker when a phase moves forward.
- Get separate approval before starting each phase. Within a phase, default to approval one step at a time.
- Track release decisions here as they arise. The license is pending and requires approval before inviting public reuse.

**Next checkpoint:** Complete the outstanding Phase 5 live agent checks and Phase 6 macOS and Windows checks. Review Phase 7 hosted CI and outstanding live-agent checks. Phase 8 requires separate approval.
