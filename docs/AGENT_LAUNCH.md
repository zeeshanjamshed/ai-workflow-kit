# Start onboarding after init

The guided initializer installs complete rules and the onboarding skill for the selected adapters. Claude uses its native `.claude/skills` entry. Codex and Cursor share the `.agents/skills` entry. Existing custom skills and knowledge stay in place. The agent must propose consolidation and request approval before saving or moving content.

After a successful setup, an interactive terminal offers Claude, Codex, a custom command, or later. The CLI shows the project root, command, and onboarding prompt. Type `start` to launch. Initialization approval alone does not launch an agent or authorize knowledge writes. Closing input, declining setup, a dry run, or a piped session cannot start an agent. `--no-launch` skips the launch menu.

Claude and Codex receive one initial prompt in a normal interactive session. The launcher adds no permission-bypass flags, installs no agent, and changes no account settings. The command's existing configuration applies. Real sessions can still require authentication or project trust confirmation.

Custom input accepts one executable or alias name, such as `claude-orca`. It must accept an initial prompt argument. Arguments, paths, and shell expressions are rejected. Custom Bash and Zsh launches load the user's login and interactive startup files so their aliases and functions are available. A fixed script restores the selected project directory after startup; the prompt and directory are passed as separate quoted arguments. An alias can have its own flags and permissions, which remain the owner's responsibility. Definitions made only in the parent terminal must also be available in the shell's startup files.

Automatic launch currently falls back to a manual handoff on Windows and for custom commands in unsupported shells. No attempt is made to execute a Windows `.cmd` file through a generic shell. Missing commands and nonzero agent exits leave setup saved and report the failure. Open the desired agent in the project and send the printed prompt, or rerun `init` in a terminal to return to onboarding. Additional AI paths supplied during setup are included in that session's printed prompt; they are not copied or moved by the installer.

## Interface evidence

Checked on November 18, 2026. Local help for Codex CLI 0.170.0 confirms `codex [OPTIONS] [PROMPT]`. Local Claude Code 2.1.327 help confirms an interactive initial prompt. Automated fixtures exercise launch selection, explicit confirmation, safe argument passing, a custom Zsh alias, working-directory restoration, and failed processes using harmless local programs. They do not authenticate or launch a real coding-agent session. The owner will perform live trials.

- [Claude CLI reference](https://code.claude.com/docs/en/cli-reference)
- [Claude skills](https://code.claude.com/docs/en/skills)
- [Cursor skills and shared discovery directories](https://cursor.com/docs/skills)
- [Zsh invocation](https://zsh.sourceforge.io/Doc/Release/Invocation.html)
- [Bash invocation](https://www.gnu.org/software/bash/manual/html_node/Invoking-Bash.html)
- [Bash startup files](https://www.gnu.org/software/bash/manual/html_node/Bash-Startup-Files.html)
