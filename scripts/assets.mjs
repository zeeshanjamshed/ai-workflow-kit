import { existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { templates } from '../packages/cli/src/initialize.ts';
import {
  assetGroups,
  bundledVersions,
  contentHash,
  snapshot,
} from '../packages/cli/src/bundles.ts';
import { packageRoot, version } from '../packages/cli/src/metadata.ts';

export function agentOrders(names) {
  return [
    [],
    ...names.flatMap((name, index) =>
      agentOrders(names.filter((_, other) => other !== index)).map((tail) => [name, ...tail]),
    ),
  ];
}

export function buildSnapshot() {
  const contents = {};
  const entry = ({ path, content }) => {
    const hash = contentHash(content);
    contents[hash] = content;
    return { path, hash };
  };
  const variants = {};
  for (const policy of ['tracked', 'mixed', 'local-only']) {
    for (const agents of agentOrders(['codex', 'claude', 'cursor'])) {
      variants[JSON.stringify([policy, agents])] = templates({ policy, agents }).map(entry);
    }
  }
  const groups = Object.fromEntries(
    [...assetGroups(version)].map(([id, entries]) => [id, entries.map(entry)]),
  );
  return { version, templates: variants, groups, contents };
}

export function freezeCurrent() {
  const destination = join(packageRoot, 'assets/releases', version + '.json');
  const content = JSON.stringify(buildSnapshot(), null, 2) + '\n';
  if (existsSync(destination)) {
    if (readFileSync(destination, 'utf8') !== content)
      throw new Error(
        `Frozen ${version} differs. Prepare a new version; never overwrite a historical baseline.`,
      );
    return;
  }
  writeFileSync(destination, content, { flag: 'wx' });
}

export function checkAssets() {
  for (const release of bundledVersions) {
    const frozen = snapshot(release);
    for (const entries of [...Object.values(frozen.templates), ...Object.values(frozen.groups)]) {
      for (const { path, hash } of entries) {
        if (
          !(hash in frozen.contents) ||
          path.split('/').some((part) => !/^[\w.-]+$/.test(part) || part === '.' || part === '..')
        )
          throw new Error(`Invalid frozen entry: ${release} ${path}`);
      }
    }
    if (Object.keys(frozen.templates).length !== 48)
      throw new Error(`Incomplete template variants: ${release}`);
  }
  if (JSON.stringify(buildSnapshot()) !== JSON.stringify(snapshot(version)))
    throw new Error(
      'Current assets changed without a prepared release version. Run release:prepare before verification.',
    );
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv[2] === 'freeze') freezeCurrent();
    else if (process.argv.length === 2 || process.argv[2] === 'check') checkAssets();
    else throw new Error('Use assets.mjs check or assets.mjs freeze.');
    console.log('Release asset baselines verified.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
