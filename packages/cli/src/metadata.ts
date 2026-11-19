import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

function findPackageRoot() {
  for (let directory = dirname(fileURLToPath(import.meta.url)); ; directory = dirname(directory)) {
    try {
      const metadata: unknown = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'));
      if (
        metadata &&
        typeof metadata === 'object' &&
        'name' in metadata &&
        metadata.name === '@zeeshanjamshed/ai-workflow-kit'
      )
        return directory;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    if (dirname(directory) === directory) throw new Error('Package metadata not found.');
  }
}

export const packageRoot = findPackageRoot();
const metadata: { version: string } = JSON.parse(
  readFileSync(join(packageRoot, 'package.json'), 'utf8'),
);
export const version = metadata.version;
export const versionPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
if (!versionPattern.test(version)) throw new Error('Invalid package version.');
