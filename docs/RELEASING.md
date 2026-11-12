# Releasing AI Workflow Kit

This example publishes `@zeeshanjamshed/ai-workflow-kit@0.4.3` to the public npm registry. Use the actual approved version for each release. Publishing requires explicit owner approval for that version and the reviewed tarball.

## 1. Prepare the master checkout

Use a clean checkout of the AI Workflow Kit repository, with Git and Node.js 22.18 or newer. Check that `origin` points to `zeeshanjamshed/ai-workflow-kit`. Resolve any local changes before updating.

```sh
git status --short --branch
git remote -v
git switch main
git pull --ff-only origin main
npm ci --ignore-scripts
npm version 0.4.3 --no-git-tag-version
```

The version command updates `package.json` and `package-lock.json` without creating a tag or commit. Update the exported version in `packages/cli/src/initialize.ts` to match. Keep the outgoing baseline in `bundledVersions` and preserve its exact template contents. If the new baseline inherits version-specific template text, include the new version in the relevant conditions. Review the diff for unintended template or dependency changes.

## 2. Build and inspect the candidate

```sh
npm run typecheck
npm test
npm pack --json
npm run test:package
npm audit --audit-level=high
tar -tzf zeeshanjamshed-ai-workflow-kit-0.4.3.tgz
shasum -a 256 zeeshanjamshed-ai-workflow-kit-0.4.3.tgz
```

The package smoke test installs the tarball in isolation and runs the installed CLI. Check that the archive contains the expected compiled CLI modules, including `dist/packages/cli/src/main.js`, plus `package.json`, `README.md`, and `LICENSE`. Review packed metadata, license, and file contents. Stop if you find unexpected files, credentials, private paths or project data. Keep the inspected tarball and record its SHA-256 (use `sha256sum` if `shasum` is unavailable) and the integrity from the pack output so you can identify the exact artifact later.

## 3. Commit and verify CI

Review and commit the approved release changes, then publish the commit to GitHub `main` through the authorized repository workflow. Keep the tarball out of Git. On GitHub Actions, verify that all six CLI checks passed **on that commit**: Linux, macOS, and Windows with both Node.js 22 and 24. Record the commit SHA and CI URL alongside the tarball checksum.

## 4. Verify npm access and get approval

```sh
npm whoami --registry https://registry.npmjs.org/
npm view @zeeshanjamshed/ai-workflow-kit@0.4.3 version --registry https://registry.npmjs.org/
```

Confirm the signed-in account owns the `@zeeshanjamshed` scope or has publish rights to the package. For an existing package, review its maintainers and access in npm. Complete any npm authentication or two-factor prompts through npm's own flow. If the target version already exists, stop and verify it. If the lookup fails for a reason other than the version being absent, resolve that before proceeding.

Give the owner the version, commit, CI link, package inventory, and tarball checksum. After explicit approval, recheck the checksum and publish that exact archive once:

```sh
npm publish ./zeeshanjamshed-ai-workflow-kit-0.4.3.tgz --access public --registry https://registry.npmjs.org/
```

## 5. Verify the public release

Run these from a disposable Git checkout so the Quickstart preview is isolated:

```sh
npm view @zeeshanjamshed/ai-workflow-kit@0.4.3 version dist.integrity --registry https://registry.npmjs.org/
npx -y @zeeshanjamshed/ai-workflow-kit@0.4.3 --version
npx -y @zeeshanjamshed/ai-workflow-kit@0.4.3 quickstart --dry-run
```

Expect version `0.4.3` and a preview with no project writes. Compare the registry integrity value with the inspected tarball's `npm pack --json` integrity. If npm accepted publication but the version is temporarily missing or npx returns 404, wait a few minutes and retry the read-only checks against the public registry. Do not republish. If it stays missing, check npm status, account permissions, and the original command output.

## 6. Update existing projects

If you installed the CLI globally, update it first with `npm install --global @zeeshanjamshed/ai-workflow-kit@0.4.3`. In the project, run `ai-setup update --dry-run`, or use `npx -y @zeeshanjamshed/ai-workflow-kit@0.4.3 update --dry-run`. Review the proposed edits and resolve conflicts without overwriting local customizations. Respect project pins. After project-owner approval, rerun without `--dry-run` and type `apply`. Record the backup ID for an approved `ai-setup rollback <backup-id>` if needed.

See [npm's scoped public package guide](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/) and the [release-readiness report](RELEASE_READINESS.md).
