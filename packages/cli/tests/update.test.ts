import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { templates, version } from '../src/initialize.ts';

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
    put(root, manifest, JSON.stringify({
      owner: 'ai-workflow-kit', version: installed, tracking: 'tracked', adapters: ['codex'],
      preserved: [], files: Object.fromEntries(entries.map(({ path, content }) =>
        [path, { sha256: createHash('sha256').update(content).digest('hex') }])),
    }, null, 2) + '\n');
    check(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function put(root: string, path: string, content: string) { writeFileSync(join(root, path), content); }
function read(root: string, path: string) { return readFileSync(join(root, path), 'utf8'); }
function run(root: string, args: string[], input = 'apply\n') {
  return spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8', input, timeout: 15000 });
}
function backupId(output: string) {
  const match = /Backup ID: ([a-f\d-]{36})/.exec(output);
  assert.ok(match, output);
  return match[1];
}

test('release version and npm version agree', () => {
  assert.equal(JSON.parse(readFileSync(new URL('../../../package.json', import.meta.url), 'utf8')).version, version);
});

test('three-way update replaces only unchanged kit files and keeps local rules and knowledge', () => fixture(root => {
  put(root, permissions, 'local rule\n');
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
  assert.equal(read(root, permissions), 'local rule\n');
  assert.equal(read(root, '.ai/knowledge/domain.md'), 'local knowledge\n');
  assert.equal(JSON.parse(read(root, manifest)).version, version);
  const rollback = run(root, ['rollback', id]);
  assert.equal(rollback.status, 0, rollback.stderr);
  assert.equal(read(root, index), original);
  assert.equal(JSON.parse(read(root, manifest)).version, '0.2.0');
}));

test('divergent changes block the entire update without creating a backup', () => fixture(root => {
  put(root, index, 'locally changed index\n');
  const result = run(root, ['update']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Resolve conflicts/);
  assert.equal(read(root, index), 'locally changed index\n');
  assert.equal(existsSync(join(root, backups)), false);
}));

test('a pinned version stays installed until an approved unpin', () => fixture(root => {
  assert.equal(run(root, ['pin', '0.2.0']).status, 0);
  assert.equal(run(root, ['update', '--version=' + version]).status, 1);
  assert.equal(run(root, ['update']).status, 0);
  assert.equal(JSON.parse(read(root, manifest)).version, '0.2.0');
  assert.equal(run(root, ['pin', 'none']).status, 0);
  assert.equal(run(root, ['update']).status, 0);
  assert.equal(JSON.parse(read(root, manifest)).version, version);
}));

test('repair restores only missing managed paths and rollback refuses subsequent edits', () => fixture(root => {
  rmSync(join(root, permissions));
  const result = run(root, ['repair']);
  assert.equal(result.status, 0, result.stderr);
  const id = backupId(result.stdout);
  assert.match(read(root, permissions), /explicit approval/);
  put(root, permissions, 'edited after repair\n');
  assert.equal(run(root, ['rollback', id]).status, 1);
  assert.equal(read(root, permissions), 'edited after repair\n');
}));

test('partly applied transaction resumes from its approved backup', () => fixture(root => {
  const preview = JSON.parse(run(root, ['update', '--dry-run']).stdout);
  const id = randomUUID();
  mkdirSync(join(root, backups));
  put(root, backups + '/.pending.json', JSON.stringify({ id, action: 'update', edits: preview.edits }, null, 2) + '\n');
  put(root, preview.edits[0].path, preview.edits[0].after);
  const resumed = run(root, ['update']);
  assert.equal(resumed.status, 0, resumed.stderr);
  assert.equal(backupId(resumed.stdout), id);
  assert.ok(readdirSync(join(root, backups)).includes(id + '.json'));
  assert.equal(existsSync(join(root, backups, '.pending.json')), false);
  assert.equal(JSON.parse(read(root, manifest)).version, version);
}));

test('an unrecognized journal cannot write outside managed paths', () => fixture(root => {
  mkdirSync(join(root, backups));
  put(root, backups + '/.pending.json', JSON.stringify({
    id: randomUUID(), action: 'update', edits: [{ path: '../sentinel', before: null, after: 'bad' }],
  }));
  const result = run(root, ['update']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /unmanaged file/);
}));

test('a Phase 4 baseline upgrades using the bundled original contents', () => fixture(root => {
  const result = run(root, ['update']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(read(root, index), /Preview kit updates/);
  assert.equal(JSON.parse(read(root, manifest)).version, version);
}, '0.1.0'));
