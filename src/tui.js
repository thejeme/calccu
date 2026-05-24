'use strict';

function helpText() {
  return [
    'calccu help',
    '',
    'Type expressions and see the result live. Press Enter to save the result as ans.',
    '',
    'Expressions:',
    '  2 + 3 * 4',
    '  2x + 1       implicit multiplication',
    '  sin(pi / 2)',
    '  ans * 10',
    '  2m + 30cm',
    '  5km to m',
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
    '  clear         clear terminal',
    '  history       show recent commands',
    '  units         show supported units',
    '  ls vars       list variables',
    '  ls funcs      list functions',
    '  precision 8   set displayed significant digits',
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
  const lines = output.split('\n');
  if (lines.length === 1) return ['< ' + output];
  return ['<', ...lines.map((line) => (line ? '  ' + line : ''))];
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
  formatOutput,
  helpText,
  readEscapeSequence
};
