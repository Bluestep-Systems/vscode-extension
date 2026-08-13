# VS Code Extension Development Guide

## OVERRIDING DIRECTIVE

AI agents must follow the guidelines in `AGENTS.md` when making changes to this codebase; if there is any conflict between this document and `AGENTS.md`, the latter takes precedence.

## Architecture Overview

This is a **WebDAV-based VS Code extension** for syncing JavaScript files with BlueStep systems. The architecture uses a singleton pattern with hierarchical context management.

This repository is the **VS Code layer only**. The vscode-free engine — `B6PCore`, `SessionManager`, `ContextNode`, persistence, and the script tree — lives in [`@bluestep-systems/b6p-core`](https://github.com/Bluestep-Systems/b6p-core), a public-npm dependency that esbuild **bundles into the `.vsix`** (only `vscode` is externalized). Code in `src/` adapts that core to VS Code; import core symbols via `'@bluestep-systems/b6p-core'`, never relative paths.

### Core Components

- **App singleton** (`src/main/app/App.ts`): the composition root. It initializes all services and command registration, and **owns** the provider implementations — `B6PCore` keeps its copies private since core 0.5.0, so `App.fs` / `App.prompt` / `App.logger` / `App.progress` are the only way to reach them
- **VS Code providers** (`src/main/providers/`): VS Code implementations of the core's provider interfaces — `VscodeFileSystem`, `VscodeLogger`, `VscodeProgress`, `VscodePrompt` — bundled as `VscodeProviders` and injected into `B6PCore`
- **`App.scriptContext` / `App.factory`**: the script subsystem's dependency bundle (held, never implemented) and a `ScriptFactory` bound to it. Core 0.5.0 removed `ScriptFactory`'s static `create*` shims and the process-global default context, so **every** node/file/folder/root construction goes through `App.factory`
- **Command handlers** (`src/main/app/ctrl-p-commands/`): one file per command palette action. Script operations call `App.core.script.*` (`push`, `pull`, `audit`, `auditPull`, `deploy`, …), not `App.core.*`
- **SessionManager / ContextNode** (in `@bluestep-systems/b6p-core`): authentication, CSRF tokens, HTTP session management, and the base class for components requiring context and persistence

### Key Patterns

**Singleton Architecture**: Most managers are singletons with explicit initialization:
```typescript
export const MANAGER_NAME = new class extends ContextNode {
  init(parent: ContextNode) { /* ... */ }
}();
```

**Command Registration**: All commands are registered in `App.ts` disposables map, pointing to `ctrl-p-commands/` scripts.

**Persistence Strategy**: Two-tier storage system using custom PseudoMaps:
- `PublicPersistanceMap`: Workspace state for user settings
- `PrivatePersistanceMap`: Secret storage for credentials/sessions (async initialization)

## Development Workflows

### Build & Watch
```bash
npm run watch          # Parallel TypeScript + esbuild watching
npm run package        # Production build
npm run package-extension  # Create .vsix package
```

### Deployment
```bash
./build-vsix.sh -h         # see all build options
./build-vsix.sh -r -g -k   # (release, git, klean) 
```

### Testing
- Use VS Code's "Run Test Environment" from Run panel
- Tests in `src/test/tests/` directory (e.g., `extension.test.ts`, `ScriptNode.test.ts`, `ScriptRoot.test.ts`)
- `npm run pretest` compiles the tests and the main bundle before testing
- Test framework: Mocha with VS Code's built-in test runner
- **Mocking limitations**: VS Code file system APIs are read-only and cannot be directly mocked
- Focus tests on logic that doesn't require file system operations, or use integration tests

### Extension Development
- Entry point: `src/extension.ts` → `src/main/index.ts` → `lifeCycle.start()`
- Commands must be registered in both `package.json` contributes AND `App.ts` disposables
- All persistence goes through PseudoMaps - never direct VS Code storage APIs

## Critical Conventions

### Authentication & Sessions
- **BearerAuthProvider** (in core, 0.5.0+): holds one opaque bearer token in secret storage under
  `bearerAuth` and renders `Authorization: Bearer <token>`. It replaced the old basic-auth pair with
  no migration path, so the user is prompted for a token on first use after the upgrade. Reach it as
  `App.auth`, typed `AuthProvider<AuthParams>` — scheme-agnostic on purpose; core drives the whole
  credential lifecycle (`getOrCreate` / `createNew` / `update` / `clear` / `hasCredentials`) through
  that interface and never inspects the credentials themselves
- **SessionManager**: Handles WebDAV authentication, CSRF token management, and cookie persistence
- Session flow: Login → CSRF token extraction → Request retry with tokens
- Custom `csrfFetch()` with automatic retry and re-authentication

### Error Handling
- Automatic session cleanup on 403 responses
- Progressive retry delays: `(MAX_RETRY_ATTEMPTS + 1 - retries) * 1000ms`

### State Management
- All state persisted through ContextNode hierarchy
- Settings use workspace state, secrets use VS Code secrets API
- Async initialization required for private persistence - check `isInitialized()`

### Command Implementation
- Commands in `src/main/app/ctrl-p-commands/`
- Follow pattern: user input → authentication → WebDAV operation → user feedback
- Use `Alert.info()` for user notifications, `App.logger.info()` for debugging

### Update System
- Custom GitHub releases-based update checking. The check logic (`UpdateService`) is in `@bluestep-systems/b6p-core`; the VS Code notification UI is in `src/main/app/services/UpdateUI.ts`
- Runs 5 seconds after startup, checks every 24 hours
- Configured via `bsjs-push-pull.updateCheck.*` settings

## Integration Points

### VS Code APIs
- Extension context managed through ContextNode hierarchy
- Output channel: `App.logger` for "B6P" channel
- Commands, settings, and views all defined in `package.json` contributes

### External Dependencies
- `@bluestep-systems/b6p-core` (`^0.5.0`): the vscode-free engine, from public npm, bundled into the
  `.vsix`. It ships its own pinned `typescript@5.9.2` as a **runtime** dependency — `ScriptTranspiler`
  drives the classic compiler API, which TypeScript 7 does not expose — nested under its own
  `node_modules` because this repo's root TypeScript is 7.x
- `fast-xml-parser` (`^5.10.1`): WebDAV response parsing. The floor is above
  [GHSA-8r6m-32jq-jx6q](https://github.com/advisories/GHSA-8r6m-32jq-jx6q); do not lower it
- `typescript` (`^7.0.2`, dev): type-checks and compiles the tests. No ESLint — `@typescript-eslint`
  supports `typescript <6.1.0` and crashes on 7; Prettier's `format-check` is the CI style gate
- esbuild: Production bundling with watch mode
- Built-in fetch for HTTP requests (no external HTTP library)

### BlueStep Integration
- WebDAV endpoints for script push/pull operations
- CSRF token workflow: `/csrf-token` → operation with `b6p-csrf-token` header
- Session management via `JSESSIONID` and `INGRESSCOOKIE` cookies

## Common Patterns

**Initialization Chain**: `extension.ts` → `main/index.ts` → `lifeCycle.start()` → `App.init()` → service initialization

**Error Recovery**: Failed requests trigger session cleanup → re-authentication → retry with exponential backoff

**Persistence Access**: Always use `this.persistence()` in ContextNode subclasses, never direct storage APIs

**Async Operations**: Use `App.logger` for progress logging, `Alert.info()` for user-facing messages

**Rethrow Utility**: Use `util.rethrow()` to propagate errors with context. We are fighting against the fact that vscode swallows stack traces in some async scenarios and does not appear to properly log them. This is possibly due to how the logging is set up in the extension host; and this comment may be neccessary to remove later.

