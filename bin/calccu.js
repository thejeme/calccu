#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { Calculator } = require('../src/engine');
const {
  applyEditKey,
  formatDisplayResult,
  formatOutput,
  helpText,
  historyPath: defaultHistoryPath,
  previewLines,
  promptView,
  readEscapeSequence,
  visibleHistoryEntries,
  wrapLines
} = require('../src/terminal');
const pkg = require('../package.json');

const cli = parseCliArgs(process.argv.slice(2));
const calc = new Calculator({ precision: cli.precision || undefined });
const stdin = process.stdin;
const stdout = process.stdout;

let input = '';
let cursor = 0;
let running = true;
let interactiveStarted = false;
let rawModeEnabled = false;
let history = [];
let commandHistory = [];
let commandHistoryIndex = 0;
let draftInput = '';
let scrollOffset = 0;
const historyPath = defaultHistoryPath();

function parseCliArgs(args) {
  const options = {
    expressionParts: [],
    help: false,
    json: false,
    plain: false,
    precision: null,
    version: false
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];

    if (arg === '--') {
      options.expressionParts.push(...args.slice(i + 1));
      break;
    }
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }
    if (arg === '--version' || arg === '-v') {
      options.version = true;
      continue;
    }
    if (arg === '--plain') {
      options.plain = true;
      continue;
    }
    if (arg === '--json') {
      options.json = true;
      continue;
    }
    if (arg === '--precision') {
      i += 1;
      if (i >= args.length) failUsage('--precision requires a value');
      options.precision = parsePrecision(args[i]);
      continue;
    }
    if (arg.startsWith('--precision=')) {
      options.precision = parsePrecision(arg.slice('--precision='.length));
      continue;
    }
    if (arg.startsWith('-') && arg !== '-' && !/^-?(?:\d|\.\d)/.test(arg)) {
      failUsage(`unknown option "${arg}"`);
    }

    options.expressionParts.push(arg);
  }

  return options;
}

function parsePrecision(value) {
  if (!/^\d+$/.test(value)) failUsage('precision must be an integer between 1 and 15');
  const precision = Number(value);
  if (!Number.isInteger(precision) || precision < 1 || precision > 15) {
    failUsage('precision must be an integer between 1 and 15');
  }
  return precision;
}

function failUsage(message) {
  console.error(`Error: ${message}`);
  console.error('Try "calccu --help" for usage.');
  process.exit(2);
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
  if (command === 'clear history') return 'clear terminal';
  if (command === 'history') return 'show command history';
  if (command === 'quit' || command === 'exit') return 'quit';
  try {
    return calc.preview(trimmed);
  } catch (error) {
    if (isLikelyIncomplete(error)) return '';
    return error.message;
  }
}

function render() {
  const columns = stdout.columns || 80;
  let row = 1;
  clearScreen();
  const scrolled = scrollOffset > 0 ? `, PageDown newer, ${scrollOffset} back` : '';
  stdout.write(`calccu  (? for help, Ctrl+C to quit${scrolled})\n\n`);
  row += 2;

  for (const entry of visibleHistory()) {
    const inputLines = wrapLines(['> ' + entry.input], columns);
    for (const line of inputLines) stdout.write(line + '\n');
    row += inputLines.length;

    const formatted = wrapLines(formatOutput(entry.output), columns);
    for (const line of formatted) stdout.write(line + '\n');
    row += formatted.length;

    stdout.write('\n');
    row += 1;
  }

  const prompt = promptView(input, cursor, columns);
  const promptRow = row;
  stdout.write(prompt.line + '\n');
  row += 1;

  const preview = previewFor(input);
  const maxPreviewRows = Math.max(0, Math.min(3, (stdout.rows || 30) - row + 1));
  for (const line of previewLines(preview, columns, maxPreviewRows)) {
    stdout.write(line + '\n');
  }

  stdout.write(`\x1b[${promptRow};${prompt.column}H`);
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
  if (command === 'clear' || command === 'cls' || command === 'clear history') {
    history = [];
    scrollOffset = 0;
    render();
    return;
  }
  if (command === 'help' || command === '?') {
    rememberResult(text, helpText());
    render();
    return;
  }
  if (command === 'history') {
    rememberResult(text, formatCommandHistory());
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
  scrollOffset = 0;
}

function visibleHistory() {
  return visibleHistoryEntries(history, {
    rows: stdout.rows || 30,
    columns: stdout.columns || 80,
    scrollOffset
  });
}

function scrollOlder() {
  if (history.length === 0) return;
  scrollOffset = Math.min(history.length - 1, scrollOffset + Math.max(1, visibleHistory().length));
}

function scrollNewer() {
  scrollOffset = Math.max(0, scrollOffset - Math.max(1, visibleHistory().length));
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
    fs.mkdirSync(path.dirname(historyPath), { recursive: true });
    fs.writeFileSync(historyPath, commandHistory.join('\n') + (commandHistory.length ? '\n' : ''), 'utf8');
  } catch {
    // History is a convenience feature; calculator use should not fail if the file cannot be written.
  }
}

function formatCommandHistory() {
  const start = Math.max(0, commandHistory.length - 20);
  const rows = commandHistory.slice(start).map((command, index) => {
    return `${String(start + index + 1).padStart(4, ' ')}  ${command}`;
  });
  return rows.length ? rows.join('\n') : 'no command history';
}

function isLikelyIncomplete(error) {
  return /^(invalid expression|expected "\)"|expected "eof")$/.test(error.message);
}

function shutdown() {
  if (!running) return;
  running = false;
  if (interactiveStarted) stdout.write('\n');
  restoreTerminal();
  stdin.pause();
}

function restoreTerminal() {
  if (rawModeEnabled && stdin.isTTY && typeof stdin.setRawMode === 'function') {
    stdin.setRawMode(false);
    rawModeEnabled = false;
  }
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
    scrollOffset = 0;
    render();
    return;
  }
  if (key === '\u001b[5~') {
    scrollOlder();
    render();
    return;
  }
  if (key === '\u001b[6~') {
    scrollNewer();
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

function evaluateExpression(expression) {
  try {
    return { input: expression, ok: true, result: calc.execute(expression) };
  } catch (error) {
    return { input: expression, ok: false, error: error.message };
  }
}

function printEvaluation(evaluation) {
  if (cli.json) {
    console.log(JSON.stringify(formatJsonEvaluation(evaluation)));
    return;
  }

  if (evaluation.ok) {
    console.log(cli.plain ? formatPlainResult(evaluation.result) : formatDisplayResult(evaluation.result));
  } else {
    console.error(cli.plain ? evaluation.error : 'Error: ' + evaluation.error);
  }
}

function formatJsonEvaluation(evaluation) {
  if (!evaluation.ok) {
    return {
      ok: false,
      input: evaluation.input,
      error: evaluation.error
    };
  }

  return {
    ok: true,
    input: evaluation.input,
    result: evaluation.result,
    value: formatPlainResult(evaluation.result)
  };
}

function formatPlainResult(result) {
  return formatDisplayResult(result);
}

function evaluateAndPrint(expressions) {
  let ok = true;
  for (const expression of expressions) {
    const evaluation = evaluateExpression(expression);
    printEvaluation(evaluation);
    if (!evaluation.ok) ok = false;
  }
  return ok;
}

function runStdinMode() {
  const chunks = [];
  stdin.setEncoding('utf8');
  stdin.on('data', (chunk) => chunks.push(chunk));
  stdin.on('end', () => {
    const expressions = chunks.join('').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    process.exitCode = evaluateAndPrint(expressions) ? 0 : 1;
  });
}

function runInteractiveMode() {
  interactiveStarted = true;
  loadCommandHistory();
  if (typeof stdin.setRawMode === 'function') {
    stdin.setRawMode(true);
    rawModeEnabled = true;
  }
  stdin.resume();
  stdin.on('data', handleData);
  stdin.on('error', shutdown);
  stdout.on('error', shutdown);
  stdout.on('resize', render);
  render();
}

process.on('exit', restoreTerminal);
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('uncaughtException', (error) => {
  restoreTerminal();
  console.error('Error: ' + error.message);
  process.exit(1);
});

if (cli.help) {
  console.log(helpText());
  process.exit(0);
}

if (cli.version) {
  console.log(pkg.version);
  process.exit(0);
}

if (cli.expressionParts.length > 0) {
  const expression = cli.expressionParts.join(' ');
  process.exit(evaluateAndPrint([expression]) ? 0 : 1);
}

if (!stdin.isTTY) {
  runStdinMode();
} else {
  runInteractiveMode();
}
