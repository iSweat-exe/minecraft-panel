---
trigger: model_decision
description: When user ask you to make git commit or something like that
---

---
name: conventional-commits
description: Write, generate, or clean up git commit messages following the Conventional Commits specification. Use this whenever the user asks to write a commit message, commit staged changes, generate a changelog-friendly message, or asks to "commit this cleanly." Also use when reviewing/rewriting an existing commit message to conventional format, or when setting up commitlint/semantic-release conventions for a repo.
---

# Conventional Commits

Generate commit messages that follow the [Conventional Commits](https://www.conventionalcommits.org/) spec, readable by tools like `semantic-release`, `commitlint`, or for auto-generating a changelog.

## Golden rule: read the real diff, never guess

Before writing a message, always look at the actual diff (`git diff --staged` or equivalent), not just what the user described from memory. A commit message that describes a different change than what the diff actually does is a hallucination — it breaks trust in the history and in any changelog generated from it later.

If the diff mixes several unrelated changes (e.g. a fix + a refactor + a dependency bump), flag it to the user and suggest splitting into multiple commits rather than cramming everything into one vague message.

## Format

```
<type>(<optional scope>)<!>: <short description>

<optional body>

<optional footer>
```

- **type**: required, one of the types below
- **scope**: optional, in parentheses — the module/component affected (e.g. `parser`, `api`, `ci`)
- **!**: right before the `:`, marks a breaking change (can combine with a `BREAKING CHANGE:` footer for details)
- **description**: imperative mood, lowercase, no trailing period, ~50-72 chars max
- **body**: explains *what* and *why*, not *how* (the diff already shows how) — separated from the title by a blank line
- **footer**: `BREAKING CHANGE: ...`, `Closes #123`, `Refs #456`, `Co-authored-by: ...`

## Types

| Type | Usage |
|---|---|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting, semicolons, whitespace — no logic change |
| `refactor` | Neither fix nor feat, code restructuring |
| `perf` | Performance improvement |
| `test` | Adding/fixing tests |
| `build` | Build system, dependencies (npm, cargo, etc.) |
| `ci` | CI files and scripts |
| `chore` | Maintenance task that touches neither src nor tests |
| `revert` | Reverts a previous commit |

## Examples

Simple:
```
fix(driver): correct stylus pressure mapping on Wacom CTL-4100
```

With body:
```
feat(overlay): add multi-monitor support to the DirectX hook

The DXGI hook only targeted the primary device. Now detects all
active swapchains and applies the overlay to the one in focus.
```

Breaking change:
```
refactor(api)!: rename `connect()` to `open_session()`

BREAKING CHANGE: callers using `connect()` must migrate to
`open_session()`, same signature.
```

Revert:
```
revert: feat(overlay): add multi-monitor support

This reverts commit a3f21c9, causes a regression on single-monitor setups.
```

## Suggested workflow

1. Get the real diff (staged, or provided)
2. Identify the dominant type(s) of change — if it mixes several subjects, say so before continuing
3. Write the title + body from what is **actually present in the diff**, not a guess about intent
4. Check: is this a breaking change? (public signature changed, default behavior changed, config file renamed...)
5. Propose the message, let the user confirm before running `git commit`

## Running the commit: Linux vs Windows — syntax pitfalls

The message can be written correctly and still end up corrupted (truncated, cut off, `!` stripped, broken accents) because of the shell that executes it. Detect the OS/shell before picking a method.

### Recommended universal method: go through a file

Regardless of OS, the most reliable way to avoid every escaping pitfall is to write the message to a temp file and use `-F` instead of `-m`:

```bash
git commit -F /path/to/message.txt
```

This completely sidesteps nested-quote issues, special characters, and multi-line handling quirks per shell. **Pitfall to know**: by default, git applies `--cleanup=strip`, which removes any message line **starting** with `#` (treated as a comment) — so `#123` at the start of a line silently disappears. If the message references an issue at the start of a line, either prefix it with text (`Refs #123` rather than `#123` alone), or add `--cleanup=verbatim` to preserve the message exactly as written.

### Linux / macOS (bash, zsh)

- `-m "message"` in double quotes: the shell interpolates `$VAR`, `` `command` ``, and backslashes — if the generated message contains a `$` or backticks (a code path, a price, a quoted template string), it can get executed/interpolated instead of staying literal text.
- **Bash-specific interactive pitfall**: a `!` inside a double-quoted string triggers history expansion (`event not found`). The breaking-change marker `type!:` is generally safe since it's at the very start of the line followed by `:`, but stay cautious if the body contains a `!` elsewhere.
- For a reliable multi-line message in one command, use a **quoted** heredoc (quoting `EOF` disables any expansion inside it):

```bash
git commit -m "$(cat <<'EOF'
feat(scope): short subject

Body with $variables, `backticks` or ! that stay
literal text thanks to the quoted heredoc.
EOF
)"
```

- Alternatively, repeating `-m` assembles each occurrence as a separate paragraph (`git commit -m "title" -m "body"`) — simpler but less practical for a long body.

### Windows PowerShell

- PowerShell uses the **backtick** `` ` `` as its escape character (not backslash), and double quotes interpolate `$variables` — so a literal `$` in a double-quoted message can get interpreted as a variable (often empty → silently disappears).
- **Known pitfall**: PowerShell reconstructs arguments passed to a native executable (`git.exe`) and can mishandle complex nested quotes in an inline command — avoid hand-rolling escaping directly on the command line.
- Reliable solution: build the message in a variable using a **single-quoted here-string** (`@'` ... `'@`, literal, no interpolation); the closing token must be alone at the start of a line, with no leading whitespace:

```powershell
$msg = @'
feat(scope): short subject

Body text, $variables and `backticks` stay literal
thanks to the single-quote here-string.
'@
git commit -m $msg
```

- **Encoding pitfall**: if you go through a file (`-F`), explicitly specify UTF-8 encoding when writing it, otherwise accented characters (é, è, à...) can get corrupted depending on the PowerShell version:

```powershell
Set-Content -Path msg.txt -Value $msg -Encoding utf8
git commit -F msg.txt
```

### Windows cmd.exe (classic command prompt)

- Avoid for multi-line messages: no real heredoc, `%` triggers environment-variable expansion (a literal `%` in the message can vanish or break), and `&`, `|`, `^`, `<`, `>` are shell-special characters.
- If cmd.exe is the only shell available, always prefer the file + `-F` method over inline `-m`.
- In practice, on Windows, Git Bash (installed alongside Git for Windows) is usually available and behaves like regular bash — recommend it first if the shell choice is open, since it avoids every PowerShell/cmd-specific pitfall.

### Quick summary

| Shell | Main pitfall | Safe fix |
|---|---|---|
| bash/zsh | `$`, `` ` ``, `!` interpolated in double quotes | quoted heredoc `<<'EOF'` or file + `-F` |
| PowerShell | `$` interpolated in double quotes, nested quotes mishandled toward the native exe | here-string `@'...'@` or file + `-F` with `-Encoding utf8` |
| cmd.exe | `%`, `&`, `|`, `^` special, no clean multi-line | file + `-F` mandatory, or avoid cmd.exe |
| all | message line starting with `#` silently stripped | `--cleanup=verbatim` or don't start a line with `#` |

## Message language

By default, keep the type keywords (`feat`, `fix`, etc.) unchanged — these are protocol tokens, not text to translate. For the description/body, follow whatever convention is already in place in the repo's history (`git log --oneline -20` to check): international open-source project → English; personal/internal French-language project → French.

## Edge cases

- **Monorepo**: use the package/folder name as scope (`fix(nexttabletdriver-core): ...`)
- **Dependency-only change (lockfile, version bump)**: `build(deps): bump serde to 1.0.210`
- **WIP not meant to be polished yet**: don't force the conventional format onto a commit explicitly marked WIP/to-be-squashed — only suggest it if the user wants a clean history right away
- **Commit with no functional content (import sorting, auto-lint)**: `style`, not `refactor`