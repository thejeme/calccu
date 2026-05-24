'use strict';

const BUILTINS = new Map([
  ['abs', Math.abs],
  ['acos', Math.acos],
  ['asin', Math.asin],
  ['atan', Math.atan],
  ['ceil', Math.ceil],
  ['cos', Math.cos],
  ['exp', Math.exp],
  ['floor', Math.floor],
  ['ln', Math.log],
  ['log', Math.log10],
  ['max', Math.max],
  ['min', Math.min],
  ['round', Math.round],
  ['sin', Math.sin],
  ['sqrt', Math.sqrt],
  ['tan', Math.tan]
]);

const CONSTANTS = new Map([
  ['e', Math.E],
  ['pi', Math.PI]
]);

const UNITS = new Map([
  ['mm', { factor: 0.001, dimension: 'length' }],
  ['cm', { factor: 0.01, dimension: 'length' }],
  ['m', { factor: 1, dimension: 'length' }],
  ['km', { factor: 1000, dimension: 'length' }],
  ['in', { factor: 0.0254, dimension: 'length' }],
  ['ft', { factor: 0.3048, dimension: 'length' }],
  ['yd', { factor: 0.9144, dimension: 'length' }],
  ['mi', { factor: 1609.344, dimension: 'length' }],
  ['mg', { factor: 0.000001, dimension: 'mass' }],
  ['g', { factor: 0.001, dimension: 'mass' }],
  ['kg', { factor: 1, dimension: 'mass' }],
  ['oz', { factor: 0.028349523125, dimension: 'mass' }],
  ['lb', { factor: 0.45359237, dimension: 'mass' }],
  ['ms', { factor: 0.001, dimension: 'time' }],
  ['s', { factor: 1, dimension: 'time' }],
  ['min', { factor: 60, dimension: 'time' }],
  ['h', { factor: 3600, dimension: 'time' }],
  ['day', { factor: 86400, dimension: 'time' }]
]);

class CalcError extends Error {}

class Quantity {
  constructor(value, dimensions, unit = '') {
    this.value = value;
    this.dimensions = normalizeDimensions(dimensions);
    this.unit = isDimensionless(this.dimensions) ? '' : unit;
  }

  add(other) {
    other = asQuantity(other);
    this.assertSameDimensions(other);
    return new Quantity(this.value + other.value, this.dimensions, this.unit || other.unit);
  }

  sub(other) {
    other = asQuantity(other);
    this.assertSameDimensions(other);
    return new Quantity(this.value - other.value, this.dimensions, this.unit || other.unit);
  }

  mul(other) {
    if (other instanceof Quantity) {
      return new Quantity(this.value * other.value, combineDimensions(this.dimensions, other.dimensions, 1), combineUnitNames(this.unit, other.unit, '*'));
    }
    return new Quantity(this.value * other, this.dimensions, this.unit);
  }

  div(other) {
    if (other instanceof Quantity) {
      if (other.value === 0) throw new CalcError('division by zero');
      return new Quantity(this.value / other.value, combineDimensions(this.dimensions, other.dimensions, -1), combineUnitNames(this.unit, other.unit, '/'));
    }
    if (other === 0) throw new CalcError('division by zero');
    return new Quantity(this.value / other, this.dimensions, this.unit);
  }

  pow(other) {
    if (other instanceof Quantity) throw new CalcError('unit exponents are not supported');
    if (!Number.isInteger(other)) throw new CalcError('unit powers must be integers');
    const dimensions = {};
    for (const [name, power] of Object.entries(this.dimensions)) dimensions[name] = power * other;
    return new Quantity(this.value ** other, dimensions, other === 1 ? this.unit : `${this.unit}^${other}`);
  }

  neg() {
    return new Quantity(-this.value, this.dimensions, this.unit);
  }

  convertTo(unitName) {
    const unit = UNITS.get(unitName);
    if (!unit) throw new CalcError(`unknown unit "${unitName}"`);
    const target = unitQuantity(unitName);
    this.assertSameDimensions(target);
    return new Quantity(this.value, this.dimensions, unitName);
  }

  assertSameDimensions(other) {
    if (!sameDimensions(this.dimensions, other.dimensions)) {
      throw new CalcError('incompatible units');
    }
  }

  toNumber() {
    if (!isDimensionless(this.dimensions)) throw new CalcError('expected a number, got a unit value');
    return this.value;
  }
}

class Rational {
  constructor(n, d = 1) {
    if (!Number.isInteger(n) || !Number.isInteger(d)) {
      throw new CalcError('exact solving only supports integer coefficients');
    }
    if (d === 0) throw new CalcError('division by zero');
    if (d < 0) {
      n = -n;
      d = -d;
    }
    const g = gcd(Math.abs(n), Math.abs(d));
    this.n = n / g;
    this.d = d / g;
  }

  add(other) {
    other = asRational(other);
    return new Rational(this.n * other.d + other.n * this.d, this.d * other.d);
  }

  sub(other) {
    other = asRational(other);
    return new Rational(this.n * other.d - other.n * this.d, this.d * other.d);
  }

  mul(other) {
    other = asRational(other);
    return new Rational(this.n * other.n, this.d * other.d);
  }

  div(other) {
    other = asRational(other);
    if (other.n === 0) throw new CalcError('division by zero');
    return new Rational(this.n * other.d, this.d * other.n);
  }

  neg() {
    return new Rational(-this.n, this.d);
  }

  isZero() {
    return this.n === 0;
  }

  toNumber() {
    return this.n / this.d;
  }

  toString() {
    return this.d === 1 ? String(this.n) : `${this.n}/${this.d}`;
  }
}

class Linear {
  constructor(coef = new Rational(0), constant = new Rational(0)) {
    this.coef = coef;
    this.constant = constant;
  }

  add(other) {
    return new Linear(this.coef.add(other.coef), this.constant.add(other.constant));
  }

  sub(other) {
    return new Linear(this.coef.sub(other.coef), this.constant.sub(other.constant));
  }

  neg() {
    return new Linear(this.coef.neg(), this.constant.neg());
  }

  mul(other) {
    if (!this.coef.isZero() && !other.coef.isZero()) {
      throw new CalcError('only linear equations are supported');
    }
    if (!this.coef.isZero()) {
      return new Linear(this.coef.mul(other.constant), this.constant.mul(other.constant));
    }
    if (!other.coef.isZero()) {
      return new Linear(other.coef.mul(this.constant), other.constant.mul(this.constant));
    }
    return new Linear(new Rational(0), this.constant.mul(other.constant));
  }

  div(other) {
    if (!other.coef.isZero()) {
      throw new CalcError('cannot divide by an expression containing the unknown');
    }
    return new Linear(this.coef.div(other.constant), this.constant.div(other.constant));
  }

  pow(other) {
    if (!other.coef.isZero()) {
      throw new CalcError('variable exponents are not supported in equations');
    }
    if (other.constant.d !== 1 || other.constant.n < 0) {
      throw new CalcError('equation powers must be non-negative integers');
    }
    if (other.constant.n === 0) return new Linear(new Rational(0), new Rational(1));
    let result = this;
    for (let i = 1; i < other.constant.n; i += 1) {
      result = result.mul(this);
    }
    return result;
  }
}

class Polynomial {
  constructor(coeffs = []) {
    this.coeffs = [
      coeffs[0] || new Rational(0),
      coeffs[1] || new Rational(0),
      coeffs[2] || new Rational(0)
    ];
  }

  add(other) {
    return new Polynomial(this.coeffs.map((coef, index) => coef.add(other.coeffs[index])));
  }

  sub(other) {
    return new Polynomial(this.coeffs.map((coef, index) => coef.sub(other.coeffs[index])));
  }

  neg() {
    return new Polynomial(this.coeffs.map((coef) => coef.neg()));
  }

  mul(other) {
    const result = [new Rational(0), new Rational(0), new Rational(0)];
    for (let i = 0; i < this.coeffs.length; i += 1) {
      for (let j = 0; j < other.coeffs.length; j += 1) {
        if (this.coeffs[i].isZero() || other.coeffs[j].isZero()) continue;
        if (i + j > 2) throw new CalcError('equation solving supports powers up to x^2');
        result[i + j] = result[i + j].add(this.coeffs[i].mul(other.coeffs[j]));
      }
    }
    return new Polynomial(result);
  }

  div(other) {
    if (!other.coeffs[1].isZero() || !other.coeffs[2].isZero()) {
      throw new CalcError('cannot divide by an expression containing the unknown');
    }
    return new Polynomial(this.coeffs.map((coef) => coef.div(other.coeffs[0])));
  }

  pow(other) {
    if (!other.coeffs[1].isZero() || !other.coeffs[2].isZero()) {
      throw new CalcError('variable exponents are not supported in equations');
    }
    const exponent = other.coeffs[0];
    if (exponent.d !== 1 || exponent.n < 0) {
      throw new CalcError('equation powers must be non-negative integers');
    }
    let result = new Polynomial([new Rational(1)]);
    for (let i = 0; i < exponent.n; i += 1) {
      result = result.mul(this);
    }
    return result;
  }

  degree() {
    if (!this.coeffs[2].isZero()) return 2;
    if (!this.coeffs[1].isZero()) return 1;
    if (!this.coeffs[0].isZero()) return 0;
    return -1;
  }
}

class Tokenizer {
  constructor(input) {
    this.input = input;
    this.index = 0;
    this.tokens = [];
  }

  tokenize() {
    while (this.index < this.input.length) {
      const char = this.input[this.index];
      if (/\s/.test(char)) {
        this.index += 1;
      } else if (/[0-9.]/.test(char)) {
        this.tokens.push(this.readNumber());
      } else if (/[A-Za-z_]/.test(char)) {
        this.tokens.push(this.readIdentifier());
      } else if ('+-*/^=(),'.includes(char)) {
        this.tokens.push({ type: char, value: char });
        this.index += 1;
      } else {
        throw new CalcError(`unexpected character "${char}"`);
      }
    }
    this.tokens.push({ type: 'eof', value: '' });
    return insertImplicitMultiplication(this.tokens);
  }

  readNumber() {
    const start = this.index;
    let dots = 0;
    while (this.index < this.input.length && /[0-9.]/.test(this.input[this.index])) {
      if (this.input[this.index] === '.') dots += 1;
      this.index += 1;
    }
    const raw = this.input.slice(start, this.index);
    if (dots > 1 || raw === '.') throw new CalcError(`invalid number "${raw}"`);
    return { type: 'number', value: Number(raw), raw };
  }

  readIdentifier() {
    const start = this.index;
    while (this.index < this.input.length && /[A-Za-z0-9_]/.test(this.input[this.index])) {
      this.index += 1;
    }
    return { type: 'identifier', value: this.input.slice(start, this.index) };
  }
}

class Parser {
  constructor(input) {
    this.tokens = new Tokenizer(input).tokenize();
    this.index = 0;
  }

  parse() {
    const expr = this.parseExpression();
    this.expect('eof');
    return expr;
  }

  parseExpression() {
    return this.parseAddSub();
  }

  parseAddSub() {
    let node = this.parseMulDiv();
    while (this.match('+') || this.match('-')) {
      const op = this.previous().type;
      const right = this.parseMulDiv();
      node = { type: 'binary', op, left: node, right };
    }
    return node;
  }

  parseMulDiv() {
    let node = this.parsePower();
    while (this.match('*') || this.match('/')) {
      const op = this.previous().type;
      const right = this.parsePower();
      node = { type: 'binary', op, left: node, right };
    }
    return node;
  }

  parsePower() {
    let node = this.parseUnary();
    if (this.match('^')) {
      node = { type: 'binary', op: '^', left: node, right: this.parsePower() };
    }
    return node;
  }

  parseUnary() {
    if (this.match('+')) return this.parseUnary();
    if (this.match('-')) return { type: 'unary', op: '-', expr: this.parseUnary() };
    return this.parsePrimary();
  }

  parsePrimary() {
    if (this.match('number')) return { type: 'number', value: this.previous().value, raw: this.previous().raw };
    if (this.match('identifier')) {
      const name = this.previous().value;
      if (this.match('(')) {
        const args = [];
        if (!this.check(')')) {
          do {
            args.push(this.parseExpression());
          } while (this.match(','));
        }
        this.expect(')');
        return { type: 'call', name, args };
      }
      return { type: 'identifier', name };
    }
    if (this.match('(')) {
      const expr = this.parseExpression();
      this.expect(')');
      return expr;
    }
    throw new CalcError('invalid expression');
  }

  match(type) {
    if (!this.check(type)) return false;
    this.index += 1;
    return true;
  }

  expect(type) {
    if (!this.match(type)) throw new CalcError(`expected "${type}"`);
    return this.previous();
  }

  check(type) {
    return this.peek().type === type;
  }

  peek() {
    return this.tokens[this.index];
  }

  previous() {
    return this.tokens[this.index - 1];
  }
}

class Calculator {
  constructor(options = {}) {
    this.variables = new Map([['ans', 0]]);
    this.functions = new Map();
    this.precision = options.precision || 12;
  }

  preview(input) {
    const parsed = this.parseStatement(input);
    switch (parsed.kind) {
      case 'expr':
        return this.formatValue(this.evaluate(parsed.expr));
      case 'convert':
        return this.formatValue(this.evaluate(parsed.expr).convertTo(parsed.unit));
      case 'equation':
        return this.solve(parsed.left, parsed.right);
      case 'assign':
        return `${parsed.name} = ${this.formatValue(this.evaluate(parsed.expr))}`;
      case 'fnAssign':
        return `save ${parsed.name}(${parsed.params.join(', ')})`;
      case 'precision':
        return parsed.value ? `precision = ${parsed.value}` : `precision = ${this.precision}`;
      case 'delete':
        return `delete ${parsed.name}`;
      case 'vars':
        return this.formatVars();
      case 'funcs':
        return this.formatFunctions();
      case 'units':
        return this.formatUnits();
      case 'history':
        return 'history is available in interactive mode';
      default:
        return '';
    }
  }

  execute(input) {
    const parsed = this.parseStatement(input);
    switch (parsed.kind) {
      case 'expr': {
        const value = this.evaluate(parsed.expr);
        this.variables.set('ans', value);
        return `ans = ${this.formatValue(value)}`;
      }
      case 'convert': {
        const value = this.evaluate(parsed.expr).convertTo(parsed.unit);
        this.variables.set('ans', value);
        return `ans = ${this.formatValue(value)}`;
      }
      case 'equation': {
        const result = this.solve(parsed.left, parsed.right);
        this.variables.set('ans', this.extractSolvedValue(result));
        return result;
      }
      case 'assign': {
        if (parsed.name === 'ans') throw new CalcError('ans is managed automatically');
        if (UNITS.has(parsed.name)) throw new CalcError(`"${parsed.name}" is a unit name`);
        const value = this.evaluate(parsed.expr);
        this.variables.set(parsed.name, value);
        this.variables.set('ans', value);
        return `${parsed.name} = ${this.formatValue(value)}`;
      }
      case 'fnAssign':
        if (BUILTINS.has(parsed.name)) throw new CalcError(`cannot replace built-in function "${parsed.name}"`);
        if (UNITS.has(parsed.name)) throw new CalcError(`"${parsed.name}" is a unit name`);
        this.functions.set(parsed.name, { params: parsed.params, body: parsed.body });
        return `${parsed.name}(${parsed.params.join(', ')}) saved`;
      case 'delete':
        return this.deleteName(parsed.name);
      case 'vars':
        return this.formatVars();
      case 'funcs':
        return this.formatFunctions();
      case 'units':
        return this.formatUnits();
      case 'history':
        return 'history is available in interactive mode';
      case 'precision':
        if (parsed.value) this.precision = parsed.value;
        return `precision = ${this.precision}`;
      default:
        throw new CalcError('unknown statement');
    }
  }

  parseStatement(input) {
    const trimmed = input.trim();
    const lower = trimmed.toLowerCase();
    if (lower === 'vars' || lower === 'variables') return { kind: 'vars' };
    if (lower === 'funcs' || lower === 'functions') return { kind: 'funcs' };
    if (lower === 'history') return { kind: 'history' };
    if (lower === 'units') return { kind: 'units' };

    const listMatch = /^(?:ls|list)\s+(vars?|variables|funcs?|functions)$/.exec(lower);
    if (listMatch) return listMatch[1].startsWith('var') ? { kind: 'vars' } : { kind: 'funcs' };

    const precisionMatch = /^(?:precision|prec)(?:\s+(\d+))?$/.exec(lower);
    if (precisionMatch) {
      if (!precisionMatch[1]) return { kind: 'precision' };
      const value = Number(precisionMatch[1]);
      if (!Number.isInteger(value) || value < 1 || value > 15) {
        throw new CalcError('precision must be between 1 and 15');
      }
      return { kind: 'precision', value };
    }

    const deleteMatch = /^(?:del|delete|rm|unset)\s+(?:(?:var|fn|func|function)\s+)?([A-Za-z_][A-Za-z0-9_]*)(?:\s*\(\s*\))?$/.exec(trimmed);
    if (deleteMatch) return { kind: 'delete', name: deleteMatch[1] };

    const convert = parseConversion(trimmed);
    if (convert) return convert;

    const topEquals = findTopLevelEquals(trimmed);
    if (topEquals !== -1) {
      const left = trimmed.slice(0, topEquals).trim();
      const right = trimmed.slice(topEquals + 1).trim();
      if (!left || !right) throw new CalcError('both sides of "=" are required');

      const fnMatch = /^([A-Za-z_][A-Za-z0-9_]*)\s*\(([^()]*)\)$/.exec(left);
      if (fnMatch) {
        const params = fnMatch[2].split(',').map((part) => part.trim()).filter(Boolean);
        if (params.length === 0) throw new CalcError('functions need at least one parameter');
        if (new Set(params).size !== params.length) throw new CalcError('function parameters must be unique');
        for (const param of params) {
          if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(param)) throw new CalcError(`invalid parameter "${param}"`);
        }
        return { kind: 'fnAssign', name: fnMatch[1], params, body: new Parser(right).parse() };
      }

      if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(left)) {
        return { kind: 'assign', name: left, expr: new Parser(right).parse() };
      }

      return { kind: 'equation', left: new Parser(left).parse(), right: new Parser(right).parse() };
    }

    return { kind: 'expr', expr: new Parser(trimmed).parse() };
  }

  evaluate(expr, locals = new Map()) {
    switch (expr.type) {
      case 'number':
        return expr.value;
      case 'identifier':
        if (locals.has(expr.name)) return locals.get(expr.name);
        if (this.variables.has(expr.name)) return this.variables.get(expr.name);
        if (CONSTANTS.has(expr.name)) return CONSTANTS.get(expr.name);
        if (UNITS.has(expr.name)) return unitQuantity(expr.name);
        throw new CalcError(`unknown variable "${expr.name}"`);
      case 'unary':
        return negateValue(this.evaluate(expr.expr, locals));
      case 'binary':
        return evalBinary(expr.op, this.evaluate(expr.left, locals), this.evaluate(expr.right, locals));
      case 'call':
        return this.evaluateCall(expr, locals);
      default:
        throw new CalcError('unknown expression');
    }
  }

  evaluateCall(expr, locals) {
    const args = expr.args.map((arg) => this.evaluate(arg, locals));
    if (BUILTINS.has(expr.name)) return BUILTINS.get(expr.name)(...args.map(numberValue));
    const fn = this.functions.get(expr.name);
    if (!fn) throw new CalcError(`unknown function "${expr.name}"`);
    if (args.length !== fn.params.length) {
      throw new CalcError(`${expr.name} expects ${fn.params.length} argument(s)`);
    }
    const childLocals = new Map(locals);
    fn.params.forEach((param, index) => childLocals.set(param, args[index]));
    return this.evaluate(fn.body, childLocals);
  }

  solve(left, right) {
    const names = new Set();
    collectIdentifiers(left, names);
    collectIdentifiers(right, names);
    for (const known of [...this.variables.keys(), ...CONSTANTS.keys()]) names.delete(known);
    if (names.size !== 1) {
      throw new CalcError('equations must contain exactly one unknown variable');
    }
    const unknown = [...names][0];
    const diff = this.toPolynomial(left, unknown).sub(this.toPolynomial(right, unknown));
    const degree = diff.degree();
    if (degree === -1) return 'all values satisfy this equation';
    if (degree === 0) throw new CalcError('equation has no solution');
    if (degree === 1) {
      const solution = diff.coeffs[0].neg().div(diff.coeffs[1]);
      return `${unknown} = ${solution.toString()}`;
    }
    return this.solveQuadratic(unknown, diff);
  }

  solveQuadratic(unknown, polynomial) {
    const c = polynomial.coeffs[0];
    const b = polynomial.coeffs[1];
    const a = polynomial.coeffs[2];
    const discriminant = b.mul(b).sub(new Rational(4).mul(a).mul(c));
    if (discriminant.n < 0) throw new CalcError('equation has no real solution');

    const exactRoot = sqrtRational(discriminant);
    const denominator = new Rational(2).mul(a);
    if (exactRoot) {
      const first = b.neg().sub(exactRoot).div(denominator);
      const second = b.neg().add(exactRoot).div(denominator);
      if (first.n === second.n && first.d === second.d) return `${unknown} = ${first.toString()}`;
      return `${unknown} = ${first.toString()} or ${unknown} = ${second.toString()}`;
    }

    const root = Math.sqrt(discriminant.toNumber());
    const first = (b.neg().toNumber() - root) / denominator.toNumber();
    const second = (b.neg().toNumber() + root) / denominator.toNumber();
    return `${unknown} ~= ${this.formatNumber(first)} or ${unknown} ~= ${this.formatNumber(second)}`;
  }

  toPolynomial(expr, unknown) {
    switch (expr.type) {
      case 'number':
        return new Polynomial([rationalFromNumber(expr.value)]);
      case 'identifier':
        if (expr.name === unknown) return new Polynomial([new Rational(0), new Rational(1)]);
        return new Polynomial([rationalFromNumber(this.evaluate(expr))]);
      case 'unary':
        return this.toPolynomial(expr.expr, unknown).neg();
      case 'binary': {
        const left = this.toPolynomial(expr.left, unknown);
        const right = this.toPolynomial(expr.right, unknown);
        if (expr.op === '+') return left.add(right);
        if (expr.op === '-') return left.sub(right);
        if (expr.op === '*') return left.mul(right);
        if (expr.op === '/') return left.div(right);
        if (expr.op === '^') return left.pow(right);
        throw new CalcError(`unsupported operator "${expr.op}"`);
      }
      case 'call':
        if (containsIdentifier(expr, unknown)) {
          throw new CalcError('functions containing the unknown cannot be solved yet');
        }
        return new Polynomial([rationalFromNumber(this.evaluate(expr))]);
      default:
        throw new CalcError('unknown expression');
    }
  }

  toLinear(expr, unknown) {
    switch (expr.type) {
      case 'number':
        return new Linear(new Rational(0), rationalFromNumber(expr.value));
      case 'identifier':
        if (expr.name === unknown) return new Linear(new Rational(1), new Rational(0));
        return new Linear(new Rational(0), rationalFromNumber(this.evaluate(expr)));
      case 'unary':
        return this.toLinear(expr.expr, unknown).neg();
      case 'binary': {
        const left = this.toLinear(expr.left, unknown);
        const right = this.toLinear(expr.right, unknown);
        if (expr.op === '+') return left.add(right);
        if (expr.op === '-') return left.sub(right);
        if (expr.op === '*') return left.mul(right);
        if (expr.op === '/') return left.div(right);
        if (expr.op === '^') return left.pow(right);
        throw new CalcError(`unsupported operator "${expr.op}"`);
      }
      case 'call':
        if (containsIdentifier(expr, unknown)) {
          throw new CalcError('functions containing the unknown cannot be solved yet');
        }
        return new Linear(new Rational(0), rationalFromNumber(this.evaluate(expr)));
      default:
        throw new CalcError('unknown expression');
    }
  }

  extractSolvedValue(result) {
    const match = /^[A-Za-z_][A-Za-z0-9_]* = (-?\d+)(?:\/(\d+))?$/.exec(result);
    if (!match) return this.variables.get('ans');
    const value = Number(match[1]) / Number(match[2] || 1);
    return value;
  }

  deleteName(name) {
    if (name === 'ans') throw new CalcError('ans cannot be deleted');
    const deletedVar = this.variables.delete(name);
    const deletedFn = this.functions.delete(name);
    if (!deletedVar && !deletedFn) return `${name} was not defined`;
    return `${name} deleted`;
  }

  formatVars() {
    const rows = [['Name', 'Value']];
    for (const [name, value] of [...this.variables.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      rows.push([name, this.formatValue(value)]);
    }
    return rows.length > 1 ? formatTable(rows) : 'no variables';
  }

  formatFunctions() {
    const rows = [['Name', 'Parameters']];
    for (const [name, fn] of [...this.functions.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      rows.push([name, fn.params.join(', ')]);
    }
    return rows.length > 1 ? formatTable(rows) : 'no functions';
  }

  formatUnits() {
    const groups = new Map();
    for (const [name, unit] of UNITS.entries()) {
      if (!groups.has(unit.dimension)) groups.set(unit.dimension, []);
      groups.get(unit.dimension).push(name);
    }
    return [...groups.entries()]
      .map(([dimension, names]) => `${dimension}: ${names.join(', ')}`)
      .join('\n');
  }

  formatNumber(value) {
    return formatNumber(value, this.precision);
  }

  formatValue(value) {
    return formatValue(value, this.precision);
  }
}

function insertImplicitMultiplication(tokens) {
  const out = [];
  for (let i = 0; i < tokens.length - 1; i += 1) {
    const current = tokens[i];
    const next = tokens[i + 1];
    out.push(current);
    if (needsImplicitMultiply(current, next)) out.push({ type: '*', value: '*' });
  }
  out.push(tokens[tokens.length - 1]);
  return out;
}

function needsImplicitMultiply(left, right) {
  const leftValue = left.type === 'number' || left.type === 'identifier' || left.type === ')';
  const rightValue = right.type === 'number' || right.type === 'identifier' || right.type === '(';
  if (!leftValue || !rightValue) return false;
  if (left.type === 'identifier' && right.type === '(') return false;
  return true;
}

function findTopLevelEquals(input) {
  let depth = 0;
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;
    if (char === '=' && depth === 0) return i;
  }
  return -1;
}

function parseConversion(input) {
  let depth = 0;
  for (let i = input.length - 1; i >= 0; i -= 1) {
    const char = input[i];
    if (char === ')') depth += 1;
    if (char === '(') depth -= 1;
    if (depth === 0 && /\s/.test(char)) {
      const right = input.slice(i).trim();
      const left = input.slice(0, i).trim();
      const match = /^to\s+([A-Za-z_][A-Za-z0-9_]*)$/i.exec(right);
      if (match && left) return { kind: 'convert', expr: new Parser(left).parse(), unit: match[1] };
    }
  }
  return null;
}

function evalBinary(op, left, right) {
  if (op === '+') return addValues(left, right);
  if (op === '-') return subValues(left, right);
  if (op === '*') return mulValues(left, right);
  if (op === '/') {
    return divValues(left, right);
  }
  if (op === '^') return powValues(left, right);
  throw new CalcError(`unknown operator "${op}"`);
}

function addValues(left, right) {
  if (left instanceof Quantity) return left.add(right);
  if (right instanceof Quantity) return asQuantity(left).add(right);
  return left + right;
}

function subValues(left, right) {
  if (left instanceof Quantity) return left.sub(right);
  if (right instanceof Quantity) return asQuantity(left).sub(right);
  return left - right;
}

function mulValues(left, right) {
  if (left instanceof Quantity) return left.mul(right);
  if (right instanceof Quantity) return right.mul(left);
  return left * right;
}

function divValues(left, right) {
  if (left instanceof Quantity) return left.div(right);
  if (right instanceof Quantity) return asQuantity(left).div(right);
  if (right === 0) throw new CalcError('division by zero');
  return left / right;
}

function powValues(left, right) {
  if (left instanceof Quantity) return left.pow(numberValue(right));
  if (right instanceof Quantity) throw new CalcError('unit exponents are not supported');
  return left ** right;
}

function negateValue(value) {
  return value instanceof Quantity ? value.neg() : -value;
}

function numberValue(value) {
  return value instanceof Quantity ? value.toNumber() : value;
}

function collectIdentifiers(expr, names) {
  if (expr.type === 'identifier') names.add(expr.name);
  if (expr.type === 'unary') collectIdentifiers(expr.expr, names);
  if (expr.type === 'binary') {
    collectIdentifiers(expr.left, names);
    collectIdentifiers(expr.right, names);
  }
  if (expr.type === 'call') {
    for (const arg of expr.args) collectIdentifiers(arg, names);
  }
}

function containsIdentifier(expr, name) {
  const names = new Set();
  collectIdentifiers(expr, names);
  return names.has(name);
}

function rationalFromNumber(value) {
  if (!Number.isFinite(value)) throw new CalcError('number is not finite');
  if (Number.isInteger(value)) return new Rational(value);
  const text = String(value);
  if (!/^-?\d+(?:\.\d+)?$/.test(text)) {
    throw new CalcError('exact solving only supports decimal coefficients');
  }
  const negative = text.startsWith('-');
  const unsigned = negative ? text.slice(1) : text;
  const [whole, fraction = ''] = unsigned.split('.');
  const scale = 10 ** fraction.length;
  const numerator = Number(whole) * scale + Number(fraction);
  return new Rational(negative ? -numerator : numerator, scale);
}

function asRational(value) {
  return value instanceof Rational ? value : new Rational(value);
}

function asQuantity(value) {
  return value instanceof Quantity ? value : new Quantity(value, {});
}

function unitQuantity(name) {
  const unit = UNITS.get(name);
  return new Quantity(unit.factor, { [unit.dimension]: 1 }, name);
}

function normalizeDimensions(dimensions) {
  const normalized = {};
  for (const [name, power] of Object.entries(dimensions)) {
    if (Math.abs(power) > 1e-12) normalized[name] = power;
  }
  return normalized;
}

function combineDimensions(left, right, sign) {
  const dimensions = { ...left };
  for (const [name, power] of Object.entries(right)) {
    dimensions[name] = (dimensions[name] || 0) + power * sign;
  }
  return normalizeDimensions(dimensions);
}

function sameDimensions(left, right) {
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every((key, index) => key === rightKeys[index] && left[key] === right[key]);
}

function isDimensionless(dimensions) {
  return Object.keys(dimensions).length === 0;
}

function combineUnitNames(left, right, op) {
  if (!left) return right ? (op === '/' ? `1/${right}` : right) : '';
  if (!right) return left;
  return `${left}${op}${right}`;
}

function gcd(a, b) {
  while (b !== 0) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a || 1;
}

function sqrtRational(value) {
  if (value.n < 0) return null;
  const n = integerSqrt(value.n);
  const d = integerSqrt(value.d);
  if (n * n === value.n && d * d === value.d) return new Rational(n, d);
  return null;
}

function integerSqrt(value) {
  return Math.floor(Math.sqrt(value));
}

function formatTable(rows) {
  const widths = rows[0].map((_, column) => {
    return Math.max(...rows.map((row) => String(row[column]).length));
  });
  return rows
    .map((row) => row.map((cell, column) => String(cell).padEnd(widths[column])).join('  ').trimEnd())
    .join('\n');
}

function formatValue(value, precision = 12) {
  if (!(value instanceof Quantity)) return formatNumber(value, precision);
  const unitName = value.unit || formatDimensions(value.dimensions);
  const amount = unitName && UNITS.has(unitName) ? value.value / UNITS.get(unitName).factor : value.value;
  return unitName ? `${formatNumber(amount, precision)} ${unitName}` : formatNumber(amount, precision);
}

function formatDimensions(dimensions) {
  const entries = Object.entries(dimensions);
  if (entries.length === 0) return '';
  return entries
    .map(([name, power]) => (power === 1 ? name : `${name}^${power}`))
    .join('*');
}

function formatNumber(value, precision = 12) {
  if (!Number.isFinite(value)) return String(value);
  if (Math.abs(value) < 1e-12) return '0';
  return Number(value.toPrecision(precision)).toString();
}

module.exports = {
  Calculator,
  CalcError,
  Parser,
  Polynomial,
  Rational
};
