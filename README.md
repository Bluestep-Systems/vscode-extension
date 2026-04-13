Welcome to the BlueStep Systems VS Code Extension! 🚀

This repository is an **npm workspaces monorepo** containing three packages:

| Package | Path | Purpose |
| --- | --- | --- |
| `@bluestep-systems/b6p-core` | `packages/b6p-core/` | Vscode-free core library: WebDAV client, sessions, persistence, script tree, types |
| `@bluestep-systems/b6p-cli` | `packages/b6p-cli/` | Standalone `b6p` command-line tool — usable in any Node environment, Claude Code sessions, CI |
| `bsjs-push-pull` | `packages/b6p-vscode/` | The VS Code extension published to the Marketplace |

The CLI and the extension are independent shipping artifacts that share the same core library.

## Installing the CLI

> **Note:** The CLI is not yet published to npm. Until then, install from a source checkout:
>
> ```bash
> git clone https://github.com/bluestep-systems/vscode-extension
> cd vscode-extension
> npm install
> npm run compile
> cd packages/b6p-cli
> npm link    # adds `b6p` to your PATH
> b6p --help
> ```

## Installing the VS Code extension

Install from the VS Code Marketplace as `bsjs-push-pull`, or build a `.vsix` locally with `./build-vsix.sh`.

## Users
Please refer to the [SETUP.md](SETUP.md) for setup instructions and configuration.

## Contributors
Please refer to the [DEVELOPER_README.md](DEVELOPER_README.md) for detailed information on development and testing.

### Common dev commands

```bash
npm install                     # installs all three workspaces
npm run compile                 # builds core → cli → extension
npm run watch                   # parallel watch across all three
npm test                        # runs the extension test suite (153 tests as of writing)
npm run package-extension       # builds the .vsix into packages/b6p-vscode/
./build-vsix.sh                 # full release flow → releases/bsjs-push-pull-X.Y.Z.vsix
```

### Follow-ups (out of scope for the initial split)
- Publish `@bluestep-systems/b6p-core` and `@bluestep-systems/b6p-cli` to npm
- Extract pure-core tests into a `packages/b6p-core/test/` mocha suite that runs without the VS Code electron harness
