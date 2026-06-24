'use strict';

const os = require('node:os');
const path = require('node:path');

function helpText() {
  return [
    'calccu help',
    '',
    'Type expressions and see a live preview. Press Enter to save the result as ans.',
    '',
    'Usage:',
    '  calccu',
    '  calccu [--precision n] [--plain|--json] "expression"',
    '  printf "2 + 2\\n5km -> m\\n" | calccu --plain',
    '',
    'Options:',
    '  -h, --help         show help',
    '  -v, --version      show version',
    '  --precision n      set displayed significant digits for this run',
    '  --plain            print display-form output',
    '  --json             print one JSON object per evaluated expression',
    '',
    'Expressions:',
    '  2 + 3 * 4',
    '  2x + 1       implicit multiplication',
    '  sin(pi / 2)',
    '  gcd(12, 18)',
    '  lcm(4, 6)',
    '  fact(5)',
    '  ans * 10',
    '  2m + 30cm',
    '  2 meters to cm',
    '  5km -> m',
    '  32F to C',
    '  1MiB to B',
    '',
    'Variables:',
    '  x = 12',
    '  del x',
    '  vars',
    '',
    'Functions:',
    '  f(x) = x^2 + 1',
    '  f(3)',
    '  del f',
    '  funcs',
    '',
    'Equations:',
    '  2x = 3       -> x = 3/2',
    '  x/2 = 3      -> x = 6',
    '  x^2 - 4 = 0  -> x = -2 or x = 2',
    '',
    'Commands:',
    '  help, ?       show help',
    '  clear, cls    clear terminal',
    '  history       show recent commands',
    '  units         show supported conversion units',
    '  ls units      show supported conversion units',
    '  ls vars       list variables',
    '  ls funcs      list functions',
    '  copy          show current ans value',
    '  precision 8   set displayed significant digits',
    '  del func f    delete a function',
    '  quit, exit    quit',
    '',
    'Keys:',
    '  Enter commit input',
    '  Ctrl+C quit',
    '  Ctrl+L clear terminal',
    '  Up/Down command history',
    '  PageUp/PageDown scroll results',
    '  Home/End move to start/end',
    '  Ctrl+A/E move to start/end',
    '  Ctrl+U/K delete before/after cursor',
    '  Ctrl+W delete previous word'
  ].join('\n');
}

function formatOutput(output) {
  const lines = formatDisplayResult(output).split('\n');
  if (lines.length === 1) return ['< ' + lines[0]];
  return ['<', ...lines.map((line) => (line ? '  ' + line : ''))];
}

function formatDisplayResult(result) {
  return result.startsWith('ans = ') ? result.slice('ans = '.length) : result;
}

function historyPath(env = process.env, homeDir = os.homedir()) {
  if (env.CALCCU_HISTORY) return env.CALCCU_HISTORY;
  const stateHome = env.XDG_STATE_HOME || path.join(homeDir, '.local', 'state');
  return path.join(stateHome, 'calccu', 'history');
}

function terminalWidth(columns) {
  return Math.max(1, columns || 80);
}

function visualLineCount(text, columns) {
  const width = terminalWidth(columns);
  const lines = String(text).split('\n');
  return lines.reduce((count, line) => count + Math.max(1, Math.ceil(line.length / width)), 0);
}

function wrapLine(text, columns) {
  const width = terminalWidth(columns);
  const value = String(text);
  if (value.length === 0) return [''];
  const lines = [];
  for (let index = 0; index < value.length; index += width) {
    lines.push(value.slice(index, index + width));
  }
  return lines;
}

function wrapLines(lines, columns) {
  return lines.flatMap((line) => wrapLine(line, columns));
}

function previewLines(output, columns, maxRows = 3) {
  if (!output) return [];
  const rows = wrapLines(formatOutput(output), columns);
  if (rows.length <= maxRows) return rows;
  if (maxRows <= 0) return [];
  return [...rows.slice(0, maxRows - 1), '...'];
}

function entryLineCount(entry, columns) {
  const inputRows = visualLineCount('> ' + entry.input, columns);
  const outputRows = formatOutput(entry.output)
    .reduce((count, line) => count + visualLineCount(line, columns), 0);
  return inputRows + outputRows + 1;
}

function visibleHistoryEntries(history, options = {}) {
  if (history.length === 0) return [];
  const rows = options.rows || 30;
  const columns = options.columns || 80;
  const scrollOffset = options.scrollOffset || 0;
  const maxRows = Math.max(6, rows - 6);
  let used = 0;
  const visible = [];
  const start = Math.max(0, history.length - 1 - scrollOffset);

  for (let i = start; i >= 0; i -= 1) {
    const entryRows = entryLineCount(history[i], columns);
    if (visible.length > 0 && used + entryRows > maxRows) break;
    visible.unshift(history[i]);
    used += entryRows;
  }

  return visible;
}

function promptView(input, cursor, columns) {
  const width = Math.max(4, terminalWidth(columns));
  const available = Math.max(1, width - 3);
  const maxBeforeCursor = available;
  const start = Math.max(0, cursor - maxBeforeCursor);
  const text = input.slice(start, start + available);

  return {
    line: '> ' + text,
    column: Math.min(width, 3 + cursor - start)
  };
}

function readEscapeSequence(text, start) {
  if (text[start + 1] === '[') {
    let end = start + 2;
    while (end < text.length && !/[A-Za-z~]/.test(text[end])) end += 1;
    if (end < text.length) return { value: text.slice(start, end + 1), end };
  }
  return { value: '\u001b', end: start };
}

function applyEditKey(state, key) {
  const next = { input: state.input, cursor: state.cursor };

  if (key === '\u001b[D') {
    next.cursor = Math.max(0, next.cursor - 1);
    return { handled: true, changed: false, state: next };
  }
  if (key === '\u001b[C') {
    next.cursor = Math.min(next.input.length, next.cursor + 1);
    return { handled: true, changed: false, state: next };
  }
  if (key === '\u0001' || key === '\u001b[H' || key === '\u001b[1~' || key === '\u001b[7~') {
    next.cursor = 0;
    return { handled: true, changed: false, state: next };
  }
  if (key === '\u0005' || key === '\u001b[F' || key === '\u001b[4~' || key === '\u001b[8~') {
    next.cursor = next.input.length;
    return { handled: true, changed: false, state: next };
  }
  if (key === '\u0015') {
    next.input = next.input.slice(next.cursor);
    next.cursor = 0;
    return { handled: true, changed: true, state: next };
  }
  if (key === '\u000b') {
    next.input = next.input.slice(0, next.cursor);
    return { handled: true, changed: true, state: next };
  }
  if (key === '\u0017') {
    const start = previousWordStart(next.input, next.cursor);
    next.input = next.input.slice(0, start) + next.input.slice(next.cursor);
    next.cursor = start;
    return { handled: true, changed: true, state: next };
  }
  if (key === '\u007f' || key === '\b') {
    if (next.cursor === 0) return { handled: true, changed: false, state: next };
    next.input = next.input.slice(0, next.cursor - 1) + next.input.slice(next.cursor);
    next.cursor -= 1;
    return { handled: true, changed: true, state: next };
  }
  if (key === '\u001b[3~') {
    if (next.cursor >= next.input.length) return { handled: true, changed: false, state: next };
    next.input = next.input.slice(0, next.cursor) + next.input.slice(next.cursor + 1);
    return { handled: true, changed: true, state: next };
  }
  if (/^[\x20-\x7e]+$/.test(key)) {
    next.input = next.input.slice(0, next.cursor) + key + next.input.slice(next.cursor);
    next.cursor += key.length;
    return { handled: true, changed: true, state: next };
  }

  return { handled: false, changed: false, state: next };
}

function previousWordStart(input, cursor) {
  let index = cursor;
  while (index > 0 && /\s/.test(input[index - 1])) index -= 1;
  while (index > 0 && !/\s/.test(input[index - 1])) index -= 1;
  return index;
}

module.exports = {
  applyEditKey,
  entryLineCount,
  formatDisplayResult,
  formatOutput,
  helpText,
  historyPath,
  previewLines,
  promptView,
  readEscapeSequence,
  visibleHistoryEntries,
  visualLineCount,
  wrapLines
};
