#!/usr/bin/env node

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Calculator } = require('../src/engine');
const { applyEditKey, formatOutput, helpText, readEscapeSequence } = require('../src/tui');

const calc = new Calculator();
const stdin = process.stdin;
const stdout = process.stdout;

let input = '';
let cursor = 0;
let running = true;
let history = [];
let commandHistory = [];
let commandHistoryIndex = 0;
let draftInput = '';
const historyPath = process.env.CALCCU_HISTORY || path.join(os.homedir(), '.calccu_history');

loadCommandHistory();

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
  let row = 1;
  clearScreen();
  stdout.write('calccu  (? for help, Ctrl+C to quit)\n\n');
  row += 2;

  for (const entry of visibleHistory()) {
    stdout.write('> ' + entry.input + '\n');
    row += 1;

    const formatted = formatOutput(entry.output);
    for (const line of formatted) stdout.write(line + '\n');
    row += formatted.length;

    stdout.write('\n');
    row += 1;
  }

  stdout.write('> ' + input + '\n');
  const promptRow = row;
  row += 1;

  if (preview) {
    const formatted = formatOutput(preview);
    stdout.write(formatted.join('\n') + '\n');
  } else {
    stdout.write('\n');
  }
  stdout.write('\n');

  const column = 3 + cursor;
  stdout.write(`\x1b[${promptRow};${column}H`);
}

function commit() {
  const text = input.trim();
  input = '';
  cursor = 0;
  commandHistoryIndex = commandHistory.length;
  draftInput = '';

  if (!text) {
    render();
    return;
  }

  rememberCommand(text);

  const command = text.toLowerCase();
  if (command === 'quit' || command === 'exit') {
    shutdown();
    return;
  }
  if (command === 'clear' || command === 'cls') {
    history = [];
    render();
    return;
  }
  if (command === 'help' || command === '?') {
    rememberResult(text, helpText());
    render();
    return;
  }

  try {
    rememberResult(text, calc.execute(text));
  } catch (error) {
    rememberResult(text, 'Error: ' + error.message);
  }
  render();
}

function rememberCommand(text) {
  if (commandHistory[commandHistory.length - 1] !== text) {
    commandHistory.push(text);
    if (commandHistory.length > 500) commandHistory = commandHistory.slice(-500);
    saveCommandHistory();
  }
  commandHistoryIndex = commandHistory.length;
}

function rememberResult(text, output) {
  history.push({ input: text, output });
  if (history.length > 200) history = history.slice(-200);
}

function visibleHistory() {
  const rows = stdout.rows || 30;
  const maxRows = Math.max(6, rows - 6);
  let used = 0;
  const visible = [];

  for (let i = history.length - 1; i >= 0; i -= 1) {
    const entryRows = 2 + entryLineCount(history[i].output);
    if (visible.length > 0 && used + entryRows > maxRows) break;
    visible.unshift(history[i]);
    used += entryRows;
  }

  return visible;
}

function entryLineCount(output) {
  return formatOutput(output).length;
}

function recallPrevious() {
  if (commandHistory.length === 0) return;
  if (commandHistoryIndex === commandHistory.length) draftInput = input;
  commandHistoryIndex = Math.max(0, commandHistoryIndex - 1);
  input = commandHistory[commandHistoryIndex];
  cursor = input.length;
}

function recallNext() {
  if (commandHistory.length === 0 || commandHistoryIndex === commandHistory.length) return;
  commandHistoryIndex += 1;
  input = commandHistoryIndex === commandHistory.length ? draftInput : commandHistory[commandHistoryIndex];
  cursor = input.length;
}

function resetCommandRecall() {
  commandHistoryIndex = commandHistory.length;
  draftInput = '';
}

function loadCommandHistory() {
  try {
    commandHistory = fs.readFileSync(historyPath, 'utf8').split('\n').filter(Boolean).slice(-500);
    commandHistoryIndex = commandHistory.length;
  } catch (error) {
    if (error.code !== 'ENOENT') return;
  }
}

function saveCommandHistory() {
  try {
    fs.writeFileSync(historyPath, commandHistory.join('\n') + (commandHistory.length ? '\n' : ''), 'utf8');
  } catch {
    // History is a convenience feature; calculator use should not fail if the file cannot be written.
  }
}

function shutdown() {
  if (!running) return;
  running = false;
  clearScreen();
  if (stdin.isTTY) stdin.setRawMode(false);
  stdin.pause();
}

function handleData(data) {
  const text = data.toString('utf8');
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === '\u001b') {
      const sequence = readEscapeSequence(text, i);
      handleKey(sequence.value);
      i = sequence.end;
    } else {
      handleKey(text[i]);
    }
  }
}

function handleKey(key) {
  if (key === '\u0003') {
    shutdown();
    return;
  }
  if (key === '\u0004') {
    shutdown();
    return;
  }
  if (key === '\u001b') {
    render();
    return;
  }
  if (key === '\r' || key === '\n') {
    commit();
    return;
  }
  if (key === '\u000c') {
    history = [];
    render();
    return;
  }
  if (key === '\u001b[A') {
    recallPrevious();
    render();
    return;
  }
  if (key === '\u001b[B') {
    recallNext();
    render();
    return;
  }

  const edit = applyEditKey({ input, cursor }, key);
  if (edit.handled) {
    input = edit.state.input;
    cursor = edit.state.cursor;
    if (edit.changed) resetCommandRecall();
    render();
  }
}

process.on('exit', () => {
  if (stdin.isTTY) stdin.setRawMode(false);
});

if (process.argv.length > 2) {
  const expression = process.argv.slice(2).join(' ');
  try {
    console.log(calc.execute(expression));
    process.exit(0);
  } catch (error) {
    console.error('Error: ' + error.message);
    process.exit(1);
  }
}

if (!stdin.isTTY) {
  const chunks = [];
  stdin.setEncoding('utf8');
  stdin.on('data', (chunk) => chunks.push(chunk));
  stdin.on('end', () => {
    const expressions = chunks.join('').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    for (const expression of expressions) {
      try {
        console.log(calc.execute(expression));
      } catch (error) {
        console.error('Error: ' + error.message);
        process.exitCode = 1;
      }
    }
  });
} else {
  stdin.setRawMode(true);
  stdin.resume();
  stdin.on('data', handleData);
  render();
}
