import { openDialog } from './terminal.ts';
import { parseOptions, stringOption } from './arguments.ts';
import type { Project } from './discovery.ts';
import { exists } from './discovery.ts';
import { safePath, validateChoices } from './initialize.ts';
import type { PresetOptions } from './quickstart.ts';
import { update } from './update.ts';

const presets = ['minimal', 'quickstart', 'full'];

export async function setup(project: Project, command: string, args: string[]) {
  const parsed = parseOptions(command, args);
  const dry = Boolean(parsed.values['dry-run']);
  const presetFlag = stringOption(parsed.values.preset);
  const trackingFlag = stringOption(parsed.values.tracking);
  const onboarding = parsed.values.onboarding
    ? '--onboarding'
    : parsed.values['no-onboarding']
      ? '--no-onboarding'
      : undefined;
  if (parsed.positionals.length || (parsed.values.onboarding && parsed.values['no-onboarding']))
    throw new Error('Choose one onboarding option and no positional arguments.');
  const pending = exists(safePath(project.root, '.ai/update-backups/.pending.json'));
  const dialog = openDialog();
  const { ask } = dialog;
  try {
    const approval = async () =>
      (await ask('Type apply to approve this operation and its backup:', false)) === 'apply';
    if (pending) {
      if (parsed.tokens.some((token) => token.kind === 'option' && token.name !== 'dry-run'))
        throw new Error(
          'Resume with ai-setup setup or ai-setup setup --dry-run to review the saved plan.',
        );
      await update(project, 'quickstart', dry ? ['--dry-run'] : [], undefined, approval);
      return;
    }
    const selected =
      command === 'full'
        ? 'full'
        : (presetFlag ??
          (dry ? 'quickstart' : await ask('Choose a preset (minimal, quickstart, full):')));
    if (!selected || !presets.includes(selected))
      throw new Error('Choose minimal, quickstart, or full.');
    const skill =
      onboarding ??
      (command === 'full' || dry || presetFlag
        ? '--no-onboarding'
        : await ask('Install guided onboarding skills for Claude Code and Codex? (yes/no)'));
    if (!skill || !['yes', 'no', '--onboarding', '--no-onboarding'].includes(skill))
      throw new Error('Choose yes or no for skill installation.');
    const initialized = project.classification === 'initialized';
    if (initialized && trackingFlag)
      throw new Error('Existing setup tracking is preserved. Omit --tracking.');
    const tracking =
      trackingFlag ??
      (initialized || command === 'full' || dry || presetFlag
        ? 'mixed'
        : await ask(
            'Tracking (mixed, tracked, local-only). Mixed keeps knowledge, decisions, and task records out of Git:',
          ));
    const { policy } = validateChoices(tracking, []);
    await update(
      project,
      'quickstart',
      dry ? ['--dry-run'] : [],
      {
        preset: selected as PresetOptions['preset'],
        onboarding: skill === 'yes' || skill === '--onboarding',
        policy,
      },
      approval,
    );
  } finally {
    dialog.close();
  }
}
