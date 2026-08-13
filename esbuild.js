const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

const problemMatcher = {
  name: 'esbuild-problem-matcher',
  setup(build) {
    build.onStart(() => console.log('[watch] build started'));
    build.onEnd((result) => {
      result.errors.forEach(({ text, location }) => {
        console.error(`✘ [ERROR] ${text}`);
        if (location) {
          console.error(`    ${location.file}:${location.line}:${location.column}:`);
        }
      });
      console.log('[watch] build finished');
    });
  },
};

// Ship TypeScript's standard library declarations next to the bundle so the core's
// snapshot-push compile can resolve them. Once b6p-core is bundled into
// dist/extension.js, TypeScript's default host looks for lib.*.d.ts relative to
// __filename — i.e. inside dist/, where none exist — and the transpile reports
// "Cannot find global type 'Array'" for every file. `App` hands the copied
// directory to the core as providers.typescriptLibDirs (see src/main/app/services/tsLibs.ts).
//
// These libs must match the compiler that READS them, which is the TypeScript esbuild
// bundled into dist/extension.js — b6p-core's own exact-pinned `typescript`, NOT this
// package's devDependency. The two are deliberately different majors: we type-check with
// TS 7 while core still transpiles with TS 5.9, so resolving from the repo root would
// ship TS 7 lib.*.d.ts (there are none) to a TS 5 compiler. Resolve from core's directory
// so the libs always track the bundled compiler. Ported from b6p-cli's esbuild.js.
const copyTsLibs = {
  name: 'copy-ts-libs',
  setup(build) {
    build.onEnd((result) => {
      // A failed build leaves no bundle to check against; don't mask its errors.
      if (result.errors.length > 0) {
        return;
      }
      // require.resolve('typescript') → <pkg>/lib/typescript.js, so its dirname is the
      // lib dir. Resolved from core's own location so it finds core's nested copy when
      // npm can't dedupe it to the root. No hard-coded path.
      const coreDir = path.dirname(require.resolve('@bluestep-systems/b6p-core/package.json'));
      const tsLibDir = path.dirname(require.resolve('typescript', { paths: [coreDir] }));
      const destDir = path.join('dist', 'lib');
      // Rebuild from scratch so a TypeScript upgrade can't leave stale (removed or
      // renamed) lib.*.d.ts behind to be shipped.
      fs.rmSync(destDir, { recursive: true, force: true });
      fs.mkdirSync(destDir, { recursive: true });
      let copied = 0;
      for (const file of fs.readdirSync(tsLibDir)) {
        if (file.startsWith('lib.') && file.endsWith('.d.ts')) {
          fs.copyFileSync(path.join(tsLibDir, file), path.join(destDir, file));
          copied++;
        }
      }
      if (copied === 0) {
        throw new Error(`copy-ts-libs: no lib.*.d.ts found in ${tsLibDir}`);
      }

      // Assert the libs we just shipped belong to the compiler that actually got bundled.
      // Both are meant to be core's TypeScript, but nothing else forces that — resolving
      // from the repo root instead looks like a harmless tidy-up, and today it fails
      // loudly only because TS 7 ships no lib.*.d.ts at all. Once core moves to TS 7 that
      // accident disappears and a mismatch would ship silently. Cheap end-to-end check:
      // the bundled compiler embeds its own version string.
      const tsVersion = require(path.join(tsLibDir, '..', 'package.json')).version;
      const bundle = fs.readFileSync('dist/extension.js', 'utf8');
      if (!bundle.includes(`"${tsVersion}"`)) {
        throw new Error(
          `copy-ts-libs: shipped lib.*.d.ts came from TypeScript ${tsVersion}, but dist/extension.js ` +
            `does not embed that version — the bundled compiler and its standard library have ` +
            `diverged. Both must resolve from b6p-core (${coreDir}).`
        );
      }
      console.log(`[copy-ts-libs] shipped ${copied} lib.*.d.ts from TypeScript ${tsVersion}`);
    });
  },
};

async function main() {
  const ctx = await esbuild.context({
    entryPoints: ['src/extension.ts'],
    bundle: true,
    format: 'cjs',
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    platform: 'node',
    outfile: 'dist/extension.js',
    // Only `vscode` is provided by the host. Everything else (including the public-npm
    // dependency @bluestep-systems/b6p-core) gets bundled into the .vsix.
    external: ['vscode'],
    logLevel: 'silent',
    // copyTsLibs runs after problemMatcher so a failed build reports its errors first.
    plugins: [problemMatcher, copyTsLibs],
  });

  if (watch) {
    await ctx.watch();
  } else {
    await ctx.rebuild();
    await ctx.dispose();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
