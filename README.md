# calccu

`calccu` is a small interactive terminal calculator. It updates the result while
you type, and pressing Enter commits the current expression so the result becomes
available as `ans`. Committed inputs and results stay visible as a short
on-screen history above the prompt. Calculator answers are shown with a leading
`<`.

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

You can also run one expression without opening the TUI:

```sh
calccu "2 + 2"
echo "2x = 3" | calccu
```

## Keys

- `Enter` commits the current input.
- `Ctrl+C` quits.
- `Ctrl+L` clears the terminal.
- Left and right arrows move the cursor.
- Up and down arrows recall previous commands.
- `Home`/`End` or `Ctrl+A`/`Ctrl+E` move to the start/end.
- `Ctrl+U`/`Ctrl+K` delete before/after the cursor.
- `Ctrl+W` deletes the previous word.

## Commands

```text
help
?
clear
quit
exit
vars
funcs
precision
precision 8
del name
delete name
```

`clear` and `Ctrl+L` clear the visible calculator history. Command recall is
saved between sessions in `~/.calccu_history`.

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
x/2 = 3
1/3x = 2
x^2 - 4 = 0
```

## Supported Math

- Operators: `+`, `-`, `*`, `/`, `^`
- Parentheses
- Implicit multiplication, such as `2x` and `3(x + 1)`
- Variables
- User-defined functions
- Fraction-style input through division, such as `1/3x = 2`
- Configurable displayed significant digits with `precision 8`
- Built-in constants: `pi`, `e`
- Built-in functions: `abs`, `acos`, `asin`, `atan`, `ceil`, `cos`, `exp`,
  `floor`, `ln`, `log`, `max`, `min`, `round`, `sin`, `sqrt`, `tan`

Equation solving supports exact single-variable linear equations and quadratic
equations up to degree two. Linear solutions are kept exact where possible, such
as `2x = 3` producing `x = 3/2`.
