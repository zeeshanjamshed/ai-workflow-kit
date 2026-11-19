import assert from 'node:assert/strict';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import { bundledVersions, frozenTemplates, snapshot, assetGroups } from '../src/bundles.ts';
import { packageRoot, version } from '../src/metadata.ts';
import { templates, validateChoices } from '../src/initialize.ts';
import { parseOptions } from '../src/arguments.ts';

test('all frozen template variants and assets retain their exact historical contents', () => {
  for (const release of bundledVersions) {
    const frozen = snapshot(release);
    assert.equal(Object.keys(frozen.templates).length, 48);
    for (const key of Object.keys(frozen.templates)) {
      const [policy, agents] = JSON.parse(key);
      const choices = validateChoices(policy, agents);
      assert.deepEqual(
        templates({ ...choices, version: release }),
        frozenTemplates(release, choices),
      );
    }
    for (const [id, entries] of assetGroups(release)) {
      assert.deepEqual(
        entries,
        frozen.groups[id].map(({ path, hash }) => ({ path, content: frozen.contents[hash] })),
      );
    }
  }
});

test('one option grammar accepts flag order and rejects unknown or duplicate options', () => {
  const a = parseOptions('init', ['--tracking=mixed', '--agents', 'codex', '--dry-run']);
  const b = parseOptions('init', ['--dry-run', '--agents=codex', '--tracking', 'mixed']);
  assert.deepEqual({ ...a.values }, { ...b.values });
  assert.throws(() => parseOptions('init', ['--dry-run', '--dry-run']), /Duplicate/);
  assert.throws(
    () => parseOptions('init', ['--tracking=mixed', '--tracking=tracked']),
    /Duplicate/,
  );
  assert.throws(() => parseOptions('init', ['--unknown']), /Unknown option/);
  assert.throws(() => parseOptions('init', ['--tracking']), /argument missing/);
  assert.equal(parseOptions('update', ['--version=1.2.3-rc.1']).values.version, '1.2.3-rc.1');
});

async function fixture(
  check: (
    root: string,
    invoke: (
      script: string,
      args?: string[],
      env?: NodeJS.ProcessEnv,
    ) => ReturnType<typeof spawnSync>,
  ) => void | Promise<void>,
) {
  const root = mkdtempSync(join(tmpdir(), 'ai-maintainer-'));
  try {
    cpSync(join(packageRoot, 'node_modules/semver'), join(root, 'node_modules/semver'), {
      recursive: true,
    });
    for (const item of [
      'packages/cli/src',
      'scripts',
      'assets',
      'package.json',
      'package-lock.json',
      '.gitignore',
      'CHANGELOG.md',
    ])
      cpSync(join(packageRoot, item), join(root, item), { recursive: true });
    const npmCli =
      process.env.npm_execpath ??
      join(
        dirname(process.execPath),
        process.platform === 'win32'
          ? 'node_modules/npm/bin/npm-cli.js'
          : '../lib/node_modules/npm/bin/npm-cli.js',
      );
    const invoke = (script: string, args: string[] = [], env: NodeJS.ProcessEnv = {}) =>
      spawnSync(process.execPath, [join(root, 'scripts', script), ...args], {
        cwd: root,
        encoding: 'utf8',
        timeout: 20000,
        env: {
          ...process.env,
          npm_execpath: npmCli,
          GITHUB_ACTIONS: 'false',
          EXPECTED_VERSION: '',
          EXPECTED_COMMIT: '',
          EXPECTED_SHA256: '',
          ...env,
        },
      });
    await check(root, invoke);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('asset freeze refuses to rewrite an old baseline after a rule edit', () =>
  fixture((root, invoke) => {
    const frozen = readFileSync(join(root, 'assets/releases', version + '.json'), 'utf8');
    writeFileSync(join(root, 'assets/current/rules/full/behavior.md'), '# Changed rules\n');
    const result = invoke('assets.mjs', ['freeze']);
    assert.equal(result.status, 1);
    assert.match(String(result.stderr), /never overwrite a historical baseline/);
    assert.equal(readFileSync(join(root, 'assets/releases', version + '.json'), 'utf8'), frozen);
  }));

test('release preparation versions metadata and notes without creating commits or tags', () =>
  fixture((root, invoke) => {
    const git = (args: string[]) => {
      const result = spawnSync('git', args, {
        cwd: root,
        encoding: 'utf8',
        env: {
          ...process.env,
          GIT_CONFIG_NOSYSTEM: '1',
          GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null',
        },
      });
      assert.equal(result.status, 0, result.stderr);
      return result.stdout.trim();
    };
    git(['init', '-b', 'main']);
    git(['add', '.']);
    git([
      '-c',
      'commit.gpgsign=false',
      '-c',
      'user.name=Fixture',
      '-c',
      'user.email=fixture@example.invalid',
      'commit',
      '-m',
      'Fixture',
    ]);
    const head = git(['rev-parse', 'HEAD']);
    const before = readFileSync(join(root, 'assets/releases', version + '.json'), 'utf8');
    const collision = invoke('release-prepare.mjs', ['0.4.4', '--notes', 'Fixture release']);
    assert.equal(collision.status, 1);
    assert.equal(JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version, version);
    const prepared = invoke('release-prepare.mjs', [
      'patch',
      '--notes',
      'Add a reviewed project rule.',
    ]);
    assert.equal(prepared.status, 0, String(prepared.stderr));
    const next = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
    assert.notEqual(next, version);
    assert.equal(JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8')).version, next);
    assert.ok(existsSync(join(root, 'assets/releases', next + '.json')));
    assert.equal(readFileSync(join(root, 'assets/releases', version + '.json'), 'utf8'), before);
    assert.match(readFileSync(join(root, 'CHANGELOG.md'), 'utf8'), /Add a reviewed project rule/);
    assert.equal(invoke('assets.mjs', ['check']).status, 0);
    assert.equal(git(['rev-parse', 'HEAD']), head);
    assert.equal(git(['tag', '--list']), '');
    const repeated = invoke('release-prepare.mjs', [
      'patch',
      '--notes',
      'Must refuse a dirty tree.',
    ]);
    assert.equal(repeated.status, 1);
    assert.match(String(repeated.stderr), /Review and commit current work/);
  }));

test('artifact identity checks detect tampering and publication fails closed outside approval', () =>
  fixture((root, invoke) => {
    const directory = join(root, 'release');
    mkdirSync(directory);
    const bytes = Buffer.from('fixture payload');
    const filename = `zeeshanjamshed-ai-workflow-kit-${version}.tgz`;
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const commit = 'a'.repeat(40);
    writeFileSync(join(directory, filename), bytes);
    writeFileSync(
      join(directory, 'artifact.json'),
      JSON.stringify({
        package: '@zeeshanjamshed/ai-workflow-kit',
        version,
        filename,
        commit,
        dirty: false,
        sha256,
        integrity: 'sha512-' + createHash('sha512').update(bytes).digest('base64'),
      }),
    );
    const expected = {
      EXPECTED_VERSION: version,
      EXPECTED_COMMIT: commit,
      EXPECTED_SHA256: sha256,
      GITHUB_ACTIONS: 'true',
    };
    assert.equal(invoke('release-check.mjs', [], expected).status, 0);
    writeFileSync(join(directory, filename), 'tampered');
    assert.match(
      String(invoke('release-check.mjs', [], expected).stderr),
      /checksum does not match/,
    );
    assert.match(String(invoke('release-publish.mjs').stderr), /Publishing is disabled/);
    assert.equal(readFileSync(join(directory, filename), 'utf8'), 'tampered');
  }));
