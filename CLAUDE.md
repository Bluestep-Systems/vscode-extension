# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Layout

This is the **single-package VS Code extension** `bsjs-push-pull`, distributed as a `.vsix` via GitHub
Releases (no Marketplace). It depends on [`@bluestep-systems/b6p-core`](https://github.com/Bluestep-Systems/b6p-core)
— the vscode-free core library (WebDAV, sessions, persistence, script tree, types) — resolved from the
public npm registry and **bundled into the `.vsix`** by esbuild. The same core powers the standalone
[`b6p` CLI](https://github.com/Bluestep-Systems/b6p-cli).

This repo holds only the **VS Code layer**: the `App` singleton and command wiring, the VS Code
implementations of the core's provider interfaces (`src/main/providers/`), the command handlers
(`src/main/app/ctrl-p-commands/`), MCP integration, and settings. The orchestrator (`B6PCore`), session
management, persistence, and script-tree logic all live in `@bluestep-systems/b6p-core`.

`b6p-core` is a normal `dependency` (bundled, not externalized — esbuild externalizes only `vscode`).
Imports from the core MUST go through `'@bluestep-systems/b6p-core'`, never relative paths into another
repo. Core-side changes (new exports, shared logic) belong in the `b6p-core` repo, not here.

## Common Development Commands

### Build and Package
```bash
npm run compile          # Type-check + esbuild bundle → dist/extension.js
npm run watch            # Rebuild on change (esbuild --watch)
npm run package-extension # Build the .vsix at the repo root
./build-vsix.sh -h       # See all build options (puts artifacts in releases/)
./build-vsix.sh -r -g -k # Release build with git and clean
```

### Testing
```bash
npm test               # Full test suite (includes pretest compilation)
npm run watch-tests    # Watch mode for test development
npm run pretest        # Compile tests and main code
```

### Code Quality
```bash
npm run check-types    # TypeScript type checking (TypeScript 7 — the native Go compiler)
npm run format        # Format code with Prettier
npm run format-check  # Check formatting (this is the CI gate; ESLint was removed —
                      # @typescript-eslint supports typescript <6.1.0 and crashes on TS 7)
```

## Architecture Overview

This is a **WebDAV-based VS Code extension** (plus a standalone CLI sharing the same core) for syncing JavaScript files with BlueStep systems using a singleton pattern with hierarchical context management.

### Core Components

- **App singleton** (`src/main/app/App.ts`): the VS Code composition root. It **owns** the four provider implementations (core keeps its copies private), initializes services, and registers commands. It exposes `App.fs` / `App.prompt` / `App.logger` / `App.progress`, *holds* a `ScriptContext` as `App.scriptContext`, and exposes `App.factory` — a `ScriptFactory` bound to that context.
- **VS Code providers** (`src/main/providers/`): VS Code implementations of the core's provider interfaces — `VscodeFileSystem`, `VscodeLogger`, `VscodeProgress`, `VscodePrompt` — bundled by the `VscodeProviders` interface. These are injected into `B6PCore` so the core stays vscode-free.
- **Command handlers** (`src/main/app/ctrl-p-commands/`): one file per command (push, pull, audit, snapshot, deploy, etc.)
- **B6PCore** (in `@bluestep-systems/b6p-core`): vscode-free orchestrator shared with the CLI. Since core 0.5.0 the script commands live on a sibling service reached as **`core.script`** (`core.script.push`, `.pull`, `.audit`, `.deploy`, …); `B6PCore` itself keeps credentials, sessions, settings, reporting and updates. Session management, persistence, and the script tree also live in the core package.

### Key Architectural Patterns

**Singleton with Explicit Initialization**:
```typescript
export const MANAGER_NAME = new class extends ContextNode {
  init(parent: ContextNode) { /* ... */ }
}();
```

**Command Registration Flow**:
1. Define in `package.json` contributes.commands
2. Register in `App.ts` disposables map
3. Implementation in `src/main/app/ctrl-p-commands/`

**Multi-Tier Persistence System**:
- `PublicPersistanceMap`: Workspace state for user settings
- `PrivatePersistanceMap`: Secret storage for credentials/sessions (requires async initialization)
- `TypedPersistable`: Type-safe wrappers around persistence maps

**Entry Point Chain**: `src/extension.ts` → `src/main/index.ts` → `lifeCycle.start()` → `App.init()`

### Authentication & Session Management

- **Bearer token** (core 0.5.0+): a single opaque token in secret storage under `bearerAuth`, rendered
  as `Authorization: Bearer <token>`. It replaced basic auth outright — there is no migration from a
  stored username/password, so the user is prompted for a token on first use after upgrading. Reached
  through the scheme-agnostic `AuthProvider<AuthParams>` interface (`App.auth`); never hold the
  concrete provider unless you need scheme-specific members.
- **WebDAV workflow**: Login → CSRF token extraction → Request retry with tokens
- **Custom csrfFetch()** with automatic retry and re-authentication
- **Session cleanup** on 403 responses with progressive retry delays
- **Cookie persistence** via `JSESSIONID` and `INGRESSCOOKIE`

### Error Handling

- Use `util.rethrow()` to propagate errors with context (fights VS Code's stack trace swallowing)
- Automatic session cleanup on authentication failures
- Progressive retry delays: `(MAX_RETRY_ATTEMPTS + 1 - retries) * 1000ms`

## Testing Architecture

### Framework
- **VS Code's official testing framework** with **Mocha** as test runner
- Tests compile from `src/test/` to `out/test/` directory
- Configuration in `.vscode-test.mjs` points to compiled test files

### File System Mocking
VS Code file system APIs are read-only and can't be mocked directly. Solution:
```typescript
// FileSystemFactory provides dependency injection
FileSystemFactory.enableTestMode()       // Switch to mock provider
FileSystemFactory.enableProductionMode() // Switch to real VS Code APIs

// In tests:
mockFileSystemProvider.setMockFile(uri, content)
mockFileSystemProvider.setMockError(uri, error)
```

### Test Categories
- **Integration tests**: `extension.test.ts` - basic extension loading
- **Unit tests**: `ScriptNode.test.ts`, `ScriptRoot.test.ts` - comprehensive business logic testing with mocked file system

## Important Development Guidelines

### Code Requirements
- **Never use `any` type** - use `//HUMAN-REVIEW-NEEDED` comment if truly necessary
- **Strict TypeScript** configuration enforced
- **All persistence** must go through PseudoMaps, never direct VS Code storage APIs
- **Number formatting**: Use underscores for thousands separators (`1_000`, `10_000_000`)

### Documentation Requirements
When making changes, update corresponding documentation:
- **Architecture changes** → Update `.github/copilot-instructions.md`
- **New commands** → Update `package.json` AND `README.md`
- **Authentication/Session logic** → Update `.github/copilot-instructions.md`
- **JSDoc comments** → Must include `@lastreviewed null` flag for AI-generated docs

### Command Implementation Pattern
1. User input collection
2. Authentication handling
3. WebDAV operation execution
4. User feedback via `Alert.info()` (user-facing) or `App.logger.info()` (debugging)

## Configuration and External Dependencies

### TypeScript Configuration
- **Compiler**: TypeScript 7 (`tsc`, the native Go compiler)
- **Target**: ES2022 with Node16 modules
- **Strict mode** enabled with comprehensive null/undefined checking, plus `noImplicitOverride`
- **`types: ["node", "vscode", "mocha"]`** — TypeScript 7 does not pull every `node_modules/@types`
  package into global scope the way 5.x did, so ambient declarations are requested by name. A new
  `@types/*` package whose globals you need must be added to that list.
- **Output**: `./dist` for main code, `./out` for tests

### Key Dependencies
- `@bluestep-systems/b6p-core`: the vscode-free core, bundled into the `.vsix`. It carries its own
  pinned `typescript@5.9.2` as a **runtime** dependency (`ScriptTranspiler` uses the classic compiler
  API, which TypeScript 7 does not expose), nested under its own `node_modules` since the root is on 7.
- `fast-xml-parser`: WebDAV response parsing
- `esbuild`: Production bundling with watch mode
- `@vscode/test-cli` + `@vscode/test-electron`: VS Code testing framework

### VS Code Integration
- **Extension context** managed through ContextNode hierarchy
- **Output channel**: `App.logger` for "B6P" channel
- **Custom sidebar**: B6P Quick Commands with contextual actions
- **Settings**: All prefixed with `bsjs-push-pull.*`

## BlueStep System Integration

### WebDAV Endpoints
- Script push/pull operations via WebDAV
- CSRF workflow: `/csrf-token` → operation with `b6p-csrf-token` header
- Session management through cookies and custom authentication

### Update System
- Custom GitHub releases-based update checker
- Runs 5 seconds after startup, checks every 24 hours
- Configurable via `bsjs-push-pull.updateCheck.*` settings

### Additional Instructions
- Defer to AGENTS.md for additional AI agent usage instructions. If there are any discrepancies, AGENTS.md is authoritative.