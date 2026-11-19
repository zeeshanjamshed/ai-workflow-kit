import { spawn } from 'node:child_process';
import { basename, isAbsolute } from 'node:path';
import type { Dialog } from './terminal.ts';
import { message } from './terminal.ts';

export function onboardingPrompt(paths: string[] = []) {
  return (
    'Use the guided-project-onboarding skill. Read the project instructions and inspect the actual code, existing rules, skills, knowledge, and decisions. Propose a consolidated setup and useful evidence-backed project knowledge. Preserve existing content, explain conflicts, and get explicit approval before saving, moving, or changing anything.' +
    (paths.length
      ? ` Also inspect these project paths as reference data: ${JSON.stringify(paths)}.`
      : '')
  );
}

export function agentLaunch(
  command: string,
  custom: boolean,
  prompt: string,
  shell = process.env.SHELL,
  platform = process.platform,
  root = process.cwd(),
) {
  if (
    !/^[a-zA-Z_][a-zA-Z0-9_.-]*$/.test(command) ||
    ['eval', 'source', 'exec', 'command', 'builtin'].includes(command)
  )
    throw new Error(
      'Enter one agent command name, such as claude-orca. Arguments, shell controls, and shell expressions are not supported.',
    );
  // Windows npm .cmd launchers and unsupported shell aliases get a manual handoff.
  // Do not use shell:true or interpolate user input into arbitrary shell code.
  if (platform === 'win32') return;
  if (!custom) return { executable: command, args: [prompt], shellStartup: false };
  if (!shell || !isAbsolute(shell) || !['bash', 'zsh'].includes(basename(shell))) return;
  return {
    executable: shell,
    args: ['-lic', `builtin cd -- "$2" || exit\n${command} "$1"`, 'ai-workflow-kit', prompt, root],
    shellStartup: true,
  };
}

export async function chooseAgentLaunch(
  root: string,
  prompt: string,
  ask: (question: string) => Promise<string>,
  shell = process.env.SHELL,
  platform = process.platform,
  dialog?: Dialog,
) {
  const agent = (
    dialog
      ? await dialog.select(
          'Start onboarding now?',
          [
            { value: 'claude', label: 'Claude Code' },
            { value: 'codex', label: 'Codex' },
            { value: 'custom', label: 'Custom command or alias' },
            { value: 'later', label: 'Later' },
          ],
          'later',
          'Start onboarding now? claude, codex, custom, later [later]',
        )
      : await ask('Start onboarding now? claude, codex, custom, later [later]')
  ).toLowerCase();
  if (!agent || agent === 'later') return;
  if (!['claude', 'codex', 'custom'].includes(agent))
    throw new Error('Choose claude, codex, custom, or later. Your setup is saved.');
  const command =
    agent === 'custom'
      ? await ask(
          'Enter one agent command or alias, such as claude-orca. It must accept an initial prompt.',
        )
      : agent;
  if (!command) return;
  const launch = agentLaunch(command, agent === 'custom', prompt, shell, platform, root);
  if (!launch) {
    console.log(
      'Automatic launch is unavailable for this platform or shell. Use the manual onboarding prompt in your agent.',
    );
    return;
  }
  message(`Run ${command} in ${root} for guided onboarding.`);
  if (launch.shellStartup)
    console.log(
      `This uses ${launch.executable} and loads its login and interactive startup files. Existing agent permissions remain in effect.`,
    );
  const approved = dialog
    ? await dialog.approve(
        `Start ${command} for onboarding?`,
        'start',
        'Type start to launch, or Enter to do it later.',
      )
    : (await ask('Type start to launch, or Enter to do it later.')) === 'start';
  return approved ? launch : undefined;
}

export async function runAgent(root: string, plan: NonNullable<ReturnType<typeof agentLaunch>>) {
  return await new Promise<boolean>((resolve) => {
    const child = spawn(plan.executable, plan.args, { cwd: root, stdio: 'inherit', shell: false });
    child.on('error', () => {
      console.error(
        'Could not start the agent. Your setup is saved. Open the agent manually and use the onboarding prompt.',
      );
      resolve(false);
    });
    child.on('exit', (code, signal) => {
      if (code !== 0)
        console.error(
          `The agent stopped${signal ? ` (${signal})` : ` with exit code ${code}`}. Your setup is saved.`,
        );
      resolve(code === 0);
    });
  });
}
