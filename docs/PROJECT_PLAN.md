# AI Workflow Kit project plan

The [README](../README.md) describes the kit. The [approved specification](SPECIFICATION.md) defines the requirements and acceptance criteria. This roadmap tracks progress through the build phases in specification section 13.

| Phase | Milestone | Completion check | Status |
| --- | --- | --- | --- |
| 1 | Approve the design | Agree on the requirements, proposed layout, and CLI boundaries. | Done |
| 2 | Establish the repository | Publish the approved baseline, roadmap, and lightweight repository instructions. | In review. README and specification are on `main`. Roadmap and agent instructions are drafted. |
| 3 | Build the read-only CLI | Test deterministic discovery, `doctor`, and `init --dry-run` against representative projects. Verify that checks and previews leave project files and external state untouched. | Planned |
| 4 | Initialize and adopt projects | Support fresh starters, established codebases, and existing AI setups. Verify previews, stepwise approval, backups, safe reruns, and recovery after interruption. | Planned |
| 5 | Verify agent integration | Test real Claude Code and Codex instruction discovery and approval behavior, supported Cursor configurations if enabled, skills discovery, and resumable handoffs. | Planned |
| 6 | Support safe updates and distribution | Verify provenance, three-way updates, conflict handling, backups, rollback, repair, version pins, and known-version offline use. Test packaging on macOS, Linux, and Windows. | Planned |
| 7 | Prove workflows and coordination | Add CI and fixtures. Exercise feature, debug, review, and risky-change workflows, security checks, and same-clone parallel work. Document coordination limits across branches and clones. | Planned |
| 8 | Pilot and release | Pilot across project types, close gaps against specification section 12, and get approval for `v1.0.0` and npm publishing. | Planned |

## Tracking progress

- Keep one status per phase. Record a short note with the relevant commit, test result, or remaining blocker when a phase moves forward.
- Get separate approval before starting each phase. Within a phase, default to approval one step at a time.
- Track release decisions here as they arise. The license is pending and requires approval before inviting public reuse.

**Next checkpoint:** Review `AGENTS.md` and this roadmap. Publishing them requires separate approval. Phase 3 starts only after its own approval.
