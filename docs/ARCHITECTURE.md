# CLI architecture

Normal users run `init` or `update`. Older interfaces remain supported through compatibility handlers.

| Responsibility                                                      | Location                                            |
| ------------------------------------------------------------------- | --------------------------------------------------- |
| Command definitions and strict option parsing                       | `packages/cli/src/arguments.ts`                     |
| Dispatch and exit status                                            | `packages/cli/src/main.ts`                          |
| Guided interaction and agent handoff                                | `guided-init.ts`, `terminal.ts`, `agent-launch.ts`  |
| Read-only project discovery                                         | `discovery.ts`, `context.ts`, `reports.ts`          |
| Setup and update planning                                           | `quickstart.ts`, `update-plan.ts`, `setup-state.ts` |
| Journal validation, approval checks, backups, application, recovery | `transactions.ts`                                   |
| Safe path and atomic file operations                                | `file-operations.ts`                                |
| Editable rule and onboarding content                                | `assets/current/`                                   |
| Immutable historical contents                                       | `assets/releases/`                                  |
| Version and package root                                            | `metadata.ts`, using package.json                   |
| Verification and release commands                                   | `scripts/`, `.github/workflows/`                    |

The ordinary flow is parse, discover, plan, preview, approve, apply, and verify. Plans contain explicit before/after edits and input fingerprints. The transaction layer rechecks them before and after approval, enforces privacy, stores a private journal, applies changes, and verifies the result. A resumed operation uses its saved plan rather than silently generating a different one.

Update planning accepts a read callback and does not write. File application is separate from comparison. Legacy minimal initialization retains its original add-only journal format and uses the same filesystem boundary; it is not silently converted into a new transaction format.

Current Markdown assets have a catalog mapping sources to installed destinations. Release snapshots deduplicate content by SHA-256, retain every supported ordered adapter/tracking variant, and have no executable historical implementation. Snapshot generation and regression tests protect exact historical bytes.

Builds remove only generated dist output, check asset consistency, and compile TypeScript to JavaScript. The npm package ships compiled runtime modules, asset data, license, changelog, and three user guides. Clack provides the interactive terminal UI and is bundled with its runtime dependencies using npm bundleDependencies, so tarball installation also works offline with an empty npm cache. Non-interactive commands do not load the renderer. Development-only ESLint, TypeScript, and Prettier provide checks.

The release workflow builds once, tests the same archive across the platform matrix, and requires an externally configured protected environment before publication. See [release setup](RELEASING.md). Native agent permissions remain the enforcement boundary for agent actions.

Interactive prompts use arrow-key selections, agent checkboxes, text inputs, and confirmations that default to No. Ctrl+C ends the current operation without approving further changes. Dumb terminals and piped input retain the original plain input protocol. NO_COLOR suppresses colour without disabling menus. Setup and update plans, preservation, journals, and recovery remain in their existing layers.
