import { unlinkSync } from 'node:fs';
import { inspectGitPath, readObject } from './discovery.ts';
import type { Project } from './discovery.ts';
import { install, json, read, replace, safePath, sha } from './file-operations.ts';
import { manifestPath, templates } from './initialize.ts';
import { bundledVersions, assetEntries } from './bundles.ts';
import { version } from './metadata.ts';
import { parseManifest } from './setup-state.ts';
import { checkQuickstartPrivacy, quickstartDefaults } from './quickstart.ts';
import {
  adapterPaths,
  engineeringModules,
  isRuleBlockEdit,
  splitRuleBlock,
} from './rule-activation.ts';
import { isLocalIgnoreEdit } from './tracking.ts';
import type { Edit, Transaction, SetupInput } from './setup-types.ts';

export const backupDir = '.ai/update-backups';
const backupIgnore = backupDir + '/.gitignore';

export function parseTransaction(source: string, root: string): Transaction {
  const raw = readObject(source);
  if (
    !raw ||
    typeof raw.id !== 'string' ||
    !/^[a-f\d-]{36}$/.test(raw.id) ||
    typeof raw.action !== 'string' ||
    ![
      'update',
      'repair',
      'pin',
      'rollback',
      'activate-rules',
      'quickstart',
      'rollback-quickstart',
    ].includes(raw.action) ||
    !Array.isArray(raw.edits) ||
    raw.edits.length > 64 ||
    !raw.edits.length
  )
    throw new Error('Invalid update journal.');
  if (raw.action === 'quickstart' || raw.action === 'rollback-quickstart') {
    const edits = raw.edits as Edit[];
    validateQuickstartEdits(root, edits, raw.action === 'rollback-quickstart');
    const inputs = readObject(JSON.stringify(raw.inputs));
    if (raw.inputs !== undefined) {
      const allowedInputs = new Set([
        '.gitignore',
        ...adapterPaths,
        ...quickstartDefaults({ policy: 'mixed', agents: [], version }).map((item) => item.path),
        manifestPath,
      ]);
      if (
        raw.action !== 'quickstart' ||
        !inputs ||
        Object.entries(inputs).some(
          ([path, hash]) =>
            !allowedInputs.has(path) ||
            edits.some((edit) => edit.path === path) ||
            (hash !== null && (typeof hash !== 'string' || !/^[a-f0-9]{64}$/.test(hash))),
        )
      )
        throw new Error('Invalid setup journal inputs.');
    }
    return { id: raw.id, action: raw.action, edits, inputs: inputs as Transaction['inputs'] };
  }
  const allowed = new Map<string, Set<string>>();
  const current = parseManifest(read(root, manifestPath));
  // Validate both ends before examining file edits. Enrollment can add asset
  // paths, and rollback can remove them, without changing baseline ownership.
  const manifestEdit = (raw.edits as Edit[]).find((edit) => edit.path === manifestPath);
  const states = [current];
  if (manifestEdit) {
    if (typeof manifestEdit.before !== 'string' || typeof manifestEdit.after !== 'string')
      throw new Error('Invalid manifest edit.');
    const candidates = [parseManifest(manifestEdit.before), parseManifest(manifestEdit.after)];
    const assets = new Set(
      bundledVersions.flatMap((bundled) => assetEntries(bundled).map((entry) => entry.path)),
    );
    const baselinePaths = (state: ReturnType<typeof parseManifest>) =>
      state.managed
        .map((entry) => entry.path)
        .filter((path) => !assets.has(path))
        .sort();
    for (const candidate of candidates) {
      if (
        json(candidate.choices) !== json(current.choices) ||
        json(baselinePaths(candidate)) !== json(baselinePaths(current)) ||
        json(candidate.raw.preserved) !== json(current.raw.preserved)
      )
        throw new Error('Journal changes setup ownership or privacy.');
    }
    if (![manifestEdit.before, manifestEdit.after].includes(read(root, manifestPath)!))
      throw new Error('Journal manifest does not match this setup.');
    states.push(...candidates);
  }
  const addKnown = (state: ReturnType<typeof parseManifest>) => {
    for (const entry of state.managed) {
      const values = allowed.get(entry.path) ?? new Set<string>();
      for (const bundled of bundledVersions) {
        const file = [
          ...templates({ ...state.choices, version: bundled }),
          ...assetEntries(bundled),
        ].find((item) => item.path === entry.path);
        if (file) values.add(file.content);
      }
      allowed.set(entry.path, values);
    }
  };
  states.forEach(addKnown);
  const paths = new Set<string>();
  for (const { path, before, after } of raw.edits as Edit[]) {
    if (typeof path !== 'string' || paths.has(path) || before === after)
      throw new Error('Invalid or duplicate journal path.');
    paths.add(path);
    if (path === manifestPath) {
      continue;
    } else if (
      ['activate-rules', 'rollback'].includes(raw.action) &&
      isRuleBlockEdit(path, before, after)
    ) {
      continue;
    } else if (
      !allowed.has(path) ||
      [before, after].some(
        (text) =>
          text !== null &&
          (typeof text !== 'string' ||
            (!allowed.get(path)!.has(text) &&
              !(
                adapterPaths.includes(path) &&
                allowed.get(path)!.has(splitRuleBlock(path, text).original)
              ))),
      )
    ) {
      throw new Error('Journal contains an unmanaged file or unknown content.');
    }
  }
  let inputs: Transaction['inputs'];
  if (raw.inputs !== undefined) {
    const values = readObject(JSON.stringify(raw.inputs));
    const allowedInputs = new Set([
      manifestPath,
      ...current.managed.map((entry) => entry.path),
      ...assetEntries(version).map((entry) => entry.path),
    ]);
    if (
      raw.action !== 'update' ||
      !values ||
      Object.entries(values).some(
        ([path, hash]) =>
          !allowedInputs.has(path) ||
          paths.has(path) ||
          (hash !== null && (typeof hash !== 'string' || !/^[a-f0-9]{64}$/.test(hash))),
      )
    )
      throw new Error('Invalid update journal inputs.');
    inputs = values as Transaction['inputs'];
  }
  return { id: raw.id, action: raw.action, edits: raw.edits as Edit[], inputs };
}

export function validateQuickstartEdits(root: string, edits: Edit[], reverse: boolean) {
  const forward = reverse
    ? edits.map((edit) => ({ path: edit.path, before: edit.after, after: edit.before })).reverse()
    : edits;
  const manifestEdit = forward.find((edit) => edit.path === manifestPath);
  const installed = read(root, manifestPath);
  if (
    manifestEdit &&
    (manifestEdit.before !== null ||
      (installed !== null && installed !== manifestEdit.after) ||
      forward.at(-1) !== manifestEdit)
  )
    throw new Error('Invalid quickstart manifest change.');
  const state = parseManifest(manifestEdit ? manifestEdit.after : installed);
  const defaults = bundledVersions.flatMap((version) =>
    quickstartDefaults({ ...state.choices, version }),
  );
  const attachesRecommended = (path: string, before: string, after: string) =>
    isRuleBlockEdit(path, before, after) &&
    (splitRuleBlock(path, after).full ||
      'minimal' in splitRuleBlock(path, after) ||
      splitRuleBlock(path, after).names.length === engineeringModules.length);
  const paths = new Set<string>();
  for (const { path, before, after } of forward) {
    if (paths.has(path) || before === after || typeof after !== 'string')
      throw new Error('Invalid quickstart journal edit.');
    paths.add(path);
    if (path === manifestPath) continue;
    if (
      path === '.gitignore' &&
      state.choices.policy === 'local-only' &&
      isLocalIgnoreEdit(before, after)
    )
      continue;
    if (typeof before === 'string' && attachesRecommended(path, before, after)) continue;
    if (
      before === null &&
      defaults.some(
        (entry) =>
          entry.path === path &&
          (entry.content === after || attachesRecommended(path, entry.content, after)),
      )
    )
      continue;
    throw new Error('Quickstart journal contains an unmanaged path or unknown content.');
  }
  if (
    manifestEdit &&
    (state.raw.pin !== undefined ||
      state.managed.some(
        ({ path, content }) =>
          !forward.some(
            (edit) =>
              edit.path === path &&
              edit.before === null &&
              (edit.after === content ||
                (typeof edit.after === 'string' && isRuleBlockEdit(path, content, edit.after))),
          ),
      ))
  ) {
    throw new Error('Quickstart manifest contains files outside the approved setup.');
  }
  return state.choices.policy;
}

function verifyEdits(root: string, edits: Edit[], resume: boolean): void {
  for (const edit of edits) {
    const current = read(root, edit.path);
    if (current !== edit.before && !(resume && current === edit.after)) {
      throw new Error(`File changed since preview: ${edit.path}`);
    }
  }
}

function checkBackupPrivacy(project: Project): void {
  const { root } = project;
  const ignore = read(root, backupIgnore);
  if (ignore !== null && ignore !== '*\n')
    throw new Error('Existing update-backup privacy rules differ.');
  if (project.git.detected && inspectGitPath(root, backupDir + '/', 'tracked') !== false) {
    throw new Error('The backup directory must be untracked.');
  }
}

export async function executeTransaction(
  project: Project,
  transaction: Transaction,
  options: {
    dry: boolean;
    resume: boolean;
    inputs: SetupInput[];
    approval: () => Promise<boolean>;
  },
): Promise<boolean> {
  const { root } = project;
  const pending = backupDir + '/.pending.json';
  parseTransaction(json(transaction), root);
  const quick = ['quickstart', 'rollback-quickstart'].includes(transaction.action);
  const quickPolicy = quick
    ? validateQuickstartEdits(root, transaction.edits, transaction.action === 'rollback-quickstart')
    : undefined;
  function checkRulePrivacy() {
    if (quickPolicy) {
      checkQuickstartPrivacy(project, transaction.edits, quickPolicy);
      return;
    }
    const current = parseManifest(read(root, manifestPath));
    if (current.choices.policy === 'local-only' && project.git.detected) {
      const manifestAfter = transaction.edits.find((edit) => edit.path === manifestPath)?.after;
      const proposed = typeof manifestAfter === 'string' ? parseManifest(manifestAfter) : current;
      const privatePaths = new Set([
        ...proposed.managed
          .filter((entry) => assetEntries(version).some((asset) => asset.path === entry.path))
          .map((entry) => entry.path),
        ...transaction.edits
          .filter(({ path, before, after }) => isRuleBlockEdit(path, before, after))
          .map((edit) => edit.path),
      ]);
      if (
        [...privatePaths].some(
          (path) =>
            inspectGitPath(root, path, 'tracked') !== false ||
            inspectGitPath(root, path, 'ignored') !== true,
        )
      ) {
        throw new Error(
          'Local-only updates require ignored, untracked rules, skills, and instruction entry points.',
        );
      }
    }
  }
  function verifySetupInputs() {
    for (const [path, hash] of Object.entries(transaction.inputs ?? {})) {
      const current = read(root, path);
      if ((current === null ? null : sha(current)) !== hash)
        throw new Error(`Setup input changed: ${path}. Review before resuming.`);
    }
  }
  checkRulePrivacy();
  verifySetupInputs();
  verifyEdits(root, transaction.edits, options.resume);
  checkBackupPrivacy(project);
  if (options.dry || !(await options.approval())) return false;
  if (options.inputs.some(({ path, content }) => read(root, path) !== content)) {
    throw new Error('A setup input changed after preview. Review a fresh plan.');
  }
  checkRulePrivacy();
  verifySetupInputs();
  verifyEdits(root, transaction.edits, options.resume);
  checkBackupPrivacy(project);
  const journal = json(transaction);
  if (Buffer.byteLength(journal) > 1024 * 1024)
    throw new Error('Combined backup is too large. Review setup in smaller steps.');
  install(root, { path: backupIgnore, content: '*\n' });
  if (project.git.detected && inspectGitPath(root, pending, 'ignored') !== true)
    throw new Error('Git does not ignore update backups.');
  install(root, { path: pending, content: journal });
  const ignoreEdits =
    transaction.action === 'quickstart'
      ? transaction.edits.filter((edit) => ['.gitignore', '.ai/.gitignore'].includes(edit.path))
      : [];
  for (const edit of ignoreEdits) replace(root, edit);
  if (quickPolicy && transaction.action === 'quickstart')
    checkQuickstartPrivacy(project, transaction.edits, quickPolicy, true);
  for (const edit of transaction.edits) if (!ignoreEdits.includes(edit)) replace(root, edit);
  if (transaction.edits.some((edit) => read(root, edit.path) !== edit.after))
    throw new Error('Update verification failed.');
  install(root, { path: backupDir + '/' + transaction.id + '.json', content: journal });
  if (read(root, pending) === journal) unlinkSync(safePath(root, pending));
  return true;
}
