# Try the local candidate

These are owner-run trials. Automated checks do not launch an authenticated agent or deploy anything.

## Install once in an isolated location

From the kit checkout, with Node.js 22.18 or newer:

```sh
npm pack
npm install --global --prefix /tmp/ai-workflow-kit-trial --offline --ignore-scripts ./zeeshanjamshed-ai-workflow-kit-0.4.5.tgz
export PATH="/tmp/ai-workflow-kit-trial/bin:$PATH"
ai-setup --version
```

Expect `0.4.5`. This leaves your regular global installation alone. Use that terminal for the project and agent session. On Windows, choose a temporary install prefix and add the prefix itself to the session PATH; the launcher is `ai-setup.cmd`. Automatic agent launch uses a manual handoff there.

## 1. New project

Create an empty temporary Git project and run:

```sh
ai-setup init
```

Choose your agents and mixed tracking. Check the proposed paths and type `apply`. Save the backup ID. Choose your usual agent or enter a custom alias such as `claude-orca`, then type `start`.

Ask the agent to explain the loaded rules and propose one harmless change without making it. Check that it gives a short plan and waits. Approve the small task once and check that it finishes within that approval, reviews its work, and reports actual checks.

During onboarding, check that facts cite real code and uncertain claims are labeled. Knowledge must not be saved before approval. A fresh session should find saved knowledge without repeating the whole investigation.

## 2. Existing project with AI setup

Use a disposable copy that includes existing instructions, skills, decisions, and ignored knowledge. A plain Git clone omits ignored and uncommitted files.

Run `ai-setup init`. Check that it identifies the setup and preserves existing content. Include any unusual rule or knowledge locations when asked. These extra references go into that session's onboarding prompt; the installer does not move them.

Check that the agent proposes how to consolidate the setup, preserves useful history, and asks about conflicting rules. Verify that existing skills remain discoverable. Approve only the proposed changes you want.

## 3. Update and recovery

In a disposable copy of an older initialized project, run:

```sh
ai-setup update
```

Review the version and file changes. Confirm that custom rules and knowledge survive. A file changed both locally and centrally should stop for review. Do not remove custom content just to make an update pass.

To test rollback, use a setup or update backup **before editing its affected files**:

```sh
ai-setup rollback <backup-id>
```

Review the reversal and type `apply`. Existing content should return. A later edit to an affected file must cause rollback to refuse. Rerunning `init` after a completed setup must not duplicate files.

For local-only tracking, use a disposable project with untracked AI files. Check the previewed `.gitignore` addition. Already tracked private files should block setup, with no silent untracking.

## Record the result

Keep a brief pass/fail note for each trial, the CLI and agent versions, the tracking choice, and the agent's native permission settings. Note any surprising question, missing rule, changed file, or lost context. Keep private project details out of this public repository.

The next step after successful trials is review of the candidate and its CI results. These instructions do not authorize publishing, commits, or deployments.
