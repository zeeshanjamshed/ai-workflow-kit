export const modules = {
  architecture: 'Inspect boundaries, dependencies, contracts, and affected consumers. Reuse proven project patterns and preserve existing behavior. Keep changes cohesive and proportional to the requirement.',
  security: 'Identify trust boundaries, authorization, input validation, secret handling, and failure paths. Use native safeguards and verify risky changes with a recovery plan.',
  testing: 'Verify affected flows, regressions, and failure cases with relevant approved checks. Report evidence and uncertainty. Obtain approval before checks that write or affect external state.',
  git: 'Inspect branch, working tree, and overlapping work before changes. Preserve other work. Obtain approval before Git writes, branch changes, shared-environment changes, or publishing.',
  workflows: 'For features, verify scope and integration points. For debugging, reproduce and distinguish confirmed causes from hypotheses. For reviews, trace consumers and cite evidence. For high-risk changes, plan compatibility, sequencing, verification, and rollback before asking for approval.',
} as const;

export const guide = `Run ai-setup onboard from the relevant checkout. Read existing agent instructions, project docs, and selected modules from ai-setup rules. Identify conflicting instructions explicitly and ask the project owner to resolve them before adopting a conflicting rule. Inspect actual manifests and source, trace critical flows to their boundaries, and sample relevant tests and conventions. In a monorepo, identify shared dependencies and examine only relevant packages. Distinguish verified facts, hypotheses, and open questions. Propose only useful knowledge records, cite source lines, and keep secrets out. Review existing knowledge for overlap. Show the proposal to the owner and wait for explicit approval before writing. Use ai-setup onboard save to review and save approved records. Recheck the code before relying on prior knowledge.`;
const skill = `---\nname: guided-project-onboarding\ndescription: Review an existing project using code evidence and propose project knowledge for approval.\n---\n\n# Guided project onboarding\n\n${guide}\n`;
export function bundledRule(name: string): string {
  return `# ${name[0].toUpperCase() + name.slice(1)}\n\n${modules[name as keyof typeof modules]}\n`;
}


export function onboardingSkills(agent: string) {
  return [
    ...(agent === 'codex' ? [] : [{ path: '.claude/skills/guided-project-onboarding/SKILL.md', content: skill }]),
    ...(agent === 'claude' ? [] : [{ path: '.agents/skills/guided-project-onboarding/SKILL.md', content: skill }]),
  ];
}
