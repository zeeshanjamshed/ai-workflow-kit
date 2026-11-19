import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { packageRoot, version } from '../packages/cli/src/metadata.ts';
import { bundledVersions, currentAsset } from '../packages/cli/src/bundles.ts';

function run(executable, args) {
  const result = spawnSync(executable, args, { cwd: packageRoot, encoding: 'utf8' });
  if (result.error || result.status !== 0) throw new Error(result.error?.message ?? result.stderr);
  return result.stdout.trim();
}

try {
  if (!process.env.npm_execpath) throw new Error('Run through npm run package:check.');
  if (process.env.EXPECTED_VERSION && process.env.EXPECTED_VERSION !== version)
    throw new Error('Requested release version does not match package.json.');
  if (process.env.EXPECTED_VERSION) {
    const changelog = readFileSync(join(packageRoot, 'CHANGELOG.md'), 'utf8');
    const heading = changelog.split('\n').find((line) => line.startsWith(`## ${version} - `));
    if (!heading || !/^\d{4}-\d{2}-\d{2}$/.test(heading.slice(`## ${version} - `.length)))
      throw new Error('Prepare dated release notes before requesting publication.');
  }
  const [packed] = JSON.parse(
    run(process.execPath, [process.env.npm_execpath, 'pack', '--json', '--ignore-scripts']),
  );
  const catalog = JSON.parse(currentAsset('catalog.json'));
  const lock = JSON.parse(readFileSync(join(packageRoot, 'package-lock.json'), 'utf8'));
  const bundledRoots = Object.entries(lock.packages)
    .filter(([path, metadata]) => path.startsWith('node_modules/') && metadata.inBundle)
    .map(([path]) => path);
  const expectedBundles = bundledRoots.map((path) => path.slice('node_modules/'.length)).sort();
  if (JSON.stringify([...packed.bundled].sort()) !== JSON.stringify(expectedBundles))
    throw new Error('Bundled runtime dependencies do not match the lockfile.');
  const allowed = new Set([
    'package.json',
    'README.md',
    'LICENSE',
    'CHANGELOG.md',
    'docs/CLI_REFERENCE.md',
    'docs/AGENT_LAUNCH.md',
    'docs/TRIALS.md',
    'assets/current/catalog.json',
    'assets/current/instructions/permissions.md',
    'assets/current/instructions/project-index.md',
    ...['claude', 'codex', 'cursor'].map((agent) => `assets/current/adapters/${agent}.md`),
    ...Object.values(catalog.groups)
      .flat()
      .map((entry) => 'assets/current/' + entry.source),
    ...bundledVersions.map((release) => `assets/releases/${release}.json`),
    ...bundledRoots.map((path) => path + '/package.json'),
  ]);
  const unexpected = packed.files.filter(
    (file) =>
      !allowed.has(file.path) &&
      !/^dist\/packages\/cli\/src\/[\w-]+\.js$/.test(file.path) &&
      !bundledRoots.some(
        (root) =>
          file.path.startsWith(root + '/') &&
          !file.path.split('/').some((part) => part === '..' || part === '.'),
      ),
  );
  if (unexpected.length)
    throw new Error(`Unexpected package files: ${unexpected.map((file) => file.path).join(', ')}`);
  for (const path of allowed)
    if (!packed.files.some((file) => file.path === path))
      throw new Error(`Missing package file: ${path}`);
  const bytes = readFileSync(join(packageRoot, packed.filename));
  const artifact = {
    package: packed.name,
    version,
    filename: packed.filename,
    commit: run('git', ['rev-parse', 'HEAD']),
    dirty: Boolean(run('git', ['status', '--porcelain', '--untracked-files=normal'])),
    sha256: createHash('sha256').update(bytes).digest('hex'),
    integrity: packed.integrity,
    files: packed.files.map((file) => file.path),
  };
  const directory = join(packageRoot, 'release');
  mkdirSync(directory, { recursive: true });
  copyFileSync(join(packageRoot, packed.filename), join(directory, packed.filename));
  writeFileSync(join(directory, 'artifact.json'), JSON.stringify(artifact, null, 2) + '\n');
  if (process.env.GITHUB_OUTPUT)
    writeFileSync(
      process.env.GITHUB_OUTPUT,
      `sha256=${artifact.sha256}\nversion=${version}\ncommit=${artifact.commit}\n`,
      { flag: 'a' },
    );
  if (process.env.GITHUB_STEP_SUMMARY)
    writeFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `## Release candidate\n\nVersion: ${version}\n\nCommit: ${artifact.commit}\n\nSHA-256: ${artifact.sha256}\n\n${artifact.files.length} allowlisted files. Review the artifact before approving publication.\n`,
      { flag: 'a' },
    );
  console.log(
    `Verified package inventory: ${artifact.files.length} files. SHA-256 ${artifact.sha256}`,
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
