import { spawnSync } from 'node:child_process';
import { checkArtifact } from './artifact.mjs';
import { waitForIntegrity } from './registry.mjs';

function npm(args) {
  if (!process.env.npm_execpath) throw new Error('Run publishing through npm run release:publish.');
  const result = spawnSync(process.execPath, [process.env.npm_execpath, ...args], {
    encoding: 'utf8',
  });
  if (result.error || result.status !== 0) throw new Error(result.error?.message ?? result.stderr);
  return result.stdout.trim();
}

try {
  if (
    process.env.GITHUB_ACTIONS !== 'true' ||
    process.env.GITHUB_EVENT_NAME !== 'workflow_dispatch' ||
    process.env.GITHUB_REF !== 'refs/heads/main' ||
    process.env.NPM_PUBLISH_ENABLED !== 'true'
  )
    throw new Error(
      'Publishing is disabled. Use the approved GitHub release workflow and protected npm environment.',
    );
  if (
    !process.env.EXPECTED_VERSION ||
    !process.env.EXPECTED_SHA256 ||
    !/^[a-f0-9]{40}$/.test(process.env.EXPECTED_COMMIT ?? '') ||
    process.env.EXPECTED_COMMIT !== process.env.GITHUB_SHA
  )
    throw new Error('Missing approved artifact identity.');
  if (process.env.NODE_AUTH_TOKEN || process.env.NPM_TOKEN)
    throw new Error('Use npm trusted publishing, not a long-lived npm token.');
  const artifact = checkArtifact(undefined, {
    version: process.env.EXPECTED_VERSION,
    commit: process.env.EXPECTED_COMMIT,
    sha256: process.env.EXPECTED_SHA256,
    release: true,
  });
  // Publishing the already-tested tarball prevents lifecycle hooks from rebuilding it.
  const tag = artifact.version.includes('-') ? 'next' : 'latest';
  console.log(
    npm([
      'publish',
      artifact.path,
      '--ignore-scripts',
      '--access',
      'public',
      '--tag',
      tag,
      '--registry',
      'https://registry.npmjs.org/',
    ]),
  );
  await waitForIntegrity(artifact.integrity, () =>
    JSON.parse(
      npm([
        'view',
        `${artifact.package}@${artifact.version}`,
        'dist.integrity',
        '--json',
        '--prefer-online',
        '--fetch-retries=0',
        '--fetch-timeout=10000',
        '--registry',
        'https://registry.npmjs.org/',
      ]),
    ),
  );
  console.log(`Published and verified ${artifact.package}@${artifact.version} (${tag}).`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
