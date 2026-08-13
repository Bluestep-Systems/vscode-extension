# Change Log

All notable changes to the B6P - BlueStep JavaScript Push/Pull extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- **The release workflow would have failed on the next tag.** `.github/workflows/release.yml`
  still ran `npm run lint` in its `validate` job after that script was deleted, so pushing a
  `v*.*.*` tag would exit 1 on both matrix legs — and since the `Run tests` step below it carries
  `continue-on-error: true`, lint was one of the few steps that could actually block a release.
  It now runs `npm run format-check`, matching `ci.yml`.

- **MCP servers were missing for the whole session after a restart.** `McpServerProvider` builds
  its server list from `OrgCache.map()`, which is deliberately *not* gated on the initial
  persistence load, and `OrgCache.onChanged` fires only on mutations — never when that load lands.
  So VS Code's first `provideMcpServerDefinitions` ran against an empty cache and offered nothing;
  a user whose session cookie was still valid might never trigger a login, so nothing ever
  re-fired. `App.buildMcp` now re-offers the list on `orgCache.whenReady()`.

  Latent before this release only because core 0.1.1 wiped the persisted org cache on construction
  anyway (fixed in 0.5.0) — so the cache was empty at activation regardless. Fixing that upstream
  is what made this reachable.

- **CI was broken on both legs before this branch even touched it**, surfaced by PR #16:

  - *Windows, format check.* Prettier's `endOfLine` default is `lf`, and a Windows runner checks
    out CRLF, so the newly-added `format-check` gate reported all 50 source files as unformatted
    — files byte-identical to what Prettier writes elsewhere. A `.gitattributes` with
    `* text=auto eol=lf` normalizes the working tree on every platform. The gate could never have
    caught this before, because the step it replaced was ESLint, which could not fail.
  - *macOS, tests.* `@vscode/test-electron` 2.5.2 launches VS Code via
    `Contents/MacOS/Electron`, which VS Code renamed to the product name; any 1.110+ archive
    fails with `spawn … ENOENT`, and CI now downloads 1.133. Bumped `@vscode/test-electron` to
    `^3.1.0` and `@vscode/test-cli` to `^0.0.15`, which fix it — both declare `engines.node >=22`,
    so the CI matrix in `ci.yml` and `release.yml` moves from Node 20 to 22. (VS Code 1.103+ ships
    a Node 22 extension host, so this only aligns CI with the runtime.)

- **Snapshot pushes reported bogus type errors for every file.** The extension never passed
  `B6PProviders.typescriptLibDirs`, added in core 0.2.0 for exactly this: once b6p-core is bundled
  into `dist/extension.js`, TypeScript's default host resolves `lib.*.d.ts` relative to
  `__filename` — the extension's `dist/`, where none exist — and falls back to the *workspace's*
  `node_modules/typescript/lib`, which a BlueStep script folder normally lacks. Every snapshot
  push then logged `Cannot find global type 'Array'` / `Cannot find name 'console'` per file,
  drowning any real diagnostic. (The push itself still completed; 0.2.0 made type diagnostics
  advisory.)

  esbuild's new `copy-ts-libs` plugin copies the standard library next to the bundle
  (`dist/lib/`, 100 files) and `App` hands that directory to the core. The libs are resolved from
  **b6p-core's** pinned `typescript@5.9.2` — the compiler that actually gets bundled, not the
  repo's TypeScript 7 — and the plugin asserts the shipped libs match the bundled compiler's
  version, so the two cannot silently diverge. Ported from `b6p-cli`. Adds ~500 KB to the `.vsix`.

### Changed

- **Bumped `@bluestep-systems/b6p-core` from `0.1.1` to `0.5.0`.** The releases in between carry
  bundled-TypeScript lib resolution, the audit indeterminate-integrity fix, `static/` bundle push
  fixes, Windows lock-error retry on `state.json`, and a set of `OrgCache` readiness fixes — see the
  [core changelog](https://github.com/Bluestep-Systems/b6p-core/blob/master/CHANGELOG.md). 0.5.0 is a
  breaking release; the VS Code layer moved with it:

  - Script commands are now reached through `core.script.*` (`core.script.push`, `.pull`, `.audit`,
    `.auditPull`, `.pullCurrent`, `.pushCurrent`) rather than sitting directly on `B6PCore`.
  - `B6PCore`'s `fs`, `prompt`, `logger`, `progress` and `persistence` are private, so `App` now
    **owns** the four provider implementations it injects and exposes them as `App.fs`, `App.prompt`,
    `App.logger` and `App.progress`. They are bundled by the new `VscodeProviders` interface in
    [src/main/providers/index.ts](src/main/providers/index.ts).
  - `App` no longer `implements ScriptContext`. It *holds* one (`App.scriptContext`), assembled from
    those providers plus the stores core builds — the core now treats the context as a dependency
    bundle rather than a shape to inherit. Dropping the `implements` clause is not sufficient on its
    own (TypeScript is structural, so `const ctx: ScriptContext = App` went on compiling); `App`
    therefore exposes no `scriptMetadataStore` getter, which had no readers and was the last member
    holding the match together. The invariant is now enforced by the compiler rather than asserted
    in a doc comment.
  - `ScriptFactory`'s static `create*` shims and `setDefaultContext()` are gone. `App.factory` is a
    factory bound to `App.scriptContext` and replaces every static call site.
  - Provider interfaces lost their `I` prefix (`IFileSystem` → `FileSystem`, and likewise `ILogger`,
    `IPrompt`, `IProgress`).
  - `B6PUri.fromUrl` → `B6PUri.fromString`, which now parses and canonicalizes its argument, so a
    malformed URI throws at the call rather than at some later `.fsPath` access.

- **Authentication is now a bearer token, not a username/password pair.** Core replaced
  `BasicAuthProvider` with `BearerAuthProvider`, which stores one opaque token and sends
  `Authorization: Bearer <token>`. **There is no migration path** — a token cannot be derived from
  stored credentials — so *B6P: Update Credentials* prompts for a token on first use after upgrading.
  *Clear All Persistance* also purges the legacy `basicAuth` secret. `McpServerProvider` holds the
  scheme-agnostic `AuthProvider<AuthParams>`, since it only ever asks for a header value.

  Snapshot history no longer records an author (a bearer token exposes no client-readable identity);
  the field reads `"unknown"`.

- **The project builds and type-checks with TypeScript 7** (`^7.0.2`, the native Go compiler).
  TypeScript 7 no longer pulls every `node_modules/@types` package into global scope, so
  `tsconfig.base.json` requests `types: ["node", "vscode", "mocha"]` explicitly; it also enables
  `noImplicitOverride`.

- **ESLint removed.** `@typescript-eslint` supports `typescript <6.1.0` and crashes outright against
  TypeScript 7, and the config it drove was toothless anyway — every rule was severity `warn` with no
  `--max-warnings`, so `npm run lint` could not fail. The CI `Lint` step is replaced by
  **`Format check`** (`npm run format-check`), which previously was not gated anywhere; net, this is
  more enforcement, not less. Removes `eslint`, `@typescript-eslint/eslint-plugin`,
  `@typescript-eslint/parser` and `eslint.config.mjs`.

### Security

- Raised the `fast-xml-parser` floor to `^5.10.1`, above the range affected by
  [GHSA-8r6m-32jq-jx6q](https://github.com/advisories/GHSA-8r6m-32jq-jx6q) (repeated `DOCTYPE`
  declarations reset entity-expansion limits). Matches the floor b6p-core 0.5.0 set.

### Removed

- `src/test/tests/BasicAuthManager.test.ts`. Every test in it was commented out, and its three local
  imports pointed at `src/main/app/authentication/`, a directory this repo has not had since the
  monorepo split. The scheme it named no longer exists in core either.

## [1.2.2] - 2026-06-24

### Changed

- Extracted from the former `bsjs-push-pull` monorepo into this standalone single-extension
  repository. The vscode-free core was split into
  [`@bluestep-systems/b6p-core`](https://github.com/Bluestep-Systems/b6p-core) and the CLI into
  [`@bluestep-systems/b6p-cli`](https://github.com/Bluestep-Systems/b6p-cli).
- `@bluestep-systems/b6p-core` is now resolved from the **public npm registry** by version (pinned via
  the committed `.npmrc`) and bundled into the `.vsix` by esbuild, instead of a monorepo workspace
  symlink. Self-contained `tsconfig`/eslint/prettier config now live at the repo root.
- Added a PR/push CI validation workflow (`.github/workflows/ci.yml`) on the win/mac matrix alongside the
  existing tag-driven release workflow.

### Fixed

- Bumped `@bluestep-systems/b6p-core` to `0.1.1`, which fixes Windows drive-letter path parsing in
  `DownstairsPathParser` — gitignore detection and root URI resolution now work correctly on Windows.
- Fixed test assertion for downstairs URI conversion to be drive-letter tolerant on Windows.

No change to extension behavior, commands, settings, or installation — it is still distributed as a
`.vsix` via GitHub Releases (no Marketplace).

## [0.0.1] - 2025-08-28

### Added
- Initial release of B6P Extension
- WebDAV integration for BlueStep systems
- Push/Pull functionality for JavaScript files
- Basic authentication management
- Command palette integration
- Sidebar quick commands
- Custom update checking system
  - Automatic update checks every 24 hours
  - Manual update checking via command
  - GitHub releases integration
  - Update notifications with download links
  - Configurable update settings
  - Release notes viewer

### Features
- **Push Script** - Upload JavaScript files to BlueStep systems
- **Pull Script** - Download JavaScript files from BlueStep systems  
- **Push Current** - Upload the currently active file
- **Pull Current** - Download files for the current project
- **Update Credentials** - Manage WebDAV authentication
- **Run Task** - Execute JavaScript code directly
- **Check for Updates** - Manually check for extension updates
- **Report State** - Debug command to show extension state
- **Clear State** - Reset extension state and credentials

### Technical
- TypeScript implementation with strict type checking
- ESBuild for production bundling
- Custom VSIX packaging system
- Private distribution support
- Comprehensive error handling
- VS Code API 1.103.0+ compatibility

## [0.0.12] - 2025-09-10

### Fixed
- Improved error handling
- Fixed UI glitches in the sidebar panel
- Fixed concurrency issues
- Fixed update notification bugs
- Fixed credential storage issues
- Fixed file path handling for different OSes
- Fixed issues with large file uploads/downloads