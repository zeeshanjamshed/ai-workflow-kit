import { currentAsset } from './bundles.ts';

export const permissions = currentAsset('instructions/permissions.md');
export const projectIndex = currentAsset('instructions/project-index.md');
export function adapterInstructions(agent: 'claude' | 'codex' | 'cursor'): string {
  return currentAsset(`adapters/${agent}.md`);
}
