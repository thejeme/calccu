# calccu AUR package

This directory contains the files for the `calccu` AUR package.

Build locally on Arch Linux:

```sh
makepkg -si
```

Publish by copying these files to the AUR Git repository for `calccu`, then
committing and pushing them there.

When releasing a new upstream version:

1. Update `pkgver` and `_commit` in `PKGBUILD`.
2. Regenerate `.SRCINFO` from Arch Linux with:

   ```sh
   makepkg --printsrcinfo > .SRCINFO
   ```
