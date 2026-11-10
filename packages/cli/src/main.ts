#!/usr/bin/env node
import { discover } from './discovery.ts';
import { diagnose, preview } from './reports.ts';

const usage = 'Usage: ai-setup doctor | ai-setup init --dry-run';
const command = process.argv.slice(2).join(' ');

if (command === '--help' || command === '-h' || command === '') {
  console.log(usage);
} else if (command === 'doctor' || command === 'init --dry-run') {
  try {
    const project = discover();
    const report = command === 'doctor' ? diagnose(project) : preview(project);
    console.log(JSON.stringify(report, null, 2));
    if ('findings' in report && report.findings.length) process.exitCode = 1;
  } catch (error) {
    console.error('Unable to inspect the project:', error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
} else {
  console.error(usage);
  process.exitCode = 2;
}
