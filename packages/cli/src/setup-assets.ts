import { currentAsset, currentGroups } from './bundles.ts';

const groups = currentGroups();
export const modules = Object.fromEntries(
  [...groups.keys()]
    .filter((id) => id.startsWith('rule:'))
    .map((id) => [id.slice(5), groups.get(id)![0].content]),
);
const skill = currentAsset('skills/guided-project-onboarding/SKILL.md');
export const guide = skill
  .slice(skill.indexOf('# Guided project onboarding') + '# Guided project onboarding'.length)
  .trim();
export function bundledRule(name: string): string {
  const content = modules[name];
  if (content === undefined) throw new Error(`Unknown rule module: ${name}`);
  return content;
}
export function onboardingSkills(agent: string) {
  return [
    ...(agent === 'codex' ? [] : groups.get('skill:claude')!),
    ...(agent === 'claude' ? [] : groups.get('skill:codex')!),
  ];
}
