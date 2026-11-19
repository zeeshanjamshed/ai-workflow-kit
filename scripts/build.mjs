import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { packageRoot } from '../packages/cli/src/metadata.ts';
import { checkAssets } from './assets.mjs';

checkAssets();
rmSync(join(packageRoot, 'dist'), { recursive: true, force: true });
const result = spawnSync(
  process.execPath,
  [join(packageRoot, 'node_modules/typescript/bin/tsc'), '-p', 'tsconfig.build.json'],
  { cwd: packageRoot, stdio: 'inherit' },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
