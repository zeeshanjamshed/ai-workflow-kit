import { openDialog } from './terminal.ts';
import { parseOptions, stringOption } from './arguments.ts';
import { versionPattern } from './metadata.ts';
import { randomUUID } from 'node:crypto';
import type { Project } from './discovery.ts';
import { json, read, sha } from './file-operations.ts';
import { manifestPath } from './initialize.ts';
import { version } from './metadata.ts';
import { parseManifest } from './setup-state.ts';
import { planUpdate } from './update-plan.ts';
import {
  backupDir,
  executeTransaction,
  parseTransaction,
  validateQuickstartEdits,
} from './transactions.ts';
import { planQuickstart, printOnboardingHandoff, printQuickstart } from './quickstart.ts';
import type { PresetOptions } from './quickstart.ts';
import { engineeringModules, planRuleActivation, rulePath } from './rule-activation.ts';
import type { Edit, Transaction, SetupInput } from './setup-types.ts';
export { read as readSetupFile } from './file-operations.ts';

async function approve(): Promise<boolean> {
  const dialog = openDialog();
  try {
    return (
      (await dialog.ask('Type apply to approve this operation and its backup:', false)) === 'apply'
    );
  } finally {
    dialog.close();
  }
}

export async function update(
  project: Project,
  action: string,
  args: string[],
  preset?: PresetOptions,
  approval = approve,
): Promise<boolean> {
  const { root } = project;
  const parsed = parseOptions(action, args);
  const dry = Boolean(parsed.values['dry-run']);
  const target = stringOption(parsed.values.version);
  const values = parsed.positionals;
  if (target !== undefined) values.push(target);
  if (
    (action !== 'activate-rules' && values.length > 1) ||
    (action === 'update' &&
      (parsed.positionals.length > Number(target !== undefined) ||
        (target !== undefined && !versionPattern.test(target)))) ||
    (['repair', 'quickstart'].includes(action) && values.length) ||
    (action === 'pin' &&
      (values.length !== 1 || (values[0] !== 'none' && !versionPattern.test(values[0])))) ||
    (action === 'rollback' && (values.length !== 1 || !/^[a-f\d-]{36}$/.test(values[0])))
  )
    throw new Error('Invalid operation arguments.');
  // Keep the complete pending journal with the private backups.
  const pending = backupDir + '/.pending.json';
  const saved = read(root, pending);
  let transaction: Transaction;
  let activationInputs: SetupInput[] = [];
  if (saved !== null) {
    transaction = parseTransaction(saved, root);
    const resumeCommand = transaction.action === 'quickstart' ? 'quickstart' : 'update';
    if (action !== resumeCommand || values.length)
      throw new Error(
        `A transaction is pending. Run ai-setup ${resumeCommand} to review and resume it.`,
      );
    if (action === 'quickstart') {
      printQuickstart(
        project,
        transaction.edits,
        [],
        validateQuickstartEdits(root, transaction.edits, false),
        true,
      );
    } else console.log(json({ pending: true, ...transaction }));
  } else {
    let edits: Edit[];
    if (action === 'rollback') {
      const receipt = read(root, backupDir + '/' + values[0] + '.json');
      if (receipt === null) throw new Error('Backup not found.');
      const original = parseTransaction(receipt, root);
      if (original.id !== values[0]) throw new Error('Backup ID does not match.');
      edits = original.edits.map((edit) => ({
        path: edit.path,
        before: edit.after,
        after: edit.before,
      }));
      if (original.action === 'quickstart') {
        action = 'rollback-quickstart';
        edits.reverse();
      } else if (original.action === 'rollback-quickstart') {
        throw new Error('Run quickstart to set up this project again.');
      }
      console.log(json({ action, backup: original.id, edits }));
    } else if (action === 'quickstart') {
      const installed = read(root, manifestPath);
      const setup = installed === null ? undefined : parseManifest(installed);
      if (setup?.managed.some(({ path }) => read(root, path) === null)) {
        throw new Error(
          'A managed setup file is missing. Review ai-setup repair before running quickstart.',
        );
      }
      const proposal = planQuickstart(project, (path) => read(root, path), setup?.choices, preset);
      edits = proposal.edits;
      activationInputs = [
        { path: manifestPath, content: installed },
        ...[...proposal.inputs].map(([path, content]) => ({ path, content })),
      ];
      printQuickstart(
        project,
        edits,
        proposal.preserved,
        proposal.policy,
        false,
        preset?.guided
          ? 'Initialize'
          : preset?.preset === 'full'
            ? 'Full Engineering'
            : preset?.preset === 'minimal'
              ? 'Minimal'
              : undefined,
      );
      if (!edits.length && !preset?.guided) printOnboardingHandoff(preset?.onboarding ?? true);
    } else if (action === 'activate-rules') {
      const names = values.length === 1 && values[0] === 'all' ? engineeringModules : values;
      edits = planRuleActivation(project, names, (path) => read(root, path));
      activationInputs = names.map((name) => ({
        path: rulePath(name),
        content: read(root, rulePath(name)),
      }));
      console.log(
        json({
          action,
          modules: activationInputs,
          edits,
          review: 'Review rule contents and existing instructions for conflicts before approval.',
        }),
      );
    } else {
      const proposal = planUpdate((path) => read(root, path), action, values[0]);
      const { inputs, ...report } = proposal;
      console.log(json({ action, bundle: version, ...report }));
      if (proposal.conflicts.length)
        throw new Error('Resolve conflicts manually before updating. No files were changed.');
      edits = proposal.edits;
      if (action === 'update')
        activationInputs = [...inputs].map(([path, content]) => ({ path, content }));
    }
    if (!edits.length) return true;
    transaction = { id: randomUUID(), action, edits };
    if (action === 'quickstart' || action === 'update')
      transaction.inputs = Object.fromEntries(
        activationInputs
          .filter((input) => !edits.some((edit) => edit.path === input.path))
          .map(({ path, content }) => [path, content === null ? null : sha(content)]),
      );
  }

  const applied = await executeTransaction(project, transaction, {
    dry,
    resume: saved !== null,
    inputs: activationInputs,
    approval,
  });
  if (!applied) return false;
  console.log(`Verified. Backup ID: ${transaction.id}`);
  if (transaction.action === 'quickstart' && !preset?.guided)
    printOnboardingHandoff(
      read(root, '.agents/skills/guided-project-onboarding/SKILL.md') !== null &&
        read(root, '.claude/skills/guided-project-onboarding/SKILL.md') !== null,
    );
  return true;
}
