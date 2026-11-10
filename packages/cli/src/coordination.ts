import { randomUUID } from 'node:crypto';
import { lstatSync, mkdirSync, readFileSync, realpathSync, renameSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin } from 'node:process';
import { exists, git, readProjectFile } from './discovery.ts';
import type { Project } from './discovery.ts';

type Claim = {
  task: string; agent: string; token: string; paths: string[];
  checkout: string; head?: string; expires: number; handoff?: string;
};

const ttl = 60 * 60 * 1000;
const name = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;
const tokenPattern = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/;

function scope(path: string): string {
  const parts = path.replaceAll('\\', '/').split('/');
  if (parts.some(part => !/^[a-zA-Z0-9_.-]+$/.test(part) || ['.', '..', '.git'].includes(part.toLowerCase()))) {
    throw new Error('Use repository-relative paths with simple names, or * for the entire repository.');
  }
  return parts.join('/').toLowerCase();
}

function overlaps(left: string, right: string): boolean {
  return left === '*' || right === '*' || left === right || left.startsWith(right + '/') || right.startsWith(left + '/');
}

function readClaims(path: string): Claim[] {
  if (!exists(path)) return [];
  const file = lstatSync(path);
  if (!file.isFile() || file.size > 1024 * 1024) throw new Error('Unsafe coordination state file.');
  const data: unknown = JSON.parse(readFileSync(path, 'utf8'));
  if (!Array.isArray(data) || data.some(item => !item || typeof item.task !== 'string' || !name.test(item.task) ||
      typeof item.agent !== 'string' || !name.test(item.agent) || typeof item.token !== 'string' || !tokenPattern.test(item.token) ||
      typeof item.checkout !== 'string' || !Number.isSafeInteger(item.expires) || !Array.isArray(item.paths) || !item.paths.length ||
      item.paths.some((p: unknown) => typeof p !== 'string' || p !== '*' && scope(p) !== p))) {
    throw new Error('Invalid coordination state.');
  }
  return data;
}

export async function coordinate(project: Project, input: string[]): Promise<void> {
  const worktree = input.includes('--worktree');
  const args = input.filter(arg => arg !== '--worktree');
  const [action = 'status', task, credential, ...rawPaths] = args;
  const common = git(project.root, ['rev-parse', '--path-format=absolute', '--git-common-dir']);
  const local = git(project.root, ['rev-parse', '--absolute-git-dir']);
  if (!common || !local) throw new Error('Coordination requires a Git checkout.');
  if (realpathSync(common) !== realpathSync(local) && !worktree) {
    throw new Error('Use --worktree explicitly to coordinate from this linked worktree.');
  }
  const directory = join(realpathSync(common), 'ai-workflow-kit-coordination');
  const state = join(directory, 'claims.json');
  const lock = join(directory, 'write.lock');
  function checkDirectory() {
    if (exists(directory) && !lstatSync(directory).isDirectory()) throw new Error('Unsafe coordination directory.');
  }
  checkDirectory();
  const snapshot = readClaims(state);
  if (action === 'status' && args.length <= 1) {
    console.log(JSON.stringify(snapshot.map(({ token, ...claim }) => ({
      ...claim, stale: claim.expires <= Date.now(),
    })), null, 2));
    return;
  }
  if (!task || !name.test(task) || !credential) throw new Error('Provide a task ID and agent name or ownership token.');
  const existing = snapshot.find(item => item.task === task);
  const now = Date.now();
  let replacement: Claim;
  if (action === 'claim' || action === 'takeover') {
    if (!name.test(credential) || !rawPaths.length || rawPaths.length > 32) throw new Error('Provide an agent name and 1–32 paths.');
    if (action === 'claim' && existing && existing.expires !== 0) throw new Error('Task is already owned. Check status for expiry.');
    if (action === 'takeover' && (!existing || existing.expires === 0 || existing.expires > now)) {
      throw new Error('Only stale ownership can be taken over.');
    }
    const paths = [...new Set(rawPaths.map(path => path === '*' ? '*' : scope(path)))].sort();
    const conflict = snapshot.find(claim => claim.task !== task && claim.expires !== 0 &&
      paths.some(path => claim.paths.some(other => overlaps(path, other))));
    if (conflict) throw new Error(`Scope overlaps task ${conflict.task} (${conflict.expires <= now ? 'stale' : 'active'}).`);
    replacement = { task, agent: credential, token: randomUUID(), paths, checkout: project.root,
      head: project.git.head, expires: now + ttl, handoff: existing?.handoff };
  } else {
    if (!existing || existing.token !== credential || existing.checkout !== project.root || existing.expires === 0) {
      throw new Error('The token and checkout must match the current owner.');
    }
    if (action === 'renew' && !rawPaths.length && existing.expires > now) {
      replacement = { ...existing, head: project.git.head, expires: now + ttl };
    } else if (action === 'release' && rawPaths.length <= 1) {
      const handoff = rawPaths[0];
      if (handoff && (!/^\.ai\/tasks\/[a-zA-Z0-9_-]+\.md$/.test(handoff) || readProjectFile(project.root, handoff) === undefined)) {
        throw new Error('Use a readable .ai/tasks/<id>.md handoff in this checkout.');
      }
      replacement = { ...existing, head: project.git.head, expires: 0, handoff };
    } else throw new Error('Invalid coordination operation or stale ownership.');
  }
  const { token, ...preview } = replacement;
  console.log(JSON.stringify({ action, ...preview, state, note: 'Recheck Git and working files before editing. Claims are advisory and shared only within this clone.' }, null, 2));
  const lines = createInterface({ input: stdin, terminal: false });
  let approved = false;
  try {
    console.log('Type apply to approve this coordination change:');
    for await (const line of lines) { approved = line.trim() === 'apply'; break; }
  } finally { lines.close(); }
  if (!approved) return;
  checkDirectory();
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  try { mkdirSync(lock, { mode: 0o700 }); } catch {
    throw new Error('Coordination writer is locked. Confirm no writer is running before manually clearing write.lock.');
  }
  try {
    if (JSON.stringify(readClaims(state)) !== JSON.stringify(snapshot) ||
        git(project.root, ['rev-parse', '--verify', 'HEAD']) !== project.git.head) {
      throw new Error('Coordination or Git state changed. Review a fresh plan.');
    }
    if (action === 'renew' && existing!.expires <= Date.now()) throw new Error('Ownership expired. Review takeover.');
    if (replacement.expires !== 0) replacement.expires = Date.now() + ttl;
    const temporary = join(directory, randomUUID() + '.tmp');
    try {
      writeFileSync(temporary, JSON.stringify([...snapshot.filter(claim => claim.task !== task), replacement], null, 2) + '\n',
        { flag: 'wx', mode: 0o600 });
      renameSync(temporary, state);
    } finally { if (exists(temporary)) unlinkSync(temporary); }
  } finally { rmdirSync(lock); }
  if (action === 'claim' || action === 'takeover') console.log(`Ownership token: ${token}`);
}
