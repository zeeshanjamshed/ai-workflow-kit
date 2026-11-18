import { fullStandards } from './full-standards.ts';
import { diagnose } from './reports.ts';
import { inspectGitPath } from './discovery.ts';
import type { Project } from './discovery.ts';
import { manifestPath, sha, statePath, templates, version } from './initialize.ts';
import type { Choices } from './initialize.ts';
import { engineeringModules, planRuleActivation, ruleAdapters, rulePath, splitRuleBlock } from './rule-activation.ts';
import { bundledRule, onboardingSkills } from './setup-assets.ts';

type Read = (path: string) => string | null;
export type Edit = { path: string; before: string | null; after: string | null };

const adapters: Choices['agents'] = ['codex', 'claude', 'cursor'];
const ignore = '.ai/.gitignore';
const modules = engineeringModules.map(name => ({ path: rulePath(name), content: bundledRule(name) }));
const skills = onboardingSkills('both');
export type PresetOptions = {
  preset: 'minimal' | 'quickstart' | 'full';
  onboarding: boolean;
  policy?: Choices['policy'];
};
const recommended: PresetOptions = { preset: 'quickstart', onboarding: true };

export function quickstartDefaults(choices: Choices & { version: string }) {
  return [...templates({ ...choices, agents: adapters }), ...modules, ...skills, ...fullStandards];
}

export function planQuickstart(project: Project, read: Read, installed?: Choices, options = recommended) {
  if (!installed && read(statePath) !== null) {
    throw new Error('An initialization is pending. Finish ai-setup init before running quickstart.');
  }
  const choices: Choices = installed ?? { policy: options.policy ?? 'mixed', agents: adapters };
  const base = templates({ ...choices, agents: adapters });
  const optional = options.preset === 'full' ? fullStandards : options.preset === 'quickstart' ? modules : [];
  const defaults = [...base, ...optional, ...(options.onboarding ? skills : [])];
  const edits = new Map<string, Edit>();
  const inputs = new Map<string, string | null>();
  const snapshot: Read = path => {
    const content = read(path);
    inputs.set(path, content);
    return content;
  };
  const projected: Read = path => edits.get(path)?.after ?? snapshot(path);
  const preserved: string[] = [];
  const hasFull = ruleAdapters(project).some(path => splitRuleBlock(path, snapshot(path) ?? '').full);

  for (const { path, content } of defaults) {
    if (path === 'AGENTS.md' && snapshot('AGENTS.override.md') !== null ||
        path === 'CLAUDE.md' && snapshot('.claude/CLAUDE.md') !== null ||
        path === '.cursor/rules/ai-workflow-kit.mdc' && projected('AGENTS.md') !== null && snapshot('AGENTS.override.md') === null && snapshot(path) === null) continue;
    const before = snapshot(path);
    if (before === null) edits.set(path, { path, before, after: content });
    else {
      if (path === ignore && before !== content) throw new Error('Existing .ai/.gitignore conflicts with the setup privacy policy.');
      if (!installed && path === '.ai/config.yaml' && before !== content) {
        throw new Error('Existing .ai/config.yaml has no recognized manifest. Review its setup and privacy choices.');
      }
      if (optional === fullStandards && fullStandards.some(entry => entry.path === path) && before !== content && !hasFull) {
        throw new Error(`Existing Full Engineering file differs: ${path}. Preserve it and reconcile the conflict before retrying.`);
      }
      if (!before.trim() && modules.some(module => module.path === path)) throw new Error(`Existing engineering rule is empty: ${path}`);
      preserved.push(path);
    }
  }
  {
    const paths = ruleAdapters(project, path => projected(path) !== null);
    const isCustom = (name: string) => {
      const content = projected(rulePath(name));
      if (!content?.trim()) throw new Error(`Missing or empty selected rule: ${rulePath(name)}`);
      return content !== bundledRule(name);
    };
    const selected = options.preset === 'quickstart' ? engineeringModules : [];
    for (const edit of planRuleActivation(project, selected, projected, paths, true, options.preset === 'full' ? isCustom : undefined, options.preset === 'minimal')) {
      edits.set(edit.path, { ...edit, before: edits.get(edit.path)?.before === null ? null : edit.before });
    }
  }
  if (!installed) {
    const managed = base.filter(({ path }) => edits.get(path)?.before === null);
    edits.set(manifestPath, { path: manifestPath, before: null, after: JSON.stringify({
      owner: 'ai-workflow-kit', version, tracking: choices.policy, adapters,
      files: Object.fromEntries(managed.map(({ path, content }) => [path, { sha256: sha(content) }])),
      preserved,
    }, null, 2) + '\n' });
  }
  return { edits: [...edits.values()], inputs, preserved, policy: choices.policy };
}

export function checkQuickstartPrivacy(project: Project, edits: Edit[], policy: Choices['policy'], applying = false) {
  if (!project.git.detected) return;
  const { root } = project;
  const willIgnore = !applying && edits.some(edit => edit.path === ignore && edit.before === null && edit.after !== null);
  const privatePaths = policy === 'local-only' ? edits.map(edit => edit.path)
    : policy === 'mixed' ? ['.ai/knowledge/', '.ai/decisions/', '.ai/tasks/'] : [];
  for (const path of privatePaths) {
    if (inspectGitPath(root, path, 'tracked') !== false ||
        !(willIgnore && path.startsWith('.ai/')) && inspectGitPath(root, path, 'ignored') !== true) {
      throw new Error(`Private path must be ignored and untracked: ${path}`);
    }
  }
  if (policy !== 'local-only') {
    for (const { path } of edits) {
      if (inspectGitPath(root, path, 'ignored') !== false) throw new Error(`Git must allow tracking for ${path}.`);
    }
  }
}

export function printQuickstart(project: Project, edits: Edit[], preserved: string[], policy: string, resumed: boolean, label = 'Quickstart') {
  console.log(`${label}: ${project.root} (${project.classification}, ${policy} tracking)`);
  if (project.workspaceMarkers.length || project.packageWorkspaces) console.log('  Workspace detected. Setup is scoped to the repository root.');
  const { findings } = diagnose(project);
  for (const finding of findings.slice(0, 3)) console.log(`  Check: ${finding}`);
  if (findings.length > 3) console.log('  Run ai-setup doctor for the remaining findings.');
  if (resumed) console.log('Resume the saved quickstart plan:');
  for (const { path, before } of edits) console.log(`  ${before === null ? 'Add' : 'Link rules in'} ${path}`);
  if (preserved.length) console.log(`Keep ${preserved.length} existing files, including any customized modules or skills.`);
  if (edits.length) console.log('Review existing instructions for conflicts. Applying saves an ignored recovery journal and backup.');
  else console.log('Setup is already complete.');
}

export function printOnboardingHandoff(withSkill = true) {
  if (!withSkill) {
    console.log('Next: use ai-setup onboard for a read-only inventory. Skill installation and any knowledge writes require separate approval.');
    return;
  }
  console.log('Next: start Claude Code or Codex here and run guided-project-onboarding. Review and approve knowledge separately.');
}
