# Releasing

The B6P toolchain lives in three independent repositories that share one core library:

| Repo | npm package | Released by | Distribution |
| --- | --- | --- | --- |
| [`b6p-core`](https://github.com/Bluestep-Systems/b6p-core) | `@bluestep-systems/b6p-core` | tag `v*.*.*` → `publish.yml` | public npm |
| [`b6p-cli`](https://github.com/Bluestep-Systems/b6p-cli) | `@bluestep-systems/b6p-cli` | tag `v*.*.*` → `publish.yml` | public npm |
| [`vscode-extension`](https://github.com/Bluestep-Systems/vscode-extension) | `bsjs-push-pull` (extension) | tag `v*.*.*` → `release.yml` | `.vsix` via GitHub Release |

Both downstream repos depend on `@bluestep-systems/b6p-core` and **bundle it at build time** (esbuild):
the CLI as a `devDependency`, the extension as a `dependency`. Neither resolves core at runtime — it is
baked into `dist/cli.js` / the `.vsix`. So the build of either downstream needs the intended core version
already published to npm.

## Ordering (when core changes)

Release in dependency order. Skip step 1–2 if you are only releasing a downstream repo and core is
unchanged.

1. **Publish `b6p-core` first.**
   - Bump the version in `b6p-core/package.json` and update its `CHANGELOG.md`.
   - Commit, then tag and push: `git tag vX.Y.Z && git push origin vX.Y.Z`.
   - `publish.yml` validates and runs `npm publish --provenance --access public` (auth via the repo's
     `NPM_TOKEN` secret, provenance via `id-token: write`).
   - Verify it is live before continuing:
     ```bash
     npm view @bluestep-systems/b6p-core version --registry=https://registry.npmjs.org
     ```

2. **Bump the core dependency in the downstream repos.**
   - In `b6p-cli/package.json` (devDependency) and `vscode-extension/package.json` (dependency), set
     `@bluestep-systems/b6p-core` to the newly published version.
   - Run `npm install` in each to refresh its `package-lock.json`, then commit the lockfile with the bump.
   - **Caret on 0.x:** `^0.1.0` only allows `0.1.x`. A core **minor** bump (e.g. `0.2.0`) requires
     widening the range in both downstreams — a plain `npm install` will not pick it up otherwise.

3. **Release `b6p-cli`.**
   - Bump `b6p-cli/package.json`, update its `CHANGELOG.md`, commit.
   - Tag and push `vX.Y.Z`; `publish.yml` validates and runs `npm publish --provenance --access public`.
   - Smoke check: `npm i -g @bluestep-systems/b6p-cli && b6p --help`.

4. **Release `vscode-extension`.**
   - Bump the extension version (`updateversion.js` / `./build-vsix.sh -r`, or edit `package.json`), update
     `CHANGELOG.md`, commit.
   - Tag and push `vX.Y.Z`; `release.yml` builds the `.vsix` and attaches it (plus checksum) to a GitHub
     Release. Installation is unchanged for end users: download the `.vsix` from the Release (no Marketplace).

## Prerequisites (one-time)

- `NPM_TOKEN` repo secret (npm automation token with publish rights to `@bluestep-systems`) must exist in
  **both** `b6p-core` and `b6p-cli` for their `publish.yml` to authenticate.
- Each repo commits an `.npmrc` pinning `@bluestep-systems` to `https://registry.npmjs.org`, so installs
  and publishes never route to GitHub Packages.

## Local bring-up before a core version is on npm

If you need to build a downstream against an unpublished core (e.g. local development), use
`npm link @bluestep-systems/b6p-core` or a temporary `file:` dependency, and revert it before tagging a
release. Released builds must resolve core from public npm.
