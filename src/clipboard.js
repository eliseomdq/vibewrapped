import { spawn } from 'node:child_process';

// Windows PowerShell must run in STA mode to touch the clipboard. -Command joins every later argument into the
// script text, so the path travels in an environment variable instead.
const WIN_SCRIPT =
  'Add-Type -AssemblyName System.Windows.Forms,System.Drawing; [System.Windows.Forms.Clipboard]::SetImage([System.Drawing.Image]::FromFile($env:VIBEWRAPPED_CARD))';
const TIMEOUT_MS = 10_000;

/**
 * The OS command that puts a PNG file on the clipboard as an image.
 * @param {NodeJS.Platform} platform
 * @param {string} file absolute path to the PNG
 * @returns {[string, string[], Record<string, string>?]} command, arguments and extra environment
 */
export function clipboardCommand(platform, file) {
  if (platform === 'darwin') {
    const quoted = file.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return ['osascript', ['-e', `set the clipboard to (read (POSIX file "${quoted}") as «class PNGf»)`]];
  }
  if (platform === 'win32') {
    return ['powershell', ['-NoProfile', '-STA', '-Command', WIN_SCRIPT], { VIBEWRAPPED_CARD: file }];
  }
  return ['xclip', ['-selection', 'clipboard', '-t', 'image/png', '-i', file]];
}

/**
 * Copies the card to the clipboard so sharing is a paste. Resolves false when the OS tool is missing or fails.
 * @param {string} file
 * @returns {Promise<boolean>}
 */
export function copyImage(file) {
  const [cmd, args, env] = clipboardCommand(process.platform, file);
  return new Promise((resolve) => {
    spawn(cmd, args, { stdio: 'ignore', timeout: TIMEOUT_MS, env: { ...process.env, ...env } })
      .on('error', () => resolve(false))
      .on('exit', (code) => resolve(code === 0));
  });
}
