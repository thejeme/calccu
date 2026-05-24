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
  assert.equal(calc.execute('x/2 = 3'), 'x = 6');
  assert.equal(calc.execute('1/3x = 2'), 'x = 6');
});

test('solves quadratic equations up to degree two', () => {
  const calc = new Calculator();
  assert.equal(calc.execute('x^2 - 4 = 0'), 'x = -2 or x = 2');
  assert.equal(calc.execute('x^2 - 2 = 0'), 'x ~= -1.41421356237 or x ~= 1.41421356237');
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

test('sets displayed precision', () => {
  const calc = new Calculator();
  assert.equal(calc.execute('precision 4'), 'precision = 4');
  assert.equal(calc.execute('1/3'), 'ans = 0.3333');
  assert.equal(calc.preview('precision'), 'precision = 4');
});

test('formats variables and functions as tables', () => {
  const calc = new Calculator();
  calc.execute('x = 2');
  calc.execute('f(t) = t + 1');
  assert.equal(calc.execute('vars'), 'Name  Value\nans   2\nx     2');
  assert.equal(calc.execute('ls vars'), 'Name  Value\nans   2\nx     2');
  assert.equal(calc.execute('funcs'), 'Name  Parameters\nf     t');
  assert.equal(calc.execute('list functions'), 'Name  Parameters\nf     t');
});

test('evaluates and converts simple units', () => {
  const calc = new Calculator();
  assert.equal(calc.execute('2m + 30cm'), 'ans = 2.3 m');
  assert.equal(calc.execute('5km to m'), 'ans = 5000 m');
  assert.equal(calc.execute('10s / 2'), 'ans = 5 s');
  assert.equal(calc.execute('10m / (2m)'), 'ans = 5');
  assert.throws(() => calc.execute('2m + 3s'), /incompatible units/);
  assert.equal(calc.execute('units').includes('length: mm, cm, m, km'), true);
});
