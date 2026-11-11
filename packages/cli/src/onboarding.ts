import { ruleAdapters, rulePath, splitRuleBlock } from './rule-activation.ts';
import { update } from './update.ts';
import { realpathSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { stdin } from 'node:process';
import { discoverSkills, resumeContext } from './context.ts';
import { exists, git, inspectGitPath, readObject, readProjectFile } from './discovery.ts';
import type { Project } from './discovery.ts';
import { install, manifestPath, safePath, sha } from './initialize.ts';

const modules = {
  architecture: 'Inspect boundaries, dependencies, contracts, and affected consumers. Reuse proven project patterns and preserve existing behavior. Keep changes cohesive and proportional to the requirement.',
  security: 'Identify trust boundaries, authorization, input validation, secret handling, and failure paths. Use native safeguards and verify risky changes with a recovery plan.',
  testing: 'Verify affected flows, regressions, and failure cases with relevant approved checks. Report evidence and uncertainty. Obtain approval before checks that write or affect external state.',
  git: 'Inspect branch, working tree, and overlapping work before changes. Preserve other work. Obtain approval before Git writes, branch changes, shared-environment changes, or publishing.',
  workflows: 'For features, verify scope and integration points. For debugging, reproduce and distinguish confirmed causes from hypotheses. For reviews, trace consumers and cite evidence. For high-risk changes, plan compatibility, sequencing, verification, and rollback before asking for approval.',
} as const;

const guide = `Run ai-setup onboard from the relevant checkout. Read existing agent instructions, project docs, and selected modules from ai-setup rules. Identify conflicting instructions explicitly and ask the project owner to resolve them before adopting a conflicting rule. Inspect actual manifests and source, trace critical flows to their boundaries, and sample relevant tests and conventions. In a monorepo, identify shared dependencies and examine only relevant packages. Distinguish verified facts, hypotheses, and open questions. Propose only useful knowledge records, cite source lines, and keep secrets out. Review existing knowledge for overlap. Show the proposal to the owner and wait for explicit approval before writing. Use ai-setup onboard save to review and save approved records. Recheck the code before relying on prior knowledge.`;
const skill = `---\nname: guided-project-onboarding\ndescription: Review an existing project using code evidence and propose project knowledge for approval.\n---\n\n# Guided project onboarding\n\n${guide}\n`;
const slug = /^[a-z0-9][a-z0-9-]{0,63}$/;
type Addition = { path: string; content: string };

function bundledRule(name: string): string {
  return `# ${name[0].toUpperCase() + name.slice(1)}\n\n${modules[name as keyof typeof modules]}\n`;
}

function ruleInventory(project: Project) {
  const adapters = ruleAdapters(project).map(path => ({
    path, names: splitRuleBlock(path, readProjectFile(project.root, path) ?? '').names,
  }));
  return Object.keys(modules).map(name => {
    const path = rulePath(name);
    const content = readProjectFile(project.root, path);
    const selectedBy = adapters.filter(adapter => adapter.names.includes(name)).map(adapter => adapter.path);
    return { name, path, present: content !== undefined, selected: selectedBy.length > 0, selectedBy,
      provenance: content === undefined ? 'missing' : content === bundledRule(name) ? 'matches-bundle' : 'project-owned' };
  });
}

function trackedFiles(project: Project) {
  const files = git(project.root, ['ls-files', '--cached', '--full-name', '-z']);
  return files?.split('\0').filter(path => path && !sensitivePath.test(path)).sort() ?? [];
}

const sensitivePath = /(?:^|\/)(?:\.env[^/]*|\.npmrc|\.netrc|\.git|[^/]*\.(?:pem|key|p12|pfx))(?=\/|$)/i;

function evidence(project: Project, tracked: Set<string>, path: unknown, line: unknown, excerpt: unknown) {
  if (typeof path !== 'string' || sensitivePath.test(path) || path.startsWith('.ai/') ||
      !tracked.has(path) || typeof line !== 'number' || !Number.isSafeInteger(line) || line < 1 ||
      typeof excerpt !== 'string' || !excerpt.trim() || excerpt.length > 300) {
    throw new Error('Verified facts require a tracked source path, line number, and short exact excerpt.');
  }
  const content = readProjectFile(project.root, path);
  if (!content?.split(/\r?\n/)[line - 1]?.includes(excerpt)) throw new Error(`Evidence does not match ${path}:${line}.`);
  return `${path}:${line}`;
}

function prose(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 600 || /[\r\n]/.test(value)) {
    throw new Error('Use a non-empty single line of at most 600 characters.');
  }
  return value.trim();
}

function knowledge(project: Project, input: string): Addition[] {
  const records: unknown = JSON.parse(input);
  if (!Array.isArray(records) || !records.length || records.length > 12) throw new Error('Provide 1–12 knowledge records.');
  const ids = new Set<string>();
  const tracked = new Set(trackedFiles(project));
  return records.map(item => {
    if (!item || typeof item.id !== 'string' || !slug.test(item.id) || ids.has(item.id)) {
      throw new Error('Each record needs a unique lowercase ID.');
    }
    ids.add(item.id);
    const { facts, hypotheses, questions } = item;
    if (![facts, hypotheses, questions].every(list => Array.isArray(list) && list.length <= 30) ||
        facts.length + hypotheses.length + questions.length === 0) {
      throw new Error('Provide facts, hypotheses, and questions arrays with up to 30 entries each.');
    }
    const sections: [string, string[]][] = [
      ['Verified facts', facts.map((fact: { text: unknown; path: unknown; line: unknown; excerpt: unknown }) =>
        `${prose(fact.text)} (source: \`${evidence(project, tracked, fact.path, fact.line, fact.excerpt)}\`)`)],
      ['Hypotheses', hypotheses.map(prose)],
      ['Open questions', questions.map(prose)],
    ];
    return {
      path: `.ai/knowledge/${item.id}.md`,
      content: `# ${prose(item.title)}\n` + sections.filter(([, values]) => values.length)
        .map(([heading, values]) => `\n## ${heading}\n\n${values.map(value => '- ' + value).join('\n')}\n`).join(''),
    };
  });
}

function writePlan(project: Project, entries: Addition[]) {
  const manifest = readObject(readProjectFile(project.root, manifestPath));
  if (manifest?.owner !== 'ai-workflow-kit' || !['tracked', 'mixed', 'local-only'].includes(String(manifest.tracking))) {
    throw new Error('Run approved ai-setup init before adding onboarding records, skills, or rules.');
  }
  const review = entries.map(entry => {
    const present = exists(safePath(project.root, entry.path));
    const status = !present ? 'add' : readProjectFile(project.root, entry.path) === entry.content ? 'keep' : 'conflict';
    if (status === 'add' && project.git.detected &&
        (manifest.tracking === 'local-only' || manifest.tracking === 'mixed' && entry.path.startsWith('.ai/knowledge/')) &&
        (inspectGitPath(project.root, entry.path, 'tracked') !== false || inspectGitPath(project.root, entry.path, 'ignored') !== true)) {
      throw new Error(`Git must ignore and leave untracked the private path ${entry.path}.`);
    }
    return { ...entry, status };
  });
  return review;
}

export async function onboard(project: Project, command: 'onboard' | 'rules', args: string[]): Promise<void> {
  const { root } = project;
  if (command === 'rules' && args[0] === 'activate') {
    await update(project, 'activate-rules', args.slice(1));
    return;
  }
  if (!args.length) {
    console.log(JSON.stringify(command === 'rules'
      ? { modules: ruleInventory(project), existingInstructions: project.agents.flatMap(agent => agent.paths) }
      : {
          project, trackedFiles: trackedFiles(project).slice(0, 300), inventoryLimit: 300,
          context: resumeContext(project), skills: discoverSkills(project, realpathSync(process.cwd())),
          guide, knowledgeSchema: [{ id: 'short-id', title: 'Title',
            facts: [{ text: 'Fact', path: 'relative/source.ts', line: 1, excerpt: 'Exact source text' }],
            hypotheses: ['Hypothesis'], questions: ['Question'] }],
        }, null, 2));
    return;
  }

  const input = createInterface({ input: stdin, terminal: false });
  const lines = input[Symbol.asyncIterator]();
  try {
    let build: () => Addition[];
    if (command === 'onboard' && args.length === 1 && args[0] === 'save') {
      console.log('Enter the one-line JSON proposal from the onboarding guide.');
      const proposal = await lines.next();
      if (proposal.done || Buffer.byteLength(proposal.value) > 128 * 1024) throw new Error('Missing or oversized proposal.');
      build = () => knowledge(project, proposal.value);
    } else if (command === 'onboard' && args[0] === 'install-skills' && args.length === 2 && /^(claude|codex|both)$/.test(args[1])) {
      build = () => [
        ...(args[1] === 'codex' ? [] : [{ path: '.claude/skills/guided-project-onboarding/SKILL.md', content: skill }]),
        ...(args[1] === 'claude' ? [] : [{ path: '.agents/skills/guided-project-onboarding/SKILL.md', content: skill }]),
      ];
    } else if (command === 'rules') {
      const names = args[0] === 'minimal' && args.length === 1 ? []
        : args[0] === 'recommended' && args.length === 1 ? Object.keys(modules)
        : args[0] === 'custom' ? args.slice(1) : undefined;
      if (!names || names.some(name => !Object.hasOwn(modules, name)) || new Set(names).size !== names.length) {
        throw new Error('Use rules minimal, rules recommended, or rules custom [architecture security testing git workflows].');
      }
      build = () => names.map(name => ({
        path: rulePath(name),
        content: bundledRule(name),
      }));
    } else throw new Error('Use onboard, onboard save, or onboard install-skills claude|codex|both.');

    const entries = build();
    const plan = writePlan(project, entries);
    console.log(JSON.stringify({
      files: plan, existingInstructions: project.agents.flatMap(agent => agent.paths),
      notes: [
        'Review existing instructions for conflicting requirements before applying.',
        'The plan creates only missing files. Existing content stays in place.',
        'Use rules activate to attach existing modules to normal agent sessions. Minimal adds no modules.',
      ],
    }, null, 2));
    if (plan.some(entry => entry.status === 'conflict')) throw new Error('Existing content differs. Review the conflict before proceeding.');
    if (!plan.some(entry => entry.status === 'add')) return;
    console.log('Type apply to approve these additions:');
    const approval = await lines.next();
    if (approval.done || approval.value.trim() !== 'apply') return;
    if (sha(JSON.stringify(writePlan(project, build()))) !== sha(JSON.stringify(plan))) {
      throw new Error('The proposal or destination changed after preview. Review a fresh plan.');
    }
    for (const { path, content, status } of plan) {
      if (status === 'add') install(root, { path, content });
      if (readProjectFile(root, path) !== content) throw new Error(`Verification failed for ${path}.`);
    }
    console.log('Verified additions. Rerun this command to review or resume.');
  } finally {
    input.close();
  }
}
