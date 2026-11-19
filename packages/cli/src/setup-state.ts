import { readObject } from './discovery.ts';
import { templates, validateChoices } from './initialize.ts';
import { bundledVersions, assetEntries, assetGroups } from './bundles.ts';
import { version } from './metadata.ts';
import { sha } from './file-operations.ts';
const owner = 'ai-workflow-kit';

export function parseManifest(source: string | null) {
  const raw = readObject(source ?? undefined);
  if (
    raw?.owner !== owner ||
    typeof raw.version !== 'string' ||
    !bundledVersions.includes(raw.version)
  ) {
    throw new Error('A recognized setup manifest and a bundled installed version are required.');
  }
  const choices = validateChoices(raw.tracking, raw.adapters);
  const base = new Map(
    [...templates({ ...choices, version: raw.version }), ...assetEntries(raw.version)].map(
      (entry) => [entry.path, entry.content],
    ),
  );
  const files = raw.files;
  if (!files || typeof files !== 'object' || Array.isArray(files))
    throw new Error('Invalid manifest provenance.');
  const knownGroups = assetGroups(version);
  if (
    raw.components !== undefined &&
    (!Array.isArray(raw.components) ||
      new Set(raw.components).size !== raw.components.length ||
      raw.components.some((item) => typeof item !== 'string' || !knownGroups.has(item)))
  )
    throw new Error('Invalid managed components.');
  const assetPaths = new Set(assetEntries(version).map((entry) => entry.path));
  if (
    raw.projectOwned !== undefined &&
    (!Array.isArray(raw.projectOwned) ||
      new Set(raw.projectOwned).size !== raw.projectOwned.length ||
      raw.projectOwned.some(
        (path) => typeof path !== 'string' || !assetPaths.has(path) || Object.hasOwn(files, path),
      ))
  )
    throw new Error('Invalid project-owned exceptions.');
  const managed = Object.entries(files).map(([path, meta]) => {
    const content = base.get(path);
    if (content === undefined || meta?.sha256 !== sha(content))
      throw new Error(`Unrecognized baseline for ${path}`);
    return { path, content };
  });
  if (
    raw.pin !== undefined &&
    (typeof raw.pin !== 'string' || !bundledVersions.includes(raw.pin))
  ) {
    throw new Error('Manifest pin is invalid or unavailable in this bundle.');
  }
  return { raw, choices, managed, installed: raw.version, pin: raw.pin };
}
