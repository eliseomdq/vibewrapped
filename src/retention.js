import { randomUUID } from 'node:crypto';
import { chmod, readFile, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Claude Code deletes transcripts older than cleanupPeriodDays, 30 by default.
export const DEFAULT_DAYS = 30;
export const KEEP_DAYS = 3650;

/** @param {string} claudeDir @returns {Promise<Record<string, unknown> | null>} */
async function readSettings(claudeDir) {
  const file = path.join(claudeDir, 'settings.json');
  let raw;
  try {
    raw = await readFile(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
  let settings;
  try {
    settings = JSON.parse(raw);
  } catch {
    throw new Error(`${file} is not valid JSON; fix it before running --keep`);
  }
  if (typeof settings !== 'object' || settings === null || Array.isArray(settings)) {
    throw new Error(`${file} is not a JSON object; fix it before running --keep`);
  }
  return settings;
}

/** @param {string} claudeDir @returns {Promise<number>} */
export async function retentionDays(claudeDir) {
  const settings = await readSettings(claudeDir).catch(() => null);
  return typeof settings?.cleanupPeriodDays === 'number' ? settings.cleanupPeriodDays : DEFAULT_DAYS;
}

/**
 * Raises cleanupPeriodDays in the user's settings.json so Claude Code stops deleting history.
 * Writes to a temp file and renames it, so the settings file is never left half-written.
 * @param {string} claudeDir
 * @returns {Promise<{ before: number | null, after: number }>}
 */
export async function keepHistory(claudeDir) {
  const isDir = await stat(claudeDir).then((s) => s.isDirectory(), () => false);
  if (!isDir) throw new Error(`${claudeDir} does not exist`);
  const settings = (await readSettings(claudeDir)) ?? {};
  const before = typeof settings.cleanupPeriodDays === 'number' ? settings.cleanupPeriodDays : null;
  if (before !== null && before >= KEEP_DAYS) return { before, after: before };
  const file = path.join(claudeDir, 'settings.json');
  // settings.json can hold API keys in its env block: keep its mode, and default new files to 0600.
  const mode = await stat(file).then((s) => s.mode & 0o777, () => 0o600);
  const tmp = `${file}.vibewrapped-${randomUUID()}.tmp`;
  await writeFile(tmp, `${JSON.stringify({ ...settings, cleanupPeriodDays: KEEP_DAYS }, null, 2)}\n`, { mode, flag: 'wx' });
  await chmod(tmp, mode);
  await rename(tmp, file);
  return { before, after: KEEP_DAYS };
}
