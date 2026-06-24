'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const bin = path.join(__dirname, '..', 'bin', 'calccu.js');

function run(args, options = {}) {
  return spawnSync(process.execPath, [bin, ...args], {
    encoding: 'utf8',
    input: options.input
  });
}

test('prints default, plain, precision, and json CLI output', () => {
  let result = run(['2 + 2']);
  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), '4');
  assert.equal(result.stderr, '');

  result = run(['--plain', '2 + 2']);
  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), '4');

  result = run(['--precision', '6', '1 / 3']);
  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), '0.333333');

  result = run(['--precision=4', '--plain', '1 / 3']);
  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), '0.3333');

  result = run(['--json', '5km to m']);
  assert.equal(result.status, 0);
  assert.deepEqual(JSON.parse(result.stdout), {
    ok: true,
    input: '5km to m',
    result: 'ans = 5000 m',
    value: '5000 m'
  });

  result = run(['5km -> m']);
  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), '5000 m');

  result = run(['h']);
  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), '1 h');

  result = run(['copy']);
  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), '0');

  result = run(['--plain', '9007199254740992 + 1']);
  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), '9007199254740993');

  result = run(['--json', '1 / 0']);
  assert.equal(result.status, 1);
  assert.deepEqual(JSON.parse(result.stdout), {
    ok: false,
    input: '1 / 0',
    error: 'division by zero'
  });
  assert.equal(result.stderr, '');
});

test('evaluates stdin batches with output modes', () => {
  let result = run(['--plain'], { input: '2 + 2\n32F to C\n' });
  assert.equal(result.status, 0);
  assert.deepEqual(result.stdout.trim().split(/\r?\n/), ['4', '0 C']);

  result = run([], { input: '\n2 + 2\n\nx = 5\n' });
  assert.equal(result.status, 0);
  assert.deepEqual(result.stdout.trim().split(/\r?\n/), ['4', 'x = 5']);

  result = run([], { input: '2 + 2\ncopy\ncopy ans\n' });
  assert.equal(result.status, 0);
  assert.deepEqual(result.stdout.trim().split(/\r?\n/), ['4', '4', '4']);

  result = run(['--json'], { input: '2 + 2\n1 / 0\n' });
  assert.equal(result.status, 1);
  const rows = result.stdout.trim().split(/\r?\n/).map((line) => JSON.parse(line));
  assert.deepEqual(rows, [
    { ok: true, input: '2 + 2', result: 'ans = 4', value: '4' },
    { ok: false, input: '1 / 0', error: 'division by zero' }
  ]);
});

test('handles CLI errors and negative expressions', () => {
  let result = run(['--definitely-not-real']);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /unknown option/);

  result = run(['--precision']);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /--precision requires a value/);

  result = run(['--precision', 'abc']);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /precision must be an integer between 1 and 15/);

  result = run(['--precision', '20', '1 / 3']);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /precision must be an integer between 1 and 15/);

  result = run(['-1 + 2']);
  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), '1');

  result = run(['--', '-1 + 2']);
  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), '1');

  result = run(['--', '--not-an-option']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /unknown variable "not"/);

  result = run(['q']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /unknown variable "q"/);
});

test('prints help and version', () => {
  let result = run(['--help']);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /calccu help/);
  assert.match(result.stdout, /--json/);

  result = run(['-h']);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /calccu help/);

  result = run(['--version']);
  assert.equal(result.status, 0);
  assert.match(result.stdout.trim(), /^\d+\.\d+\.\d+$/);

  result = run(['-v']);
  assert.equal(result.status, 0);
  assert.match(result.stdout.trim(), /^\d+\.\d+\.\d+$/);
});
