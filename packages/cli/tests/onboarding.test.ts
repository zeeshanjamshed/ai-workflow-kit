import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { templates, sha, version } from '../src/initialize.ts';

const cli = fileURLToPath(new URL('../src/main.ts', import.meta.url));

function fixture(
  check: (root: string, run: (args: string[], input?: string) => ReturnType<typeof invoke>) => void,
) {
  const root = mkdtempSync(join(tmpdir(), 'ai-onboard-'));
  const git = (args: string[]) => {
    const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  };
  function invoke(args: string[], input = '') {
    return spawnSync(process.execPath, [cli, ...args], {
      cwd: root,
      input,
      encoding: 'utf8',
      timeout: 15000,
    });
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

test('onboarding inventories source and saves only approved evidence-backed knowledge', () =>
  fixture((root, run) => {
    const discovery = run(['onboard']);
    assert.equal(discovery.status, 0, discovery.stderr);
    assert.ok(JSON.parse(discovery.stdout).trackedFiles.includes('app.js'));
    assert.ok(!JSON.parse(discovery.stdout).trackedFiles.includes('.env'));
    const record = {
      id: 'queue',
      title: 'Queue boundary',
      facts: [
        { text: 'The queue name is orders.', path: 'app.js', line: 1, excerpt: 'queue = "orders"' },
      ],
      hypotheses: ['A worker may consume this queue.'],
      questions: ['Where are retries handled?'],
    };
    const path = join(root, '.ai/knowledge/queue.md');
    const save = (approval: string) =>
      run(['onboard', 'save'], JSON.stringify([record]) + '\n' + approval + '\n');
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

test('rule selection and skills are opt-in and preserve custom instructions and modules', () =>
  fixture((root, run) => {
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

test('v0.3 manifest and original template hashes remain valid for updates', () =>
  fixture((root, run) => {
    const entries = templates({ version: '0.3.0', policy: 'mixed', agents: [] });
    mkdirSync(join(root, '.ai/rules'), { recursive: true });
    for (const { path, content } of entries) writeFileSync(join(root, path), content);
    writeFileSync(
      join(root, '.ai/setup-manifest.json'),
      JSON.stringify({
        owner: 'ai-workflow-kit',
        version: '0.3.0',
        tracking: 'mixed',
        adapters: [],
        files: Object.fromEntries(
          entries.map(({ path, content }) => [path, { sha256: sha(content) }]),
        ),
      }),
    );
    const result = run(['update', '--dry-run']);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /replace-with-bundled/);
    const applied = run(['update'], 'apply\n');
    assert.equal(applied.status, 0, applied.stderr);
    assert.equal(
      JSON.parse(readFileSync(join(root, '.ai/setup-manifest.json'), 'utf8')).version,
      version,
    );
    assert.equal(run(['rules', 'custom', 'testing'], 'apply\n').status, 0);
    assert.equal(run(['rules', 'activate', 'testing'], 'apply\n').status, 0);
    assert.equal(run(['onboard', 'install-skills', 'both'], 'apply\n').status, 0);
    assert.match(run(['onboard', 'install-skills', 'both'], 'apply\n').stdout, /"status": "keep"/);
  }));

test('approved activation connects selected project-owned rules to native entry points and rolls back safely', () =>
  fixture((root, run) => {
    const module = join(root, '.ai/rules/engineering-security.md');
    const agents = join(root, 'AGENTS.md');
    const claude = join(root, 'CLAUDE.md');
    const original = '# Custom project instructions\r\nKeep my conventions.';
    writeFileSync(agents, original);
    const originalClaude = readFileSync(claude, 'utf8');
    assert.equal(run(['rules', 'custom', 'security'], 'apply\n').status, 0);
    writeFileSync(module, '# Custom security\nCheck the authentication boundary.\n');
    const inventory = () =>
      JSON.parse(run(['rules']).stdout).modules.find(
        (item: { name: string }) => item.name === 'security',
      );
    assert.equal(inventory().selected, false);
    const command = ['rules', 'activate', 'security'];
    assert.equal(run([...command, '--dry-run'], 'apply\n').status, 0);
    assert.equal(run(command, 'no\n').status, 0);
    assert.equal(readFileSync(agents, 'utf8'), original);
    const applied = run(command, 'apply\n');
    assert.equal(applied.status, 0, applied.stderr);
    assert.ok(readFileSync(agents, 'utf8').startsWith(original));
    assert.match(
      readFileSync(agents, 'utf8'),
      /Before planning[\s\S]*\.ai\/rules\/engineering-security\.md/,
    );
    assert.match(readFileSync(claude, 'utf8'), /@\.ai\/rules\/engineering-security\.md/);
    assert.deepEqual(inventory().selectedBy, ['AGENTS.md', 'CLAUDE.md']);
    assert.equal(inventory().provenance, 'project-owned');
    assert.match(run(command, 'apply\n').stdout, /"edits": \[\]/);
    const enrollment = JSON.parse(run(['update', '--dry-run']).stdout);
    assert.ok(
      enrollment.comparisons.some(
        (item: { path: string; status: string }) =>
          item.path === '.ai/rules/engineering-security.md' &&
          item.status === 'preserve-project-owned',
      ),
    );
    assert.ok(
      enrollment.edits.every((item: { path: string }) => item.path === '.ai/setup-manifest.json'),
    );
    const id = applied.stdout.match(/Backup ID: ([\da-f-]+)/)?.[1];
    assert.ok(id);
    const rollback = run(['rollback', id], 'apply\n');
    assert.equal(rollback.status, 0, rollback.stderr);
    assert.equal(readFileSync(agents, 'utf8'), original);
    assert.equal(readFileSync(claude, 'utf8'), originalClaude);
    assert.equal(inventory().selected, false);
    assert.equal(
      readFileSync(module, 'utf8'),
      '# Custom security\nCheck the authentication boundary.\n',
    );
  }));

test('quickstart previews without writes and completes a fresh project with one approval', () =>
  fixture((root, run) => {
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
    assert.match(
      readFileSync(join(root, 'CLAUDE.md'), 'utf8'),
      /@\.ai\/rules\/engineering-testing\.md/,
    );
    assert.equal(
      JSON.parse(run(['rules']).stdout).modules.filter(
        (item: { selected: boolean }) => item.selected,
      ).length,
      5,
    );
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

test('quickstart keeps existing custom adapters, rules and skills and rejects conflicting activation blocks', () =>
  fixture((root, run) => {
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
    for (const path of [override, customClaude]) {
      const contents = readFileSync(path, 'utf8');
      assert.ok(contents.startsWith(custom));
      assert.match(contents, /\.ai\/rules\/permissions\.md/);
    }
    assert.match(
      readFileSync(join(root, '.cursor/rules/ai-workflow-kit.mdc'), 'utf8'),
      /alwaysApply: true[\s\S]*engineering-testing/,
    );
    assert.equal(readFileSync(join(root, '.ai/setup-manifest.json'), 'utf8'), originalManifest);
    assert.match(run(['quickstart']).stdout, /already complete/);
  }));

test('quickstart resumes an interrupted journal and detects conflicts before resuming', () =>
  fixture((root, run) => {
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

test('quickstart from a nested package changes only the repository-root setup', () =>
  fixture((root, run) => {
    const nested = join(root, 'packages/app');
    mkdirSync(nested, { recursive: true });
    writeFileSync(join(nested, 'AGENTS.md'), '# Package-specific rules\n');
    const applied = spawnSync(process.execPath, [cli, 'quickstart'], {
      cwd: nested,
      input: 'apply\n',
      encoding: 'utf8',
      timeout: 15000,
    });
    assert.equal(applied.status, 0, applied.stderr);
    assert.match(applied.stdout, /Workspace detected/);
    assert.equal(existsSync(join(nested, '.ai')), false);
    assert.equal(readFileSync(join(nested, 'AGENTS.md'), 'utf8'), '# Package-specific rules\n');
    assert.match(run(['quickstart']).stdout, /already complete/);
  }));

test('interactive minimal installs safety and optional onboarding without engineering modules', () =>
  fixture((root, run) => {
    const skill = join(root, '.agents/skills/guided-project-onboarding/SKILL.md');
    const rules = join(root, 'AGENTS.md');
    const original = readFileSync(rules, 'utf8');
    const result = run(['setup'], 'minimal\nyes\napply\n');
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.match(/Type apply/g)?.length, 1);
    assert.ok(existsSync(skill));
    assert.ok(readFileSync(rules, 'utf8').startsWith(original));
    assert.match(readFileSync(rules, 'utf8'), /Get explicit approval before writes/);
    assert.equal(existsSync(join(root, '.ai/rules/engineering-git.md')), false);
    assert.equal(existsSync(join(root, '.ai/rules/full/README.md')), false);
    assert.match(run(['setup', '--preset=minimal', '--onboarding']).stdout, /already complete/);
  }));

test('setup quickstart can omit onboarding, while legacy quickstart still installs it', () =>
  fixture((root, run) => {
    const skill = join(root, '.claude/skills/guided-project-onboarding/SKILL.md');
    const result = run(['setup', '--preset=quickstart', '--no-onboarding'], 'apply\n');
    assert.equal(result.status, 0, result.stderr);
    assert.equal(existsSync(skill), false);
    assert.ok(existsSync(join(root, '.ai/rules/engineering-git.md')));
    assert.equal(run(['quickstart'], 'apply\n').status, 0);
    assert.ok(existsSync(skill));
  }));

test('Full upgrades Quickstart with one reversible rule section and retains customizations', () =>
  fixture((root, run) => {
    assert.equal(run(['quickstart'], 'apply\n').status, 0);
    const agent = join(root, 'AGENTS.md');
    const original = readFileSync(agent, 'utf8');
    const custom = join(root, '.ai/rules/engineering-git.md');
    writeFileSync(custom, '# Custom Git conventions\n');
    const full = join(root, '.ai/rules/full/README.md');
    assert.equal(run(['full', '--dry-run'], 'apply\n').status, 0);
    assert.equal(run(['full'], 'no\n').status, 0);
    assert.equal(existsSync(full), false);
    assert.equal(readFileSync(agent, 'utf8'), original);
    const applied = run(['full'], 'apply\n');
    assert.equal(applied.status, 0, applied.stderr);
    assert.ok(existsSync(full));
    assert.ok(existsSync(join(root, '.ai/workflows/risky-change.md')));
    const active = readFileSync(agent, 'utf8');
    assert.match(active, /\.ai\/rules\/full\/README\.md/);
    assert.match(active, /engineering-git\.md/);
    assert.doesNotMatch(active, /engineering-testing\.md/);
    assert.equal(active.match(/<!-- ai-workflow-kit:engineering-rules -->/g)?.length, 1);
    assert.match(run(['full']).stdout, /already complete/);
    assert.match(run(['quickstart']).stdout, /already complete/);
    const id = applied.stdout.match(/Backup ID: ([\da-f-]+)/)?.[1];
    assert.ok(id);
    const undone = run(['rollback', id], 'apply\n');
    assert.equal(undone.status, 0, undone.stderr);
    assert.equal(readFileSync(agent, 'utf8'), original);
    assert.equal(readFileSync(custom, 'utf8'), '# Custom Git conventions\n');
    assert.equal(existsSync(full), false);
  }));

test('Full preserves conflicting project workflows and applies no other changes', () =>
  fixture((root, run) => {
    mkdirSync(join(root, '.ai/workflows'), { recursive: true });
    const workflow = join(root, '.ai/workflows/feature.md');
    writeFileSync(workflow, '# Our feature workflow\n');
    const prior = readFileSync(join(root, 'AGENTS.md'), 'utf8');
    const result = run(['full', '--onboarding'], 'apply\n');
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Existing Full Engineering file differs/);
    assert.equal(readFileSync(workflow, 'utf8'), '# Our feature workflow\n');
    assert.equal(readFileSync(join(root, 'AGENTS.md'), 'utf8'), prior);
    assert.equal(existsSync(join(root, '.agents/skills')), false);
  }));

test('Full runs on a fresh project and resumes from a saved journal', () =>
  fixture((root, run) => {
    rmSync(join(root, '.ai'), { recursive: true });
    const result = run(['full', '--onboarding'], 'apply\n');
    assert.equal(result.status, 0, result.stderr);
    const id = result.stdout.match(/Backup ID: ([\da-f-]+)/)?.[1];
    assert.ok(id);
    const backups = join(root, '.ai/update-backups');
    const pending = join(backups, '.pending.json');
    writeFileSync(pending, readFileSync(join(backups, id + '.json'), 'utf8'));
    const path = join(root, '.ai/workflows/debugging.md');
    rmSync(path);
    const preview = run(['setup', '--dry-run'], 'apply\n');
    assert.equal(preview.status, 0, preview.stderr);
    assert.match(preview.stdout, /Resume/);
    assert.equal(existsSync(path), false);
    const resumed = run(['setup'], 'apply\n');
    assert.equal(resumed.status, 0, resumed.stderr);
    assert.ok(existsSync(path));
    assert.equal(existsSync(pending), false);
    assert.match(resumed.stdout, /guided-project-onboarding/);
  }));

test('Full customized modules survive repeats and rollback refuses later edits', () =>
  fixture((root, run) => {
    const applied = run(['full'], 'apply\n');
    assert.equal(applied.status, 0, applied.stderr);
    const path = join(root, '.ai/rules/full/engineering.md');
    writeFileSync(
      path,
      readFileSync(path, 'utf8') + '\nProject-specific architecture exception.\n',
    );
    assert.match(run(['full']).stdout, /already complete/);
    const id = applied.stdout.match(/Backup ID: ([\da-f-]+)/)?.[1];
    assert.ok(id);
    assert.equal(run(['rollback', id], 'apply\n').status, 1);
    assert.match(readFileSync(path, 'utf8'), /Project-specific architecture exception/);
  }));

test('Full respects nested Claude entry points and includes all module links', () =>
  fixture((root, run) => {
    const prior = '# Existing nested Claude instructions\n';
    rmSync(join(root, '.ai'), { recursive: true });
    rmSync(join(root, 'CLAUDE.md'));
    mkdirSync(join(root, '.claude'), { recursive: true });
    writeFileSync(join(root, '.claude/CLAUDE.md'), prior);
    const applied = run(['full', '--onboarding'], 'apply\n');
    assert.equal(applied.status, 0, applied.stderr);
    assert.equal(existsSync(join(root, 'CLAUDE.md')), false);
    assert.ok(readFileSync(join(root, '.claude/CLAUDE.md'), 'utf8').startsWith(prior));
    assert.match(
      readFileSync(join(root, '.claude/CLAUDE.md'), 'utf8'),
      /@\.\.\/\.ai\/rules\/full\/README\.md/,
    );
    const index = readFileSync(join(root, '.ai/rules/full/README.md'), 'utf8');
    assert.match(index, /behavior\.md/);
    assert.match(index, /risky-change\.md/);
  }));
