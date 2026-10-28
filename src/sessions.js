import { createReadStream } from 'node:fs';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';

/**
 * @typedef {{ path: string, isSubagent: boolean }} SessionFile
 */

/**
 * @param {Record<string, string | undefined>} env
 * @param {string} home
 * @returns {string[]}
 */
export function defaultClaudeDirs(env, home) {
  return env.CLAUDE_CONFIG_DIR ? [env.CLAUDE_CONFIG_DIR] : [path.join(home, '.claude')];
}

/**
 * Lists every session transcript under <claudeDir>/projects, including subagent runs
 * stored in <session>/subagents/.
 * @param {string} claudeDir
 * @returns {Promise<SessionFile[]>}
 */
export async function findSessionFiles(claudeDir) {
  const projects = path.join(claudeDir, 'projects');
  let entries;
  try {
    entries = await readdir(projects, { recursive: true, withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  return entries
    .filter((e) => e.isFile() && e.name.endsWith('.jsonl'))
    .map((e) => {
      const dir = e.parentPath ?? e.path;
      return { path: path.join(dir, e.name), isSubagent: path.basename(dir) === 'subagents' };
    });
}

/**
 * Streams parsed JSONL records. Lines that are not valid JSON (partial writes) are skipped,
 * and so are files that vanish or can't be read mid-run (Claude Code's own cleanup can delete them).
 * @param {SessionFile[]} files
 * @param {(file: string, error: Error) => void} onUnreadable
 * @returns {AsyncGenerator<{ file: string, record: any, isSubagent: boolean }>}
 */
export async function* readRecords(files, onUnreadable = () => {}) {
  for (const { path: file, isSubagent } of files) {
    const parsed = [];
    try {
      const lines = readline.createInterface({ input: createReadStream(file), crlfDelay: Infinity });
      for await (const line of lines) {
        if (!line.trim()) continue;
        try {
          parsed.push(JSON.parse(line));
        } catch {
          continue;
        }
      }
    } catch (error) {
      onUnreadable(file, error);
      continue;
    }
    for (const record of parsed) yield { file, record, isSubagent };
  }
}
