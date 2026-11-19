import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { packageRoot, version } from '../packages/cli/src/metadata.ts';

export function checkArtifact(directory = join(packageRoot, 'release'), expected = {}) {
  const artifact = JSON.parse(readFileSync(join(directory, 'artifact.json'), 'utf8'));
  const filename = `zeeshanjamshed-ai-workflow-kit-${version}.tgz`;
  if (
    artifact.package !== '@zeeshanjamshed/ai-workflow-kit' ||
    artifact.version !== version ||
    artifact.filename !== filename ||
    basename(artifact.filename) !== artifact.filename
  )
    throw new Error('Artifact metadata does not match this checkout.');
  if (
    (expected.version && expected.version !== artifact.version) ||
    (expected.commit && expected.commit !== artifact.commit) ||
    (expected.release && artifact.dirty !== false)
  )
    throw new Error('Artifact version or source commit is not approved for release.');
  const path = join(directory, filename);
  const bytes = readFileSync(path);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const integrity = 'sha512-' + createHash('sha512').update(bytes).digest('base64');
  if (
    sha256 !== artifact.sha256 ||
    integrity !== artifact.integrity ||
    (expected.sha256 && sha256 !== expected.sha256)
  )
    throw new Error('Artifact checksum does not match.');
  return { ...artifact, path };
}
