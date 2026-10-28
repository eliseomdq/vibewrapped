import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clipboardCommand } from '../src/clipboard.js';

test('copies the PNG with AppleScript on macOS', () => {
  const [cmd, args] = clipboardCommand('darwin', '/tmp/my card.png');
  assert.equal(cmd, 'osascript');
  assert.deepEqual(args, ['-e', 'set the clipboard to (read (POSIX file "/tmp/my card.png") as «class PNGf»)']);
});

test('escapes quotes and backslashes in the macOS path', () => {
  const [, args] = clipboardCommand('darwin', '/tmp/a"b\\c.png');
  assert.equal(args[1], 'set the clipboard to (read (POSIX file "/tmp/a\\"b\\\\c.png") as «class PNGf»)');
});

test('uses an STA PowerShell and passes the path in the environment, not the script, on Windows', () => {
  const file = "C:\\Users\\o'neil\\a b;calc.png";
  const [cmd, args, env] = clipboardCommand('win32', file);
  assert.equal(cmd, 'powershell');
  assert.ok(args.includes('-STA'));
  assert.deepEqual(env, { VIBEWRAPPED_CARD: file });
  assert.ok(!args.some((a) => a.includes('calc')), 'path must not reach the PowerShell command line');
});

test('uses xclip on Linux', () => {
  assert.deepEqual(clipboardCommand('linux', '/tmp/c.png'), ['xclip', ['-selection', 'clipboard', '-t', 'image/png', '-i', '/tmp/c.png']]);
});
