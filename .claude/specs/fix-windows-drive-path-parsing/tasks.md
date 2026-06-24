# Tasks — Fix Windows drive-letter path parsing in b6p-core

**Status:** Ready for execution (tasks-only spec — no requirements/design phase)

> Handoff note: this spec was created from a CI investigation. It documents a **pre-existing**
> `b6p-core` bug (present in every shipped version, not introduced by the monorepo split). The
> primary fix lives in the **`b6p-core`** repo and requires an npm republish; downstream repos then
> bump the dependency. Read the Context below before starting.

---

## Context

### Repo layout (three independent repos, siblings under the workspace root)

| Repo | Path | Remote | npm |
| --- | --- | --- | --- |
| `b6p-core` | `b6p-core/` | `Bluestep-Systems/b6p-core` | `@bluestep-systems/b6p-core` (public, currently `0.1.0`) |
| `b6p-cli` | `b6p-cli/` | `Bluestep-Systems/b6p-cli` | `@bluestep-systems/b6p-cli` (public, `0.1.0`) |
| `vscode-extension` | `b6p-vscode/` | `Bluestep-Systems/vscode-extension` | `bsjs-push-pull` (`.vsix`, not on npm) |

Downstream repos **bundle** `b6p-core` at build time (esbuild) and pin it by version. Release ordering
(see `b6p-vscode/RELEASING.md`): publish core first → bump downstream → rebuild/republish downstream.

### Root cause

`DownstairsPathParser` (`b6p-core/src/data/DownstairsPathParser.ts`) builds `prependingPath` assuming
POSIX absolute paths (leading `/` → empty first segment):

```js
const isAbsolute = path.isAbsolute(rawPath);
const segments = rawPath.split(path.sep).filter((s) => s !== "");
// ...
this.prependingPath = (isAbsolute ? path.sep : "") + prependingSegments.join(path.sep);
```

On **Windows**, an absolute path starts with a drive letter (`C:\…`), not an empty segment, so this
prepends a bogus separator **before** the drive. Reproduction:

```
input:           C:\Users\jdoe\ws\U100001\MyScript\draft\file.js
prependingPath:  "\C:\Users\jdoe\ws\U100001"   ← bogus leading "\" before "C:"  (MANGLED)
```

At runtime the parser is fed `uri.fsPath` (`ScriptRoot.ts:36`, `ScriptNode.ts:41`, `B6PCore.ts:171/180/506`),
which on Windows is a drive-letter path — so this triggers in production, not just tests.

### Blast radius (Windows runtime)

The mangled `prependingPath` → `getShavedName()` → `ScriptRoot.rootUri` (`ScriptRoot.ts:37-38`) corrupts
everything derived from the root URI:

- `B6PCore` `rootPath` for pull/push landing — `B6PCore.ts:174,183`
- `isInGitIgnore()` — `ScriptNode.ts:178-180` (gitignore exclusion **silently fails** on Windows;
  `path.relative(mangledRoot, correctFile)` → mismatched roots → no match)
- `pathWithRespectToDraftRoot()` — `ScriptNode.ts:223`
- gitignore file URI / draft / declarations folder URIs, `dirname`, root-equality —
  `ScriptRoot.ts:60,173,248,317,326`, `ScriptNode.ts:291`

`GlobMatcher` itself is fine (it already normalizes `path.sep` → `/`); the corruption is upstream in
the root path.

### Evidence (CI)

`vscode-extension` `.github/workflows/ci.yml` on `windows-latest` (run after commit `f055352`) — 3 failures,
all in `ScriptNode Tests`:
- `should convert to downstairs URI correctly` — **test-only** (expected value omits the Windows drive letter)
- `should detect files in gitignore` — **real bug** (mangled root → gitignore miss)
- `should detect gitignored files via glob matcher` — **real bug** (same)

macOS and Linux pass (POSIX `path.sep` is `/`, so the mangling does not occur). The older
`release.yml` masked these with `continue-on-error: true`, which is why they were never caught.

A separate, already-fixed issue (`DownstairsPathParser.test.ts` hardcoding `/` inputs) was resolved in
`vscode-extension` commit `f055352` via an `osPath()` helper — **leave that as-is**; it is correct and
unrelated to this core fix.

---

## Tasks

- [x] **1.** Fix drive-letter root handling in `DownstairsPathParser`. Derive the real filesystem root
      with `path.parse(rawPath).root` (`"/"` on POSIX, `"C:\\"` on Windows), strip it before splitting
      into segments, and rebuild `prependingPath` as `root + prependingSegments.join(path.sep)` so the
      drive is preserved and no bogus separator is prepended. Verify `isAbsolute` / `getShavedName()` /
      `equals()` still behave on POSIX. — files: `b6p-core/src/data/DownstairsPathParser.ts`
- [x] **2.** Add Windows-path regression coverage. `b6p-core` has no test runner today, so either
      (a) add a minimal node-based unit test + script in `b6p-core` that exercises a `C:\…\U######\…`
      path and asserts a correct (un-mangled) `prependingPath` / `getShavedName()`, or (b) if keeping
      tests downstream, ensure the `vscode-extension` `ScriptNode`/`DownstairsPathParser` suites cover a
      drive-letter input. Prefer (a) so the fix is guarded in the repo that owns the code. — files:
      `b6p-core/src/data/DownstairsPathParser.ts` (+ a test file / `package.json` test script in `b6p-core`)
- [x] **3.** Release `b6p-core@0.1.1`: bump `version` in `b6p-core/package.json`, add a `CHANGELOG.md`
      entry describing the Windows drive-letter fix, then tag `v0.1.1` (triggers `publish.yml` →
      `npm publish --provenance --access public`). Confirm with
      `npm view @bluestep-systems/b6p-core version --registry=https://registry.npmjs.org`. — files:
      `b6p-core/package.json`, `b6p-core/CHANGELOG.md`
- [x] **4.** Bump the dependency in `vscode-extension`: set `@bluestep-systems/b6p-core` to `^0.1.1` in
      `b6p-vscode/package.json`, run `npm install` to refresh the lockfile, and commit both. — files:
      `b6p-vscode/package.json`, `b6p-vscode/package-lock.json`
- [x] **5.** Fix the test-only failure in `vscode-extension`: the `should convert to downstairs URI
      correctly` test compares `downstairsUri.fsPath` (which gains a drive letter on Windows) against a
      `path.join`-built expected value that lacks the drive. Make the assertion drive-tolerant (e.g.
      compare against the same `B6PUri`-derived source, or strip/normalize the drive on both sides). —
      files: `b6p-vscode/src/test/tests/ScriptNode.test.ts`
- [x] **6.** Verify green CI on Windows: push to `vscode-extension` and confirm the `ci.yml`
      `windows-latest` job passes (`check-types`, `lint`, `npm test` — all 153 tests, including the two
      gitignore tests). — files: (CI verification only)
- [x] **7.** (If needed for release ordering) Bump `@bluestep-systems/b6p-core` to `^0.1.1` in `b6p-cli`
      and refresh its lockfile, so the whole scope stays on the fixed core. The CLI does not exercise the
      VS Code URI path, but keep versions aligned. — files: `b6p-cli/package.json`, `b6p-cli/package-lock.json`

## Verification

In `b6p-core` (after Task 1–2):

- `npm run check-types && npm run lint && npm run compile`
- New Windows-path assertion passes (un-mangled `prependingPath` for a `C:\…` input).

In `vscode-extension` (after Task 4–5), ideally on Windows or via CI:

- `npm run check-types && npm run lint && npm run format-check`
- `npm test` → 153 passing on `windows-latest` (the two gitignore tests + the URI-conversion test green).
- `ci.yml` `windows-latest` + `macos-latest` jobs both green.

## Wrap-up

- `b6p-core/CHANGELOG.md`: note the Windows drive-letter path fix under a new `0.1.1` entry.
- `vscode-extension/CHANGELOG.md`: note the bumped core dependency under `[Unreleased]` if appropriate.
- Keep `b6p-cli`/`vscode-extension` core-dependency versions aligned per `RELEASING.md`.
- No public API or command changes — this is a path-correctness fix; runtime behavior on Windows is
  restored to match POSIX.
