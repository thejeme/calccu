'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const {
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
} = require('../src/terminal');

test('formats single-line answers and multi-line blocks differently', () => {
  assert.equal(formatDisplayResult('ans = 4'), '4');
  assert.equal(formatDisplayResult('x = 4'), 'x = 4');
  assert.deepEqual(formatOutput('ans = 4'), ['< 4']);
  assert.deepEqual(formatOutput(''), ['< ']);
  assert.deepEqual(formatOutput('Title\n\nBody'), ['<', '  Title', '', '  Body']);
});

test('help text does not reserve h or q as commands', () => {
  const text = helpText();
  assert.doesNotMatch(text, /\bhelp, \?, h\b/);
  assert.doesNotMatch(text, /\bquit, exit, q\b/);
  assert.match(text, /\bhelp, \?/);
  assert.match(text, /\bquit, exit\b/);
});

test('chooses XDG history path without legacy fallback', () => {
  assert.equal(
    historyPath({ CALCCU_HISTORY: '/tmp/custom-history' }, '/home/tester'),
    '/tmp/custom-history'
  );
  assert.equal(
    historyPath({ XDG_STATE_HOME: '/tmp/state' }, '/home/tester'),
    path.join('/tmp/state', 'calccu', 'history')
  );
  assert.equal(
    historyPath({}, '/home/tester'),
    path.join('/home/tester', '.local', 'state', 'calccu', 'history')
  );
});

test('wraps terminal lines and counts visual rows', () => {
  assert.deepEqual(wrapLines(['abcdef'], 3), ['abc', 'def']);
  assert.deepEqual(wrapLines(['', 'abcd'], 3), ['', 'abc', 'd']);
  assert.deepEqual(wrapLines(['abc'], 0), ['abc']);
  assert.equal(visualLineCount('abcdef', 3), 2);
  assert.equal(visualLineCount('abc\ndefgh', 3), 3);
  assert.equal(visualLineCount('', 3), 1);
  assert.equal(entryLineCount({ input: 'abcdef', output: 'ans = 123456' }, 5), 5);
});

test('caps live preview rows', () => {
  assert.deepEqual(previewLines('ans = 123456', 5, 3), ['< 123', '456']);
  assert.deepEqual(previewLines('a\nb\nc\nd', 80, 3), ['<', '  a', '...']);
  assert.deepEqual(previewLines('', 80, 3), []);
  assert.deepEqual(previewLines('ans = 1', 80, 0), []);
});

test('selects visible history by wrapped terminal height', () => {
  const entries = [
    { input: 'first', output: 'ans = 1' },
    { input: 'second-with-long-input', output: 'ans = 2' },
    { input: 'third', output: 'ans = 3' }
  ];

  assert.deepEqual(
    visibleHistoryEntries(entries, { rows: 15, columns: 80, scrollOffset: 0 }),
    entries
  );
  assert.deepEqual(
    visibleHistoryEntries(entries, { rows: 8, columns: 10, scrollOffset: 0 }),
    [entries[2]]
  );
  assert.deepEqual(
    visibleHistoryEntries(entries, { rows: 8, columns: 10, scrollOffset: 1 }),
    [entries[1]]
  );
  assert.deepEqual(visibleHistoryEntries([], { rows: 8, columns: 10 }), []);
});

test('clips active prompt to one line with stable cursor column', () => {
  assert.deepEqual(promptView('abcdef', 0, 6), { line: '> abc', column: 3 });
  assert.deepEqual(promptView('abcdef', 3, 6), { line: '> abc', column: 6 });
  assert.deepEqual(promptView('abcdef', 6, 6), { line: '> def', column: 6 });
  assert.deepEqual(promptView('abcdef', 6, 4), { line: '> f', column: 4 });
});

test('reads complete escape sequences from batched input', () => {
  assert.deepEqual(readEscapeSequence('\u001b[Arest', 0), { value: '\u001b[A', end: 2 });
  assert.deepEqual(readEscapeSequence('\u001b[3~x', 0), { value: '\u001b[3~', end: 3 });
  assert.deepEqual(readEscapeSequence('\u001b[12;5Rtail', 0), { value: '\u001b[12;5R', end: 6 });
  assert.deepEqual(readEscapeSequence('\u001b[', 0), { value: '\u001b', end: 0 });
  assert.deepEqual(readEscapeSequence('\u001bx', 0), { value: '\u001b', end: 0 });
});

test('applies editing keys', () => {
  let state = { input: 'abc def', cursor: 7 };

  state = applyEditKey(state, '\u0001').state;
  assert.deepEqual(state, { input: 'abc def', cursor: 0 });

  state = applyEditKey(state, '\u0005').state;
  assert.deepEqual(state, { input: 'abc def', cursor: 7 });

  state = applyEditKey(state, '\u0017').state;
  assert.deepEqual(state, { input: 'abc ', cursor: 4 });

  state = applyEditKey(state, 'Z').state;
  assert.deepEqual(state, { input: 'abc Z', cursor: 5 });

  state = applyEditKey(state, '\u0015').state;
  assert.deepEqual(state, { input: '', cursor: 0 });
});

test('handles editing boundary and delete keys', () => {
  let edit = applyEditKey({ input: 'abc', cursor: 0 }, '\u007f');
  assert.deepEqual(edit, { handled: true, changed: false, state: { input: 'abc', cursor: 0 } });

  edit = applyEditKey({ input: 'abc', cursor: 1 }, '\u001b[3~');
  assert.deepEqual(edit, { handled: true, changed: true, state: { input: 'ac', cursor: 1 } });

  edit = applyEditKey({ input: 'abc', cursor: 3 }, '\u001b[3~');
  assert.deepEqual(edit, { handled: true, changed: false, state: { input: 'abc', cursor: 3 } });

  edit = applyEditKey({ input: 'abc', cursor: 1 }, '\u001b[D');
  assert.deepEqual(edit, { handled: true, changed: false, state: { input: 'abc', cursor: 0 } });

  edit = applyEditKey({ input: 'abc', cursor: 3 }, '\u001b[C');
  assert.deepEqual(edit, { handled: true, changed: false, state: { input: 'abc', cursor: 3 } });

  edit = applyEditKey({ input: 'ac', cursor: 1 }, 'b');
  assert.deepEqual(edit, { handled: true, changed: true, state: { input: 'abc', cursor: 2 } });

  edit = applyEditKey({ input: 'abc', cursor: 1 }, '\u0002');
  assert.deepEqual(edit, { handled: false, changed: false, state: { input: 'abc', cursor: 1 } });
});
