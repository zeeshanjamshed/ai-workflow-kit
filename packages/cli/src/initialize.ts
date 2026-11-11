import { createHash, randomUUID } from 'node:crypto';
import { closeSync, linkSync, lstatSync, mkdirSync, openSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { discover, exists, readObject, readProjectFile, inspectGitPath } from './discovery.ts';
import type { Project } from './discovery.ts';
import { adapterInstructions, permissions as currentPermissions, projectIndex } from './instructions.ts';

const owner = 'ai-workflow-kit';
export const version = '0.4.1';
export const bundledVersions = ['0.1.0', '0.2.0', '0.3.0', '0.4.0', version];
const statePath = '.ai/.init-plan.json';
export const manifestPath = '.ai/setup-manifest.json';
const ignorePath = '.ai/.gitignore';
const policies = ['tracked', 'local-only', 'mixed'] as const;
type Policy = typeof policies[number];
const adapters = { codex: 'AGENTS.md', claude: 'CLAUDE.md', cursor: '.cursor/rules/ai-workflow-kit.mdc' };
type Adapter = keyof typeof adapters;
type Choices = { policy: Policy; agents: Adapter[] };
type Entry = { path: string; content: string };
type State = Choices & { owner: string; version: string; create: string[]; preserve: string[] };

const rules = 'Read-only inspection may proceed. Explain the scope and risks and get explicit approval before writes or external changes. Approve each step by default. Preserve existing work, verify changes, and report results briefly.';
const permissions = `# Project permissions\n\n${rules}\n\nFor known breaking changes, explain the impact, alternatives, and recovery. Obtain three distinct explicit confirmations. Use native safeguards for risky actions.\n`;

export function templates(choices: Choices & { version?: string }): Entry[] {
  const legacy = choices.version === '0.1.0';
  const templateVersion = choices.version ?? version;
  const updateGuide = ['0.3.0', '0.4.0', '0.4.1'].includes(templateVersion)
    ? '\nPreview kit updates with `ai-setup update --dry-run`.\n' : '';
  const onboardingGuide = ['0.4.0', '0.4.1'].includes(templateVersion)
    ? '\nRun `ai-setup onboard` before development in an unfamiliar project. Use `ai-setup rules` to locate selected engineering modules and read relevant modules alongside existing instructions. Resolve conflicts with the project owner.\n' : '';
  const indexContents = projectIndex + updateGuide + onboardingGuide;
  const result: Entry[] = [];
  if (choices.policy !== 'tracked') {
    result.push({ path: ignorePath, content: choices.policy === 'local-only'
      ? '*\n'
      : '/knowledge/\n/decisions/\n/tasks/\n' });
  }
  result.push(
    { path: '.ai/README.md', content: legacy ? '# Project context\n\nAdd verified project context as it becomes useful. Start with [project permissions](rules/permissions.md) and preserve existing project instructions.\n' : indexContents },
    { path: '.ai/rules/permissions.md', content: legacy ? permissions : currentPermissions },
    { path: '.ai/config.yaml', content: `version: "${templateVersion}"\ntracking: ${choices.policy}\nadapters: [${choices.agents.join(', ')}]\n` },
  );
  for (const agent of choices.agents) {
    const cursor = agent === 'cursor';
    const prefix = cursor ? '---\ndescription: Project workflow and approvals\nalwaysApply: true\n---\n\n' : '';
    const index = cursor ? '../../.ai/README.md' : '.ai/README.md';
    result.push({ path: adapters[agent], content: legacy ? `${prefix}# Project workflow\n\n${rules}\n\nRead ${index} for project context and shared rules.\n` : adapterInstructions(agent) });
  }
  return result;
}

function json(value: unknown): string {
  return JSON.stringify(value, null, 2) + '\n';
}

export function sha(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

export function safePath(root: string, path: string, createParents = false): string {
  const parts = path.split('/');
  if (parts.some(part => !/^[a-zA-Z0-9_.-]+$/.test(part) || part === '.' || part === '..')) throw new Error('Invalid managed path.');
  let current = root;
  for (const part of parts.slice(0, -1)) {
    current = join(current, part);
    if (!exists(current) && createParents) {
      try { mkdirSync(current); } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      }
    }
    if (exists(current) && !lstatSync(current).isDirectory()) throw new Error(`Unsafe parent for ${path}`);
  }
  const target = join(current, parts.at(-1)!);
  if (exists(target) && !lstatSync(target).isFile()) throw new Error(`Unsafe target for ${path}`);
  return target;
}

// Publish a complete file atomically. A concurrent creator wins without being overwritten.
export function install(root: string, entry: Entry): void {
  const target = safePath(root, entry.path, true);
  if (exists(target)) {
    if (readProjectFile(root, entry.path) === entry.content) return;
    throw new Error(`Conflicting file: ${entry.path}`);
  }
  const temp = join(dirname(target), `.ai-setup-${randomUUID()}.tmp`);
  const fd = openSync(temp, 'wx', 0o600);
  try {
    try { writeFileSync(fd, entry.content); } finally { closeSync(fd); }
    try { linkSync(temp, target); } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST' || safePath(root, entry.path) !== target ||
          readProjectFile(root, entry.path) !== entry.content) throw error;
    }
  } finally {
    unlinkSync(temp);
  }
}

export function validateChoices(policy: unknown, agents: unknown): Choices {
  if (typeof policy !== 'string' || !policies.includes(policy as Policy) ||
      !Array.isArray(agents) || agents.some(agent => typeof agent !== 'string' || !Object.hasOwn(adapters, agent)) ||
      new Set(agents).size !== agents.length) throw new Error('Choose a supported tracking policy and adapter list.');
  return { policy: policy as Policy, agents: agents as Adapter[] };
}

function readState(root: string): State | undefined {
  if (!exists(safePath(root, statePath))) return undefined;
  const raw = readObject(readProjectFile(root, statePath));
  if (raw?.owner !== owner || !bundledVersions.includes(raw.version as string)) throw new Error('Unrecognized initialization journal. Review it manually.');
  if (typeof raw.version !== 'string') throw new Error('Invalid initialization version.');
  const choices = validateChoices(raw.policy, raw.agents);
  const paths = templates({ ...choices, version: raw.version }).map(entry => entry.path);
  const { create, preserve } = raw;
  if (!Array.isArray(create) || !Array.isArray(preserve) ||
      paths.some(path => Number(create.includes(path)) + Number(preserve.includes(path)) !== 1) ||
      create.length + preserve.length !== paths.length) throw new Error('Invalid initialization journal.');
  return { owner, version: raw.version, ...choices, create, preserve };
}

function plan(project: Project, choices: Choices): State {
  const create: string[] = [];
  const preserve: string[] = [];
  for (const { path } of templates(choices)) {
    const agent = choices.agents.find(name => adapters[name] === path);
    const existing = agent && project.agents.find(info => info.name === agent)?.paths.some(p => !p.endsWith('/skills'));
    // Cursor can use AGENTS.md directly when Codex is enabled or the file already exists.
    const sharedCursor = agent === 'cursor' && (choices.agents.includes('codex') && !project.agents.some(info => info.name === 'codex' && info.paths.includes('AGENTS.override.md')) ||
      project.agents.some(info => info.name === 'codex' && info.paths.includes('AGENTS.md')));
    (exists(safePath(project.root, path)) || existing || sharedCursor ? preserve : create).push(path);
  }
  return { owner, version, ...choices, create, preserve };
}

function checkPrivacy(project: Project, state: State, entries: Entry[], verify = false): void {
  const { root } = project;
  const ignore = entries.find(entry => entry.path === ignorePath);
  if (ignore && state.preserve.includes(ignorePath) && readProjectFile(root, ignorePath) !== ignore.content) {
    throw new Error('Existing .ai/.gitignore differs. Review the project’s privacy rules before proceeding.');
  }
  if (!project.git.detected) return;
  if (state.policy === 'local-only' && inspectGitPath(root, '.ai/', 'tracked') !== false) {
    throw new Error('Local-only setup requires an inspectable Git index with no tracked .ai files.');
  }
  const privatePaths = state.policy === 'local-only' ? [...state.create, statePath, manifestPath]
    : state.policy === 'mixed' ? ['.ai/knowledge/', '.ai/decisions/', '.ai/tasks/'] : [];
  for (const path of privatePaths) {
    if (inspectGitPath(root, path, 'tracked') !== false) throw new Error(`Cannot confirm untracked private path: ${path}`);
    if ((verify || !path.startsWith('.ai/')) && inspectGitPath(root, path, 'ignored') !== true) {
      throw new Error(`Private path must be ignored by Git: ${path}`);
    }
  }
  if (state.policy !== 'local-only') {
    for (const path of [...state.create, statePath, manifestPath]) {
      if (inspectGitPath(root, path, 'ignored') !== false) throw new Error(`Git must allow tracking for ${path}`);
    }
  }
}

export async function initialize(project: Project, options?: Choices, dryRun = false): Promise<void> {
  const { root } = project;
  if (exists(safePath(root, manifestPath))) {
    const manifest = readObject(readProjectFile(root, manifestPath));
    if (manifest?.owner !== owner || typeof manifest.version !== 'string') throw new Error('Existing setup manifest is unrecognized. It was preserved for manual review.');
    console.log('Already initialized. Existing files were preserved.');
    return;
  }
  const saved = readState(root);
  const input = createInterface({ input: stdin, output: stdout, terminal: false });
  const lines = input[Symbol.asyncIterator]();
  async function ask(prompt: string): Promise<string> {
    console.log(prompt);
    const answer = await lines.next();
    if (answer.done) throw new Error('Input closed before approval.');
    return answer.value.trim();
  }

  try {
    const choices = saved ?? options ?? validateChoices(
      await ask('Tracking policy (tracked, local-only, mixed):'),
      (await ask('Adapters (codex, claude, cursor; comma-separated or blank for none):')).split(',').map(name => name.trim()).filter(Boolean),
    );
    if (saved && options && (saved.policy !== options.policy || saved.agents.join() !== options.agents.join())) {
      throw new Error('Resume with the original tracking and adapter choices.');
    }
    const state = saved ?? plan(project, choices);
    const entries = templates(state).filter(entry => state.create.includes(entry.path));
    checkPrivacy(project, state, templates(state));
    for (const entry of entries) {
      if (exists(safePath(root, entry.path)) && (!saved || readProjectFile(root, entry.path) !== entry.content)) {
        throw new Error(`Conflicting file: ${entry.path}`);
      }
    }
    const manifest: Entry = {
      path: manifestPath,
      content: json({
        owner, version: state.version, tracking: state.policy, adapters: state.agents,
        files: Object.fromEntries(entries.map(entry => [entry.path, { sha256: sha(entry.content) }])),
        preserved: state.preserve,
      }),
    };
    console.log(json({
      root, projectType: project.classification, resumed: Boolean(saved), policy: state.policy,
      detectedInstructions: project.agents.flatMap(agent => agent.paths),
      preserve: state.preserve, add: [{ path: statePath, content: json(state) }, ...entries, manifest],
      notes: [
        'Existing files are preserved in place. This plan replaces no files, so there are no originals to back up.',
        'Tracked records can be shared after a separate Git action. Ignored records stay local and need independent backups. Mixed keeps knowledge, decisions, and tasks local.',
        'Review existing instructions and verify actual agent discovery before relying on the setup.',
      ],
    }));
    if (dryRun || await ask('Type apply to approve this entire preview:') !== 'apply') return;
    const current = discover(root);
    if (current.root !== root || current.git.detected !== project.git.detected ||
        exists(safePath(root, manifestPath)) ||
        !saved && json(plan(current, choices)) !== json(state)) throw new Error('Project changed after preview. Review a fresh plan.');
    checkPrivacy(current, state, templates(state));
    // Establish ignore rules before creating any local-only records.
    const ignore = entries.find(entry => entry.path === ignorePath);
    if (ignore) install(root, ignore);
    install(root, { path: statePath, content: json(state) });
    for (const entry of entries) if (entry !== ignore) install(root, entry);
    checkPrivacy(current, state, templates(state), true);
    if (entries.some(entry => readProjectFile(root, entry.path) !== entry.content)) throw new Error('Initialization files changed during verification.');
    install(root, manifest);
    console.log('Initialized and verified. Existing files were preserved.');
  } finally {
    input.close();
  }
}

export function parseChoices(args: string[]): Choices {
  if (args.length !== 2 || !args[0].startsWith('--tracking=') || !args[1].startsWith('--agents=')) {
    throw new Error('Use --tracking=<tracked|local-only|mixed> --agents=<codex,claude,cursor>. An empty list selects no adapters.');
  }
  const agents = args[1].slice('--agents='.length);
  return validateChoices(args[0].slice('--tracking='.length), agents ? agents.split(',') : []);
}
