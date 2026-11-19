import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { templates, version } from '../src/initialize.ts';
import { assetEntries } from '../src/asset-baselines.ts';

const cli = fileURLToPath(new URL('../src/main.ts', import.meta.url));
const manifest = '.ai/setup-manifest.json';
const backups = '.ai/update-backups';
const permissions = '.ai/rules/permissions.md';
const index = '.ai/README.md';

function fixture(check: (root: string) => void, installed = '0.2.0') {
  const root = mkdtempSync(join(tmpdir(), 'ai-update-'));
  try {
    const entries = templates({ policy: 'tracked', agents: ['codex'], version: installed });
    for (const { path, content } of entries) {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), content);
    }
    put(
      root,
      manifest,
      JSON.stringify(
        {
          owner: 'ai-workflow-kit',
          version: installed,
          tracking: 'tracked',
          adapters: ['codex'],
          preserved: [],
          files: Object.fromEntries(
            entries.map(({ path, content }) => [
              path,
              { sha256: createHash('sha256').update(content).digest('hex') },
            ]),
          ),
        },
        null,
        2,
      ) + '\n',
    );
    check(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function put(root: string, path: string, content: string) {
  writeFileSync(join(root, path), content);
}
function read(root: string, path: string) {
  return readFileSync(join(root, path), 'utf8');
}
function run(root: string, args: string[], input = 'apply\n') {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: root,
    encoding: 'utf8',
    input,
    timeout: 15000,
  });
}
function backupId(output: string) {
  const match = /Backup ID: ([a-f\d-]{36})/.exec(output);
  assert.ok(match, output);
  return match[1];
}

test('release version and npm version agree', () => {
  assert.equal(
    JSON.parse(readFileSync(new URL('../../../package.json', import.meta.url), 'utf8')).version,
    version,
  );
});

test('three-way update replaces unchanged kit files and keeps project rules and knowledge', () =>
  fixture((root) => {
    put(root, '.ai/rules/project.md', 'local rule\n');
    mkdirSync(join(root, '.ai/knowledge'));
    put(root, '.ai/knowledge/domain.md', 'local knowledge\n');
    const original = read(root, index);
    const dry = run(root, ['update', '--dry-run']);
    assert.equal(dry.status, 0, dry.stderr);
    assert.equal(JSON.parse(dry.stdout).bundle, version);
    assert.equal(run(root, ['update'], 'no\n').status, 0);
    assert.equal(read(root, index), original);
    assert.equal(existsSync(join(root, backups)), false);
    const applied = run(root, ['update']);
    assert.equal(applied.status, 0, applied.stderr);
    const id = backupId(applied.stdout);
    assert.match(read(root, index), /Preview kit updates/);
    assert.equal(read(root, '.ai/rules/project.md'), 'local rule\n');
    assert.equal(read(root, '.ai/knowledge/domain.md'), 'local knowledge\n');
    assert.equal(JSON.parse(read(root, manifest)).version, version);
    const rollback = run(root, ['rollback', id]);
    assert.equal(rollback.status, 0, rollback.stderr);
    assert.equal(read(root, index), original);
    assert.equal(JSON.parse(read(root, manifest)).version, '0.2.0');
  }));

test('divergent changes block the entire update without creating a backup', () =>
  fixture((root) => {
    put(root, index, 'locally changed index\n');
    const result = run(root, ['update']);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Resolve conflicts/);
    assert.equal(read(root, index), 'locally changed index\n');
    assert.equal(existsSync(join(root, backups)), false);
  }));

test('a pinned version stays installed until an approved unpin', () =>
  fixture((root) => {
    assert.equal(run(root, ['pin', '0.2.0']).status, 0);
    assert.equal(run(root, ['update', '--version=' + version]).status, 1);
    assert.equal(run(root, ['update']).status, 0);
    assert.equal(JSON.parse(read(root, manifest)).version, '0.2.0');
    assert.equal(run(root, ['pin', 'none']).status, 0);
    assert.equal(run(root, ['update']).status, 0);
    assert.equal(JSON.parse(read(root, manifest)).version, version);
  }));

test('repair restores only missing managed paths and rollback refuses subsequent edits', () =>
  fixture((root) => {
    rmSync(join(root, permissions));
    const result = run(root, ['repair']);
    assert.equal(result.status, 0, result.stderr);
    const id = backupId(result.stdout);
    assert.match(read(root, permissions), /explicit approval/);
    put(root, permissions, 'edited after repair\n');
    assert.equal(run(root, ['rollback', id]).status, 1);
    assert.equal(read(root, permissions), 'edited after repair\n');
  }));

test('partly applied transaction resumes from its approved backup', () =>
  fixture((root) => {
    const preview = JSON.parse(run(root, ['update', '--dry-run']).stdout);
    const id = randomUUID();
    mkdirSync(join(root, backups));
    put(
      root,
      backups + '/.pending.json',
      JSON.stringify({ id, action: 'update', edits: preview.edits }, null, 2) + '\n',
    );
    put(root, preview.edits[0].path, preview.edits[0].after);
    const resumed = run(root, ['update']);
    assert.equal(resumed.status, 0, resumed.stderr);
    assert.equal(backupId(resumed.stdout), id);
    assert.ok(readdirSync(join(root, backups)).includes(id + '.json'));
    assert.equal(existsSync(join(root, backups, '.pending.json')), false);
    assert.equal(JSON.parse(read(root, manifest)).version, version);
  }));

test('an unrecognized journal cannot write outside managed paths', () =>
  fixture((root) => {
    mkdirSync(join(root, backups));
    put(
      root,
      backups + '/.pending.json',
      JSON.stringify({
        id: randomUUID(),
        action: 'update',
        edits: [{ path: '../sentinel', before: null, after: 'bad' }],
      }),
    );
    const result = run(root, ['update']);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /unmanaged file/);
  }));

test('a Phase 4 baseline upgrades using the bundled original contents', () =>
  fixture((root) => {
    const result = run(root, ['update']);
    assert.equal(result.status, 0, result.stderr);
    assert.match(read(root, index), /Preview kit updates/);
    assert.equal(JSON.parse(read(root, manifest)).version, version);
  }, '0.1.0'));

function addAssets(root: string, installed: string, managed = false) {
  const state = JSON.parse(read(root, manifest));
  for (const { path, content } of assetEntries(installed)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    put(root, path, content);
    if (managed) state.files[path] = { sha256: createHash('sha256').update(content).digest('hex') };
  }
  if (managed) put(root, manifest, JSON.stringify(state, null, 2) + '\n');
}

test('legacy stock rules and skills enroll and update while custom rules and knowledge survive', () =>
  fixture((root) => {
    addAssets(root, '0.4.3');
    const custom = '.ai/rules/full/engineering.md';
    put(root, custom, '# My project architecture\nKeep this.\n');
    mkdirSync(join(root, '.ai/knowledge'));
    put(root, '.ai/knowledge/domain.md', 'Do not lose this knowledge.\n');
    const originalManifest = read(root, manifest);
    const behavior = '.ai/rules/full/behavior.md';
    const originalBehavior = read(root, behavior);
    const skill = '.agents/skills/guided-project-onboarding/SKILL.md';
    const originalSkill = read(root, skill);
    const preview = run(root, ['update', '--dry-run']);
    assert.equal(preview.status, 0, preview.stderr);
    assert.match(preview.stdout, /preserve-project-owned/);
    assert.equal(read(root, manifest), originalManifest);
    assert.equal(run(root, ['update'], 'no\n').status, 0);
    assert.equal(read(root, skill), originalSkill);
    const applied = run(root, ['update']);
    assert.equal(applied.status, 0, applied.stderr);
    const state = JSON.parse(read(root, manifest));
    assert.ok(state.files[behavior]);
    assert.ok(state.files[skill]);
    assert.ok(!state.files[custom]);
    assert.ok(state.projectOwned.includes(custom));
    assert.match(read(root, behavior), /small task/);
    assert.match(read(root, skill), /recoverable originals/);
    assert.equal(read(root, custom), '# My project architecture\nKeep this.\n');
    assert.equal(read(root, '.ai/knowledge/domain.md'), 'Do not lose this knowledge.\n');
    assert.equal(JSON.parse(run(root, ['update', '--dry-run']).stdout).edits.length, 0);
    const reversed = run(root, ['rollback', backupId(applied.stdout)]);
    assert.equal(reversed.status, 0, reversed.stderr);
    assert.equal(read(root, manifest), originalManifest);
    assert.equal(read(root, behavior), originalBehavior);
    assert.equal(read(root, skill), originalSkill);
  }, '0.4.3'));

test('managed assets stop the entire update when local and central changes diverge', () =>
  fixture((root) => {
    addAssets(root, '0.4.3', true);
    const path = '.ai/rules/full/behavior.md';
    put(root, path, 'Local approval exception\n');
    const before = read(root, manifest);
    const result = run(root, ['update']);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Resolve conflicts/);
    assert.equal(read(root, path), 'Local approval exception\n');
    assert.equal(read(root, manifest), before);
    assert.equal(existsSync(join(root, backups)), false);
  }, '0.4.3'));

test('new Full setup manages rules and skills and repair restores only missing assets', () =>
  fixture((root) => {
    const result = run(root, ['full', '--onboarding']);
    assert.equal(result.status, 0, result.stderr);
    // Existing initialized projects enroll optional files through update.
    const enrolled = run(root, ['update']);
    assert.equal(enrolled.status, 0, enrolled.stderr);
    const skill = '.agents/skills/guided-project-onboarding/SKILL.md';
    const behavior = '.ai/rules/full/behavior.md';
    assert.ok(JSON.parse(read(root, manifest)).files[skill]);
    put(root, behavior, 'Local behavior\n');
    assert.equal(run(root, ['update']).status, 0);
    assert.equal(read(root, behavior), 'Local behavior\n');
    const original = read(root, skill);
    rmSync(join(root, skill));
    assert.equal(run(root, ['update']).status, 1);
    const repaired = run(root, ['repair']);
    assert.equal(repaired.status, 0, repaired.stderr);
    assert.equal(read(root, skill), original);
    assert.equal(read(root, behavior), 'Local behavior\n');
    assert.equal(run(root, ['rollback', backupId(repaired.stdout)]).status, 0);
    assert.equal(existsSync(join(root, skill)), false);
  }, version));

test('pinned old setups do not adopt or replace optional assets', () =>
  fixture((root) => {
    addAssets(root, '0.4.3');
    assert.equal(run(root, ['pin', '0.4.3']).status, 0);
    const before = read(root, manifest);
    const behavior = read(root, '.ai/rules/full/behavior.md');
    assert.equal(run(root, ['update']).status, 0);
    assert.equal(read(root, manifest), before);
    assert.equal(read(root, '.ai/rules/full/behavior.md'), behavior);
  }, '0.4.3'));

test('asset enrollment resumes after partial writes and rejects changed preserved inputs', () =>
  fixture((root) => {
    addAssets(root, '0.4.3');
    const custom = '.ai/rules/full/engineering.md';
    put(root, custom, 'Custom rules\n');
    const preview = JSON.parse(run(root, ['update', '--dry-run']).stdout);
    const id = randomUUID();
    const source =
      JSON.stringify(
        {
          id,
          action: 'update',
          edits: preview.edits,
          inputs: { [custom]: createHash('sha256').update('Custom rules\n').digest('hex') },
        },
        null,
        2,
      ) + '\n';
    mkdirSync(join(root, backups));
    put(root, backups + '/.pending.json', source);
    put(root, preview.edits[0].path, preview.edits[0].after);
    put(root, custom, 'Changed while paused\n');
    assert.match(run(root, ['update']).stderr, /Setup input changed/);
    put(root, custom, 'Custom rules\n');
    const resumed = run(root, ['update']);
    assert.equal(resumed.status, 0, resumed.stderr);
    assert.equal(backupId(resumed.stdout), id);
    assert.equal(existsSync(join(root, backups, '.pending.json')), false);
    assert.equal(JSON.parse(read(root, manifest)).version, version);
  }, '0.4.3'));

test('a journal cannot enroll knowledge or use unknown asset content', () =>
  fixture((root) => {
    const before = read(root, manifest);
    const next = JSON.parse(before);
    next.files['.ai/knowledge/domain.md'] = {
      sha256: createHash('sha256').update('forged\n').digest('hex'),
    };
    mkdirSync(join(root, backups));
    put(
      root,
      backups + '/.pending.json',
      JSON.stringify({
        id: randomUUID(),
        action: 'update',
        edits: [
          { path: '.ai/knowledge/domain.md', before: null, after: 'forged\n' },
          { path: manifest, before, after: JSON.stringify(next, null, 2) + '\n' },
        ],
      }),
    );
    assert.match(run(root, ['update']).stderr, /Unrecognized baseline/);
    assert.equal(existsSync(join(root, '.ai/knowledge/domain.md')), false);
    delete next.files['.ai/knowledge/domain.md'];
    const skill = '.agents/skills/guided-project-onboarding/SKILL.md';
    next.files[skill] = { sha256: createHash('sha256').update('forged\n').digest('hex') };
    put(
      root,
      backups + '/.pending.json',
      JSON.stringify({
        id: randomUUID(),
        action: 'update',
        edits: [
          { path: skill, before: null, after: 'forged\n' },
          { path: manifest, before, after: JSON.stringify(next, null, 2) + '\n' },
        ],
      }),
    );
    assert.match(run(root, ['update']).stderr, /Unrecognized baseline/);
    assert.equal(existsSync(join(root, skill)), false);
  }, version));

test('fresh Full setup records managed assets immediately and respects omitted skills', () =>
  fixture((root) => {
    rmSync(join(root, '.ai'), { recursive: true });
    rmSync(join(root, 'AGENTS.md'));
    const result = run(root, ['full']);
    assert.equal(result.status, 0, result.stderr);
    const state = JSON.parse(read(root, manifest));
    assert.ok(state.files['.ai/rules/full/behavior.md']);
    assert.ok(state.components.includes('full'));
    assert.ok(!state.components.includes('skill:codex'));
    const updated = run(root, ['update', '--dry-run']);
    assert.equal(updated.status, 0, updated.stderr);
    assert.equal(JSON.parse(updated.stdout).edits.length, 0);
    assert.equal(
      existsSync(join(root, '.agents/skills/guided-project-onboarding/SKILL.md')),
      false,
    );
  }, version));

test('ordinary project workflows do not cause Full rules to be installed by update', () =>
  fixture((root) => {
    mkdirSync(join(root, '.ai/workflows'));
    put(root, '.ai/workflows/feature.md', '# Project workflow\n');
    assert.equal(run(root, ['update']).status, 0);
    assert.equal(existsSync(join(root, '.ai/rules/full/README.md')), false);
    assert.equal(read(root, '.ai/workflows/feature.md'), '# Project workflow\n');
  }, '0.4.3'));

test('local-only enrollment refuses unignored skills without changing privacy or content', () =>
  fixture((root) => {
    assert.equal(spawnSync('git', ['init'], { cwd: root, encoding: 'utf8' }).status, 0);
    const state = JSON.parse(read(root, manifest));
    const entries = templates({ policy: 'local-only', agents: [], version: '0.4.3' });
    for (const { path, content } of entries) put(root, path, content);
    state.tracking = 'local-only';
    state.adapters = [];
    state.files = Object.fromEntries(
      entries.map(({ path, content }) => [
        path,
        { sha256: createHash('sha256').update(content).digest('hex') },
      ]),
    );
    put(root, manifest, JSON.stringify(state, null, 2) + '\n');
    const skill = assetEntries(version).find((entry) => entry.path.startsWith('.agents/'))!;
    mkdirSync(dirname(join(root, skill.path)), { recursive: true });
    put(root, skill.path, skill.content);
    const before = read(root, manifest);
    const result = run(root, ['update']);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Local-only updates require ignored/);
    assert.equal(read(root, manifest), before);
    assert.equal(read(root, skill.path), skill.content);
    assert.equal(existsSync(join(root, backups)), false);
  }, '0.4.3'));

test('rollback of asset enrollment refuses subsequent edits', () =>
  fixture((root) => {
    addAssets(root, '0.4.3');
    const updated = run(root, ['update']);
    assert.equal(updated.status, 0, updated.stderr);
    const skill = '.agents/skills/guided-project-onboarding/SKILL.md';
    put(root, skill, 'Edited after update\n');
    const before = read(root, manifest);
    assert.equal(run(root, ['rollback', backupId(updated.stdout)]).status, 1);
    assert.equal(read(root, skill), 'Edited after update\n');
    assert.equal(read(root, manifest), before);
  }, '0.4.3'));

test('selected Full component receives missing bundled files and rollback removes only those additions', () =>
  fixture((root) => {
    const entry = assetEntries('0.4.3').find((item) => item.path === '.ai/rules/full/README.md')!;
    mkdirSync(dirname(join(root, entry.path)), { recursive: true });
    put(root, entry.path, entry.content);
    const before = read(root, manifest);
    const result = run(root, ['update']);
    assert.equal(result.status, 0, result.stderr);
    assert.ok(existsSync(join(root, '.ai/rules/full/engineering.md')));
    assert.ok(existsSync(join(root, '.ai/workflows/review.md')));
    const reversed = run(root, ['rollback', backupId(result.stdout)]);
    assert.equal(reversed.status, 0, reversed.stderr);
    assert.equal(read(root, manifest), before);
    assert.equal(read(root, entry.path), entry.content);
    assert.equal(existsSync(join(root, '.ai/rules/full/engineering.md')), false);
    assert.equal(existsSync(join(root, '.ai/workflows/review.md')), false);
  }, '0.4.3'));

test('a legacy Full setup backup can still roll back original rule and skill contents', () =>
  fixture((root) => {
    addAssets(root, '0.4.3');
    const id = randomUUID();
    const base = templates({
      policy: 'tracked',
      agents: ['codex', 'claude', 'cursor'],
      version: '0.4.3',
    });
    for (const entry of base) {
      mkdirSync(dirname(join(root, entry.path)), { recursive: true });
      put(root, entry.path, entry.content);
    }
    const state = JSON.parse(read(root, manifest));
    state.adapters = ['codex', 'claude', 'cursor'];
    state.files = Object.fromEntries(
      base.map(({ path, content }) => [
        path,
        { sha256: createHash('sha256').update(content).digest('hex') },
      ]),
    );
    put(root, manifest, JSON.stringify(state, null, 2) + '\n');
    const entries = [...base, ...assetEntries('0.4.3')];
    const edits = entries.map((entry) => ({
      path: entry.path,
      before: null,
      after: entry.content,
    }));
    edits.push({ path: manifest, before: null, after: read(root, manifest) });
    mkdirSync(join(root, backups));
    put(root, backups + '/' + id + '.json', JSON.stringify({ id, action: 'quickstart', edits }));
    const reversed = run(root, ['rollback', id]);
    assert.equal(reversed.status, 0, reversed.stderr);
    assert.equal(existsSync(join(root, manifest)), false);
    assert.equal(existsSync(join(root, '.ai/rules/full/behavior.md')), false);
    assert.equal(
      existsSync(join(root, '.agents/skills/guided-project-onboarding/SKILL.md')),
      false,
    );
  }, '0.4.3'));

test('enrollment can finish recovery after its manifest was already written', () =>
  fixture((root) => {
    addAssets(root, '0.4.3');
    const preview = JSON.parse(run(root, ['update', '--dry-run']).stdout);
    const id = randomUUID();
    mkdirSync(join(root, backups));
    put(
      root,
      backups + '/.pending.json',
      JSON.stringify({ id, action: 'update', edits: preview.edits }, null, 2) + '\n',
    );
    for (const edit of preview.edits) {
      mkdirSync(dirname(join(root, edit.path)), { recursive: true });
      put(root, edit.path, edit.after);
    }
    const resumed = run(root, ['update']);
    assert.equal(resumed.status, 0, resumed.stderr);
    assert.equal(backupId(resumed.stdout), id);
    assert.equal(existsSync(join(root, backups, '.pending.json')), false);
  }, '0.4.3'));

test('updates refresh stock native instructions while retaining kit-generated rule activation', () =>
  fixture((root) => {
    assert.equal(run(root, ['rules', 'recommended']).status, 0);
    assert.equal(run(root, ['rules', 'activate', 'all']).status, 0);
    const before = read(root, 'AGENTS.md');
    assert.match(before, /engineering-testing/);
    const applied = run(root, ['update']);
    assert.equal(applied.status, 0, applied.stderr);
    assert.match(applied.stdout, /update-instructions-keep-rule-links/);
    assert.match(read(root, 'AGENTS.md'), /For small tasks/);
    assert.match(read(root, 'AGENTS.md'), /engineering-testing/);
    const reversed = run(root, ['rollback', backupId(applied.stdout)]);
    assert.equal(reversed.status, 0, reversed.stderr);
    assert.equal(read(root, 'AGENTS.md'), before);
  }, '0.4.4'));

test('local edits survive a version upgrade when their central asset has not changed', () =>
  fixture((root) => {
    addAssets(root, '0.4.4', true);
    const path = '.ai/rules/engineering-testing.md';
    put(root, path, '# Project-specific testing rules\n');
    const result = run(root, ['update']);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /preserve-local/);
    assert.equal(read(root, path), '# Project-specific testing rules\n');
    assert.equal(JSON.parse(read(root, manifest)).version, version);
  }, '0.4.4'));
