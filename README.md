# calccu

`calccu` is a live terminal calculator for quick arithmetic, variables,
functions, unit conversion, and simple equation solving.

It shows a bounded live preview while you type. Pressing Enter evaluates the
current expression, stores the result in `ans`, and keeps a short visible
history above the prompt. Automatic answers are shown as values with a leading
`<`; named assignments and equation solutions keep their names.

## Features

- Live interactive terminal UI with command history and editable input
- One-shot CLI mode for scripts, pipes, and shell aliases
- Variables, user-defined functions, and automatic `ans`
- Exact basic decimal and large integer arithmetic
- Linear and quadratic equation solving
- Unit conversion across temperature, length, weight, area, volume, energy,
  speed, time, and data units
- Common unit aliases and plural names, such as `meter`, `meters`, `feet`,
  `hours`, and `bytes`
- Configurable displayed precision
- No runtime npm dependencies

## Install

Requires Node.js 18 or newer.

From this repository:

```sh
npm install -g .
```

Then run:

```sh
calccu
```

Arch users can build the local AUR package files:

```sh
cd aur
makepkg -si
```

## Usage

Open the interactive calculator:

```sh
calccu
```

Evaluate one expression and exit:

```sh
calccu "2 + 2"
calccu "5km to m"
calccu "5km -> m"
calccu "2 meters to cm"
calccu "2x = 3"
```

Use script-friendly output modes:

```sh
calccu --precision 6 "1 / 3"
calccu --json "5km -> m"
```

Read expressions from standard input:

```sh
printf "2 + 2\n32F to C\n" | calccu
printf "2 + 2\n32F to C\n" | calccu --json
```

Show help or version information:

```sh
calccu --help
calccu --version
man calccu
```

## Shell Completions

Completion files are included for bash, zsh, and fish:

```text
completions/calccu.bash
completions/_calccu
completions/calccu.fish
```

The AUR package installs them into the standard shell completion directories.
They complete the top-level CLI flags `--help`, `-h`, `--version`, and `-v`.
They also complete `--precision`, `--plain`, and `--json`.

## Examples

Arithmetic and units:

```text
2 + 3 * 4
2m + 30cm
2 meters to cm
5km to m
5km -> m
32F to C
1MiB to B
```

Variables:

```text
x = 12
2x + 1
ans * 10
```

Functions:

```text
f(x) = x^2 + 1
f(3)
gcd(12, 18)
lcm(4, 6)
fact(5)
```

Equations:

```text
2x = 3
3(x - 1) = 9
x/2 = 3
1/3x = 2
x^2 - 4 = 0
```

## Commands

```text
help            show help
?               show help
clear           clear visible calculator history
cls             clear visible calculator history
clear history   clear visible calculator history
quit            quit interactive mode
exit            quit interactive mode
vars            list variables
funcs           list functions
ls vars         list variables
ls funcs        list functions
ls units        show supported conversion units
list units      show supported conversion units
history         show recent commands
units           show supported conversion units
copy            show the current ans value
copy ans        show the current ans value
precision       show displayed significant digits
precision 8     set displayed significant digits
del name        delete a variable or function
delete name     delete a variable or function
del var name    delete a variable
del fn name     delete a function
del func name   delete a function
```

Command recall is saved between sessions in `$XDG_STATE_HOME/calccu/history`,
or `~/.local/state/calccu/history` when `XDG_STATE_HOME` is unset. Set
`CALCCU_HISTORY` to use a different history file.

Long inputs and outputs wrap to the terminal width, and the display re-renders
when the terminal is resized.

## Keys

```text
Enter                 commit the current input
Ctrl+C                quit
Ctrl+L                clear visible calculator history
Left/Right            move the cursor
Up/Down               recall previous or next command
PageUp/PageDown       scroll visible-session results
Home/End              move to start or end
Ctrl+A/Ctrl+E         move to start or end
Ctrl+U/Ctrl+K         delete before or after the cursor
Ctrl+W                delete the previous word
```

## Supported Math

- Operators: `+`, `-`, `*`, `/`, `^`
- Parentheses
- Implicit multiplication, such as `2x` and `3(x + 1)`
- Variables
- User-defined functions
- Exact rational arithmetic for basic finite decimal and integer calculations
- Fraction-style input through division, such as `1/3x = 2`
- Unit conversion with `to` or `->`, such as `5km to m` and `5km -> m`
- Common unit aliases and plural names, such as `meter`, `meters`, `feet`,
  `hours`, and `bytes`
- Configurable displayed significant digits with `precision 8`
- Built-in constants: `pi`, `e`
- Built-in functions: `abs`, `acos`, `asin`, `atan`, `cbrt`, `ceil`, `cos`,
  `exp`, `fact`, `factorial`, `floor`, `gcd`, `hypot`, `lcm`, `ln`, `log`,
  `log2`, `max`, `min`, `round`, `sign`, `sin`, `sqrt`, `tan`, `trunc`

Basic arithmetic keeps finite decimal input exact, so expressions such as
`0.1 + 0.2`, `8.15 * 100`, and large integer additions avoid JavaScript
floating-point artifacts. Integer functions such as `gcd`, `lcm`, and `fact`
also stay exact. Built-in transcendental functions and unit conversion factors
still use JavaScript numbers where approximation is expected.

Unknown unit-like names include suggestions when there is a close match, such
as `meterx` suggesting `meter`.

Equation solving supports exact single-variable linear equations and quadratic
equations up to degree two. Linear solutions are kept exact where possible, such
as `2x = 3` producing `x = 3/2`.

## Units

The short symbols below are the canonical output names. Common aliases and
plural forms are also accepted for many units, including names such as `meter`,
`metre`, `meters`, `feet`, `pounds`, `seconds`, `hours`, `bytes`, and
`kilobytes`.

- Temperature: `C`, `F`, `K`, `degC`, `degF`
- Length: `mm`, `cm`, `m`, `km`, `in`, `ft`, `yd`, `mi`
- Weight: `mg`, `g`, `kg`, `t`, `oz`, `lb`, `st`
- Area: `m2`, `cm2`, `km2`, `ft2`, `in2`, `acre`, `ha`
- Volume: `m3`, `cm3`, `mm3`, `L`, `l`, `mL`, `ml`, `gal`, `qt`, `pt`,
  `cup`, `fl_oz`
- Energy: `J`, `kJ`, `cal`, `kcal`, `Wh`, `kWh`, `BTU`, `btu`
- Speed: `mps`, `kmh`, `mph`, `knot`, `fps`
- Time: `ms`, `s`, `min`, `h`, `day`, `week`
- Data: `bit`, `b`, `B`, `KB`, `MB`, `GB`, `TB`, `KiB`, `MiB`, `GiB`, `TiB`

## Development

Run the calculator locally:

```sh
npm start
```

Run tests:

```sh
npm test
```

Preview the manual page:

```sh
man ./man/calccu.1
```

## AUR Packaging

The `aur/` directory contains a `PKGBUILD` and `.SRCINFO` for publishing
`calccu` to the Arch User Repository. The package source follows the GitHub
release tag `v0.2.0`.

When releasing a new version:

1. Update `package.json`.
2. Tag the release as `vX.Y.Z`.
3. Update `pkgver` in `aur/PKGBUILD`.
4. Regenerate `aur/.SRCINFO` on Arch with `makepkg --printsrcinfo > .SRCINFO`.

## License

MIT. See [LICENSE](LICENSE).
