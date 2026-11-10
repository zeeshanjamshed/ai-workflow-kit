import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const cli = fileURLToPath(new URL('../src/main.ts', import.meta.url));

function snapshot(root: string): unknown[] {
  return readdirSync(root, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).map(entry => {
    const path = join(root, entry.name);
    return [entry.name, entry.isDirectory() ? snapshot(path) : readFileSync(path)];
  });
}

function fixture(run: (root: string, project: string) => void) {
  const root = mkdtempSync(join(tmpdir(), 'ai-setup-'));
  const project = join(root, 'project');
  mkdirSync(project);
  try {
    run(root, project);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function cliRun(cwd: string, args: string[], env = process.env) {
  return spawnSync(process.execPath, [cli, ...args], { cwd, env, encoding: 'utf8', timeout: 15000 });
}

test('starter discovery and unsupported write commands leave the fixture unchanged', () => fixture((root, project) => {
  const before = snapshot(root);
  const result = cliRun(project, ['init', '--dry-run']);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.project.classification, 'starter');
  assert.equal(report.files[0].action, 'candidate-add');
  assert.equal(cliRun(project, ['init']).status, 2);
  assert.equal(cliRun(project, ['update']).status, 2);
  assert.deepEqual(snapshot(root), before);
}));

test('doctor reports malformed setup and missing local links without writing', () => fixture((root, project) => {
  mkdirSync(join(project, '.ai'));
  writeFileSync(join(project, '.ai', 'setup-manifest.json'), '{');
  writeFileSync(join(project, 'AGENTS.md'), '[Missing](missing.md) [External](https://example.invalid/x.md)\n');
  const before = snapshot(root);
  const result = cliRun(project, ['doctor']);
  assert.equal(result.status, 1, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.project.classification, 'initialized');
  assert.ok(report.findings.some((item: string) => item.includes('Manifest')));
  assert.ok(report.findings.some((item: string) => item.includes('missing.md')));
  assert.ok(report.findings.every((item: string) => !item.includes('example.invalid')));
  assert.deepEqual(snapshot(root), before);
}));

test('nested Git discovery reads metadata without rewriting Git or running configured helpers', () => fixture((root, project) => {
  const git = (...args: string[]) => {
    const result = spawnSync('git', args, { cwd: project, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  };
  git('init', '-b', 'main');
  mkdirSync(join(project, 'packages'));
  writeFileSync(join(project, 'package.json'), JSON.stringify({ workspaces: ['packages/*'], dependencies: { react: '^19.0.0' } }));
  writeFileSync(join(project, 'README.md'), 'before\n');
  writeFileSync(join(project, '.gitattributes'), 'README.md filter=probe\n');
  writeFileSync(join(project, '.gitignore'), '.ai/\n');
  git('add', '.');
  const probe = join(root, 'probe.cjs');
  const sentinel = join(root, 'helper-ran');
  writeFileSync(probe, `require('node:fs').writeFileSync(${JSON.stringify(sentinel)}, 'ran');`);
  const helper = `"${process.execPath.replaceAll('\\', '/')}" "${probe.replaceAll('\\', '/')}"`;
  git('config', 'filter.probe.clean', helper);
  git('config', 'core.fsmonitor', helper);
  writeFileSync(join(project, 'README.md'), 'changed content\n');
  const before = snapshot(root);
  for (const args of [['doctor'], ['init', '--dry-run']]) {
    const result = cliRun(join(project, 'packages'), args);
    assert.equal(result.status, 0, result.stderr);
    const { project: info } = JSON.parse(result.stdout);
    assert.equal(info.git.branch, 'main');
    assert.equal(info.git.dirty, true);
    assert.equal(info.git.aiIgnored, true);
    assert.equal(info.packageWorkspaces, true);
    assert.equal(info.frameworks.react, '^19.0.0');
    assert.deepEqual(snapshot(root), before);
  }
}));

test('commands work offline with process and network APIs denied', () => fixture((root, project) => {
  const before = snapshot(root);
  for (const args of [['doctor'], ['init', '--dry-run']]) {
    const result = cliRun(project, args, {
      ...process.env, PATH: '',
      NODE_OPTIONS: '--permission --allow-fs-read=*',
    });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(snapshot(root), before);
  }
}));
