import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const cli = fileURLToPath(new URL('../src/main.ts', import.meta.url));
const location = '.git/ai-workflow-kit-coordination';

function command(cwd: string, executable: string, args: string[], input?: string) {
  return spawnSync(executable, args, { cwd, input, encoding: 'utf8', timeout: 20000 });
}

function fixture(check: (root: string, project: string, git: (...args: string[]) => void) => void) {
  const root = mkdtempSync(join(tmpdir(), 'ai-coordination-'));
  const project = join(root, 'project');
  mkdirSync(project);
  const git = (...args: string[]) => {
    const result = command(project, 'git', args);
    assert.equal(result.status, 0, result.stderr);
  };
  try {
    git('init', '-b', 'main');
    git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--allow-empty', '-m', 'Initial');
    check(root, project, git);
  } finally { rmSync(root, { recursive: true, force: true }); }
}

function coordinate(project: string, args: string[], input = 'apply\n') {
  return command(project, process.execPath, [cli, 'coordinate', ...args], input);
}

function claim(project: string, task: string, path: string, action = 'claim') {
  const result = coordinate(project, [action, task, 'codex', path]);
  assert.equal(result.status, 0, result.stderr);
  const token = /Ownership token: (\S+)/.exec(result.stdout);
  assert.ok(token);
  return token[1];
}

test('feature ownership requires approval, detects overlap, and permits independent work', () => fixture((_root, project) => {
  assert.equal(coordinate(project, ['status']).status, 0);
  assert.equal(coordinate(project, ['claim', 'feature', 'codex', 'src'], 'no\n').status, 0);
  assert.equal(existsSync(join(project, location)), false);
  const token = claim(project, 'feature', 'src');
  assert.equal(coordinate(project, ['claim', 'debug', 'claude', 'SRC/file.ts']).status, 1);
  claim(project, 'debug', 'tests');
  assert.equal(coordinate(project, ['release', 'feature', 'wrong']).status, 1);
  assert.equal(coordinate(project, ['renew', 'feature', token]).status, 0);
  assert.equal(coordinate(project, ['release', 'feature', token], 'no\n').status, 0);
  const report = coordinate(project, ['status']);
  assert.ok(!report.stdout.includes(token));
  assert.equal(JSON.parse(report.stdout).length, 2);
}));

test('debugging handoff survives release and stale takeover rotates ownership', () => fixture((_root, project) => {
  const original = claim(project, 'bug', 'src');
  const state = join(project, location, 'claims.json');
  const claims = JSON.parse(readFileSync(state, 'utf8'));
  claims[0].expires = 1;
  writeFileSync(state, JSON.stringify(claims));
  assert.equal(JSON.parse(coordinate(project, ['status']).stdout)[0].stale, true);
  assert.equal(coordinate(project, ['claim', 'other', 'claude', 'src']).status, 1);
  const next = claim(project, 'bug', 'src', 'takeover');
  assert.notEqual(next, original);
  assert.equal(coordinate(project, ['release', 'bug', original]).status, 1);
  mkdirSync(join(project, '.ai/tasks'), { recursive: true });
  writeFileSync(join(project, '.ai/tasks/bug.md'), '# Regression\nTests pending.\n');
  assert.equal(coordinate(project, ['release', 'bug', next, '.ai/tasks/bug.md']).status, 0);
  assert.equal(JSON.parse(coordinate(project, ['status']).stdout)[0].handoff, '.ai/tasks/bug.md');
  assert.equal(command(project, process.execPath, [cli, 'context', 'bug']).status, 0);
}));

test('worktrees share ownership only with explicit opt-in, while clones and files remain separate', () => fixture((root, project, git) => {
  const linked = join(root, 'linked');
  const clone = join(root, 'clone');
  git('worktree', 'add', '-b', 'review', linked);
  git('clone', '.', clone);
  claim(project, 'feature', 'src');
  assert.equal(coordinate(linked, ['status']).status, 1);
  assert.equal(JSON.parse(coordinate(linked, ['status', '--worktree']).stdout).length, 1);
  assert.equal(coordinate(linked, ['claim', 'review', 'claude', 'src', '--worktree']).status, 1);
  assert.deepEqual(JSON.parse(coordinate(clone, ['status']).stdout), []);
  writeFileSync(join(project, 'local.txt'), 'uncommitted');
  assert.equal(existsSync(join(linked, 'local.txt')), false);
  assert.equal(existsSync(join(clone, 'local.txt')), false);
}));

test('read-only review and high-risk scope guard leave project files untouched', () => fixture((_root, project) => {
  writeFileSync(join(project, 'app.js'), 'export const stable = true;\n');
  const original = readFileSync(join(project, 'app.js'));
  assert.equal(command(project, process.execPath, [cli, 'doctor']).status, 0);
  assert.equal(command(project, process.execPath, [cli, 'init', '--dry-run']).status, 0);
  assert.equal(coordinate(project, ['claim', 'unsafe', 'claude', '../outside']).status, 1);
  const token = claim(project, 'risk', '*');
  assert.equal(coordinate(project, ['claim', 'feature', 'codex', 'app.js']).status, 1);
  mkdirSync(join(project, location, 'write.lock'));
  assert.match(coordinate(project, ['takeover', 'risk', 'claude', '*']).stderr, /stale ownership/);
  assert.match(coordinate(project, ['release', 'risk', token]).stderr, /writer is locked/);
  assert.deepEqual(readFileSync(join(project, 'app.js')), original);
  assert.equal(existsSync(join(project, '.ai')), false);
}));
