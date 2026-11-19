import { currentGroups } from './bundles.ts';

export const fullIndex = '.ai/rules/full/README.md';
export const fullStandards = currentGroups().get('full')!;
