import { spawnSync } from 'node:child_process';
import { accessSync, constants, lstatSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { delimiter, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

const markers = ['package.json', 'pnpm-workspace.yaml', 'Cargo.toml', 'pyproject.toml', 'go.mod', 'composer.json', 'Gemfile', 'pom.xml', 'build.gradle', 'pubspec.yaml'];
const agentFiles = {
  claude: ['CLAUDE.md', '.claude/CLAUDE.md', '.claude/rules', '.claude/skills'],
  codex: ['AGENTS.md', 'AGENTS.override.md', '.agents/skills'],
  cursor: ['.cursor/rules', '.cursorrules', '.cursor/skills'],
  other: ['.github/copilot-instructions.md', 'GEMINI.md', '.windsurfrules', '.aider.conf.yml'],
};
const frameworkNames = ['next', 'react', 'vue', 'nuxt', 'svelte', '@angular/core', 'expo', 'react-native', 'express', 'astro', '@sveltejs/kit'];

export function exists(path: string): boolean {
  try {
    lstatSync(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT' || (error as NodeJS.ErrnoException).code === 'ENOTDIR') return false;
    throw error;
  }
}

export function within(root: string, path: string): boolean {
  const rel = relative(root, path);
  return !isAbsolute(rel) && rel !== '..' && !rel.startsWith('..' + sep);
}

export function readProjectFile(root: string, path: string): string | undefined {
  const file = resolve(root, path);
  if (!within(root, file) || !exists(file)) return undefined;
  const actual = realpathSync(file);
  if (!within(root, actual) || !lstatSync(actual).isFile()) return undefined;
  if (lstatSync(actual).size > 1024 * 1024) return undefined;
  return readFileSync(actual, 'utf8');
}

export function readObject(source: string | undefined): Record<string, unknown> | undefined {
  if (source === undefined) return undefined;
  try {
    const value: unknown = JSON.parse(source);
    if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  } catch {
    // Discovery can continue when optional metadata is invalid.
  }
  return undefined;
}

function executable(name: string): boolean {
  const suffixes = process.platform === 'win32' ? ['.exe', '.cmd', '.bat'] : [''];
  return (process.env.PATH ?? '').split(delimiter).filter(isAbsolute).some(dir =>
    suffixes.some(suffix => {
      try {
        const path = join(dir, name + suffix);
        accessSync(path, constants.X_OK);
        return lstatSync(realpathSync(path)).isFile();
      } catch {
        return false;
      }
    }),
  );
}

function runGit(root: string, args: string[], input?: string) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith('GIT_')));
  return spawnSync('git', [
    '--no-optional-locks', '--no-lazy-fetch', '-c', 'core.fsmonitor=false',
    '-c', 'core.untrackedCache=false', ...args,
  ], {
    cwd: root,
    env: { ...env, GIT_TERMINAL_PROMPT: '0', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null' },
    encoding: 'utf8', input, timeout: 5000, maxBuffer: 4 * 1024 * 1024, windowsHide: true,
  });
}

function git(root: string, args: string[], input?: string): string | undefined {
  const result = runGit(root, args, input);
  return result.status === 0 ? result.stdout.trimEnd() : undefined;
}

export function inspectGitPath(root: string, path: string, kind: 'tracked' | 'ignored'): boolean | undefined {
  if (kind === 'tracked') {
    const result = git(root, ['ls-files', '--', path]);
    return result === undefined ? undefined : result.length > 0;
  }
  const { status } = runGit(root, ['check-ignore', '--no-index', '--quiet', '--', path]);
  return status === 0 ? true : status === 1 ? false : undefined;
}

function fallbackRoot(start: string): string {
  for (let dir = start; ; dir = dirname(dir)) {
    if (exists(join(dir, '.git')) || markers.some(marker => exists(join(dir, marker)))) return dir;
    if (dirname(dir) === dir) return start;
  }
}

export function projectPathExists(root: string, path: string): boolean {
  const file = resolve(root, path);
  return within(root, file) && exists(file);
}

export function discover(start = process.cwd()) {
  const cwd = realpathSync(start);
  const gitRoot = executable('git') ? git(cwd, ['rev-parse', '--show-toplevel']) : undefined;
  const root = gitRoot ? realpathSync(gitRoot) : fallbackRoot(cwd);
  const files = readdirSync(root).filter(name => name !== '.git').sort();
  const has = (path: string) => exists(join(root, path));
  const tools = Object.fromEntries(['git', 'node', 'npm', 'pnpm', 'yarn', 'claude', 'codex', 'cursor'].map(name => [name, executable(name)]));
  const agents = Object.entries(agentFiles).map(([name, paths]) => ({
    name, paths: paths.filter(has), onPath: tools[name] ?? false,
  }));
  const manifest = readObject(readProjectFile(root, '.ai/setup-manifest.json'));
  const pkg = readObject(readProjectFile(root, 'package.json'));
  const dependencies = { ...readObjectFromValue(pkg?.dependencies), ...readObjectFromValue(pkg?.devDependencies) };
  const frameworks = Object.fromEntries(frameworkNames.filter(name => typeof dependencies[name] === 'string').map(name => [name, dependencies[name]]));
  // Git status may invoke project-configured clean filters. Disable them before inspecting.
  const filterKeys = gitRoot ? git(root, ['config', '--name-only', '--list', '--null']) : undefined;
  const filterOverrides = filterKeys?.split('\0').flatMap(key =>
    /^filter\..+\.(clean|process|required)$/i.test(key)
      ? ['-c', key + (key.toLowerCase().endsWith('.required') ? '=false' : '=')]
      : [],
  );
  const status = filterOverrides ? git(root, [
    ...filterOverrides, 'status', '--porcelain=v1', '--untracked-files=normal', '--ignore-submodules=all', '--no-renames',
  ]) : undefined;
  const classification = has('.ai/setup-manifest.json') ? 'initialized'
    : has('.ai') || agents.some(agent => agent.paths.length) ? 'existing-ai'
    : files.some(name => !/^(readme(?:\..*)?|license(?:\..*)?|\.gitignore|\.gitattributes)$/i.test(name)) ? 'existing' : 'starter';

  return {
    root, files, classification, agents, tools, frameworks,
    docs: files.filter(name => /^(readme(?:\..*)?|docs)$/i.test(name)),
    projectMarkers: markers.filter(has),
    workspaceMarkers: ['pnpm-workspace.yaml', 'lerna.json', 'nx.json', 'turbo.json', 'packages', 'apps'].filter(has),
    packageWorkspaces: Array.isArray(pkg?.workspaces) || typeof pkg?.workspaces === 'object' && pkg.workspaces !== null,
    packageManager: typeof pkg?.packageManager === 'string' ? pkg.packageManager : undefined,
    version: typeof manifest?.version === 'string' ? manifest.version : undefined,
    git: {
      detected: Boolean(gitRoot || has('.git')),
      branch: gitRoot ? git(root, ['symbolic-ref', '--quiet', '--short', 'HEAD']) : undefined,
      head: gitRoot ? git(root, ['rev-parse', '--verify', 'HEAD']) : undefined,
      dirty: status === undefined ? undefined : status.length > 0,
      aiTracked: gitRoot ? Boolean(git(root, ['ls-files', '--', '.ai/'])) : undefined,
      aiIgnored: gitRoot ? git(root, ['check-ignore', '--no-index', '--stdin'], '.ai/\n') !== undefined : undefined,
    },
  };
}

function readObjectFromValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export type Project = ReturnType<typeof discover>;
