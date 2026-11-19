import { checkArtifact } from './artifact.mjs';

try {
  const artifact = checkArtifact(undefined, {
    version: process.env.EXPECTED_VERSION,
    commit: process.env.EXPECTED_COMMIT,
    sha256: process.env.EXPECTED_SHA256,
    release: process.env.GITHUB_ACTIONS === 'true',
  });
  console.log(`Artifact verified: ${artifact.version} ${artifact.sha256}`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
