#!/usr/bin/env node
import { discover } from './discovery.ts';
import { diagnose, preview } from './reports.ts';
import { realpathSync } from 'node:fs';
import { discoverSkills, resumeContext } from './context.ts';
import { update } from './update.ts';
import { onboard } from './onboarding.ts';
import { coordinate } from './coordination.ts';
import { initialize, parseChoices, version } from './initialize.ts';

const usage = 'Usage: ai-setup doctor | ai-setup skills | ai-setup context [task-id] | ai-setup init [--dry-run] [--tracking=POLICY --agents=LIST] | ai-setup update [--dry-run] | ai-setup repair | ai-setup pin VERSION | ai-setup rollback ID | ai-setup coordinate ACTION | ai-setup onboard [save|install-skills] | ai-setup rules [minimal|recommended|custom|activate]';
const [command = '', ...args] = process.argv.slice(2);

const operations = ['update', 'repair', 'pin', 'rollback'];

if (command === '--version' && !args.length) {
  console.log(version);
} else if (command === '--help' || command === '-h' || command === '') {
  console.log(usage);
} else if ((command === 'doctor' || command === 'skills') && args.length === 0 ||
           command === 'context' && args.length <= 1 || command === 'init' || operations.includes(command) || command === 'coordinate' || command === 'onboard' || command === 'rules') {
  try {
    const project = discover();
    const dryRun = args[0] === '--dry-run';
    const options = dryRun ? args.slice(1) : args;
    if (command === 'onboard' || command === 'rules') {
      await onboard(project, command, args);
    } else if (command === 'coordinate') {
      await coordinate(project, args);
    } else if (operations.includes(command)) {
      await update(project, command, args);
    } else if (command === 'skills') {
      console.log(JSON.stringify(discoverSkills(project, realpathSync(process.cwd())), null, 2));
    } else if (command === 'context') {
      console.log(JSON.stringify(resumeContext(project, args[0]), null, 2));
    } else if (command === 'init' && (!dryRun || options.length)) {
      await initialize(project, options.length ? parseChoices(options) : undefined, dryRun);
    } else {
      const report = command === 'doctor' ? diagnose(project) : preview(project);
      console.log(JSON.stringify(report, null, 2));
      if ('findings' in report && report.findings.length) process.exitCode = 1;
    }
  } catch (error) {
    console.error('Unable to inspect the project:', error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
} else {
  console.error(usage);
  process.exitCode = 2;
}
