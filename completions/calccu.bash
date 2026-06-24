# bash completion for calccu

_calccu() {
  local cur
  cur="${COMP_WORDS[COMP_CWORD]}"

  if [[ "${cur}" == -* ]]; then
    COMPREPLY=($(compgen -W '--help -h --version -v --precision --plain --json' -- "${cur}"))
    return 0
  fi

  COMPREPLY=()
}

complete -F _calccu calccu
