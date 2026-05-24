'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { Calculator } = require('../src/engine');

test('evaluates arithmetic and implicit multiplication', () => {
  const calc = new Calculator();
  calc.execute('x = 4');
  assert.equal(calc.execute('2x + 3'), 'ans = 11');
});

test('stores and calls functions', () => {
  const calc = new Calculator();
  assert.equal(calc.execute('f(x) = x^2 + 1'), 'f(x) saved');
  assert.equal(calc.execute('f(3)'), 'ans = 10');
});

test('maintains ans', () => {
  const calc = new Calculator();
  calc.execute('10 + 5');
  assert.equal(calc.execute('ans * 2'), 'ans = 30');
});

test('solves linear equations exactly', () => {
  const calc = new Calculator();
  assert.equal(calc.execute('2x = 3'), 'x = 3/2');
  assert.equal(calc.execute('3(x - 1) = 9'), 'x = 4');
  assert.equal(calc.execute('-0.5x = 1'), 'x = -2');
});

test('deletes variables and functions', () => {
  const calc = new Calculator();
  calc.execute('x = 2');
  calc.execute('f(t) = t + 1');
  assert.equal(calc.execute('del x'), 'x deleted');
  assert.equal(calc.execute('delete f'), 'f deleted');
});

test('previews function definitions without evaluating the body', () => {
  const calc = new Calculator();
  assert.equal(calc.preview('g(x) = x + later'), 'save g(x)');
});
