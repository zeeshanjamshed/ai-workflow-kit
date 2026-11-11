import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const tar = resolve(pkg.name.replace(/^@/, '').replace('/', '-') + '-' + pkg.version + '.tgz');
const root = mkdtempSync(join(tmpdir(), 'ai-package-'));
const windows = process.platform === 'win32';
const install = join(root, 'install');
const bin = windows ? install : join(install, 'bin');
const pathKey = Object.keys(process.env).find(key => key.toLowerCase() === 'path') ?? 'PATH';
const env = { ...process.env, [pathKey]: bin + delimiter + process.env[pathKey] };

function run(executable, args, cwd, input) {
  const result = spawnSync(executable, args, { cwd, input, env, encoding: 'utf8', timeout: 30000 });
  assert.equal(result.status, 0, result.error?.message ?? result.stderr);
  return result.stdout;
}
try {
  const project = join(root, 'project');
  mkdirSync(project);
  run(process.execPath, [process.env.npm_execpath, 'install', '--global', '--prefix', install,
    '--offline', '--ignore-scripts', '--no-audit', '--no-fund', tar], root);
  run('git', ['init'], project);
  const invoke = (args, input) => windows
    ? run('cmd.exe', ['/d', '/c', 'ai-setup', ...args], project, input)
    : run('ai-setup', args, project, input);
  assert.equal(invoke(['--version']).trim(), pkg.version);
  invoke(['doctor']);
  invoke(['init', '--dry-run', '--tracking=tracked', '--agents=codex']);
  assert.equal(existsSync(join(project, '.ai')), false);
  assert.ok(JSON.parse(invoke(['onboard'])).project.root);
  invoke(['quickstart', '--dry-run'], 'apply\n');
  assert.equal(existsSync(join(project, '.ai')), false);
  assert.match(invoke(['quickstart'], 'apply\n'), /guided-project-onboarding/);
  assert.match(invoke(['quickstart']), /already complete/);
  assert.equal(JSON.parse(invoke(['update', '--dry-run'])).edits.length, 0);
  assert.deepEqual(JSON.parse(invoke(['coordinate', 'status'])), []);
  console.log('Offline package install and CLI smoke checks passed.');
} finally { rmSync(root, { recursive: true, force: true }); }
