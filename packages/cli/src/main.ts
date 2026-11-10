#!/usr/bin/env node
import { discover } from './discovery.ts';
import { diagnose, preview } from './reports.ts';
import { initialize, parseChoices } from './initialize.ts';

const usage = 'Usage: ai-setup doctor | ai-setup init [--dry-run] [--tracking=POLICY --agents=LIST]';
const [command = '', ...args] = process.argv.slice(2);

if (command === '--help' || command === '-h' || command === '') {
  console.log(usage);
} else if (command === 'doctor' && args.length === 0 || command === 'init') {
  try {
    const project = discover();
    const dryRun = args[0] === '--dry-run';
    const options = dryRun ? args.slice(1) : args;
    if (command === 'init' && (!dryRun || options.length)) {
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
