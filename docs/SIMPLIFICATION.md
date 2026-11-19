# Agreed simplification

Approved direction, 18 November 2026. This document takes precedence over conflicting older design proposals in the specification. The implementation sequence below records what is complete and what remains for owner trials.

## User experience

- One guided `init` installs the complete central rules and one onboarding skill. No preset selection is required. Retain existing commands as compatibility interfaces.
- Detect existing project and AI setup, show the evidence, and ask only necessary questions. Offer shared, mixed (recommended), or local-only Git tracking. Preview ignore changes; never silently untrack existing files.
- Preview the bounded operation and obtain approval before applying. Reruns detect completed setup and offer missing setup or unfinished onboarding without duplicates.
- Offer onboarding through Claude Code, Codex, a custom executable or shell alias/function, or later. Verify supported native launch interfaces before implementation. Explain unsupported launch cases clearly. Never treat custom input as an arbitrary shell script without review.
- The agent inspects actual project code and existing knowledge. It proposes consolidation and conflict resolutions before approved knowledge writes. Preserve existing instructions, decisions, skills, and knowledge, including traceable recovery for moves and replacements.
- `update` uses an identified release, previews meaningful changes, and preserves project additions and recorded exceptions. Central rules and bundled skills must participate in updates. Never silently fetch mutable source or overwrite local customizations.
- Keep backups, recovery, pins, and diagnostics available without requiring users to learn them for normal setup. Local and ignored knowledge needs an explicit backup or sharing mechanism. Keep secrets out of records and shared artifacts.

## Runtime baseline

The complete runtime baseline is currently maintained in `assets/current/rules/full/`. It covers communication, engineering, risk and verification, collaboration, and four workflows. Native permission reminders remain essential. Agent instructions guide behavior; native permissions and sandboxes enforce restrictions.

- Communicate precisely, simply, briefly, and naturally. Lead with the main point, avoid filler and awkward punctuation, and distinguish evidence from uncertainty. Use ASD-STE100 as inspiration, not a compliance claim.
- Investigate relevant affected areas before planning. Apply principal engineering, architecture, and DevOps judgment. Use official documentation matching installed versions; ask for missing docs before proposing a last-resort workaround.
- Small tasks receive one bounded approval. Large tasks use phase approvals. Whole-plan approval permits all listed steps without repeated requests. Read-only investigation proceeds freely. Significant changes in scope or risk need a new decision.
- Reuse established patterns, keep responsibilities focused, and use professional, accessible UI. Address relevant security, traffic, reliability, failure, and recovery concerns proportionally.
- Tests assess requirements, including relevant negative, boundary, permission, failure, integration, concurrency, and recovery cases. Review code and the final diff before completion or proposing a commit. Run relevant approved checks and report actual outcomes.
- Confirm the base branch and normal checkout versus worktree before changes; honor prior explicit choices. Coordinate concurrent agents and recommend isolated branches/worktrees. Use configured Git identity without AI co-author credits. Include safe approved cleanup after completion or deployment.
- Preserve knowledge, history, existing skills, and project exceptions. Record useful facts, decisions, and substantial task handoffs without creating unnecessary documents. Verify old records against current code.

The existing three-confirmation safeguard for known breaking changes remains in effect. Changing that safeguard is not part of this phase.

## Approved implementation sequence

1. Consolidate runtime rules and record the agreed design. Approved on main. Relevant checks are included.
2. Extend managed updates to central rules and skills while preserving old baselines, customizations, and recovery. Approved and implemented as the unpublished v0.4.4 candidate.
3. Implement guided `init`, tracking choices, adoption guidance, optional agent launch, and compatibility commands. Approved and implemented as the unpublished v0.4.5 candidate.
4. Complete automated verification, code review, documentation cleanup, and owner trial instructions. Approved and completed locally on November 19. The owner will run real project and agent trials. Publishing requires separate approval.

Do not rewrite historical template baselines in place. Their exact contents validate installed manifest hashes. The first phase changes Full runtime rules only; existing minimal initialization and CLI behavior remain unchanged until the later approved migration.

Phase 2 adds versioned asset catalogs, managed component tracking, and explicit project-owned exceptions. New setup transactions manage the stock assets they create. Updates can enroll legacy stock assets and add new files belonging to selected components. Existing customized unmanaged assets remain project-owned. Managed local edits survive unchanged central defaults; changes on both sides block for review. Knowledge and arbitrary third-party skills remain outside the catalog. The v0.4.3 Full and v0.4.0–v0.4.3 setup asset snapshots are frozen for compatibility and recovery. Guided `init` and optional agent launch followed in phase 3.

Phase 3 implements plain `init` with complete rules, agent choices, shared/mixed/local-only tracking, existing-setup summaries, optional extra path references, and one setup approval. Local-only ignore changes participate in the same backup and recovery transaction. Already tracked private files block writes. The old paired `--tracking` and `--agents` options retain minimal scripted behavior; add `--guided` to use both with the new flow. Older baselines stay preserved until a separately approved `update`. Stock native instruction updates preserve generated rule activation sections. Frozen pre-v0.4.5 instructions keep historical manifest hashes valid.

After setup, interactive terminals offer native Claude/Codex launch, a custom command, or later, with a separate `start` confirmation. Custom Bash/Zsh names load trusted user startup files, restore the project directory, and receive the prompt as a literal argument. Piped sessions, Windows, and unsupported custom shells use a manual handoff. No real agent session was launched during automated verification. See [launch details and interface evidence](AGENT_LAUNCH.md). Phase 4 is complete locally; owner trials and hosted CI remain outstanding.
