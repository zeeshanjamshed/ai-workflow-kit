import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { checkArtifact } from './artifact.mjs';
import { packageRoot } from '../packages/cli/src/metadata.ts';

const artifact = checkArtifact();
const result = spawnSync(
  process.execPath,
  [join(packageRoot, 'packages/cli/tests/package-smoke.mjs')],
  {
    cwd: packageRoot,
    stdio: 'inherit',
    env: { ...process.env, KIT_TARBALL: artifact.path },
  },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
