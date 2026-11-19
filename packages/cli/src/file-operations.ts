import { createHash, randomUUID } from 'node:crypto';
import {
  closeSync,
  linkSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { exists, readProjectFile } from './discovery.ts';
import type { Entry } from './bundles.ts';
import type { Edit } from './setup-types.ts';

export function json(value: unknown): string {
  return JSON.stringify(value, null, 2) + '\n';
}

export function sha(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

export function safePath(root: string, path: string, createParents = false): string {
  const parts = path.split('/');
  if (parts.some((part) => !/^[a-zA-Z0-9_.-]+$/.test(part) || part === '.' || part === '..'))
    throw new Error('Invalid managed path.');
  let current = root;
  for (const part of parts.slice(0, -1)) {
    current = join(current, part);
    if (!exists(current) && createParents) {
      try {
        mkdirSync(current);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      }
    }
    if (exists(current) && !lstatSync(current).isDirectory())
      throw new Error(`Unsafe parent for ${path}`);
  }
  const target = join(current, parts.at(-1)!);
  if (exists(target) && !lstatSync(target).isFile()) throw new Error(`Unsafe target for ${path}`);
  return target;
}

// Publish a complete file atomically. A concurrent creator wins without being overwritten.
export function install(root: string, entry: Entry): void {
  const target = safePath(root, entry.path, true);
  if (exists(target)) {
    if (readProjectFile(root, entry.path) === entry.content) return;
    throw new Error(`Conflicting file: ${entry.path}`);
  }
  const temp = join(dirname(target), `.ai-setup-${randomUUID()}.tmp`);
  const fd = openSync(temp, 'wx', 0o600);
  try {
    try {
      writeFileSync(fd, entry.content);
    } finally {
      closeSync(fd);
    }
    try {
      linkSync(temp, target);
    } catch (error) {
      if (
        (error as NodeJS.ErrnoException).code !== 'EEXIST' ||
        safePath(root, entry.path) !== target ||
        readProjectFile(root, entry.path) !== entry.content
      )
        throw error;
    }
  } finally {
    unlinkSync(temp);
  }
}

export function read(root: string, path: string): string | null {
  const file = safePath(root, path);
  if (!exists(file)) return null;
  if (lstatSync(file).size > 1024 * 1024) throw new Error(`Managed file is too large: ${path}`);
  const bytes = readFileSync(file);
  const text = bytes.toString('utf8');
  if (!Buffer.from(text).equals(bytes)) throw new Error(`Managed file is not UTF-8: ${path}`);
  return text;
}

export function replace(root: string, edit: Edit): void {
  const current = read(root, edit.path);
  if (current === edit.after) return;
  if (current !== edit.before) throw new Error(`File changed since preview: ${edit.path}`);
  if (edit.after === null) {
    // Rollback can remove files created by an approved setup, repair, or update.
    unlinkSync(safePath(root, edit.path));
  } else if (edit.before === null) {
    install(root, { path: edit.path, content: edit.after });
  } else {
    const file = safePath(root, edit.path);
    const temporary = join(dirname(file), `.ai-setup-${randomUUID()}.tmp`);
    const fd = openSync(temporary, 'wx', lstatSync(file).mode & 0o777);
    try {
      try {
        writeFileSync(fd, edit.after);
      } finally {
        closeSync(fd);
      }
      if (read(root, edit.path) !== edit.before)
        throw new Error(`File changed since preview: ${edit.path}`);
      renameSync(temporary, file);
    } finally {
      if (exists(temporary)) unlinkSync(temporary);
    }
  }
}
