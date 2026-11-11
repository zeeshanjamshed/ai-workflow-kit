import { checkQuickstartPrivacy, planQuickstart, printOnboardingHandoff, printQuickstart, quickstartDefaults } from './quickstart.ts';
import type { Edit } from './quickstart.ts';
import { engineeringModules, isRuleBlockEdit, planRuleActivation, rulePath, splitRuleBlock } from './rule-activation.ts';
import { randomUUID } from 'node:crypto';
import { closeSync, lstatSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin } from 'node:process';
import { exists, inspectGitPath, readObject } from './discovery.ts';
import type { Project } from './discovery.ts';
import { bundledVersions, install, manifestPath, safePath, sha, templates, validateChoices, version } from './initialize.ts';

const backupDir = '.ai/update-backups';
const backupIgnore = backupDir + '/.gitignore';
const owner = 'ai-workflow-kit';

type Transaction = { id: string; action: string; edits: Edit[] };

function json(value: unknown): string {
  return JSON.stringify(value, null, 2) + '\n';
}

function read(root: string, path: string): string | null {
  const file = safePath(root, path);
  if (!exists(file)) return null;
  if (lstatSync(file).size > 1024 * 1024) throw new Error(`Managed file is too large: ${path}`);
  const bytes = readFileSync(file);
  const text = bytes.toString('utf8');
  if (!Buffer.from(text).equals(bytes)) throw new Error(`Managed file is not UTF-8: ${path}`);
  return text;
}

function manifest(source: string | null) {
  const raw = readObject(source ?? undefined);
  if (raw?.owner !== owner || typeof raw.version !== 'string' || !bundledVersions.includes(raw.version)) {
    throw new Error('A recognized setup manifest and a bundled installed version are required.');
  }
  const choices = validateChoices(raw.tracking, raw.adapters);
  const base = new Map(templates({ ...choices, version: raw.version }).map(entry => [entry.path, entry.content]));
  const files = raw.files;
  if (!files || typeof files !== 'object' || Array.isArray(files)) throw new Error('Invalid manifest provenance.');
  const managed = Object.entries(files).map(([path, meta]) => {
    const content = base.get(path);
    if (content === undefined || meta?.sha256 !== sha(content)) throw new Error(`Unrecognized baseline for ${path}`);
    return { path, content };
  });
  if (raw.pin !== undefined && (typeof raw.pin !== 'string' || !bundledVersions.includes(raw.pin))) {
    throw new Error('Manifest pin is invalid or unavailable in this bundle.');
  }
  return { raw, choices, managed, installed: raw.version, pin: raw.pin };
}

function plan(root: string, action: string, value?: string) {
  const before = read(root, manifestPath);
  const { raw, choices, managed, installed, pin } = manifest(before);
  const edits: Edit[] = [];
  const comparisons: { path: string; status: string }[] = [];
  const conflicts: string[] = [];
  let next = { ...raw };
  if (action === 'pin') {
    if (value === 'none') delete next.pin;
    else if (value === installed || value === version) next.pin = value;
    else throw new Error('Pin the installed version, the current bundled version, or use none.');
  } else if (action === 'repair') {
    for (const { path, content } of managed) {
      if (read(root, path) === null) edits.push({ path, before: null, after: content });
    }
  } else {
    const target = value ?? pin ?? version;
    if (target !== installed && target !== version) throw new Error('Only the installed or current bundled version can be selected.');
    if (pin && target !== pin) throw new Error(`Version is pinned to ${pin}. Change the pin in a separate approved operation.`);
    const proposed = new Map(templates({ ...choices, version: target }).map(entry => [entry.path, entry.content]));
    for (const { path, content: base } of managed) {
      const local = read(root, path);
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
      } else {
        status = 'conflict';
      }
      if (status === 'conflict') conflicts.push(path);
      comparisons.push({ path, status });
    }
    if (!conflicts.length && target !== installed) {
      next = { ...raw, version: target, files: Object.fromEntries(managed.map(({ path }) => [
        path, { sha256: sha(proposed.get(path)!) },
      ])) };
    }
  }
  if (json(raw) !== json(next)) edits.push({ path: manifestPath, before, after: json(next) });
  return { installed, pin, comparisons, conflicts, edits };
}

function replace(root: string, edit: Edit): void {
  const current = read(root, edit.path);
  if (current === edit.after) return;
  if (current !== edit.before) throw new Error(`File changed since preview: ${edit.path}`);
  if (edit.after === null) {
    // Only a rollback of a verified kit-created repair can remove a file.
    unlinkSync(safePath(root, edit.path));
  } else if (edit.before === null) {
    install(root, { path: edit.path, content: edit.after });
  } else {
    const file = safePath(root, edit.path);
    const temporary = join(dirname(file), `.ai-setup-${randomUUID()}.tmp`);
    const fd = openSync(temporary, 'wx', lstatSync(file).mode & 0o777);
    try {
      try { writeFileSync(fd, edit.after); } finally { closeSync(fd); }
      if (read(root, edit.path) !== edit.before) throw new Error(`File changed since preview: ${edit.path}`);
      renameSync(temporary, file);
    } finally {
      if (exists(temporary)) unlinkSync(temporary);
    }
  }
}

function parseTransaction(source: string, root: string): Transaction {
  const raw = readObject(source);
  if (!raw || typeof raw.id !== 'string' || !/^[a-f\d-]{36}$/.test(raw.id) ||
      typeof raw.action !== 'string' || !['update', 'repair', 'pin', 'rollback', 'activate-rules', 'quickstart', 'rollback-quickstart'].includes(raw.action) ||
      !Array.isArray(raw.edits) || raw.edits.length > 20 || !raw.edits.length) throw new Error('Invalid update journal.');
  if (raw.action === 'quickstart' || raw.action === 'rollback-quickstart') {
    const edits = raw.edits as Edit[];
    validateQuickstartEdits(root, edits, raw.action === 'rollback-quickstart');
    return { id: raw.id, action: raw.action, edits };
  }
  const allowed = new Map<string, Set<string>>();
  const current = manifest(read(root, manifestPath));
  const addKnown = (state: ReturnType<typeof manifest>) => {
    for (const entry of state.managed) {
      const values = allowed.get(entry.path) ?? new Set<string>();
      for (const bundled of bundledVersions) {
        const file = templates({ ...state.choices, version: bundled }).find(item => item.path === entry.path);
        if (file) values.add(file.content);
      }
      allowed.set(entry.path, values);
    }
  };
  addKnown(current);
  const paths = new Set<string>();
  for (const { path, before, after } of raw.edits as Edit[]) {
    if (typeof path !== 'string' || paths.has(path) || before === after) throw new Error('Invalid or duplicate journal path.');
    paths.add(path);
    if (path === manifestPath) {
      if (typeof before !== 'string' || typeof after !== 'string') throw new Error('Invalid manifest edit.');
      for (const candidate of [manifest(before), manifest(after)]) {
        if (json(candidate.choices) !== json(current.choices) ||
            json(candidate.managed.map(x => x.path)) !== json(current.managed.map(x => x.path)) ||
            json(candidate.raw.preserved) !== json(current.raw.preserved)) throw new Error('Journal changes setup ownership or privacy.');
      }
    } else if (['activate-rules', 'rollback'].includes(raw.action) && isRuleBlockEdit(path, before, after)) {
      continue;
    } else if (!allowed.has(path) ||
      [before, after].some(text => text !== null && (typeof text !== 'string' || !allowed.get(path)!.has(text)))) {
      throw new Error('Journal contains an unmanaged file or unknown content.');
    }
  }
  return { id: raw.id, action: raw.action, edits: raw.edits as Edit[] };
}

function validateQuickstartEdits(root: string, edits: Edit[], reverse: boolean) {
  const forward = reverse ? edits.map(edit => ({ path: edit.path, before: edit.after, after: edit.before })).reverse() : edits;
  const manifestEdit = forward.find(edit => edit.path === manifestPath);
  const installed = read(root, manifestPath);
  if (manifestEdit && (manifestEdit.before !== null || installed !== null && installed !== manifestEdit.after ||
      forward.at(-1) !== manifestEdit)) throw new Error('Invalid quickstart manifest change.');
  const state = manifest(manifestEdit ? manifestEdit.after : installed);
  const defaults = bundledVersions.flatMap(version => quickstartDefaults({ ...state.choices, version }));
  const attachesRecommended = (path: string, before: string, after: string) =>
    isRuleBlockEdit(path, before, after) && splitRuleBlock(path, after).names.length === engineeringModules.length;
  const paths = new Set<string>();
  for (const { path, before, after } of forward) {
    if (paths.has(path) || before === after || typeof after !== 'string') throw new Error('Invalid quickstart journal edit.');
    paths.add(path);
    if (path === manifestPath) continue;
    if (typeof before === 'string' && attachesRecommended(path, before, after)) continue;
    if (before === null && defaults.some(entry => entry.path === path &&
        (entry.content === after || attachesRecommended(path, entry.content, after)))) continue;
    throw new Error('Quickstart journal contains an unmanaged path or unknown content.');
  }
  if (manifestEdit && (state.raw.pin !== undefined || state.managed.some(({ path, content }) =>
    !forward.some(edit => edit.path === path && edit.before === null &&
      (edit.after === content || typeof edit.after === 'string' && isRuleBlockEdit(path, content, edit.after)))))) {
    throw new Error('Quickstart manifest contains files outside the approved setup.');
  }
  return state.choices.policy;
}

async function approve(): Promise<boolean> {
  const input = createInterface({ input: stdin, terminal: false });
  try {
    console.log('Type apply to approve this operation and its backup:');
    for await (const line of input) return line.trim() === 'apply';
    return false;
  } finally {
    input.close();
  }
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
  if (ignore !== null && ignore !== '*\n') throw new Error('Existing update-backup privacy rules differ.');
  if (project.git.detected && inspectGitPath(root, backupDir + '/', 'tracked') !== false) {
    throw new Error('The backup directory must be untracked.');
  }
}

export async function update(project: Project, action: string, args: string[]): Promise<void> {
  const { root } = project;
  const dry = args.includes('--dry-run');
  const values = args.filter(arg => arg !== '--dry-run');
  if (args.length !== values.length + Number(dry) || action !== 'activate-rules' && values.length > 1 ||
      action === 'update' && values.length && !/^--version=\d+\.\d+\.\d+$/.test(values[0]) ||
      ['repair', 'quickstart'].includes(action) && values.length ||
      action === 'pin' && (values.length !== 1 || !/^(none|\d+\.\d+\.\d+)$/.test(values[0])) ||
      action === 'rollback' && (values.length !== 1 || !/^[a-f\d-]{36}$/.test(values[0]))) throw new Error('Invalid operation arguments.');
  // Keep the complete pending journal with the private backups.
  const pending = backupDir + '/.pending.json';
  const saved = read(root, pending);
  let transaction: Transaction;
  let activationInputs: { path: string; content: string | null }[] = [];
  if (saved !== null) {
    transaction = parseTransaction(saved, root);
    const resumeCommand = transaction.action === 'quickstart' ? 'quickstart' : 'update';
    if (action !== resumeCommand || values.length) throw new Error(`A transaction is pending. Run ai-setup ${resumeCommand} to review and resume it.`);
    if (action === 'quickstart') {
      printQuickstart(project, transaction.edits, [], validateQuickstartEdits(root, transaction.edits, false), true);
    } else console.log(json({ pending: true, ...transaction }));
  } else {
    let edits: Edit[];
    if (action === 'rollback') {
      const receipt = read(root, backupDir + '/' + values[0] + '.json');
      if (receipt === null) throw new Error('Backup not found.');
      const original = parseTransaction(receipt, root);
      if (original.id !== values[0]) throw new Error('Backup ID does not match.');
      edits = original.edits.map(edit => ({ path: edit.path, before: edit.after, after: edit.before }));
      if (original.action === 'quickstart') {
        action = 'rollback-quickstart';
        edits.reverse();
      } else if (original.action === 'rollback-quickstart') {
        throw new Error('Run quickstart to set up this project again.');
      }
      console.log(json({ action, backup: original.id, edits }));
    } else if (action === 'quickstart') {
      const installed = read(root, manifestPath);
      const setup = installed === null ? undefined : manifest(installed);
      if (setup?.managed.some(({ path }) => read(root, path) === null)) {
        throw new Error('A managed setup file is missing. Review ai-setup repair before running quickstart.');
      }
      const proposal = planQuickstart(project, path => read(root, path), setup?.choices);
      edits = proposal.edits;
      activationInputs = [{ path: manifestPath, content: installed },
        ...[...proposal.inputs].map(([path, content]) => ({ path, content }))];
      printQuickstart(project, edits, proposal.preserved, proposal.policy, false);
      if (!edits.length) printOnboardingHandoff();
    } else if (action === 'activate-rules') {
      const names = values.length === 1 && values[0] === 'all' ? engineeringModules : values;
      edits = planRuleActivation(project, names, path => read(root, path));
      activationInputs = names.map(name => ({ path: rulePath(name), content: read(root, rulePath(name)) }));
      console.log(json({ action, modules: activationInputs, edits,
        review: 'Review rule contents and existing instructions for conflicts before approval.' }));
    } else {
      const proposal = plan(root, action, values[0]?.replace(/^--version=/, ''));
      console.log(json({ action, bundle: version, ...proposal }));
      if (proposal.conflicts.length) throw new Error('Resolve conflicts manually before updating. No files were changed.');
      edits = proposal.edits;
    }
    if (!edits.length) return;
    transaction = { id: randomUUID(), action, edits };
  }

  parseTransaction(json(transaction), root);
  const quick = ['quickstart', 'rollback-quickstart'].includes(transaction.action);
  const quickPolicy = quick ? validateQuickstartEdits(root, transaction.edits, transaction.action === 'rollback-quickstart') : undefined;
  function checkRulePrivacy() {
    if (quickPolicy) {
      checkQuickstartPrivacy(project, transaction.edits, quickPolicy);
      return;
    }
    if (manifest(read(root, manifestPath)).choices.policy === 'local-only' && project.git.detected &&
        transaction.edits.some(({ path, before, after }) => isRuleBlockEdit(path, before, after) &&
          (inspectGitPath(root, path, 'tracked') !== false || inspectGitPath(root, path, 'ignored') !== true))) {
      throw new Error('Local-only activation requires ignored, untracked instruction entry points.');
    }
  }
  checkRulePrivacy();
  verifyEdits(root, transaction.edits, saved !== null);
  checkBackupPrivacy(project);
  if (dry || !await approve()) return;
  if (activationInputs.some(({ path, content }) => read(root, path) !== content)) {
    throw new Error('A setup input changed after preview. Review a fresh plan.');
  }
  checkRulePrivacy();
  verifyEdits(root, transaction.edits, saved !== null);
  checkBackupPrivacy(project);
  const journal = json(transaction);
  if (Buffer.byteLength(journal) > 1024 * 1024) throw new Error('Combined backup is too large. Review setup in smaller steps.');
  install(root, { path: backupIgnore, content: '*\n' });
  if (project.git.detected && inspectGitPath(root, pending, 'ignored') !== true) throw new Error('Git does not ignore update backups.');
  install(root, { path: pending, content: journal });
  const ignoreEdit = transaction.action === 'quickstart' && transaction.edits.find(edit => edit.path === '.ai/.gitignore');
  if (ignoreEdit) replace(root, ignoreEdit);
  if (quickPolicy && transaction.action === 'quickstart') checkQuickstartPrivacy(project, transaction.edits, quickPolicy, true);
  for (const edit of transaction.edits) if (edit !== ignoreEdit) replace(root, edit);
  if (transaction.edits.some(edit => read(root, edit.path) !== edit.after)) throw new Error('Update verification failed.');
  install(root, { path: backupDir + '/' + transaction.id + '.json', content: journal });
  if (read(root, pending) === journal) unlinkSync(safePath(root, pending));
  console.log(`Verified. Backup ID: ${transaction.id}`);
  if (transaction.action === 'quickstart') printOnboardingHandoff();
}
