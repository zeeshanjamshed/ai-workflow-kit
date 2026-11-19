import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { packageRoot, version } from './metadata.ts';

export type Entry = { path: string; content: string };
export type BundleChoices = {
  policy: 'tracked' | 'mixed' | 'local-only';
  agents: ('claude' | 'codex' | 'cursor')[];
};
export type Snapshot = {
  version: string;
  templates: Record<string, { path: string; hash: string }[]>;
  groups: Record<string, { path: string; hash: string }[]>;
  contents: Record<string, string>;
};

const releases = join(packageRoot, 'assets/releases');
export const bundledVersions = [
  ...new Set([
    ...readdirSync(releases)
      .filter((name) => /^\d+\.\d+\.\d+(?:-[\w.-]+)?\.json$/.test(name))
      .map((name) => name.slice(0, -5)),
    version,
  ]),
];
export const contentHash = (content: string) => createHash('sha256').update(content).digest('hex');

export function currentAsset(source: string): string {
  if (source.split('/').some((part) => !/^[\w.-]+$/.test(part) || part === '.' || part === '..'))
    throw new Error('Invalid asset source.');
  return readFileSync(join(packageRoot, 'assets/current', source), 'utf8');
}

export function currentGroups() {
  const catalog: { groups: Record<string, { path: string; source: string }[]> } = JSON.parse(
    currentAsset('catalog.json'),
  );
  return new Map(
    Object.entries(catalog.groups).map(([id, entries]) => [
      id,
      entries.map(({ path, source }) => ({ path, content: currentAsset(source) })),
    ]),
  );
}

export function snapshot(release: string): Snapshot {
  if (!bundledVersions.includes(release)) throw new Error(`Unknown bundled version: ${release}`);
  const data: Snapshot = JSON.parse(readFileSync(join(releases, release + '.json'), 'utf8'));
  if (
    data.version !== release ||
    Object.entries(data.contents).some(([hash, content]) => contentHash(content) !== hash)
  )
    throw new Error(`Invalid frozen bundle: ${release}`);
  return data;
}

function expand(data: Snapshot, entries: { path: string; hash: string }[]): Entry[] {
  return entries.map(({ path, hash }) => {
    const content = data.contents[hash];
    if (content === undefined) throw new Error(`Missing bundle content: ${path}`);
    return { path, content };
  });
}

export function frozenTemplates(release: string, choices: BundleChoices) {
  const data = snapshot(release);
  const entries = data.templates[JSON.stringify([choices.policy, choices.agents])];
  if (!entries) throw new Error('Unknown frozen template choices.');
  return expand(data, entries);
}

export function assetGroups(release: string): Map<string, Entry[]> {
  if (release === version) return currentGroups();
  const data = snapshot(release);
  return new Map(Object.entries(data.groups).map(([id, entries]) => [id, expand(data, entries)]));
}

export function assetEntries(release: string) {
  return [...assetGroups(release).values()].flat();
}
