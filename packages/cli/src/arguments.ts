import { parseArgs } from 'node:util';
import type { ParseArgsConfig } from 'node:util';

const boolean = { type: 'boolean' } as const;
const string = { type: 'string' } as const;
const dry = { 'dry-run': boolean };

// This is the only CLI option grammar. Command handlers validate domain values.
export const commandOptions: Record<string, NonNullable<ParseArgsConfig['options']>> = {
  init: { ...dry, tracking: string, agents: string, guided: boolean, 'no-launch': boolean },
  setup: {
    ...dry,
    preset: string,
    onboarding: boolean,
    'no-onboarding': boolean,
    tracking: string,
  },
  full: { ...dry, onboarding: boolean, 'no-onboarding': boolean, tracking: string },
  quickstart: dry,
  update: { ...dry, version: string },
  repair: dry,
  pin: dry,
  rollback: dry,
  'activate-rules': dry,
  doctor: {},
  skills: {},
  context: {},
  onboard: {},
  rules: dry,
  coordinate: { worktree: boolean },
};

export function parseOptions(command: string, args: string[]) {
  const options = commandOptions[command];
  if (!options) throw new Error(`Unknown command: ${command}`);
  const definitions: NonNullable<ParseArgsConfig['options']> = {
    ...options,
    help: { type: 'boolean', short: 'h' },
  };
  const parsed = parseArgs({
    args,
    options: definitions,
    allowPositionals: true,
    strict: true,
    tokens: true,
  });
  const names = new Set<string>();
  for (const token of parsed.tokens) {
    if (token.kind !== 'option') continue;
    if (names.has(token.name)) throw new Error(`Duplicate option: --${token.name}`);
    names.add(token.name);
  }
  return parsed;
}

export function stringOption(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export const simpleHelp =
  'AI Workflow Kit\n\n  ai-setup init     Set up this project and optionally start onboarding\n  ai-setup update   Review and apply kit updates\n\nUse init --dry-run to preview without writes. Use --help-all for maintenance and compatibility commands.';
export const detailedHelp = [
  simpleHelp,
  '',
  'Initialization options',
  '  init [--guided] [--tracking=shared|mixed|local-only] [--agents=claude,codex,cursor] [--no-launch] [--dry-run]',
  '  Original paired tracking/agents flags without --guided retain legacy minimal initialization.',
  '',
  'Maintenance',
  '  update [--version=VERSION] [--dry-run]',
  '  doctor | skills | context [task-id]',
  '  repair | pin VERSION | rollback BACKUP-ID',
  '  onboard [save|install-skills claude|codex|both]',
  '  rules [minimal|recommended|custom MODULE...] | rules activate MODULE... [--dry-run]',
  '  coordinate ACTION [--worktree]',
  '',
  'Compatibility',
  '  quickstart [--dry-run]',
  '  setup [--preset=minimal|quickstart|full] [--onboarding|--no-onboarding] [--tracking=POLICY] [--dry-run]',
  '  full [--onboarding|--no-onboarding] [--dry-run]',
].join('\n');
