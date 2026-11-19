import { parseOptions, stringOption } from './arguments.ts';
import { install, json, safePath, sha } from './file-operations.ts';
export { install, safePath, sha };
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { discover, exists, readObject, readProjectFile, inspectGitPath } from './discovery.ts';
import type { Project } from './discovery.ts';
import * as currentInstructions from './instructions.ts';
import { frozenTemplates, bundledVersions } from './bundles.ts';
import { version } from './metadata.ts';
export { bundledVersions, version };

const owner = 'ai-workflow-kit';
export const statePath = '.ai/.init-plan.json';
export const manifestPath = '.ai/setup-manifest.json';
const ignorePath = '.ai/.gitignore';
const policies = ['tracked', 'local-only', 'mixed'] as const;
type Policy = (typeof policies)[number];
const adapters = {
  codex: 'AGENTS.md',
  claude: 'CLAUDE.md',
  cursor: '.cursor/rules/ai-workflow-kit.mdc',
};
type Adapter = keyof typeof adapters;
export type Choices = { policy: Policy; agents: Adapter[] };
type Entry = { path: string; content: string };
type State = Choices & { owner: string; version: string; create: string[]; preserve: string[] };

export function templates(choices: Choices & { version?: string }): Entry[] {
  const templateVersion = choices.version ?? version;
  if (templateVersion !== version) return frozenTemplates(templateVersion, choices);
  const {
    adapterInstructions,
    permissions: currentPermissions,
    projectIndex,
  } = currentInstructions;
  const updateGuide = '\nPreview kit updates with `ai-setup update --dry-run`.\n';
  const onboardingGuide =
    '\nRun `ai-setup onboard` before development in an unfamiliar project. Use `ai-setup rules` to locate selected engineering modules and read relevant modules alongside existing instructions. Resolve conflicts with the project owner.\n';
  const indexContents = projectIndex + updateGuide + onboardingGuide;
  const result: Entry[] = [];
  if (choices.policy !== 'tracked') {
    result.push({
      path: ignorePath,
      content: choices.policy === 'local-only' ? '*\n' : '/knowledge/\n/decisions/\n/tasks/\n',
    });
  }
  result.push(
    { path: '.ai/README.md', content: indexContents },
    { path: '.ai/rules/permissions.md', content: currentPermissions },
    {
      path: '.ai/config.yaml',
      content: `version: "${templateVersion}"\ntracking: ${choices.policy}\nadapters: [${choices.agents.join(', ')}]\n`,
    },
  );
  for (const agent of choices.agents) {
    result.push({ path: adapters[agent], content: adapterInstructions(agent) });
  }
  return result;
}

export function validateChoices(policy: unknown, agents: unknown): Choices {
  if (
    typeof policy !== 'string' ||
    !policies.includes(policy as Policy) ||
    !Array.isArray(agents) ||
    agents.some((agent) => typeof agent !== 'string' || !Object.hasOwn(adapters, agent)) ||
    new Set(agents).size !== agents.length
  )
    throw new Error('Choose a supported tracking policy and adapter list.');
  return { policy: policy as Policy, agents: agents as Adapter[] };
}

function readState(root: string): State | undefined {
  if (!exists(safePath(root, statePath))) return undefined;
  const raw = readObject(readProjectFile(root, statePath));
  if (raw?.owner !== owner || !bundledVersions.includes(raw.version as string))
    throw new Error('Unrecognized initialization journal. Review it manually.');
  if (typeof raw.version !== 'string') throw new Error('Invalid initialization version.');
  const choices = validateChoices(raw.policy, raw.agents);
  const paths = templates({ ...choices, version: raw.version }).map((entry) => entry.path);
  const { create, preserve } = raw;
  if (
    !Array.isArray(create) ||
    !Array.isArray(preserve) ||
    paths.some((path) => Number(create.includes(path)) + Number(preserve.includes(path)) !== 1) ||
    create.length + preserve.length !== paths.length
  )
    throw new Error('Invalid initialization journal.');
  return { owner, version: raw.version, ...choices, create, preserve };
}

function plan(project: Project, choices: Choices): State {
  const create: string[] = [];
  const preserve: string[] = [];
  for (const { path } of templates(choices)) {
    const agent = choices.agents.find((name) => adapters[name] === path);
    const existing =
      agent &&
      project.agents.find((info) => info.name === agent)?.paths.some((p) => !p.endsWith('/skills'));
    // Cursor can use AGENTS.md directly when Codex is enabled or the file already exists.
    const sharedCursor =
      agent === 'cursor' &&
      ((choices.agents.includes('codex') &&
        !project.agents.some(
          (info) => info.name === 'codex' && info.paths.includes('AGENTS.override.md'),
        )) ||
        project.agents.some((info) => info.name === 'codex' && info.paths.includes('AGENTS.md')));
    (exists(safePath(project.root, path)) || existing || sharedCursor ? preserve : create).push(
      path,
    );
  }
  return { owner, version, ...choices, create, preserve };
}

function checkPrivacy(project: Project, state: State, entries: Entry[], verify = false): void {
  const { root } = project;
  const ignore = entries.find((entry) => entry.path === ignorePath);
  if (
    ignore &&
    state.preserve.includes(ignorePath) &&
    readProjectFile(root, ignorePath) !== ignore.content
  ) {
    throw new Error(
      'Existing .ai/.gitignore differs. Review the project’s privacy rules before proceeding.',
    );
  }
  if (!project.git.detected) return;
  if (state.policy === 'local-only' && inspectGitPath(root, '.ai/', 'tracked') !== false) {
    throw new Error(
      'Local-only setup requires an inspectable Git index with no tracked .ai files.',
    );
  }
  const privatePaths =
    state.policy === 'local-only'
      ? [...state.create, statePath, manifestPath]
      : state.policy === 'mixed'
        ? ['.ai/knowledge/', '.ai/decisions/', '.ai/tasks/']
        : [];
  for (const path of privatePaths) {
    if (inspectGitPath(root, path, 'tracked') !== false)
      throw new Error(`Cannot confirm untracked private path: ${path}`);
    if ((verify || !path.startsWith('.ai/')) && inspectGitPath(root, path, 'ignored') !== true) {
      throw new Error(`Private path must be ignored by Git: ${path}`);
    }
  }
  if (state.policy !== 'local-only') {
    for (const path of [...state.create, statePath, manifestPath]) {
      if (inspectGitPath(root, path, 'ignored') !== false)
        throw new Error(`Git must allow tracking for ${path}`);
    }
  }
}

export async function initialize(
  project: Project,
  options?: Choices,
  dryRun = false,
): Promise<void> {
  const { root } = project;
  if (exists(safePath(root, manifestPath))) {
    const manifest = readObject(readProjectFile(root, manifestPath));
    if (manifest?.owner !== owner || typeof manifest.version !== 'string')
      throw new Error(
        'Existing setup manifest is unrecognized. It was preserved for manual review.',
      );
    console.log('Already initialized. Existing files were preserved.');
    return;
  }
  if (exists(safePath(root, '.ai/update-backups/.pending.json'))) {
    throw new Error('A setup transaction is pending. Run ai-setup quickstart to review it.');
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
    const choices =
      saved ??
      options ??
      validateChoices(
        await ask('Tracking policy (tracked, local-only, mixed):'),
        (await ask('Adapters (codex, claude, cursor; comma-separated or blank for none):'))
          .split(',')
          .map((name) => name.trim())
          .filter(Boolean),
      );
    if (
      saved &&
      options &&
      (saved.policy !== options.policy || saved.agents.join() !== options.agents.join())
    ) {
      throw new Error('Resume with the original tracking and adapter choices.');
    }
    const state = saved ?? plan(project, choices);
    const entries = templates(state).filter((entry) => state.create.includes(entry.path));
    checkPrivacy(project, state, templates(state));
    for (const entry of entries) {
      if (
        exists(safePath(root, entry.path)) &&
        (!saved || readProjectFile(root, entry.path) !== entry.content)
      ) {
        throw new Error(`Conflicting file: ${entry.path}`);
      }
    }
    const manifest: Entry = {
      path: manifestPath,
      content: json({
        owner,
        version: state.version,
        tracking: state.policy,
        adapters: state.agents,
        files: Object.fromEntries(
          entries.map((entry) => [entry.path, { sha256: sha(entry.content) }]),
        ),
        preserved: state.preserve,
      }),
    };
    console.log(
      json({
        root,
        projectType: project.classification,
        resumed: Boolean(saved),
        policy: state.policy,
        detectedInstructions: project.agents.flatMap((agent) => agent.paths),
        preserve: state.preserve,
        add: [{ path: statePath, content: json(state) }, ...entries, manifest],
        notes: [
          'Existing files are preserved in place. This plan replaces no files, so there are no originals to back up.',
          'Tracked records can be shared after a separate Git action. Ignored records stay local and need independent backups. Mixed keeps knowledge, decisions, and tasks local.',
          'Review existing instructions and verify actual agent discovery before relying on the setup.',
        ],
      }),
    );
    if (dryRun || (await ask('Type apply to approve this entire preview:')) !== 'apply') return;
    const current = discover(root);
    if (
      current.root !== root ||
      current.git.detected !== project.git.detected ||
      exists(safePath(root, manifestPath)) ||
      (!saved && json(plan(current, choices)) !== json(state))
    )
      throw new Error('Project changed after preview. Review a fresh plan.');
    checkPrivacy(current, state, templates(state));
    // Establish ignore rules before creating any local-only records.
    const ignore = entries.find((entry) => entry.path === ignorePath);
    if (ignore) install(root, ignore);
    install(root, { path: statePath, content: json(state) });
    for (const entry of entries) if (entry !== ignore) install(root, entry);
    checkPrivacy(current, state, templates(state), true);
    if (entries.some((entry) => readProjectFile(root, entry.path) !== entry.content))
      throw new Error('Initialization files changed during verification.');
    install(root, manifest);
    console.log('Initialized and verified. Existing files were preserved.');
  } finally {
    input.close();
  }
}

export function parseChoices(args: string[]): Choices {
  const { values, positionals } = parseOptions('init', args);
  const policy = stringOption(values.tracking);
  const agents = stringOption(values.agents);
  if (positionals.length || policy === undefined || agents === undefined)
    throw new Error('Provide both --tracking and --agents for legacy initialization.');
  return validateChoices(policy, agents ? agents.split(',') : []);
}
