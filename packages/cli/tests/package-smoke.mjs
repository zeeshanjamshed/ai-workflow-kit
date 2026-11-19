import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const tar = resolve(
  process.env.KIT_TARBALL ??
    pkg.name.replace(/^@/, '').replace('/', '-') + '-' + pkg.version + '.tgz',
);
const root = mkdtempSync(join(tmpdir(), 'ai-package-'));
const windows = process.platform === 'win32';
const install = join(root, 'install');
const bin = windows ? install : join(install, 'bin');
const pathKey = Object.keys(process.env).find((key) => key.toLowerCase() === 'path') ?? 'PATH';
const env = { ...process.env, [pathKey]: bin + delimiter + process.env[pathKey] };

function run(executable, args, cwd, input) {
  const result = spawnSync(executable, args, { cwd, input, env, encoding: 'utf8', timeout: 30000 });
  assert.equal(result.status, 0, result.error?.message ?? result.stderr);
  return result.stdout;
}
try {
  const project = join(root, 'project');
  mkdirSync(project);
  run(
    process.execPath,
    [
      process.env.npm_execpath,
      'install',
      '--global',
      '--prefix',
      install,
      '--cache',
      join(root, 'empty-npm-cache'),
      '--offline',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      tar,
    ],
    root,
  );
  const installedPackage = join(install, windows ? 'node_modules' : 'lib/node_modules', pkg.name);
  for (const guide of ['CLI_REFERENCE.md', 'AGENT_LAUNCH.md', 'TRIALS.md']) {
    assert.ok(existsSync(join(installedPackage, 'docs', guide)), `Missing bundled guide: ${guide}`);
  }
  run('git', ['init'], project);
  const invoke = (args, input) =>
    windows
      ? run('cmd.exe', ['/d', '/c', 'ai-setup', ...args], project, input)
      : run('ai-setup', args, project, input);
  assert.equal(invoke(['--version']).trim(), pkg.version);
  invoke(['doctor']);
  invoke(['init', '--dry-run', '--tracking=tracked', '--agents=codex']);
  assert.equal(existsSync(join(project, '.ai')), false);
  assert.ok(JSON.parse(invoke(['onboard'])).project.root);
  const guidedPreview = JSON.parse(invoke(['init', '--dry-run']));
  assert.ok(guidedPreview.edits.some((edit) => edit.path === '.ai/rules/full/behavior.md'));
  assert.match(
    invoke(['init', '--no-launch'], 'codex\nmixed\n\napply\n'),
    /Saving knowledge needs your approval/,
  );
  const managed = JSON.parse(readFileSync(join(project, '.ai/setup-manifest.json'), 'utf8'));
  assert.ok(managed.files['.ai/rules/full/behavior.md']);
  assert.ok(managed.files['.agents/skills/guided-project-onboarding/SKILL.md']);
  assert.match(invoke(['init', '--no-launch'], '\n'), /already complete/);
  assert.equal(JSON.parse(invoke(['update', '--dry-run'])).edits.length, 0);
  // Compatibility commands still run after the new primary initializer.
  invoke(['quickstart', '--dry-run'], 'apply\n');
  assert.match(invoke(['quickstart'], 'apply\n'), /guided-project-onboarding/);
  assert.match(invoke(['quickstart']), /already complete/);
  invoke(['update'], 'apply\n');
  assert.equal(JSON.parse(invoke(['update', '--dry-run'])).edits.length, 0);
  assert.deepEqual(JSON.parse(invoke(['coordinate', 'status'])), []);
  console.log('Offline package install and CLI smoke checks passed.');
} finally {
  rmSync(root, { recursive: true, force: true });
}
