#!/usr/bin/env node

const { Calculator } = require('../src/engine');

const calc = new Calculator();
const stdin = process.stdin;
const stdout = process.stdout;

let input = '';
let cursor = 0;
let status = '';
let running = true;

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
    '  3(x - 1) = 9 -> x = 4',
    '',
    'Commands:',
    '  help, ?       show help',
    '  clear         clear terminal',
    '  quit, exit    quit',
    '',
    'Keys:',
    '  Enter commit input',
    '  Esc or Ctrl+C quit',
    '  Ctrl+L clear terminal'
  ].join('\n');
}

function clearScreen() {
  stdout.write('\x1b[2J\x1b[H');
}

function previewFor(text) {
  const trimmed = text.trim();
  if (!trimmed) return '';
  const command = trimmed.toLowerCase();
  if (command === 'help' || command === '?') return 'show help';
  if (command === 'clear' || command === 'cls') return 'clear terminal';
  if (command === 'quit' || command === 'exit') return 'quit';
  try {
    return calc.preview(trimmed);
  } catch (error) {
    return error.message;
  }
}

function render() {
  const preview = previewFor(input);
  clearScreen();
  stdout.write('calccu  (? for help, Esc to quit)\n\n');
  if (status) {
    stdout.write(status + '\n\n');
  }
  stdout.write('> ' + input + '\n');
  if (preview) {
    stdout.write('= ' + preview + '\n');
  } else {
    stdout.write('\n');
  }
  stdout.write('\n');

  const row = status ? 4 + status.split('\n').length : 3;
  const column = 3 + cursor;
  stdout.write(`\x1b[${row};${column}H`);
}

function commit() {
  const text = input.trim();
  input = '';
  cursor = 0;

  if (!text) {
    render();
    return;
  }

  const command = text.toLowerCase();
  if (command === 'quit' || command === 'exit') {
    shutdown();
    return;
  }
  if (command === 'clear' || command === 'cls') {
    status = '';
    render();
    return;
  }
  if (command === 'help' || command === '?') {
    status = helpText();
    render();
    return;
  }

  try {
    status = calc.execute(text);
  } catch (error) {
    status = 'Error: ' + error.message;
  }
  render();
}

function insert(text) {
  input = input.slice(0, cursor) + text + input.slice(cursor);
  cursor += text.length;
}

function removeBeforeCursor() {
  if (cursor === 0) return;
  input = input.slice(0, cursor - 1) + input.slice(cursor);
  cursor -= 1;
}

function removeAtCursor() {
  if (cursor >= input.length) return;
  input = input.slice(0, cursor) + input.slice(cursor + 1);
}

function shutdown() {
  if (!running) return;
  running = false;
  clearScreen();
  if (stdin.isTTY) stdin.setRawMode(false);
  stdin.pause();
}

function handleKey(data) {
  const key = data.toString('utf8');
  if (key === '\u0003' || key === '\u001b') {
    shutdown();
    return;
  }
  if (key === '\u0004') {
    shutdown();
    return;
  }
  if (key === '\r' || key === '\n') {
    commit();
    return;
  }
  if (key === '\u000c') {
    status = '';
    render();
    return;
  }
  if (key === '\u007f' || key === '\b') {
    removeBeforeCursor();
    render();
    return;
  }
  if (key === '\u001b[D') {
    cursor = Math.max(0, cursor - 1);
    render();
    return;
  }
  if (key === '\u001b[C') {
    cursor = Math.min(input.length, cursor + 1);
    render();
    return;
  }
  if (key === '\u001b[3~') {
    removeAtCursor();
    render();
    return;
  }
  if (/^[\x20-\x7e]+$/.test(key)) {
    insert(key);
    render();
  }
}

process.on('exit', () => {
  if (stdin.isTTY) stdin.setRawMode(false);
});

if (!stdin.isTTY) {
  console.error('calccu needs an interactive terminal.');
  process.exit(1);
}

stdin.setRawMode(true);
stdin.resume();
stdin.on('data', handleKey);
render();
