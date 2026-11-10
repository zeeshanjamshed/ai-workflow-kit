import { isAbsolute, posix } from 'node:path';
import { projectPathExists, readObject, readProjectFile } from './discovery.ts';
import type { Project } from './discovery.ts';

const index = '.ai/README.md';
const manifest = '.ai/setup-manifest.json';
const entries = ['CLAUDE.md', 'AGENTS.md', '.cursor/rules/ai-workflow-kit.mdc'];

export function preview(project: Project) {
  const paths = [index, manifest, ...entries];
  return {
    project,
    files: paths.map(path => ({
      path,
      action: projectPathExists(project.root, path) ? 'review-existing' : 'candidate-add',
    })),
    next: [
      'Review candidates with the selected agent and confirm project and tool requirements.',
      'Confirm enabled adapters and whether AI records should be tracked, ignored, or mixed.',
      'Review exact contents, existing instructions, and backups before approving any writes.',
    ],
  };
}

export function diagnose(project: Project) {
  const findings: string[] = [];
  const read = (path: string) => readProjectFile(project.root, path);
  if (project.git.detected && project.git.dirty === undefined) findings.push('Git status unavailable. Check the repository and Git installation.');
  if (project.classification === 'initialized') {
    if (!project.version || !readObject(read(manifest))) findings.push('Manifest is invalid or lacks a version. Review setup provenance.');
    if (!read(index)) findings.push('Project knowledge index is missing or unreadable. Review the .ai setup.');
    if (project.agents.every(agent => !agent.paths.some(path => /\.md$|\.cursor\/rules$/.test(path)))) {
      findings.push('No recognized instruction entry point. Review the enabled adapters.');
    }
  }
  const docs = new Set([index, ...project.docs.filter(path => /\.md$/i.test(path)),
    ...project.agents.flatMap(agent => agent.paths.filter(path => /\.md$/i.test(path)))]);
  for (const path of docs) {
    const source = read(path);
    if (!source) continue;
    for (const match of source.replace(/^```[^\n]*\n[\s\S]*?^```[ \t]*$/gm, '').matchAll(/\]\(<?([^\s)>#]+)(?:#[^\s)>]*)?>?\)/g)) {
      const target = match[1];
      if (!/\.md$/i.test(target) || /^[a-z][a-z\d+.-]*:|^\/\//i.test(target) || isAbsolute(target)) continue;
      let decoded: string;
      try {
        decoded = decodeURIComponent(target);
      } catch {
        continue;
      }
      const resolved = posix.normalize(posix.join(posix.dirname(path), decoded));
      if (!projectPathExists(project.root, resolved)) findings.push(`Check Markdown link in ${path}: ${target}`);
    }
  }
  return { project, findings: [...new Set(findings)] };
}
