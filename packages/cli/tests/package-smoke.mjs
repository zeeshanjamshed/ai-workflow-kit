import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const tar = resolve(pkg.name.replace(/^@/, '').replace('/', '-') + '-' + pkg.version + '.tgz');
const root = mkdtempSync(join(tmpdir(), 'ai-package-'));
function run(executable, args, cwd, input) {
  const result = spawnSync(executable, args, { cwd, input, encoding: 'utf8', timeout: 30000 });
  assert.equal(result.status, 0, result.error?.message ?? result.stderr);
  return result.stdout;
}
try {
  const project = join(root, 'project');
  mkdirSync(project);
  run(process.execPath, [process.env.npm_execpath, 'install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', tar], root);
  run('git', ['init'], project);
  const bin = join(root, 'node_modules', '.bin', 'ai-setup');
  const windows = process.platform === 'win32';
  assert.ok(existsSync(windows ? bin + '.cmd' : bin));
  const exe = windows ? process.execPath : bin;
  const prefix = windows ? [join(root, 'node_modules', pkg.name, pkg.bin['ai-setup'])] : [];
  run(exe, [...prefix, 'doctor'], project);
  run(exe, [...prefix, 'init', '--dry-run', '--tracking=tracked', '--agents=codex'], project);
  assert.equal(existsSync(join(project, '.ai')), false);
  run(exe, [...prefix, 'init', '--tracking=tracked', '--agents=codex'], project, 'apply\n');
  assert.equal(JSON.parse(run(exe, [...prefix, 'update', '--dry-run'], project)).edits.length, 0);
  assert.deepEqual(JSON.parse(run(exe, [...prefix, 'coordinate', 'status'], project)), []);
  console.log('Offline package install and CLI smoke checks passed.');
} finally { rmSync(root, { recursive: true, force: true }); }
