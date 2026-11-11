import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { templates, sha, version } from '../src/initialize.ts';

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
  const applied = run(['update'], 'apply\n');
  assert.equal(applied.status, 0, applied.stderr);
  assert.equal(JSON.parse(readFileSync(join(root, '.ai/setup-manifest.json'), 'utf8')).version, version);
  assert.equal(run(['rules', 'custom', 'testing'], 'apply\n').status, 0);
  assert.equal(run(['rules', 'activate', 'testing'], 'apply\n').status, 0);
  assert.equal(run(['onboard', 'install-skills', 'both'], 'apply\n').status, 0);
  assert.match(run(['onboard', 'install-skills', 'both'], 'apply\n').stdout, /"status": "keep"/);
}));

test('approved activation connects selected project-owned rules to native entry points and rolls back safely', () => fixture((root, run) => {
  const module = join(root, '.ai/rules/engineering-security.md');
  const agents = join(root, 'AGENTS.md');
  const claude = join(root, 'CLAUDE.md');
  const original = '# Custom project instructions\r\nKeep my conventions.';
  writeFileSync(agents, original);
  const originalClaude = readFileSync(claude, 'utf8');
  assert.equal(run(['rules', 'custom', 'security'], 'apply\n').status, 0);
  writeFileSync(module, '# Custom security\nCheck the authentication boundary.\n');
  const inventory = () => JSON.parse(run(['rules']).stdout).modules.find((item: { name: string }) => item.name === 'security');
  assert.equal(inventory().selected, false);
  const command = ['rules', 'activate', 'security'];
  assert.equal(run([...command, '--dry-run'], 'apply\n').status, 0);
  assert.equal(run(command, 'no\n').status, 0);
  assert.equal(readFileSync(agents, 'utf8'), original);
  const applied = run(command, 'apply\n');
  assert.equal(applied.status, 0, applied.stderr);
  assert.ok(readFileSync(agents, 'utf8').startsWith(original));
  assert.match(readFileSync(agents, 'utf8'), /Before planning[\s\S]*\.ai\/rules\/engineering-security\.md/);
  assert.match(readFileSync(claude, 'utf8'), /@\.ai\/rules\/engineering-security\.md/);
  assert.deepEqual(inventory().selectedBy, ['AGENTS.md', 'CLAUDE.md']);
  assert.equal(inventory().provenance, 'project-owned');
  assert.match(run(command, 'apply\n').stdout, /"edits": \[\]/);
  assert.equal(JSON.parse(run(['update', '--dry-run']).stdout).edits.length, 0);
  const id = applied.stdout.match(/Backup ID: ([\da-f-]+)/)?.[1];
  assert.ok(id);
  const rollback = run(['rollback', id], 'apply\n');
  assert.equal(rollback.status, 0, rollback.stderr);
  assert.equal(readFileSync(agents, 'utf8'), original);
  assert.equal(readFileSync(claude, 'utf8'), originalClaude);
  assert.equal(inventory().selected, false);
  assert.equal(readFileSync(module, 'utf8'), '# Custom security\nCheck the authentication boundary.\n');
}));

test('quickstart previews without writes and completes a fresh project with one approval', () => fixture((root, run) => {
  const original = readFileSync(join(root, 'AGENTS.md'), 'utf8');
  rmSync(join(root, '.ai'), { recursive: true });
  rmSync(join(root, 'CLAUDE.md'));
  assert.match(run(['quickstart', '--dry-run'], 'apply\n').stdout, /starter|existing-ai/);
  assert.equal(run(['quickstart'], 'no\n').status, 0);
  assert.equal(existsSync(join(root, '.ai')), false);
  const result = run(['quickstart'], 'apply\n');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.match(/Type apply/g)?.length, 1);
  assert.match(result.stdout, /guided-project-onboarding/);
  assert.ok(readFileSync(join(root, 'AGENTS.md'), 'utf8').startsWith(original));
  assert.match(readFileSync(join(root, 'CLAUDE.md'), 'utf8'), /@\.ai\/rules\/engineering-testing\.md/);
  assert.equal(JSON.parse(run(['rules']).stdout).modules.filter((item: { selected: boolean }) => item.selected).length, 5);
  assert.match(run(['quickstart']).stdout, /already complete/);
  assert.equal(JSON.parse(run(['update', '--dry-run']).stdout).edits.length, 0);
  const id = result.stdout.match(/Backup ID: ([\da-f-]+)/)?.[1];
  assert.ok(id);
  const rollback = run(['rollback', id], 'apply\n');
  assert.equal(rollback.status, 0, rollback.stderr);
  assert.equal(readFileSync(join(root, 'AGENTS.md'), 'utf8'), original);
  assert.equal(existsSync(join(root, '.ai/setup-manifest.json')), false);
  assert.equal(existsSync(join(root, 'CLAUDE.md')), false);
}));

test('quickstart keeps existing custom adapters, rules and skills and rejects conflicting activation blocks', () => fixture((root, run) => {
  const originalManifest = readFileSync(join(root, '.ai/setup-manifest.json'), 'utf8');
  const override = join(root, 'AGENTS.override.md');
  const customClaude = join(root, 'CLAUDE.md');
  const cursor = join(root, '.cursor/rules/custom.mdc');
  const skill = join(root, '.agents/skills/guided-project-onboarding/SKILL.md');
  const security = join(root, '.ai/rules/engineering-security.md');
  mkdirSync(join(root, '.cursor/rules'), { recursive: true });
  mkdirSync(join(root, '.agents/skills/guided-project-onboarding'), { recursive: true });
  const custom = '# Project-specific conventions\n';
  writeFileSync(override, custom);
  writeFileSync(customClaude, custom);
  writeFileSync(cursor, custom);
  writeFileSync(skill, custom);
  writeFileSync(security, custom);
  writeFileSync(override, custom + '<!-- ai-workflow-kit:engineering-rules -->\n');
  assert.equal(run(['quickstart'], 'apply\n').status, 1);
  assert.equal(existsSync(join(root, '.ai/rules/engineering-testing.md')), false);
  writeFileSync(override, custom);
  const result = run(['quickstart'], 'apply\n');
  assert.equal(result.status, 0, result.stderr);
  for (const path of [cursor, skill, security]) assert.equal(readFileSync(path, 'utf8'), custom);
  for (const path of [override, customClaude]) assert.ok(readFileSync(path, 'utf8').startsWith(custom));
  assert.match(readFileSync(join(root, '.cursor/rules/ai-workflow-kit.mdc'), 'utf8'), /alwaysApply: true[\s\S]*engineering-testing/);
  assert.equal(readFileSync(join(root, '.ai/setup-manifest.json'), 'utf8'), originalManifest);
  assert.match(run(['quickstart']).stdout, /already complete/);
}));

test('quickstart resumes an interrupted journal and detects conflicts before resuming', () => fixture((root, run) => {
  const result = run(['quickstart'], 'apply\n');
  assert.equal(result.status, 0, result.stderr);
  const id = result.stdout.match(/Backup ID: ([\da-f-]+)/)?.[1];
  assert.ok(id);
  const backup = join(root, '.ai/update-backups');
  const journal = readFileSync(join(backup, id + '.json'), 'utf8');
  writeFileSync(join(backup, '.pending.json'), journal);
  const module = join(root, '.ai/rules/engineering-testing.md');
  writeFileSync(module, 'Unrelated user edit');
  assert.equal(run(['quickstart'], 'apply\n').status, 1);
  assert.equal(readFileSync(module, 'utf8'), 'Unrelated user edit');
  rmSync(module);
  const preview = run(['quickstart', '--dry-run'], 'apply\n');
  assert.equal(preview.status, 0, preview.stderr);
  assert.match(preview.stdout, /Resume/);
  assert.equal(existsSync(module), false);
  const resumed = run(['quickstart'], 'apply\n');
  assert.equal(resumed.status, 0, resumed.stderr);
  assert.equal(existsSync(module), true);
  assert.equal(existsSync(join(backup, '.pending.json')), false);
}));

test('quickstart from a nested package changes only the repository-root setup', () => fixture((root, run) => {
  const nested = join(root, 'packages/app');
  mkdirSync(nested, { recursive: true });
  writeFileSync(join(nested, 'AGENTS.md'), '# Package-specific rules\n');
  const applied = spawnSync(process.execPath, [cli, 'quickstart'], {
    cwd: nested, input: 'apply\n', encoding: 'utf8', timeout: 15000,
  });
  assert.equal(applied.status, 0, applied.stderr);
  assert.match(applied.stdout, /Workspace detected/);
  assert.equal(existsSync(join(nested, '.ai')), false);
  assert.equal(readFileSync(join(nested, 'AGENTS.md'), 'utf8'), '# Package-specific rules\n');
  assert.match(run(['quickstart']).stdout, /already complete/);
}));
