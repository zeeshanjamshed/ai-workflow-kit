import { openDialog, interactiveTerminal, intro, outro, note, message } from './terminal.ts';
import { parseOptions, stringOption } from './arguments.ts';
import { stdin, stdout } from 'node:process';
import { realpathSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { discoverSkills, resumeContext } from './context.ts';
import { exists, readObject, within } from './discovery.ts';
import type { Project } from './discovery.ts';
import {
  bundledVersions,
  initialize,
  manifestPath,
  safePath,
  statePath,
  validateChoices,
  version,
} from './initialize.ts';
import { planQuickstart, checkQuickstartPrivacy } from './quickstart.ts';
import type { PresetOptions } from './quickstart.ts';
import { preview } from './reports.ts';
import { readSetupFile, update } from './update.ts';
import { agentLaunch, chooseAgentLaunch, onboardingPrompt, runAgent } from './agent-launch.ts';

function tracking(value: string) {
  return value === 'shared' ? 'tracked' : value;
}

export function additionalPaths(root: string, input: string): string[] {
  return [
    ...new Set(
      input
        .split(',')
        .map((path) => path.trim())
        .filter(Boolean),
    ),
  ].map((path) => {
    if (
      isAbsolute(path) ||
      !within(root, resolve(root, path)) ||
      !within(root, realpathSync(resolve(root, path)))
    ) {
      throw new Error('Additional AI paths must exist inside this project.');
    }
    return path;
  });
}

export async function guidedInit(project: Project, args: string[]) {
  const parsed = parseOptions('init', args);
  if (parsed.positionals.length) throw new Error('Init does not accept positional arguments.');
  const dry = Boolean(parsed.values['dry-run']);
  const trackingFlag = stringOption(parsed.values.tracking);
  const agentsFlag = stringOption(parsed.values.agents);
  if (trackingFlag === '' || agentsFlag === '')
    throw new Error('Choose a tracking policy and at least one supported agent.');
  const source = readSetupFile(project.root, manifestPath);
  const installed = source === null ? undefined : readObject(source);
  if (
    source !== null &&
    (installed?.owner !== 'ai-workflow-kit' ||
      typeof installed.version !== 'string' ||
      !bundledVersions.includes(installed.version))
  ) {
    throw new Error('Existing setup manifest is unrecognized. It was preserved for review.');
  }
  const choices = installed ? validateChoices(installed.tracking, installed.adapters) : undefined;
  if (choices && trackingFlag && tracking(trackingFlag) !== choices.policy)
    throw new Error('Existing tracking is preserved. Review a tracking change separately.');
  if (choices && agentsFlag) {
    const requested = validateChoices(
      choices.policy,
      agentsFlag.split(',').map((name) => name.trim()),
    ).agents;
    if (
      requested.length !== choices.agents.length ||
      requested.some((agent) => !choices.agents.includes(agent))
    ) {
      throw new Error(
        'Existing agent selection is preserved. Review an adapter change separately rather than changing its setup provenance.',
      );
    }
  }
  if (!choices && exists(safePath(project.root, statePath))) {
    await initialize(project, undefined, dry);
    if (!dry)
      console.log(
        'The original initialization was reviewed. Run init again for the complete guided setup.',
      );
    return;
  }
  const pending = readSetupFile(project.root, '.ai/update-backups/.pending.json');
  if (pending !== null && readObject(pending)?.action !== 'quickstart')
    throw new Error('Another operation is pending. Run ai-setup update to review and resume it.');
  if (pending !== null && (trackingFlag || agentsFlag))
    throw new Error('Resume with init and no tracking or agent options to review the saved setup.');

  const dialog = openDialog();
  const { ask } = dialog;
  let launch: ReturnType<typeof agentLaunch>;
  try {
    const found = project.agents.flatMap((agent) => agent.paths);
    const skills = discoverSkills(project, realpathSync(process.cwd()), null);
    const context = resumeContext(project);
    const records = context.knowledge.length + context.decisions.length + context.tasks.length;
    if (!dry) {
      intro(`AI Workflow Kit ${version}`);
      if (interactiveTerminal) {
        note(
          [
            project.root,
            found.length || records || skills.length
              ? `Existing setup found. ${skills.length} project skills and ${records} saved records.`
              : 'No standard AI setup found.',
            ...new Set(found),
            'Existing files stay in place.',
          ].join('\n'),
          'Project',
        );
      } else {
        console.log(`Project ${project.root}`);
        if (found.length || records || skills.length)
          console.log(
            `Existing AI setup found. ${skills.length} project skills in this scope and ${records} saved records. Existing files stay in place.\n${found.map((path) => `  ${path}`).join('\n')}`,
          );
        else console.log('No standard AI setup found. Existing project files will be preserved.');
      }
    }
    let agentNames = agentsFlag ?? choices?.agents.join(',');
    if (!agentNames)
      agentNames =
        dry || pending !== null
          ? 'all'
          : (
              await dialog.multiselect(
                'Which agents do you use?',
                ['claude', 'codex', 'cursor'].map((value) => ({
                  value,
                  label: { claude: 'Claude Code', codex: 'Codex', cursor: 'Cursor' }[value]!,
                })),
                ['claude', 'codex', 'cursor'],
                'Which agents? claude,codex,cursor [all]',
              )
            ).join(',');
    const enabled = agentNames
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean);
    const agents =
      enabled.length && enabled.join() !== 'all' ? enabled : ['claude', 'codex', 'cursor'];
    validateChoices('mixed', agents);
    let policyName = choices?.policy ?? trackingFlag;
    if (!policyName)
      policyName =
        dry || pending !== null
          ? 'mixed'
          : await dialog.select(
              'How should Git track this setup?',
              [
                {
                  value: 'mixed',
                  label: 'Mixed',
                  hint: 'Recommended. Share rules, keep knowledge local',
                },
                { value: 'shared', label: 'Shared', hint: 'Share rules and project knowledge' },
                { value: 'local-only', label: 'Local only', hint: 'Ignore all kit files' },
              ],
              'mixed',
              'Git tracking? shared, mixed, local-only [mixed]\nShared includes rules and knowledge. Mixed keeps knowledge, decisions, and handoffs local. Local-only ignores all kit files.',
            );
    const policy = tracking(policyName || 'mixed');
    const selected = validateChoices(policy, agents);
    const options: PresetOptions = { preset: 'full', onboarding: true, guided: true, ...selected };
    if (dry && pending === null) {
      const proposal = planQuickstart(
        project,
        (path) => readSetupFile(project.root, path),
        choices,
        options,
      );
      const blockers: string[] = [];
      try {
        checkQuickstartPrivacy(project, proposal.edits, proposal.policy);
      } catch (error) {
        blockers.push((error as Error).message);
      }
      console.log(
        JSON.stringify(
          {
            ...preview(project),
            agents,
            tracking: policy,
            skills,
            records,
            edits: proposal.edits,
            preserved: proposal.preserved,
            blockers,
            note: 'Read-only setup preview. Existing instructions need semantic review during onboarding.',
          },
          null,
          2,
        ),
      );
      return;
    }
    const extra =
      pending !== null
        ? []
        : additionalPaths(
            project.root,
            await ask('Any other AI rule or knowledge paths? Comma-separated, or Enter to skip.'),
          );
    const prompt = onboardingPrompt(extra);
    const completed = await update(project, 'quickstart', dry ? ['--dry-run'] : [], options, () =>
      dialog.approve(
        'Apply this setup and save its recovery backup?',
        'apply',
        'Type apply to install this setup and save its recovery backup.',
      ),
    );
    if (!completed || dry) {
      if (!completed) outro('Setup not applied.');
      return;
    }
    if (project.version && project.version !== version) {
      if (interactiveTerminal)
        message(
          `This project still uses baseline ${project.version}. This CLI is ${version}.\nRun npx @zeeshanjamshed/ai-workflow-kit@latest update to review the upgrade.`,
          'warn',
        );
      else
        console.log(
          `Installed baseline ${project.version} is preserved. Run update to review the latest bundled changes.`,
        );
    }
    if (interactiveTerminal)
      message(
        'Onboarding reviews your code and existing AI setup. Saving or consolidating anything needs your approval.',
      );
    else
      console.log(
        `Onboarding can inspect your project and propose consolidation. Saving knowledge needs your approval.\nIn your agent, send\n${prompt}`,
      );
    if (parsed.values['no-launch'] || !stdin.isTTY || !stdout.isTTY) {
      if (interactiveTerminal) note(prompt, 'Manual onboarding prompt');
      console.log(
        'Open your agent in this project to onboard, or rerun init in a terminal to start it here.',
      );
      outro('Setup ready.');
      return;
    }
    launch = await chooseAgentLaunch(
      project.root,
      prompt,
      (question) => ask(question, false),
      undefined,
      undefined,
      dialog,
    );
    if (interactiveTerminal && !launch) note(prompt, 'Manual onboarding prompt');
    outro(launch ? 'Starting onboarding.' : 'Setup ready.');
  } finally {
    dialog.close();
  }
  if (launch && !(await runAgent(project.root, launch))) process.exitCode = 1;
}
