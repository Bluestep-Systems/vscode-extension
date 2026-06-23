# B6P — BlueStep VS Code Extension

The **B6P Push/Pull** VS Code extension (`bsjs-push-pull`) syncs JavaScript files with
[BlueStep](https://www.bluestep.net/) systems over WebDAV: pull components from the platform into
your workspace, push changes back, audit local vs. server, snapshot history, and deploy.

This repository is the **VS Code extension only**. It depends on
[`@bluestep-systems/b6p-core`](https://github.com/Bluestep-Systems/b6p-core) — the vscode-free core
library (WebDAV client, sessions, persistence, script tree, types) — which is resolved from the public
npm registry and **bundled into the `.vsix`** at build time. The same core powers the standalone
[`b6p` CLI](https://github.com/Bluestep-Systems/b6p-cli).

## Installing the extension

The extension is distributed as a `.vsix` attached to each [GitHub Release](https://github.com/Bluestep-Systems/b6p-vscode/releases) — it is **not** on the VS Code Marketplace.

1. Download the latest `bsjs-push-pull-X.Y.Z.vsix` from the Releases page.
2. In VS Code, open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`).
3. Run **"Extensions: Install from VSIX…"** and select the downloaded file.

To build a `.vsix` yourself, see [DEVELOPER_README.md](DEVELOPER_README.md) and `./build-vsix.sh`.

## Users

Please refer to [SETUP.md](SETUP.md) for setup instructions and configuration.

## Contributors

Please refer to [DEVELOPER_README.md](DEVELOPER_README.md) for detailed development and testing information.

### Common dev commands

```bash
npm install                # install dependencies (b6p-core from public npm)
npm run compile            # type-check + esbuild bundle → dist/extension.js
npm run watch              # rebuild on change
npm test                   # full extension test suite
npm run check-types        # tsc --noEmit
npm run lint               # eslint
npm run format             # prettier --write
npm run package-extension  # build the .vsix at the repo root
./build-vsix.sh            # full release flow → releases/bsjs-push-pull-X.Y.Z.vsix
```

> The `@bluestep-systems` scope is pinned to the public npm registry via the committed `.npmrc`, so
> `npm install` needs no authentication.

## Related repositories

| Repo | npm | Purpose |
| --- | --- | --- |
| [`b6p-core`](https://github.com/Bluestep-Systems/b6p-core) | `@bluestep-systems/b6p-core` | Shared vscode-free core library |
| [`b6p-cli`](https://github.com/Bluestep-Systems/b6p-cli) | `@bluestep-systems/b6p-cli` | Standalone `b6p` command-line tool |

## License

MIT
