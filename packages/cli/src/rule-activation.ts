import { fullIndex } from './full-standards.ts';
import { exists } from './discovery.ts';
import type { Project } from './discovery.ts';
import { safePath } from './initialize.ts';

export const engineeringModules = ['architecture', 'security', 'testing', 'git', 'workflows'];
export const rulePath = (name: string) => `.ai/rules/engineering-${name}.md`;
const start = '<!-- ai-workflow-kit:engineering-rules -->';
const end = '<!-- /ai-workflow-kit:engineering-rules -->';
export const adapterPaths = ['AGENTS.md', 'AGENTS.override.md', 'CLAUDE.md', '.claude/CLAUDE.md', '.cursor/rules/ai-workflow-kit.mdc'];

function block(path: string, names: string[], includeContext = false, full = false): string {
  const claude = path.endsWith('CLAUDE.md');
  const prefix = path === '.claude/CLAUDE.md' ? '../' : '';
  const rules = names.map(name => claude ? `@${prefix}${rulePath(name)}` : `- \`${rulePath(name)}\``);
  const safety = 'Get explicit approval before writes or side effects. For known breaking changes obtain three distinct explicit confirmations. Use native safeguards.';
  if (!full && !names.length) {
    return `\n\n${start}\n## Project safety\n\n${safety} Read .ai/rules/permissions.md and .ai/README.md before planning.\n${end}\n`;
  }
  if (full) {
    const nav = claude ? `@${prefix}${fullIndex}` : `Read \`${fullIndex}\` at task start.`;
    const custom = rules.length ? `\nPreviously selected project-customized rules:\n\n${rules.join('\n')}\n` : '';
    return `\n\n${start}\n## Full Engineering\n\n${safety} Read .ai/rules/permissions.md and .ai/README.md before planning. Load only applicable detailed modules; keep existing project instructions and ask the owner to resolve conflicts.\n\n${nav}\n${custom}${end}\n`;
  }
  const context = includeContext ? 'Read `.ai/rules/permissions.md` for approval and safety and `.ai/README.md` for shared project context.\n\n' : '';
  return `\n\n${start}\n## Selected engineering rules\n\nBefore planning or implementing a task, load and apply the applicable rules below from the repository root. Preserve existing instructions and ask the project owner to resolve any conflict before proceeding.\n\n${context}${rules.join('\n')}\n${end}\n`;
}

export function splitRuleBlock(path: string, content: string) {
  const index = content.indexOf(start);
  if (index === -1 && !content.includes(end)) return { original: content, names: [] as string[], full: false };
  const original = content.slice(0, index - 2);
  const suffix = content.slice(index - 2);
  const names = engineeringModules.filter(name => suffix.includes(rulePath(name)));
  if (suffix === block(path, [], true)) return { original, names, full: false, minimal: true };
  if (suffix === block(path, names, true, true)) return { original, names, full: true };
  if (!names.length || suffix !== block(path, names) && suffix !== block(path, names, true)) throw new Error(`Review the customized engineering rule block in ${path} before proceeding.`);
  return { original, names, full: false };
}

export function isRuleBlockEdit(path: string, before: unknown, after: unknown): boolean {
  return adapterPaths.includes(path) && typeof before === 'string' && typeof after === 'string' &&
    splitRuleBlock(path, before).original === splitRuleBlock(path, after).original;
}

export function ruleAdapters(project: Project, present = (path: string) => exists(safePath(project.root, path))): string[] {
  return [
    ['AGENTS.override.md', 'AGENTS.md'].find(present),
    ['CLAUDE.md', '.claude/CLAUDE.md'].find(present),
    ['.cursor/rules/ai-workflow-kit.mdc'].find(present),
  ].filter(path => path !== undefined);
}

export function planRuleActivation(project: Project, names: string[], read: (path: string) => string | null, paths = ruleAdapters(project), includeContext = false, full?: (name: string) => boolean, minimal = false) {
  if ((!minimal && !full && !names.length) || names.some(name => !engineeringModules.includes(name)) || new Set(names).size !== names.length) {
    throw new Error('Select existing modules: architecture security testing git workflows, or use rules activate all.');
  }
  for (const name of names) if (!read(rulePath(name))?.trim()) throw new Error(`Missing or empty engineering module: ${rulePath(name)}`);
  if (!paths.length) throw new Error('Set up a supported instruction entry point before activating engineering rules.');
  return paths.flatMap(path => {
    const before = read(path);
    if (before === null) throw new Error(`Instruction file disappeared: ${path}`);
    if (path.endsWith('.mdc') && !/^---\r?\n[\s\S]*?^alwaysApply:\s*true\s*$[\s\S]*?^---\s*$/m.test(before)) {
      throw new Error(`Review the existing Cursor rule scope in ${path} before activation.`);
    }
    const { original, names: active, full: activeFull } = splitRuleBlock(path, before);
    const hasContext = active.length > 0 && before === original + block(path, active, true);
    if (activeFull && !full || minimal && (active.length || before !== original)) return [];
    const after = full ? original + block(path, active.filter(full), true, true) : original + block(path, engineeringModules.filter(name => active.includes(name) || names.includes(name)), includeContext || hasContext);
    return before === after ? [] : [{ path, before, after }];
  });
}
