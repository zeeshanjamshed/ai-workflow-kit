import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import semver from 'semver';
import { packageRoot, version } from '../packages/cli/src/metadata.ts';

function command(executable, args) {
  const result = spawnSync(executable, args, { cwd: packageRoot, encoding: 'utf8' });
  if (result.error || result.status !== 0)
    throw new Error(result.error?.message ?? result.stderr.trim());
  return result.stdout.trim();
}

try {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: { notes: { type: 'string' } },
  });
  const [target] = positionals;
  if (
    positionals.length !== 1 ||
    !target ||
    (!['patch', 'minor', 'major'].includes(target) && !semver.valid(target)) ||
    !values.notes?.trim()
  )
    throw new Error(
      'Use npm run release:prepare -- patch|minor|major|VERSION --notes "Reviewed release notes".',
    );
  if (!process.env.npm_execpath)
    throw new Error('Run release preparation through npm run release:prepare.');
  const requested = semver.valid(target) ?? semver.inc(version, target);
  if (!requested || !semver.gt(requested, version))
    throw new Error('Choose a version newer than the current package version.');
  if (command('git', ['rev-parse', '--show-toplevel']) !== packageRoot)
    throw new Error('Release preparation requires this package repository.');
  if (command('git', ['status', '--porcelain', '--untracked-files=normal']))
    throw new Error(
      'Review and commit current work before release preparation. No files were changed.',
    );
  if (!existsSync(join(packageRoot, 'assets/releases', version + '.json')))
    throw new Error('The outgoing version needs its frozen baseline before preparing a release.');
  if (existsSync(join(packageRoot, 'assets/releases', requested + '.json')))
    throw new Error('That version already has a frozen baseline. Choose a new version.');
  const changelogPath = join(packageRoot, 'CHANGELOG.md');
  const changelog = existsSync(changelogPath)
    ? readFileSync(changelogPath, 'utf8')
    : '# Changelog\n';
  // npm owns package.json and lockfile version updates. No commit or tag is created.
  command(process.execPath, [
    process.env.npm_execpath,
    'version',
    requested,
    '--no-git-tag-version',
    '--ignore-scripts',
  ]);
  const next = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8')).version;
  command(process.execPath, [join(packageRoot, 'scripts/assets.mjs'), 'freeze']);
  const body = changelog.replace(/^# Changelog\s*/, '');
  writeFileSync(
    changelogPath,
    `# Changelog\n\n## ${next} - ${new Date().toISOString().slice(0, 10)}\n\n${values.notes.trim()}\n\n${body}`,
  );
  console.log(
    `Prepared ${next}. Review the diff, run npm run verify, and obtain approval before committing or publishing. No Git actions were performed.`,
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
