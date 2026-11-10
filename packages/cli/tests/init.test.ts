import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const cli = fileURLToPath(new URL('../src/main.ts', import.meta.url));
const choices = ['--tracking=tracked', '--agents=codex,claude,cursor'];
const journal = '.ai/.init-plan.json';
const manifest = '.ai/setup-manifest.json';

function run(root: string, args = choices, input = 'apply\n', dryRun = false) {
  return spawnSync(process.execPath, [cli, 'init', ...(dryRun ? ['--dry-run'] : []), ...args], {
    cwd: root, input, encoding: 'utf8', timeout: 15000,
  });
}

async function fixture(action: (root: string) => void | Promise<void>) {
  const root = mkdtempSync(join(tmpdir(), 'ai-init-'));
  try {
    await action(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('starter requires explicit approval and supports a read-only exact preview', () => fixture(root => {
  const preview = run(root, choices, '', true);
  assert.equal(preview.status, 0, preview.stderr);
  assert.ok(JSON.parse(preview.stdout).add.some((entry: {path: string}) => entry.path === manifest));
  assert.equal(run(root, choices, 'no\n').status, 0);
  assert.equal(run(root, choices, '').status, 1);
  assert.deepEqual(readdirSync(root), []);
  const result = run(root);
  assert.equal(result.status, 0, result.stderr);
  const record = JSON.parse(readFileSync(join(root, manifest), 'utf8'));
  assert.equal(record.tracking, 'tracked');
  assert.ok(record.files['AGENTS.md'].sha256);
  assert.match(readFileSync(join(root, 'AGENTS.md'), 'utf8'), /explicit approval/);
  const original = readFileSync(join(root, manifest));
  writeFileSync(join(root, 'AGENTS.md'), 'local customization\n');
  assert.match(run(root).stdout, /Already initialized/);
  assert.equal(readFileSync(join(root, 'AGENTS.md'), 'utf8'), 'local customization\n');
  assert.deepEqual(readFileSync(join(root, manifest)), original);
}));

test('existing codebase is initialized without modifying its source', () => fixture(root => {
  writeFileSync(join(root, 'package.json'), '{"name":"existing"}\n');
  writeFileSync(join(root, 'index.js'), 'console.log("existing");\n');
  const result = run(root);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /"projectType": "existing"/);
  assert.equal(readFileSync(join(root, 'index.js'), 'utf8'), 'console.log("existing");\n');
}));

test('adoption preserves existing agent instructions, skills, and knowledge', () => fixture(root => {
  mkdirSync(join(root, '.cursor', 'rules'), { recursive: true });
  mkdirSync(join(root, '.claude', 'skills'), { recursive: true });
  mkdirSync(join(root, '.ai'), { recursive: true });
  const files = ['AGENTS.md', '.claude/CLAUDE.md', '.claude/skills/custom.md', '.cursor/rules/custom.mdc', '.ai/README.md', 'GEMINI.md'];
  for (const file of files) writeFileSync(join(root, file), 'existing custom text\n');
  const result = run(root);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /"projectType": "existing-ai"/);
  assert.match(result.stdout, /GEMINI.md/);
  for (const file of files) assert.equal(readFileSync(join(root, file), 'utf8'), 'existing custom text\n');
  assert.equal(existsSync(join(root, 'CLAUDE.md')), false);
  assert.equal(existsSync(join(root, '.cursor/rules/ai-workflow-kit.mdc')), false);
}));

test('foreign manifest and incompatible privacy rules block writes', () => fixture(root => {
  mkdirSync(join(root, '.ai'));
  writeFileSync(join(root, manifest), '{"version":"foreign"}\n');
  assert.equal(run(root).status, 1);
  assert.equal(existsSync(join(root, journal)), false);
  rmSync(join(root, manifest));
  writeFileSync(join(root, '.ai/.gitignore'), 'custom\n');
  assert.equal(run(root, ['--tracking=mixed', '--agents=']).status, 1);
  assert.equal(readFileSync(join(root, '.ai/.gitignore'), 'utf8'), 'custom\n');
  assert.equal(existsSync(join(root, journal)), false);
}));

test('an interrupted partial write resumes, while conflicts are preserved', () => fixture(root => {
  const report = JSON.parse(run(root, choices, '', true).stdout);
  mkdirSync(join(root, '.ai'));
  writeFileSync(join(root, journal), report.add[0].content);
  writeFileSync(join(root, '.ai/README.md'), report.add.find((entry: {path: string}) => entry.path === '.ai/README.md').content);
  writeFileSync(join(root, '.ai/config.yaml'), 'conflicting edit\n');
  assert.equal(run(root).status, 1);
  assert.equal(readFileSync(join(root, '.ai/config.yaml'), 'utf8'), 'conflicting edit\n');
  assert.equal(existsSync(join(root, manifest)), false);
  rmSync(join(root, '.ai/config.yaml'));
  const resumed = run(root);
  assert.equal(resumed.status, 0, resumed.stderr);
  assert.match(resumed.stdout, /"resumed": true/);
  assert.ok(existsSync(join(root, manifest)));
}));

test('a target created after preview invalidates approval without writing a journal', () => fixture(root => new Promise<void>((resolve, reject) => {
  const child = spawn(process.execPath, [cli, 'init', ...choices], { cwd: root });
  let output = '';
  let responded = false;
  child.stdout.on('data', chunk => {
    output += chunk;
    if (responded || !output.includes('Type apply')) return;
    responded = true;
    writeFileSync(join(root, 'AGENTS.md'), 'added concurrently\n');
    child.stdin.end('apply\n');
  });
  child.on('error', reject);
  child.on('close', status => {
    try {
      assert.equal(responded, true, output);
      assert.equal(status, 1);
      assert.equal(readFileSync(join(root, 'AGENTS.md'), 'utf8'), 'added concurrently\n');
      assert.equal(existsSync(join(root, journal)), false);
      resolve();
    } catch (error) { reject(error); }
  });
})));

test('Git privacy policies keep selected paths ignored without changing tracked files', () => fixture(root => {
  const git = (...args: string[]) => spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  assert.equal(git('init').status, 0);
  writeFileSync(join(root, '.gitignore'), '/AGENTS.md\n');
  const result = run(root, ['--tracking=local-only', '--agents=codex']);
  assert.equal(result.status, 0, result.stderr);
  for (const file of [manifest, journal, 'AGENTS.md']) assert.equal(git('check-ignore', '--quiet', file).status, 0, file);
  assert.equal(readFileSync(join(root, '.gitignore'), 'utf8'), '/AGENTS.md\n');
  assert.equal(git('ls-files').stdout, '');
}));

test('mixed tracking shares setup and ignores project records', () => fixture(root => {
  const git = (...args: string[]) => spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  assert.equal(git('init').status, 0);
  const result = run(root, ['--tracking=mixed', '--agents=codex']);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(git('check-ignore', '--quiet', '.ai/tasks/task.md').status, 0);
  assert.equal(git('check-ignore', '--quiet', manifest).status, 1);
}));

test('an interrupted run with an obstructed directory resumes after the obstruction is removed', () => fixture(root => {
  const report = JSON.parse(run(root, choices, '', true).stdout);
  mkdirSync(join(root, '.ai'));
  writeFileSync(join(root, journal), report.add[0].content);
  writeFileSync(join(root, '.ai/rules'), 'existing obstruction\n');
  const failed = run(root);
  assert.equal(failed.status, 1);
  assert.match(failed.stderr, /Unsafe parent/);
  assert.equal(readFileSync(join(root, '.ai/rules'), 'utf8'), 'existing obstruction\n');
  assert.equal(existsSync(join(root, manifest)), false);
  rmSync(join(root, '.ai/rules'));
  const recovered = run(root);
  assert.equal(recovered.status, 0, recovered.stderr);
  assert.ok(existsSync(join(root, manifest)));
}));
