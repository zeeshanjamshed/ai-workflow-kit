import { homedir } from 'node:os';
import { dirname, join, relative, sep } from 'node:path';
import { readdirSync, realpathSync, statSync } from 'node:fs';
import { readProjectFile, within } from './discovery.ts';
import type { Project } from './discovery.ts';

const skillRoots = [
  { agent: 'claude', directory: '.claude/skills', nested: false },
  { agent: 'codex', directory: '.agents/skills', nested: true },
  { agent: 'cursor', directory: '.cursor/skills', nested: true },
];

function list(path: string) {
  try {
    return readdirSync(path, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
  } catch (error) {
    if (['ENOENT', 'ENOTDIR'].includes((error as NodeJS.ErrnoException).code ?? '')) return [];
    throw error;
  }
}

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch (error) {
    if (['ENOENT', 'ENOTDIR', 'ELOOP'].includes((error as NodeJS.ErrnoException).code ?? '')) return false;
    throw error;
  }
}

function skillFiles(root: string, nested: boolean): string[] {
  const files: string[] = [];
  const pending = [root];
  while (pending.length) {
    const directory = pending.pop()!;
    for (const entry of list(directory)) {
      const folder = join(directory, entry.name);
      if (entry.name.startsWith('.') || !entry.isDirectory() && !entry.isSymbolicLink()) continue;
      const file = join(folder, 'SKILL.md');
      if (isFile(file)) files.push(file);
      else if (nested && entry.isDirectory()) pending.push(folder);
    }
  }
  return files.sort();
}

export function discoverSkills(project: Project, cwd: string, home = homedir()) {
  // Use the same OS canonicalization for the Git-reported root and the working directory.
  const root = realpathSync.native(project.root);
  const directories = [root];
  for (let dir = realpathSync.native(cwd); within(root, dir) && relative(root, dir); dir = dirname(dir)) {
    directories.push(dir);
  }
  const displayPath = (base: string, path: string) => relative(base, path).split(sep).join('/');

  return skillRoots.flatMap(({ agent, directory, nested }) => [
    ...directories.flatMap(dir => skillFiles(join(dir, directory), nested).map(path => ({
      agent, scope: 'project', path: displayPath(root, path),
    }))),
    ...skillFiles(join(home, directory), nested).map(path => ({
      agent, scope: 'user', path: displayPath(home, path),
    })),
  ]);
}

function records(root: string, directory: string): string[] {
  const path = join(root, directory);
  try {
    if (!within(root, realpathSync(path))) return [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  return list(path)
    .filter(entry => entry.isFile() && /^[a-zA-Z0-9][a-zA-Z0-9._-]*\.md$/.test(entry.name))
    .map(entry => directory + '/' + entry.name);
}

export function resumeContext(project: Project, task?: string) {
  const { root } = project;
  const tasks = records(root, '.ai/tasks');
  let handoff: { path: string; markdown: string } | undefined;
  if (task !== undefined) {
    const path = '.ai/tasks/' + task + '.md';
    if (!tasks.includes(path)) throw new Error('Task not found. Run context to list available handoffs.');
    const markdown = readProjectFile(root, path);
    if (markdown === undefined) throw new Error('The task record is not readable inside the project.');
    handoff = { path, markdown };
  }
  return {
    root, git: project.git,
    index: ['.ai/README.md', '.ai/rules/permissions.md'].filter(path => readProjectFile(root, path) !== undefined),
    knowledge: records(root, '.ai/knowledge'),
    decisions: records(root, '.ai/decisions'),
    tasks, handoff,
    next: 'Read the project rules. Verify handoff claims against the current Git state and code. Confirm approval before writing.',
  };
}
