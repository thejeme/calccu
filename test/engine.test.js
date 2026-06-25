'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { Calculator } = require('../src/engine');

test('evaluates arithmetic and implicit multiplication', () => {
  const calc = new Calculator();
  calc.execute('x = 4');
  assert.equal(calc.execute('2x + 3'), 'ans = 11');
});

test('evaluates common calculator expressions', () => {
  const calc = new Calculator();
  const cases = [
    ['2 + 2', 'ans = 4'],
    ['2 + 3 * 4', 'ans = 14'],
    ['2(3 + 4)', 'ans = 14'],
    ['-(2 + 3)', 'ans = -5'],
    ['+5', 'ans = 5'],
    ['2^3^2', 'ans = 512'],
    ['2^-2', 'ans = 0.25'],
    ['sin(pi / 2)', 'ans = 1'],
    ['cos(0)', 'ans = 1'],
    ['ln(e)', 'ans = 1'],
    ['log(1000)', 'ans = 3'],
    ['log2(1024)', 'ans = 10'],
    ['max(1, 5, 3)', 'ans = 5'],
    ['min(1, -5, 3)', 'ans = -5'],
    ['ceil(1.2) + floor(1.8)', 'ans = 3'],
    ['sqrt(9) + abs(-2)', 'ans = 5'],
    ['cbrt(27)', 'ans = 3'],
    ['hypot(3, 4)', 'ans = 5'],
    ['round(1.5)', 'ans = 2'],
    ['sign(-42)', 'ans = -1'],
    ['trunc(1.9)', 'ans = 1'],
    ['0.1 + 0.2', 'ans = 0.3']
  ];

  for (const [input, expected] of cases) {
    assert.equal(calc.execute(input), expected, input);
  }
});

test('keeps basic decimal and large integer arithmetic exact', () => {
  const calc = new Calculator({ precision: 15 });
  const cases = [
    ['0.1 + 0.2', 'ans = 0.3'],
    ['0.3 - 0.2', 'ans = 0.1'],
    ['8.15 * 100', 'ans = 815'],
    ['1.23 + 4.567', 'ans = 5.797'],
    ['5.5 / 2', 'ans = 2.75'],
    ['1 / 8', 'ans = 0.125'],
    ['(0.2 + 0.3) * 10', 'ans = 5'],
    ['2^10', 'ans = 1024'],
    ['2^-3', 'ans = 0.125'],
    ['1.5^2', 'ans = 2.25'],
    ['9007199254740992 + 1', 'ans = 9007199254740993'],
    ['9999999999999999 + 1', 'ans = 10000000000000000']
  ];

  for (const [input, expected] of cases) {
    assert.equal(calc.execute(input), expected, input);
  }
});

test('evaluates exact integer math functions', () => {
  const calc = new Calculator();
  const cases = [
    ['gcd(12, 18)', 'ans = 6'],
    ['gcd(-12, 18, 30)', 'ans = 6'],
    ['gcd(0, 0)', 'ans = 0'],
    ['lcm(4, 6)', 'ans = 12'],
    ['lcm(-4, 6, 10)', 'ans = 60'],
    ['lcm(0, 9)', 'ans = 0'],
    ['fact(0)', 'ans = 1'],
    ['fact(5)', 'ans = 120'],
    ['factorial(6)', 'ans = 720'],
    ['gcd(9007199254740992, 9007199254740994)', 'ans = 2']
  ];

  for (const [input, expected] of cases) {
    assert.equal(calc.execute(input), expected, input);
  }
});

test('keeps exact arithmetic through variables and user functions', () => {
  const calc = new Calculator({ precision: 15 });
  assert.equal(calc.execute('x = 9007199254740992'), 'x = 9007199254740992');
  assert.equal(calc.execute('x + 1'), 'ans = 9007199254740993');
  assert.equal(calc.execute('f(t) = t + 0.2'), 'f(t) saved');
  assert.equal(calc.execute('f(0.1)'), 'ans = 0.3');
  assert.equal(calc.execute('ans * 10'), 'ans = 3');
});

test('stores and calls functions', () => {
  const calc = new Calculator();
  assert.equal(calc.execute('f(x) = x^2 + 1'), 'f(x) saved');
  assert.equal(calc.execute('f(3)'), 'ans = 10');
  assert.equal(calc.execute('add(a, b) = a + b'), 'add(a, b) saved');
  assert.equal(calc.execute('add(2, 5)'), 'ans = 7');
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
  calc.execute('a = 2');
  assert.equal(calc.execute('a*x = 8'), 'x = 4');
});

test('solves quadratic equations up to degree two', () => {
  const calc = new Calculator();
  assert.equal(calc.execute('x^2 - 4 = 0'), 'x = -2 or x = 2');
  assert.equal(calc.execute('x^2 + 2x + 1 = 0'), 'x = -1');
  assert.equal(calc.execute('x^2 - 2 = 0'), 'x ~= -1.41421356237 or x ~= 1.41421356237');
});

test('reports equation edge cases', () => {
  const calc = new Calculator();
  assert.equal(calc.execute('x + 0 = x'), 'all values satisfy this equation');
  assert.throws(() => calc.execute('x + 1 = x'), /equation has no solution/);
  assert.throws(() => calc.execute('x^2 + 1 = 0'), /no real solution/);
  calc.execute('f(t) = t');
  assert.throws(() => calc.execute('f(x) + 0 = 1'), /functions containing the unknown cannot be solved yet/);
  assert.throws(() => calc.execute('x / x = 1'), /cannot divide by an expression containing the unknown/);
  assert.throws(() => calc.execute('2^x = 8'), /variable exponents are not supported/);
  assert.throws(() => calc.execute('x^-1 = 1'), /equation powers must be non-negative integers/);
});

test('deletes variables and functions', () => {
  const calc = new Calculator();
  calc.execute('x = 2');
  calc.execute('f(t) = t + 1');
  assert.equal(calc.execute('del x'), 'x deleted');
  assert.equal(calc.execute('delete f'), 'f deleted');
  calc.execute('double(t) = t * 2');
  assert.equal(calc.execute('del func double'), 'double deleted');
  assert.equal(calc.execute('delete missing'), 'missing was not defined');
  assert.throws(() => calc.execute('delete ans'), /ans cannot be deleted/);
});

test('previews function definitions without evaluating the body', () => {
  const calc = new Calculator();
  assert.equal(calc.preview('square(x) = x + later'), 'save square(x)');
  assert.equal(calc.preview('2 + 2'), '4');
  assert.equal(calc.preview('5km to m'), '5000 m');
  assert.equal(calc.preview('2x = 3'), 'x = 3/2');
  assert.equal(calc.preview('x = 2'), 'x = 2');
  assert.equal(calc.preview('vars'), 'Name  Value\nans   0');
  assert.equal(calc.preview('copy'), 'ans = 0');
  assert.equal(calc.preview('history'), 'history is available in interactive mode');
});

test('previews reserved assignment errors before commit', () => {
  const calc = new Calculator();
  assert.throws(() => calc.preview('m ='), /"m" is a unit name/);
  assert.throws(() => calc.preview('m = 2'), /"m" is a unit name/);
  assert.throws(() => calc.preview('ans = 2'), /ans is managed automatically/);
  assert.throws(() => calc.preview('sin(x) = x'), /cannot replace built-in function "sin"/);
  assert.throws(() => calc.preview('kg(x) = x'), /"kg" is a unit name/);
});

test('copies the current answer as displayable output', () => {
  const calc = new Calculator();
  assert.equal(calc.execute('copy'), 'ans = 0');
  calc.execute('2 + 2');
  assert.equal(calc.execute('copy'), 'ans = 4');
  assert.equal(calc.execute('copy ans'), 'ans = 4');
  calc.execute('x = 10');
  assert.equal(calc.execute('copy'), 'ans = 10');
});

test('sets displayed precision', () => {
  const calc = new Calculator();
  assert.equal(calc.execute('precision 4'), 'precision = 4');
  assert.equal(calc.execute('1/3'), 'ans = 0.3333');
  assert.equal(calc.preview('precision'), 'precision = 4');
  assert.equal(calc.execute('prec'), 'precision = 4');
  assert.throws(() => calc.execute('precision 0'), /precision must be between 1 and 15/);
  assert.throws(() => calc.execute('precision 16'), /precision must be between 1 and 15/);
});

test('formats variables and functions as tables', () => {
  const calc = new Calculator();
  calc.execute('x = 2');
  calc.execute('f(t) = t + 1');
  assert.equal(calc.execute('vars'), 'Name  Value\nans   2\nx     2');
  assert.equal(calc.execute('ls vars'), 'Name  Value\nans   2\nx     2');
  assert.equal(calc.execute('funcs'), 'Name  Parameters\nf     t');
  assert.equal(calc.execute('list functions'), 'Name  Parameters\nf     t');
  assert.equal(calc.execute('ls units').includes('length: mm, cm, m, km'), true);
  assert.equal(calc.execute('list units').includes('data: bit, b, B'), true);
});

test('evaluates and converts simple units', () => {
  const calc = new Calculator();
  assert.equal(calc.execute('2m + 30cm'), 'ans = 2.3 m');
  assert.equal(calc.execute('5km to m'), 'ans = 5000 m');
  assert.equal(calc.execute('5km -> m'), 'ans = 5000 m');
  assert.equal(calc.execute('5km->m'), 'ans = 5000 m');
  assert.equal(calc.execute('(2m + 30cm) -> cm'), 'ans = 230 cm');
  assert.equal(calc.execute('2 hours -> minutes'), 'ans = 120 min');
  assert.equal(calc.execute('10s / 2'), 'ans = 5 s');
  assert.equal(calc.execute('10m / (2m)'), 'ans = 5');
  assert.equal(calc.execute('2m * 3m'), 'ans = 6 m*m');
  assert.equal(calc.execute('10m / (2s)'), 'ans = 5 m/s');
  assert.equal(calc.execute('2m^2'), 'ans = 2 m^2');
  assert.equal(calc.execute('(2m)^2'), 'ans = 4 m^2');
  assert.throws(() => calc.execute('2m + 3s'), /incompatible units/);
  assert.equal(calc.execute('units').includes('length: mm, cm, m, km'), true);
});

test('converts requested unit categories', () => {
  const calc = new Calculator();
  assert.equal(calc.execute('32F to C'), 'ans = 0 C');
  assert.equal(calc.execute('1km to m'), 'ans = 1000 m');
  assert.equal(calc.execute('1lb to kg'), 'ans = 0.45359237 kg');
  assert.equal(calc.execute('1acre to m2'), 'ans = 4046.8564224 m2');
  assert.equal(calc.execute('1gal to L'), 'ans = 3.785411784 L');
  assert.equal(calc.execute('1kWh to J'), 'ans = 3600000 J');
  assert.equal(calc.execute('60mph to kmh'), 'ans = 96.56064 kmh');
  assert.equal(calc.execute('2h to min'), 'ans = 120 min');
  assert.equal(calc.execute('1MiB to B'), 'ans = 1048576 B');
});

test('accepts common unit aliases and plural names', () => {
  const calc = new Calculator();
  const cases = [
    ['1 meter to cm', 'ans = 100 cm'],
    ['2 meters to cm', 'ans = 200 cm'],
    ['1 kilometre to meter', 'ans = 1000 m'],
    ['12 inches to ft', 'ans = 1 ft'],
    ['3 feet to yd', 'ans = 1 yd'],
    ['1 pound to kg', 'ans = 0.45359237 kg'],
    ['2 hours to minutes', 'ans = 120 min'],
    ['60 seconds to min', 'ans = 1 min'],
    ['1 byte to bits', 'ans = 8 bit'],
    ['1 megabyte to kilobytes', 'ans = 1000 KB']
  ];

  for (const [input, expected] of cases) {
    assert.equal(calc.execute(input), expected, input);
  }
});

test('suggests likely unit names for unknown units', () => {
  const calc = new Calculator();
  assert.throws(() => calc.execute('1 meterx to m'), /unknown variable "meterx"; did you mean unit "meter"\?/);
  assert.throws(() => calc.execute('1m to meterx'), /unknown unit "meterx"; did you mean "meter"\?/);
});

test('rejects temperature arithmetic', () => {
  const calc = new Calculator();
  assert.throws(() => calc.execute('20C + 10C'), /temperature arithmetic/);
  assert.throws(() => calc.execute('20C * 2'), /temperature scaling/);
  assert.throws(() => calc.execute('20C / 2'), /temperature scaling/);
  assert.throws(() => calc.execute('20C * (2m)'), /temperature multiplication and division/);
});

test('reports useful errors for malformed input', () => {
  const calc = new Calculator();
  const cases = [
    ['2 +', /invalid expression|expected/],
    ['1..2', /invalid number/],
    ['2 @ 3', /unexpected character "@"|expected "eof"/],
    ['5km ->', /both sides of "->" are required/],
    ['-> m', /both sides of "->" are required/],
    ['5km -> m/s', /invalid unit "m\/s"/],
    ['2m + 3s', /incompatible units/],
    ['unknown + 1', /unknown variable "unknown"/],
    ['missing(1)', /unknown function "missing"/],
    ['sqrt(1m)', /expected a number, got a unit value/],
    ['gcd(1.5, 3)', /gcd expects integer arguments/],
    ['gcd(1m, 3)', /expected a number, got a unit value/],
    ['gcd()', /gcd expects at least 1 argument/],
    ['lcm(1 / 2, 3)', /lcm expects integer arguments/],
    ['fact(-1)', /factorial expects a non-negative integer/],
    ['fact(1, 2)', /fact expects 1 argument/],
    ['fact(1001)', /fact input is too large/],
    ['f() = 1', /functions need at least one parameter/],
    ['f(x, x) = x', /function parameters must be unique/],
    ['f(1x) = x', /invalid parameter/],
    ['sin(x) = x', /cannot replace built-in function/],
    ['m = 2', /"m" is a unit name/],
    ['ans = 2', /ans is managed automatically/],
    ['f(x) = x', null],
    ['f(1, 2)', /f expects 1 argument/],
    ['1 / 0', /division by zero/],
    ['x + y = 1', /exactly one unknown variable/],
    ['x^3 = 1', /powers up to x\^2/],
    ['20C + 10C', /temperature arithmetic/],
    ['= 1', /both sides of "=" are required/],
    ['x =', /both sides of "=" are required/],
    ['.', /invalid number/],
    ['2(', /invalid expression/]
  ];

  for (const [input, expected] of cases) {
    if (expected === null) {
      calc.execute(input);
    } else {
      assert.throws(() => calc.execute(input), expected, input);
    }
  }
});
