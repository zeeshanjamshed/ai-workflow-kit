import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { additionalPaths } from '../src/guided-init.ts';
import { agentLaunch, chooseAgentLaunch, onboardingPrompt, runAgent } from '../src/agent-launch.ts';
import { isLocalIgnoreEdit } from '../src/tracking.ts';

const cli = fileURLToPath(new URL('../src/main.ts', import.meta.url));
const manifest = '.ai/setup-manifest.json';
const full = '.ai/rules/full/behavior.md';
const skill = '.agents/skills/guided-project-onboarding/SKILL.md';
const localOptions = ['--guided', '--tracking=local-only', '--agents=codex'];
const read = (root: string, path: string) => readFileSync(join(root, path), 'utf8');
function put(root: string, path: string, content: string) {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), content);
}
function run(root: string, args: string[], input = '') {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: root,
    encoding: 'utf8',
    input,
    timeout: 15000,
  });
}
function git(root: string, args: string[]) {
  return spawnSync('git', args, { cwd: root, encoding: 'utf8' });
}
async function fixture(check: (root: string) => void | Promise<void>) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'ai-guided-')));
  try {
    await check(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('guided init previews complete defaults and requires approval before writes', () =>
  fixture((root) => {
    const result = run(root, ['init', '--dry-run']);
    assert.equal(result.status, 0, result.stderr);
    const preview = JSON.parse(result.stdout);
    assert.ok(preview.edits.some((edit: { path: string }) => edit.path === full));
    assert.ok(preview.edits.some((edit: { path: string }) => edit.path === skill));
    assert.equal(preview.tracking, 'mixed');
    assert.equal(run(root, ['init'], 'codex\nmixed\n\nno\n').status, 0);
    assert.equal(run(root, ['init']).status, 1);
    assert.deepEqual(readdirSync(root), []);
    const applied = run(root, ['init'], 'codex\nmixed\n\napply\n');
    assert.equal(applied.status, 0, applied.stderr);
    assert.equal(applied.stdout.match(/Type apply/g)?.length, 1);
    const state = JSON.parse(read(root, manifest));
    assert.deepEqual(state.adapters, ['codex']);
    assert.ok(state.files[full]);
    assert.ok(state.files[skill]);
    assert.match(read(root, 'AGENTS.md'), /full\/README.md/);
    assert.match(read(root, '.ai/rules/permissions.md'), /For small tasks/);
    assert.equal(existsSync(join(root, '.claude')), false);
    assert.match(applied.stdout, /Saving knowledge needs your approval/);
    assert.doesNotMatch(applied.stdout, /Type start/);
    const before = read(root, manifest);
    const repeated = run(root, ['init'], '\n');
    assert.equal(repeated.status, 0, repeated.stderr);
    assert.match(repeated.stdout, /already complete/);
    assert.equal(read(root, manifest), before);
    assert.equal(JSON.parse(run(root, ['update', '--dry-run']).stdout).edits.length, 0);
  }));

test('guided adoption preserves custom instructions, skills, knowledge, and extra references', () =>
  fixture((root) => {
    put(root, 'AGENTS.md', '# Our rules\nKeep approvals.\n');
    put(root, '.claude/CLAUDE.md', '# Our Claude rules\n');
    put(root, '.agents/skills/custom/SKILL.md', '# Existing skill\n');
    put(root, '.ai/knowledge/domain.md', '# Existing knowledge\n');
    put(root, '.ai/decisions/001.md', '# Existing decision\n');
    put(root, 'docs/other-ai.md', '# Extra instructions\n');
    const result = run(root, ['init'], 'claude,codex\nshared\ndocs/other-ai.md\napply\n');
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Existing AI setup found/);
    assert.match(result.stdout, /docs\/other-ai.md/);
    assert.ok(read(root, 'AGENTS.md').startsWith('# Our rules\nKeep approvals.\n'));
    assert.ok(read(root, '.claude/CLAUDE.md').startsWith('# Our Claude rules\n'));
    assert.equal(existsSync(join(root, 'CLAUDE.md')), false);
    assert.equal(read(root, '.agents/skills/custom/SKILL.md'), '# Existing skill\n');
    assert.equal(read(root, '.ai/knowledge/domain.md'), '# Existing knowledge\n');
    assert.equal(read(root, '.ai/decisions/001.md'), '# Existing decision\n');
    assert.equal(JSON.parse(read(root, manifest)).tracking, 'tracked');
    assert.throws(() => additionalPaths(root, '../outside'), /inside this project/);
  }));

test('local-only setup previews ignore changes and rolls them back without losing existing text', () =>
  fixture((root) => {
    assert.equal(git(root, ['init']).status, 0);
    put(root, '.gitignore', '/node_modules/\n');
    const preview = run(root, ['init', ...localOptions, '--dry-run']);
    assert.equal(preview.status, 0, preview.stderr);
    const plan = JSON.parse(preview.stdout);
    assert.deepEqual(plan.blockers, []);
    assert.ok(plan.edits.some((edit: { path: string }) => edit.path === '.gitignore'));
    assert.equal(read(root, '.gitignore'), '/node_modules/\n');
    const applied = run(root, ['init', ...localOptions], '\napply\n');
    assert.equal(applied.status, 0, applied.stderr);
    assert.ok(read(root, '.gitignore').startsWith('/node_modules/\n'));
    for (const path of [manifest, full, skill, 'AGENTS.md'])
      assert.equal(git(root, ['check-ignore', '--quiet', path]).status, 0, path);
    const id = /Backup ID: (\S+)/.exec(applied.stdout)?.[1];
    assert.ok(id);
    const before = read(root, '.gitignore');
    assert.equal(run(root, ['init'], '\n').status, 0);
    assert.equal(read(root, '.gitignore'), before);
    const reversed = run(root, ['rollback', id], 'apply\n');
    assert.equal(reversed.status, 0, reversed.stderr);
    assert.equal(read(root, '.gitignore'), '/node_modules/\n');
    assert.equal(existsSync(join(root, manifest)), false);
    assert.equal(existsSync(join(root, skill)), false);
  }));

test('local-only adoption refuses tracked instructions and leaves the Git index intact', () =>
  fixture((root) => {
    assert.equal(git(root, ['init']).status, 0);
    put(root, 'AGENTS.md', '# Tracked rules\n');
    assert.equal(git(root, ['add', 'AGENTS.md']).status, 0);
    const before = git(root, ['ls-files', '--stage']).stdout;
    const result = run(root, ['init', ...localOptions], '\napply\n');
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Private path must be ignored and untracked/);
    assert.equal(read(root, 'AGENTS.md'), '# Tracked rules\n');
    assert.equal(git(root, ['ls-files', '--stage']).stdout, before);
    assert.equal(existsSync(join(root, '.gitignore')), false);
    assert.equal(existsSync(join(root, '.ai')), false);
  }));

test('local-only adoption also refuses an unchanged onboarding skill already tracked by Git', () =>
  fixture((root) => {
    assert.equal(git(root, ['init']).status, 0);
    put(root, skill, '# Existing project onboarding\n');
    assert.equal(git(root, ['add', skill]).status, 0);
    const before = git(root, ['ls-files', '--stage']).stdout;
    const result = run(root, ['init', ...localOptions], '\napply\n');
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Private path must be ignored and untracked/);
    assert.equal(read(root, skill), '# Existing project onboarding\n');
    assert.equal(git(root, ['ls-files', '--stage']).stdout, before);
    assert.equal(existsSync(join(root, manifest)), false);
    assert.equal(existsSync(join(root, '.gitignore')), false);
  }));

test('guided reruns refuse agent selection changes instead of leaving misleading provenance', () =>
  fixture((root) => {
    const first = run(root, ['init'], 'codex\nmixed\n\napply\n');
    assert.equal(first.status, 0, first.stderr);
    const before = read(root, manifest);
    const result = run(root, ['init', '--agents=claude'], '\napply\n');
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Existing agent selection is preserved/);
    assert.equal(read(root, manifest), before);
    assert.equal(existsSync(join(root, 'CLAUDE.md')), false);
  }));

test('an interrupted local setup resumes through init using its saved choices', () =>
  fixture((root) => {
    assert.equal(git(root, ['init']).status, 0);
    const plan = JSON.parse(run(root, ['init', ...localOptions, '--dry-run']).stdout);
    put(
      root,
      '.ai/update-backups/.pending.json',
      JSON.stringify({ id: randomUUID(), action: 'quickstart', edits: plan.edits }, null, 2) + '\n',
    );
    const resumed = run(root, ['init'], 'apply\n');
    assert.equal(resumed.status, 0, resumed.stderr);
    assert.deepEqual(JSON.parse(read(root, manifest)).adapters, ['codex']);
    assert.equal(JSON.parse(read(root, manifest)).tracking, 'local-only');
    assert.equal(existsSync(join(root, '.ai/update-backups/.pending.json')), false);
  }));

test('ignore edits made after preview invalidate approval before any setup write', () =>
  fixture(
    (root) =>
      new Promise<void>((resolve, reject) => {
        assert.equal(git(root, ['init']).status, 0);
        put(root, '.gitignore', '/node_modules/\n');
        const child = spawn(process.execPath, [cli, 'init', ...localOptions], { cwd: root });
        let output = '';
        let responded = false;
        child.stdin.write('\n');
        child.stdout.on('data', (data) => {
          output += data;
          if (responded || !output.includes('Type apply')) return;
          responded = true;
          put(root, '.gitignore', '/changed-during-preview/\n');
          child.stdin.end('apply\n');
        });
        child.on('error', reject);
        child.on('close', (status) => {
          try {
            assert.ok(responded, output);
            assert.equal(status, 1);
            assert.equal(read(root, '.gitignore'), '/changed-during-preview/\n');
            assert.equal(existsSync(join(root, '.ai')), false);
            resolve();
          } catch (error) {
            reject(error);
          }
        });
      }),
  ));

test('legacy scripted init stays minimal while guided options install the complete baseline', () =>
  fixture((root) => {
    const legacy = run(root, ['init', '--tracking=tracked', '--agents=codex'], 'apply\n');
    assert.equal(legacy.status, 0, legacy.stderr);
    assert.equal(existsSync(join(root, full)), false);
    const guided = run(
      root,
      ['init', '--guided', '--tracking=tracked', '--agents=codex', '--no-launch'],
      '\napply\n',
    );
    assert.equal(guided.status, 0, guided.stderr);
    assert.equal(existsSync(join(root, full)), true);
    assert.equal(existsSync(join(root, skill)), true);
  }));

test('invalid options and forged ignore journal edits cannot change existing files', () =>
  fixture((root) => {
    for (const args of [
      ['--agents=unknown'],
      ['--tracking='],
      ['--surprise'],
      ['--dry-run', '--dry-run'],
    ]) {
      assert.equal(run(root, ['init', ...args]).status, 1);
    }
    assert.deepEqual(readdirSync(root), []);
    assert.equal(isLocalIgnoreEdit('keep\n', 'replace\n'), false);
    assert.equal(
      isLocalIgnoreEdit(
        null,
        '\n\n# ai-workflow-kit local setup\n/.ai/\n/*\n# /ai-workflow-kit local setup\n',
      ),
      false,
    );
    const plan = JSON.parse(run(root, ['init', ...localOptions, '--dry-run']).stdout);
    plan.edits[0].after = '*\n';
    put(
      root,
      '.ai/update-backups/.pending.json',
      JSON.stringify({ id: randomUUID(), action: 'quickstart', edits: plan.edits }, null, 2) + '\n',
    );
    assert.match(run(root, ['init'], 'apply\n').stderr, /unmanaged path or unknown content/);
    assert.equal(existsSync(join(root, '.gitignore')), false);
  }));

test('agent launch choices require start and preserve prompts as data', async () => {
  const prompt = onboardingPrompt(['docs/other-ai.md']);
  for (const agent of ['claude', 'codex']) {
    const plan = agentLaunch(agent, false, prompt, '/bin/zsh', 'darwin')!;
    assert.deepEqual(plan.args, [prompt]);
    assert.equal(plan.shellStartup, false);
  }
  const answers = ['custom', 'claude-orca', 'start'];
  const custom = await chooseAgentLaunch(
    '/project',
    prompt,
    async () => answers.shift()!,
    '/bin/zsh',
    'darwin',
  );
  assert.equal(custom?.args[1], 'builtin cd -- "$2" || exit\nclaude-orca "$1"');
  assert.equal(custom?.args.at(-2), prompt);
  assert.equal(custom?.args.at(-1), '/project');
  assert.equal(custom?.shellStartup, true);
  const declined = ['codex', ''];
  assert.equal(
    await chooseAgentLaunch(
      '/project',
      prompt,
      async () => declined.shift()!,
      '/bin/zsh',
      'darwin',
    ),
    undefined,
  );
  assert.equal(await chooseAgentLaunch('/project', prompt, async () => 'later'), undefined);
  const cancelled = ['custom', ''];
  assert.equal(
    await chooseAgentLaunch('/project', prompt, async () => cancelled.shift()!),
    undefined,
  );
  for (const value of [
    'claude;touch marker',
    '$(touch marker)',
    'claude --dangerously-skip-permissions',
    'claude\nexit',
    'eval',
    'source',
  ]) {
    assert.throws(
      () => agentLaunch(value, true, prompt, '/bin/zsh', 'darwin'),
      /one agent command/,
    );
  }
  assert.equal(agentLaunch('claude-orca', true, prompt, '/bin/fish', 'linux'), undefined);
  assert.equal(agentLaunch('claude', false, prompt, undefined, 'win32'), undefined);
});

test(
  'custom Zsh aliases receive the literal onboarding prompt',
  { skip: !existsSync('/bin/zsh') },
  () =>
    fixture((root) => {
      const prompt = onboardingPrompt(['docs/a$(echo untrusted).md']);
      put(
        root,
        'recorder.cjs',
        'require("node:fs").writeFileSync("received.json", JSON.stringify({cwd:process.cwd(), args:process.argv.slice(2)}));',
      );
      // Shell-quote only trusted executable and fixture paths in this isolated startup file.
      const quote = (value: string) => "'" + value.replaceAll("'", "'\\''") + "'";
      const target = `${quote(process.execPath)} ${quote(join(root, 'recorder.cjs'))}`;
      put(root, '.zshrc', `alias claude-orca=${quote(target)}\ncd /\n`);
      const plan = agentLaunch('claude-orca', true, prompt, '/bin/zsh', process.platform, root)!;
      const result = spawnSync(plan.executable, plan.args, {
        cwd: root,
        env: { ...process.env, ZDOTDIR: root },
        encoding: 'utf8',
      });
      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(JSON.parse(read(root, 'received.json')), { cwd: root, args: [prompt] });
      assert.equal(existsSync(join(root, 'untrusted')), false);
    }),
);

test('agent process failures keep the initialized project intact', () =>
  fixture(async (root) => {
    const applied = run(root, ['init'], 'codex\nmixed\n\napply\n');
    assert.equal(applied.status, 0, applied.stderr);
    const before = read(root, manifest);
    assert.equal(
      await runAgent(root, {
        executable: process.execPath,
        args: ['-e', 'process.exit(7)'],
        shellStartup: false,
      }),
      false,
    );
    assert.equal(
      await runAgent(root, {
        executable: join(root, 'missing-agent'),
        args: [],
        shellStartup: false,
      }),
      false,
    );
    assert.equal(read(root, manifest), before);
  }));
