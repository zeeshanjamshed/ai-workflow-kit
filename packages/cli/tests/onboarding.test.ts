import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { templates, sha } from '../src/initialize.ts';

const cli = fileURLToPath(new URL('../src/main.ts', import.meta.url));

function fixture(check: (root: string, run: (args: string[], input?: string) => ReturnType<typeof invoke>) => void) {
  const root = mkdtempSync(join(tmpdir(), 'ai-onboard-'));
  const git = (args: string[]) => {
    const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  };
  function invoke(args: string[], input = '') {
    return spawnSync(process.execPath, [cli, ...args], { cwd: root, input, encoding: 'utf8', timeout: 15000 });
  }
  try {
    git(['init']);
    writeFileSync(join(root, 'app.js'), 'export const queue = "orders";\n');
    writeFileSync(join(root, '.env'), 'EXAMPLE=fixture\n');
    writeFileSync(join(root, 'AGENTS.md'), '# Existing approval rules\n');
    git(['add', '--', 'app.js', '.env', 'AGENTS.md']);
    const init = invoke(['init', '--tracking=mixed', '--agents=codex,claude'], 'apply\n');
    assert.equal(init.status, 0, init.stderr);
    check(root, invoke);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('onboarding inventories source and saves only approved evidence-backed knowledge', () => fixture((root, run) => {
  const discovery = run(['onboard']);
  assert.equal(discovery.status, 0, discovery.stderr);
  assert.ok(JSON.parse(discovery.stdout).trackedFiles.includes('app.js'));
  assert.ok(!JSON.parse(discovery.stdout).trackedFiles.includes('.env'));
  const record = {
    id: 'queue', title: 'Queue boundary',
    facts: [{ text: 'The queue name is orders.', path: 'app.js', line: 1, excerpt: 'queue = "orders"' }],
    hypotheses: ['A worker may consume this queue.'], questions: ['Where are retries handled?'],
  };
  const path = join(root, '.ai/knowledge/queue.md');
  const save = (approval: string) => run(['onboard', 'save'], JSON.stringify([record]) + '\n' + approval + '\n');
  assert.equal(save('no').status, 0);
  assert.equal(existsSync(path), false);
  const applied = save('apply');
  assert.equal(applied.status, 0, applied.stderr);
  const original = readFileSync(path, 'utf8');
  assert.match(original, /Verified facts[\s\S]*app\.js:1[\s\S]*Hypotheses[\s\S]*Open questions/);
  assert.match(save('apply').stdout, /"status": "keep"/);
  record.facts[0].text = 'Different wording.';
  assert.equal(save('apply').status, 1);
  record.facts[0].excerpt = 'not in source';
  assert.match(save('apply').stderr, /Evidence does not match/);
  assert.equal(readFileSync(path, 'utf8'), original);
}));

test('rule selection and skills are opt-in and preserve custom instructions and modules', () => fixture((root, run) => {
  const path = join(root, '.ai/rules/engineering-security.md');
  assert.equal(run(['rules', 'minimal'], 'apply\n').status, 0);
  assert.equal(run(['rules', 'recommended'], 'no\n').status, 0);
  assert.equal(existsSync(path), false);
  assert.equal(run(['rules', 'custom', 'security'], 'apply\n').status, 0);
  writeFileSync(path, 'Custom security rules\n');
  const conflict = run(['rules', 'recommended'], 'apply\n');
  assert.equal(conflict.status, 1);
  assert.equal(existsSync(join(root, '.ai/rules/engineering-testing.md')), false);
  assert.equal(readFileSync(path, 'utf8'), 'Custom security rules\n');
  assert.equal(run(['onboard', 'install-skills', 'both'], 'apply\n').status, 0);
  assert.match(run(['skills']).stdout, /\.claude\/skills\/guided-project-onboarding\/SKILL.md/);
  assert.match(run(['skills']).stdout, /\.agents\/skills\/guided-project-onboarding\/SKILL.md/);
  assert.equal(readFileSync(join(root, 'AGENTS.md'), 'utf8'), '# Existing approval rules\n');
}));

test('v0.3 manifest and original template hashes remain valid for updates', () => fixture((root, run) => {
  const entries = templates({ version: '0.3.0', policy: 'mixed', agents: [] });
  mkdirSync(join(root, '.ai/rules'), { recursive: true });
  for (const { path, content } of entries) writeFileSync(join(root, path), content);
  writeFileSync(join(root, '.ai/setup-manifest.json'), JSON.stringify({
    owner: 'ai-workflow-kit', version: '0.3.0', tracking: 'mixed', adapters: [],
    files: Object.fromEntries(entries.map(({ path, content }) => [path, { sha256: sha(content) }])),
  }));
  const result = run(['update', '--dry-run']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /replace-with-bundled/);
}));
