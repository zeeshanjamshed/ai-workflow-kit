import type { Edit } from './quickstart.ts';
import { adapterPaths } from './rule-activation.ts';

const start = '# ai-workflow-kit local setup';
const end = '# /ai-workflow-kit local setup';
const allowed = new Set([
  '/.ai/',
  ...adapterPaths.map((path) => '/' + path),
  '/.agents/skills/guided-project-onboarding/',
  '/.claude/skills/guided-project-onboarding/',
]);

// Only append a recognizable block. Existing ignore text is never rewritten.
export function localIgnoreEdit(before: string | null, paths: string[]): Edit | undefined {
  const lines = [
    ...new Set([
      '/.ai/',
      ...paths
        .filter((path) => !path.startsWith('.ai/'))
        .map(
          (path) => '/' + (path.endsWith('/SKILL.md') ? path.slice(0, -'SKILL.md'.length) : path),
        ),
    ]),
  ].sort();
  if (lines.some((line) => !allowed.has(line))) throw new Error('Unknown local setup ignore path.');
  const block = `\n\n${start}\n${lines.join('\n')}\n${end}\n`;
  if (before?.endsWith(block)) return;
  if (before?.includes(start) || before?.includes(end))
    throw new Error('Existing kit ignore section differs. Review its privacy rules first.');
  return { path: '.gitignore', before, after: (before ?? '') + block };
}

export function isLocalIgnoreEdit(before: unknown, after: unknown): boolean {
  if ((before !== null && typeof before !== 'string') || typeof after !== 'string') return false;
  const suffix = after.slice((before ?? '').length);
  if (
    !after.startsWith(before ?? '') ||
    !suffix.startsWith(`\n\n${start}\n`) ||
    !suffix.endsWith(`\n${end}\n`)
  )
    return false;
  if (typeof before === 'string' && (before.includes(start) || before.includes(end))) return false;
  const lines = suffix.slice(`\n\n${start}\n`.length, -`\n${end}\n`.length).split('\n');
  return (
    lines.includes('/.ai/') &&
    new Set(lines).size === lines.length &&
    lines.every((line) => allowed.has(line))
  );
}
