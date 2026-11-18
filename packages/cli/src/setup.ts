import { createInterface } from 'node:readline/promises';
import { stdin } from 'node:process';
import type { Project } from './discovery.ts';
import { exists } from './discovery.ts';
import { safePath, validateChoices } from './initialize.ts';
import type { PresetOptions } from './quickstart.ts';
import { update } from './update.ts';

const presets = ['minimal', 'quickstart', 'full'];

export async function setup(project: Project, command: string, args: string[]) {
  const dry = args.includes('--dry-run');
  const flags = args.filter(arg => arg !== '--dry-run');
  const presetFlag = flags.find(arg => arg.startsWith('--preset='));
  const trackingFlag = flags.find(arg => arg.startsWith('--tracking='));
  const onboarding = flags.filter(arg => arg === '--onboarding' || arg === '--no-onboarding');
  if (args.length !== flags.length + Number(dry) || onboarding.length > 1 ||
      flags.length !== Number(Boolean(presetFlag)) + Number(Boolean(trackingFlag)) + onboarding.length ||
      command === 'full' && presetFlag) throw new Error('Use setup [--preset=minimal|quickstart|full] [--onboarding|--no-onboarding] [--tracking=POLICY] [--dry-run].');
  const pending = exists(safePath(project.root, '.ai/update-backups/.pending.json'));
  const input = createInterface({ input: stdin, terminal: false });
  const lines = input[Symbol.asyncIterator]();
  const ask = async (prompt: string) => {
    console.log(prompt);
    return (await lines.next()).value?.trim();
  };
  try {
    const approval = async () => await ask('Type apply to approve this operation and its backup:') === 'apply';
    if (pending) {
      if (flags.length) throw new Error('Resume with ai-setup setup or ai-setup setup --dry-run to review the saved plan.');
      await update(project, 'quickstart', dry ? ['--dry-run'] : [], undefined, approval);
      return;
    }
    const selected = command === 'full' ? 'full' : presetFlag?.slice(9) ??
      (dry ? 'quickstart' : await ask('Choose a preset (minimal, quickstart, full):'));
    if (!selected || !presets.includes(selected)) throw new Error('Choose minimal, quickstart, or full.');
    const skill = onboarding.at(0) ?? (command === 'full' || dry || presetFlag ? '--no-onboarding'
      : await ask('Install guided onboarding skills for Claude Code and Codex? (yes/no)'));
    if (!skill || !['yes', 'no', '--onboarding', '--no-onboarding'].includes(skill)) throw new Error('Choose yes or no for skill installation.');
    const initialized = project.classification === 'initialized';
    if (initialized && trackingFlag) throw new Error('Existing setup tracking is preserved. Omit --tracking.');
    const tracking = trackingFlag?.slice(11) ?? (initialized || command === 'full' || dry || presetFlag ? 'mixed'
      : await ask('Tracking (mixed, tracked, local-only). Mixed keeps knowledge, decisions, and task records out of Git:'));
    const { policy } = validateChoices(tracking, []);
    await update(project, 'quickstart', dry ? ['--dry-run'] : [],
      { preset: selected as PresetOptions['preset'], onboarding: skill === 'yes' || skill === '--onboarding', policy }, approval);
  } finally {
    input.close();
  }
}
