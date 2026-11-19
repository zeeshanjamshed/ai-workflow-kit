import { fullStandards } from './full-standards.ts';
import { interactiveTerminal, note } from './terminal.ts';
import { diagnose } from './reports.ts';
import { inspectGitPath } from './discovery.ts';
import type { Project } from './discovery.ts';
import { manifestPath, sha, statePath, templates, version } from './initialize.ts';
import type { Choices } from './initialize.ts';
import {
  engineeringModules,
  planRuleActivation,
  ruleAdapters,
  rulePath,
  splitRuleBlock,
} from './rule-activation.ts';
import { bundledRule, onboardingSkills } from './setup-assets.ts';
import { assetEntries, assetGroups } from './asset-baselines.ts';
import { isLocalIgnoreEdit, localIgnoreEdit } from './tracking.ts';

type Read = (path: string) => string | null;
import type { Edit } from './setup-types.ts';
export type { Edit } from './setup-types.ts';

const adapters: Choices['agents'] = ['codex', 'claude', 'cursor'];
const ignore = '.ai/.gitignore';
const modules = engineeringModules.map((name) => ({
  path: rulePath(name),
  content: bundledRule(name),
}));
const skills = onboardingSkills('both');
export type PresetOptions = {
  preset: 'minimal' | 'quickstart' | 'full';
  onboarding: boolean;
  policy?: Choices['policy'];
  agents?: Choices['agents'];
  guided?: boolean;
};
const recommended: PresetOptions = { preset: 'quickstart', onboarding: true };

export function quickstartDefaults(choices: Choices & { version: string }) {
  return [
    ...templates({ ...choices, agents: adapters }),
    ...templates(choices),
    ...assetEntries(choices.version),
  ];
}

export function planQuickstart(
  project: Project,
  read: Read,
  installed?: Choices,
  options = recommended,
) {
  if (!installed && read(statePath) !== null) {
    throw new Error(
      'An initialization is pending. Finish ai-setup init before running quickstart.',
    );
  }
  const enabled = options.guided ? (options.agents ?? installed?.agents ?? adapters) : adapters;
  const choices: Choices = installed ?? { policy: options.policy ?? 'mixed', agents: enabled };
  const base = templates({ ...choices, agents: enabled });
  const optional =
    options.preset === 'full' ? fullStandards : options.preset === 'quickstart' ? modules : [];
  const selectedSkills = options.guided
    ? skills.filter((entry) =>
        entry.path.startsWith('.claude/')
          ? enabled.includes('claude')
          : enabled.includes('codex') || enabled.includes('cursor'),
      )
    : skills;
  const defaults = [...base, ...optional, ...(options.onboarding ? selectedSkills : [])];
  const edits = new Map<string, Edit>();
  const inputs = new Map<string, string | null>();
  const snapshot: Read = (path) => {
    const content = read(path);
    inputs.set(path, content);
    return content;
  };
  const projected: Read = (path) => edits.get(path)?.after ?? snapshot(path);
  const preserved: string[] = [];
  const hasFull = ruleAdapters(project).some(
    (path) => splitRuleBlock(path, snapshot(path) ?? '').full,
  );

  for (const { path, content } of defaults) {
    if (
      (path === 'AGENTS.md' && snapshot('AGENTS.override.md') !== null) ||
      (path === 'CLAUDE.md' && snapshot('.claude/CLAUDE.md') !== null) ||
      (path === '.cursor/rules/ai-workflow-kit.mdc' &&
        projected('AGENTS.md') !== null &&
        snapshot('AGENTS.override.md') === null &&
        snapshot(path) === null)
    )
      continue;
    const before = snapshot(path);
    if (before === null) edits.set(path, { path, before, after: content });
    else {
      if (path === ignore && before !== content)
        throw new Error('Existing .ai/.gitignore conflicts with the setup privacy policy.');
      if (!installed && path === '.ai/config.yaml' && before !== content) {
        throw new Error(
          'Existing .ai/config.yaml has no recognized manifest. Review its setup and privacy choices.',
        );
      }
      if (
        optional === fullStandards &&
        fullStandards.some((entry) => entry.path === path) &&
        before !== content &&
        !hasFull
      ) {
        throw new Error(
          `Existing Full Engineering file differs: ${path}. Preserve it and reconcile the conflict before retrying.`,
        );
      }
      if (!before.trim() && modules.some((module) => module.path === path))
        throw new Error(`Existing engineering rule is empty: ${path}`);
      preserved.push(path);
    }
  }
  {
    const paths = ruleAdapters(project, (path) => projected(path) !== null).filter(
      (path) =>
        !options.guided ||
        (path.endsWith('CLAUDE.md') && enabled.includes('claude')) ||
        (path.endsWith('.mdc') && enabled.includes('cursor')) ||
        (path.startsWith('AGENTS') &&
          (enabled.includes('codex') ||
            (enabled.includes('cursor') &&
              path === 'AGENTS.md' &&
              projected('AGENTS.override.md') === null))),
    );
    const isCustom = (name: string) => {
      const content = projected(rulePath(name));
      if (!content?.trim()) throw new Error(`Missing or empty selected rule: ${rulePath(name)}`);
      return content !== bundledRule(name);
    };
    const selected = options.preset === 'quickstart' ? engineeringModules : [];
    for (const edit of paths.length
      ? planRuleActivation(
          project,
          selected,
          projected,
          paths,
          true,
          options.preset === 'full' ? isCustom : undefined,
          options.preset === 'minimal',
        )
      : []) {
      edits.set(edit.path, {
        ...edit,
        before: edits.get(edit.path)?.before === null ? null : edit.before,
      });
    }
  }
  let privacyEdit: Edit | undefined;
  if (options.guided && choices.policy === 'local-only') {
    privacyEdit = localIgnoreEdit(
      snapshot('.gitignore'),
      defaults
        .map((entry) => entry.path)
        .filter((path) => path.startsWith('.ai/') || projected(path) !== null)
        .concat([...edits.keys()].filter((path) => !path.startsWith('.ai/'))),
    );
  }
  if (!installed) {
    const managed = defaults.filter(({ path }) => edits.get(path)?.before === null);
    edits.set(manifestPath, {
      path: manifestPath,
      before: null,
      after:
        JSON.stringify(
          {
            owner: 'ai-workflow-kit',
            version,
            tracking: choices.policy,
            adapters: enabled,
            files: Object.fromEntries(
              managed.map(({ path, content }) => [path, { sha256: sha(content) }]),
            ),
            components: [...assetGroups(version)]
              .filter(([, entries]) =>
                entries.some((entry) => defaults.some((item) => item.path === entry.path)),
              )
              .map(([id]) => id),
            projectOwned: [],
            preserved,
          },
          null,
          2,
        ) + '\n',
    });
  }
  return {
    edits: [...(privacyEdit ? [privacyEdit] : []), ...edits.values()],
    inputs,
    preserved,
    policy: choices.policy,
  };
}

export function checkQuickstartPrivacy(
  project: Project,
  edits: Edit[],
  policy: Choices['policy'],
  applying = false,
) {
  if (!project.git.detected) return;
  const { root } = project;
  const willIgnore =
    !applying &&
    edits.some((edit) => edit.path === ignore && edit.before === null && edit.after !== null);
  const rootIgnore = applying
    ? undefined
    : edits.find(
        (edit) => edit.path === '.gitignore' && isLocalIgnoreEdit(edit.before, edit.after),
      );
  const covered = (path: string) =>
    rootIgnore?.after
      ?.split('\n')
      .some(
        (line) =>
          line.startsWith('/') &&
          (line.endsWith('/') ? (path + '/').startsWith(line.slice(1)) : path === line.slice(1)),
      );
  if (policy === 'local-only' && inspectGitPath(root, '.ai/', 'tracked') !== false)
    throw new Error(
      'Local-only setup cannot hide already tracked .ai files. Choose shared tracking or review them separately.',
    );
  const ignoredSetupPaths =
    rootIgnore?.after
      ?.slice((rootIgnore.before ?? '').length)
      .split('\n')
      .filter((line) => line.startsWith('/'))
      .map((line) => line.slice(1)) ?? [];
  const privatePaths =
    policy === 'local-only'
      ? [
          ...edits.map((edit) => edit.path).filter((path) => path !== '.gitignore'),
          ...ignoredSetupPaths,
        ]
      : policy === 'mixed'
        ? ['.ai/knowledge/', '.ai/decisions/', '.ai/tasks/']
        : [];
  for (const path of privatePaths) {
    if (
      inspectGitPath(root, path, 'tracked') !== false ||
      (!(willIgnore && path.startsWith('.ai/')) &&
        !covered(path) &&
        inspectGitPath(root, path, 'ignored') !== true)
    ) {
      throw new Error(`Private path must be ignored and untracked: ${path}`);
    }
  }
  if (policy !== 'local-only') {
    for (const { path } of edits) {
      if (inspectGitPath(root, path, 'ignored') !== false)
        throw new Error(`Git must allow tracking for ${path}.`);
    }
  }
}

export function printQuickstart(
  project: Project,
  edits: Edit[],
  preserved: string[],
  policy: string,
  resumed: boolean,
  label = 'Quickstart',
) {
  const privacy = edits.find((edit) => edit.path === '.gitignore');
  if (interactiveTerminal) {
    const { findings } = diagnose(project);
    note(
      [
        project.root,
        `Git tracking ${policy === 'tracked' ? 'shared' : policy}`,
        ...(project.workspaceMarkers.length || project.packageWorkspaces
          ? ['Workspace detected. Setup applies to the repository root.']
          : []),
        ...(resumed ? ['Resume the previously saved plan.'] : []),
        ...edits.map(
          ({ path, before, after }) =>
            `${after === null ? 'Remove' : before === null ? 'Add' : 'Update'} ${path}`,
        ),
        ...(preserved.length
          ? [`Keep ${preserved.length} existing files, including custom rules and skills.`]
          : []),
        ...(edits.length
          ? ['Applying saves a local recovery backup.']
          : ['Setup is already complete.']),
        ...findings.map((finding) => `Check ${finding}`),
        ...(privacy
          ? [
              'Git ignore additions',
              privacy.after?.slice((privacy.before ?? '').length).trim() ?? '',
            ]
          : []),
      ].join('\n'),
      label === 'Initialize' ? 'Setup preview' : label,
    );
    return;
  }
  console.log(`${label}: ${project.root} (${project.classification}, ${policy} tracking)`);
  if (project.workspaceMarkers.length || project.packageWorkspaces)
    console.log('  Workspace detected. Setup is scoped to the repository root.');
  const { findings } = diagnose(project);
  for (const finding of findings.slice(0, 3)) console.log(`  Check: ${finding}`);
  if (findings.length > 3) console.log('  Run ai-setup doctor for the remaining findings.');
  if (resumed) console.log('Resume the saved quickstart plan:');
  for (const { path, before } of edits)
    console.log(
      `  ${before === null ? 'Add' : path === '.gitignore' ? 'Update ignore rules in' : 'Link rules in'} ${path}`,
    );
  if (privacy)
    console.log(
      `  Ignore these setup paths in Git\n${privacy.after?.slice((privacy.before ?? '').length).trim()}`,
    );
  if (preserved.length)
    console.log(
      `Keep ${preserved.length} existing files, including any customized modules or skills.`,
    );
  if (edits.length)
    console.log(
      'Review existing instructions for conflicts. Applying saves an ignored recovery journal and backup.',
    );
  else console.log('Setup is already complete.');
}

export function printOnboardingHandoff(withSkill = true) {
  if (!withSkill) {
    console.log(
      'Next: use ai-setup onboard for a read-only inventory. Skill installation and any knowledge writes require separate approval.',
    );
    return;
  }
  console.log(
    'Next: start Claude Code or Codex here and run guided-project-onboarding. Review and approve knowledge separately.',
  );
}
