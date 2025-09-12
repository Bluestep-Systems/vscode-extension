# VS Code Extension Development Guide

## Architecture Overview

This is a **WebDAV-based VS Code extension** for syncing JavaScript files with BlueStep systems. The architecture uses a singleton pattern with hierarchical context management.

### Core Components

- **App singleton** (`src/main/app/App.ts`): Root context manager that initializes all services and command registration
- **SessionManager** (`src/main/app/b6p_session/SessionManager.ts`): Handles authentication, CSRF tokens, and HTTP session management for BlueStep servers
- **ContextNode pattern** (`src/main/app/context/ContextNode.ts`): Base class for all components requiring VS Code context and persistence

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
- Tests in `src/test/` directory (e.g., `extension.test.ts`, `RemoteScriptFile.test.ts`)
- `npm run pretest` builds and lints before testing
- Test framework: Mocha with VS Code's built-in test runner
- **Mocking limitations**: VS Code file system APIs are read-only and cannot be directly mocked
- Focus tests on logic that doesn't require file system operations, or use integration tests

### Extension Development
- Entry point: `src/extension.ts` → `src/main/index.ts` → `lifeCycle.start()`
- Commands must be registered in both `package.json` contributes AND `App.ts` disposables
- All persistence goes through PseudoMaps - never direct VS Code storage APIs

## Critical Conventions

### Authentication & Sessions
- **BasicAuthManager**: Singleton managing credentials per "flag" (authentication profile)
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
- Commands in `src/main/app/ctrl-p-commands/scripts/`
- Follow pattern: user input → authentication → WebDAV operation → user feedback
- Use `Alert.info()` for user notifications, `App.logger.info()` for debugging

### Update System
- Custom GitHub releases-based update checker (`src/main/app/services/UpdateChecker.ts`)
- Runs 5 seconds after startup, checks every 24 hours
- Configured via `bsjs-push-pull.updateCheck.*` settings

## Integration Points

### VS Code APIs
- Extension context managed through ContextNode hierarchy
- Output channel: `App.logger` for "B6P" channel
- Commands, settings, and views all defined in `package.json` contributes

### External Dependencies
- `fast-xml-parser`: WebDAV response parsing
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