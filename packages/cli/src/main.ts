#!/usr/bin/env node
import { realpathSync } from 'node:fs';
import { commandOptions, detailedHelp, parseOptions, simpleHelp } from './arguments.ts';
import { discover } from './discovery.ts';
import { diagnose } from './reports.ts';
import { discoverSkills, resumeContext } from './context.ts';
import { setup } from './setup.ts';
import { update } from './update.ts';
import { onboard } from './onboarding.ts';
import { coordinate } from './coordination.ts';
import { initialize, parseChoices } from './initialize.ts';
import { version } from './metadata.ts';
import { guidedInit } from './guided-init.ts';
import { DialogCancelled } from './terminal.ts';

async function main() {
  const [command = '', ...args] = process.argv.slice(2);
  if (['', '--help', '-h'].includes(command)) {
    console.log(simpleHelp);
    return;
  }
  if (command === '--help-all') {
    console.log(detailedHelp);
    return;
  }
  if (command === '--version' && !args.length) {
    console.log(version);
    return;
  }
  if (!Object.hasOwn(commandOptions, command) || command === 'activate-rules') {
    console.error(detailedHelp);
    process.exitCode = 2;
    return;
  }
  const parsed = parseOptions(command, args);
  if (parsed.values.help) {
    console.log(detailedHelp);
    return;
  }
  if (
    (['doctor', 'skills'].includes(command) && parsed.positionals.length) ||
    (command === 'context' && parsed.positionals.length > 1)
  )
    throw new Error('Unexpected positional arguments.');
  const project = discover();
  switch (command) {
    case 'init': {
      // Preserve the original scripted interface through an explicit adapter.
      const legacy =
        parsed.values.tracking !== undefined &&
        parsed.values.agents !== undefined &&
        !parsed.values.guided;
      if (legacy) {
        if (parsed.values['no-launch'])
          throw new Error('Add --guided when combining legacy choice flags with --no-launch.');
        await initialize(project, parseChoices(args), Boolean(parsed.values['dry-run']));
      } else await guidedInit(project, args);
      break;
    }
    case 'setup':
    case 'full':
      await setup(project, command, args);
      break;
    case 'update':
    case 'repair':
    case 'pin':
    case 'rollback':
    case 'quickstart':
      await update(project, command, args);
      break;
    case 'onboard':
    case 'rules':
      await onboard(project, command, args);
      break;
    case 'coordinate':
      await coordinate(project, args);
      break;
    case 'skills':
      console.log(JSON.stringify(discoverSkills(project, realpathSync(process.cwd())), null, 2));
      break;
    case 'context':
      console.log(JSON.stringify(resumeContext(project, parsed.positionals[0]), null, 2));
      break;
    case 'doctor': {
      const report = diagnose(project);
      console.log(JSON.stringify(report, null, 2));
      if (report.findings.length) process.exitCode = 1;
      break;
    }
  }
}

try {
  await main();
} catch (error) {
  if (error instanceof DialogCancelled) process.exitCode = 130;
  else {
    console.error('Operation failed:', error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
