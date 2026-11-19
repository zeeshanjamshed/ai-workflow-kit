import { parseManifest } from './setup-state.ts';
import { manifestPath, templates } from './initialize.ts';
import { json, sha } from './file-operations.ts';
import { assetEntries, assetGroups, bundledVersions } from './bundles.ts';
import { version } from './metadata.ts';
import { adapterPaths, splitRuleBlock } from './rule-activation.ts';
import type { Edit } from './setup-types.ts';

export function planUpdate(read: (path: string) => string | null, action: string, value?: string) {
  const before = read(manifestPath);
  const { raw, choices, managed, installed, pin } = parseManifest(before);
  const edits: Edit[] = [];
  const comparisons: { path: string; status: string }[] = [];
  const conflicts: string[] = [];
  const inputs = new Map<string, string | null>([[manifestPath, before]]);
  const snapshot = (path: string) => {
    const content = read(path);
    inputs.set(path, content);
    return content;
  };
  let next = { ...raw };
  if (action === 'pin') {
    if (value === 'none') delete next.pin;
    else if (value === installed || value === version) next.pin = value;
    else throw new Error('Pin the installed version, the current bundled version, or use none.');
  } else if (action === 'repair') {
    for (const { path, content } of managed) {
      if (read(path) === null) edits.push({ path, before: null, after: content });
    }
  } else {
    const target = value ?? pin ?? version;
    if (target !== installed && target !== version)
      throw new Error('Only the installed or current bundled version can be selected.');
    if (pin && target !== pin)
      throw new Error(
        `Version is pinned to ${pin}. Change the pin in a separate approved operation.`,
      );
    const proposed = new Map(
      [...templates({ ...choices, version: target }), ...assetEntries(target)].map((entry) => [
        entry.path,
        entry.content,
      ]),
    );
    const files = Object.fromEntries(
      managed.map(({ path, content }) => [path, { sha256: sha(proposed.get(path) ?? content) }]),
    );
    for (const { path, content: base } of managed) {
      const local = snapshot(path);
      const incoming = proposed.get(path);
      let status: string;
      if (incoming === undefined || local === null) {
        status = 'conflict';
      } else if (local === incoming) {
        status = 'matches-proposed';
      } else if (base === incoming) {
        status = 'preserve-local';
      } else if (local === base) {
        status = 'replace-with-bundled';
        edits.push({ path, before: local, after: incoming });
      } else if (adapterPaths.includes(path) && splitRuleBlock(path, local).original === base) {
        status = 'update-instructions-keep-rule-links';
        edits.push({ path, before: local, after: incoming + local.slice(base.length) });
      } else {
        status = 'conflict';
      }
      if (status === 'conflict') conflicts.push(path);
      comparisons.push({ path, status });
    }
    // Legacy optional assets were not in the manifest. Adopt only recognized stock
    // content; unknown content becomes an explicit project-owned exception.
    if (target === version) {
      const components = new Set<string>((raw.components as string[]) ?? []);
      const projectOwned = new Set<string>((raw.projectOwned as string[]) ?? []);
      for (const [id, entries] of assetGroups(target)) {
        if (
          entries.some(
            ({ path }) =>
              (id !== 'full' || path.startsWith('.ai/rules/full/')) &&
              (snapshot(path) !== null || Object.hasOwn(raw.files as object, path)),
          )
        )
          components.add(id);
        if (!components.has(id)) continue;
        for (const { path, content } of entries) {
          if (Object.hasOwn(files, path)) continue;
          const local = snapshot(path);
          if (projectOwned.has(path)) {
            comparisons.push({ path, status: 'preserve-project-owned' });
            continue;
          }
          const recognized = bundledVersions.some((bundled) =>
            assetEntries(bundled).some((entry) => entry.path === path && entry.content === local),
          );
          if (local !== null && !recognized) {
            projectOwned.add(path);
            comparisons.push({ path, status: 'preserve-project-owned' });
            continue;
          }
          files[path] = { sha256: sha(content) };
          comparisons.push({
            path,
            status:
              local === content
                ? 'adopt-bundled'
                : local === null
                  ? 'add-bundled'
                  : 'replace-with-bundled',
          });
          if (local !== content) edits.push({ path, before: local, after: content });
        }
      }
      next = { ...raw, version: target, files };
      if (components.size || raw.components !== undefined) next.components = [...components];
      if (projectOwned.size || raw.projectOwned !== undefined)
        next.projectOwned = [...projectOwned];
    } else if (target !== installed) {
      next = { ...raw, version: target, files };
    }
  }
  if (json(raw) !== json(next)) edits.push({ path: manifestPath, before, after: json(next) });
  return { installed, pin, comparisons, conflicts, edits, inputs };
}
