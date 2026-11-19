# Release the package

Publication is a separate owner-approved action. The local candidate remains unpublished. The workflow never commits, pushes, or creates tags.

## One-time account setup

Do these only after the workflow files are reviewed and committed through an approved Git action.

1. In GitHub repository settings, create an environment named `npm`. Restrict it to `main` and require the owner's approval. Configure the reviewer so the intended owner can approve the run; enabling prevention of self-review requires another reviewer.
2. In npm package settings for `@zeeshanjamshed/ai-workflow-kit`, add a GitHub Actions trusted publisher for owner `zeeshanjamshed`, repository `ai-workflow-kit`, workflow `release.yml`, and environment `npm`. Permit direct publication. No long-lived publishing token is needed.
3. After those protections are configured, set the environment variable `NPM_PUBLISH_ENABLED` to `true` in the GitHub `npm` environment. Leave it unset until setup is complete. GitHub may create an unprotected environment if a workflow names one that does not exist; the variable gate keeps a fresh setup from publishing accidentally.

These are account settings, not changes the local workflow files can enforce by themselves. Keep npm account 2FA enabled. Do not add npm publishing tokens to repository secrets. Trusted publishing needs npm 11.5.1 or newer; workflows pin npm 11.11.0.

## Prepare a release

After the code changes are reviewed and committed, run one command from a clean kit checkout.

```sh
npm run release:prepare -- patch --notes "Add the reviewed engineering rule."
```

Use `minor`, `major`, or an explicit new version when appropriate. Choose the version based on compatibility. For a preview release, use an explicit version such as `0.5.0-rc.1`.

The command uses `npm version` to update package metadata and the lockfile, generates the new immutable asset snapshot, and adds dated changelog notes. Old snapshots are retained. It creates no commit or tag. Review its diff and run:

```sh
npm run verify
```

This runs formatting, lint, types, asset checks, all tests, a clean build, package inventory checks, and offline installation of the resulting tarball. Fix the cause of any failure. Generated assets must not be hand-edited to hide an incompatibility.

If preparation stops after npm updates metadata, inspect the working tree before retrying. Do not delete old release snapshots or overwrite unrelated work. The generated changes remain reviewable; nothing has been committed or published.

Obtain approval to commit and push the reviewed release changes. Do not use implementation-phase numbers as release versions. The CLI reads its current version from package.json.

## Check and publish

In GitHub Actions, select **Release npm package**, choose `main`, and enter the exact prepared version.

- Leave **publish** off for a build-and-test trial.
- Turn **publish** on only when publication is intended. Checks still run before the environment approval.

The workflow builds one tarball on Linux, records its source commit and checksums, and uploads it as an immutable artifact. Six jobs run source checks and install the same tarball on Linux, macOS, and Windows with Node.js 22 and 24. npm audit must pass. A failed check blocks publication.

Review the source commit, release notes, results, artifact inventory, and SHA-256 in the run summary. The `publish` job then waits for the configured environment approval. After approval, it downloads the artifact by ID, verifies the version, commit, and checksum again, and publishes those exact bytes with lifecycle scripts disabled. The publish job alone receives OIDC permission.

npm trusted publishing supplies short-lived credentials and, for this public repository/package, automatic provenance. Stable versions use the `latest` npm tag. Versions containing a prerelease suffix use `next`.

The workflow verifies the registry's integrity value after publishing, refreshing npm metadata and retrying bounded read failures while the version becomes visible. An integrity mismatch stops verification immediately. If publication succeeded but registry verification failed, inspect npm state before doing anything else. Never assume that rerunning a failed workflow means the version was not published. npm versions cannot be overwritten.

GitHub release notes and Git tags remain separate explicit Git actions. Use the verified source commit if the owner approves creating them.

## Edit or add rules

- Edit Markdown in `assets/current/`.
- Add a new asset's destination and source to `assets/current/catalog.json` under its relevant installed component.
- Prepare a new version before final verification. Existing projects can then review the new baseline through `update`.
- Never edit `assets/releases/*.json`. These preserve exact historical contents and every supported tracking/agent variant.

`assets:freeze` refuses to replace a different snapshot. Release preparation creates a snapshot for the new version automatically. Asset loading uses Node.js built-ins. The Clack prompt library and its locked runtime dependencies are bundled in the tarball. Package inventory checks verify the bundled package set, and smoke installation uses an empty npm cache with offline mode enabled.

## Official guidance

- [npm trusted publishing and automatic provenance](https://docs.npmjs.com/trusted-publishers/)
- [npm version](https://docs.npmjs.com/cli/v11/commands/npm-version/)
- [npm lifecycle scripts](https://docs.npmjs.com/cli/v11/using-npm/scripts/)
- [GitHub environments and approval protections](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments)
- [GitHub artifact immutability](https://github.com/actions/upload-artifact)
