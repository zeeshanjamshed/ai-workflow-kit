import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const cli = fileURLToPath(new URL('../src/main.ts', import.meta.url));

test('monorepo adoption preserves custom rules and supports nested skills and handoffs', () => {
  const root = mkdtempSync(join(tmpdir(), 'ai-pilot-'));
  const app = join(root, 'packages/app');
  function put(path: string, content: string) {
    const target = join(root, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content);
  }
  function run(args: string[], input = '') {
    const result = spawnSync(process.execPath, [cli, ...args], { cwd: app, input, encoding: 'utf8', timeout: 15000 });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout;
  }
  try {
    assert.equal(spawnSync('git', ['init'], { cwd: root }).status, 0);
    put('package.json', '{"private":true,"workspaces":["packages/*"]}\n');
    put('packages/app/package.json', '{"name":"pilot-app","dependencies":{"react":"19.0.0"}}\n');
    put('packages/app/index.js', 'export const orderStatus = "pending";\n');
    put('AGENTS.md', '# Existing approvals\nPreserve our review rules.\n');
    put('packages/app/.agents/skills/review/SKILL.md', '# Review skill\n');
    put('.ai/tasks/pilot.md', '# Pilot\nVerify the order status contract before changes.\n');
    const proposal = JSON.parse(run(['init', '--dry-run', '--tracking=tracked', '--agents=codex,claude']));
    assert.equal(proposal.projectType, 'existing-ai');
    assert.ok(proposal.preserve.includes('AGENTS.md'));
    assert.match(run(['init', '--tracking=tracked', '--agents=codex,claude'], 'apply\n'), /Initialized and verified/);
    assert.match(run(['init']), /Already initialized/);
    assert.equal(JSON.parse(run(['doctor'])).project.packageWorkspaces, true);
    const skills = JSON.parse(run(['skills'])) as { path: string }[];
    assert.ok(skills.some(skill => skill.path.split(sep).join('/') === 'packages/app/.agents/skills/review/SKILL.md'));
    assert.match(JSON.parse(run(['context', 'pilot'])).handoff.markdown, /order status contract/);
    const claim = run(['coordinate', 'claim', 'pilot', 'codex', 'packages/app'], 'apply\n');
    const token = /Ownership token: (\S+)/.exec(claim)?.[1];
    assert.ok(token);
    run(['coordinate', 'release', 'pilot', token, '.ai/tasks/pilot.md'], 'apply\n');
    assert.equal(JSON.parse(run(['coordinate', 'status']))[0].handoff, '.ai/tasks/pilot.md');
    assert.deepEqual(JSON.parse(run(['update', '--dry-run'])).edits, []);
    assert.equal(readFileSync(join(root, 'AGENTS.md'), 'utf8'), '# Existing approvals\nPreserve our review rules.\n');
    assert.equal(readFileSync(join(app, 'index.js'), 'utf8'), 'export const orderStatus = "pending";\n');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
