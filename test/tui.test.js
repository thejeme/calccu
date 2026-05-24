'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { applyEditKey, formatOutput, readEscapeSequence } = require('../src/tui');

test('formats single-line answers and multi-line blocks differently', () => {
  assert.deepEqual(formatOutput('ans = 4'), ['< ans = 4']);
  assert.deepEqual(formatOutput('Title\n\nBody'), ['<', '  Title', '', '  Body']);
});

test('reads complete escape sequences from batched input', () => {
  assert.deepEqual(readEscapeSequence('\u001b[Arest', 0), { value: '\u001b[A', end: 2 });
  assert.deepEqual(readEscapeSequence('\u001b[3~x', 0), { value: '\u001b[3~', end: 3 });
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
