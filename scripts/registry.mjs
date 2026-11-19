export async function waitForIntegrity(
  expected,
  readIntegrity,
  {
    attempts = 24,
    delay = 5000,
    sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  } = {},
) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt++) {
    let actual;
    try {
      actual = await readIntegrity();
    } catch (error) {
      lastError = error;
      if (attempt + 1 === attempts) break;
      await sleep(delay);
      continue;
    }
    if (actual !== expected)
      throw new Error('Published integrity differs from the approved tarball.');
    return;
  }
  throw new Error(
    'The publish command completed, but registry confirmation timed out. Do not republish; inspect npm state.',
    { cause: lastError },
  );
}
