# calccu

`calccu` is a small interactive terminal calculator. It updates the result while
you type, and pressing Enter commits the current expression so the result becomes
available as `ans`.

## Install

From this directory:

```sh
npm install -g .
```

Then run:

```sh
calccu
```

For local development:

```sh
npm start
npm test
```

## Keys

- `Enter` commits the current input.
- `Esc` or `Ctrl+C` quits.
- `Ctrl+L` clears the terminal.
- Left and right arrows move the cursor.

## Commands

```text
help
?
clear
quit
exit
vars
funcs
del name
delete name
```

## Examples

```text
2 + 3 * 4
```

```text
x = 12
2x + 1
```

```text
f(x) = x^2 + 1
f(3)
```

```text
2x = 3
3(x - 1) = 9
```

## Supported Math

- Operators: `+`, `-`, `*`, `/`, `^`
- Parentheses
- Implicit multiplication, such as `2x` and `3(x + 1)`
- Variables
- User-defined functions
- Built-in constants: `pi`, `e`
- Built-in functions: `abs`, `acos`, `asin`, `atan`, `ceil`, `cos`, `exp`,
  `floor`, `ln`, `log`, `max`, `min`, `round`, `sin`, `sqrt`, `tan`

Equation solving is intentionally small in this first version. It supports exact
single-variable linear equations such as `2x = 3` and `3(x - 1) = 9`.
