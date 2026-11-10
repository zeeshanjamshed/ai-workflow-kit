import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const cli = fileURLToPath(new URL('../src/main.ts', import.meta.url));

function fixture(check: (run: (args: string[], cwd?: string, input?: string) => ReturnType<typeof invoke>, root: string, home: string) => void) {
  const scratch = mkdtempSync(join(tmpdir(), 'ai-context-'));
  const root = join(scratch, 'project');
  const home = join(scratch, 'home');
  mkdirSync(root);
  mkdirSync(home);
  function invoke(args: string[], cwd = root, input = '') {
    return spawnSync(process.execPath, [cli, ...args], { cwd, input, encoding: 'utf8',
      env: { ...process.env, HOME: home, USERPROFILE: home }, timeout: 15000 });
  }
  try { check(invoke, root, home); } finally { rmSync(scratch, { recursive: true, force: true }); }
}

function put(root: string, path: string, value: string) {
  const file = join(root, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, value);
}

test('skills inventory sees project, nested and home skills without running their contents', () => fixture((run, root, home) => {
  put(root, 'package.json', '{}');
  const paths = ['.claude/skills/vendor/SKILL.md', 'app/.agents/skills/local/SKILL.md', '.cursor/skills/group/tool/SKILL.md'];
  for (const path of paths) put(root, path, 'Untrusted content must not execute.\n');
  put(home, '.agents/skills/personal/SKILL.md', 'Personal content must not be emitted.');
  const result = run(['skills'], join(root, 'app'));
  assert.equal(result.status, 0, result.stderr);
  const skills = JSON.parse(result.stdout);
  for (const path of paths) assert.ok(skills.some((skill: {path: string}) => skill.path.replaceAll('\\', '/') === path));
  assert.ok(skills.some((skill: {agent: string; scope: string}) => skill.agent === 'codex' && skill.scope === 'user'));
  assert.ok(!result.stdout.includes('must not'));
}));

test('new adapters point to canonical permissions and share the Codex entry point with Cursor', () => fixture((run, root) => {
  const result = run(['init', '--tracking=tracked', '--agents=codex,claude,cursor'], root, 'apply\n');
  assert.equal(result.status, 0, result.stderr);
  assert.match(readFileSync(join(root, 'CLAUDE.md'), 'utf8'), /@\.ai\/rules\/permissions\.md/);
  assert.match(readFileSync(join(root, 'AGENTS.md'), 'utf8'), /explicit approval.*before writes/);
  assert.match(readFileSync(join(root, '.ai/rules/permissions.md'), 'utf8'), /three distinct explicit confirmations/);
  assert.equal(existsSync(join(root, '.cursor/rules/ai-workflow-kit.mdc')), false);
}));

test('Cursor-only setup gets a native always-applied rule', () => fixture((run, root) => {
  const result = run(['init', '--tracking=tracked', '--agents=cursor'], root, 'apply\n');
  assert.equal(result.status, 0, result.stderr);
  assert.match(readFileSync(join(root, '.cursor/rules/ai-workflow-kit.mdc'), 'utf8'), /alwaysApply: true[\s\S]*explicit approval/);
}));

test('handoffs expose selected context and reject traversal without creating files', () => fixture((run, root) => {
  put(root, '.ai/tasks/ship.md', '# Ship\n\nVerified: tests passed.\nNext: review Git state.\n');
  put(root, '.ai/knowledge/data.md', '# Data\n');
  put(root, '.ai/decisions/format.md', '# Format\n');
  const result = run(['context', 'ship']);
  assert.equal(result.status, 0, result.stderr);
  const record = JSON.parse(result.stdout);
  assert.deepEqual(record.knowledge, ['.ai/knowledge/data.md']);
  assert.deepEqual(record.decisions, ['.ai/decisions/format.md']);
  assert.match(record.handoff.markdown, /Verified: tests passed/);
  assert.equal(run(['context', '../knowledge/data']).status, 1);
  assert.equal(existsSync(join(root, '.ai/setup-manifest.json')), false);
}));

test('a Phase 4 journal resumes using the original templates', () => fixture((run, root) => {
  put(root, '.ai/.init-plan.json', JSON.stringify({
    owner: 'ai-workflow-kit', version: '0.1.0', policy: 'tracked', agents: [],
    create: ['.ai/README.md', '.ai/rules/permissions.md', '.ai/config.yaml'], preserve: [],
  }, null, 2) + '\n');
  put(root, '.ai/config.yaml', 'version: "0.1.0"\ntracking: tracked\nadapters: []\n');
  const result = run(['init'], root, 'apply\n');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(readFileSync(join(root, '.ai/setup-manifest.json'), 'utf8')).version, '0.1.0');
}));
