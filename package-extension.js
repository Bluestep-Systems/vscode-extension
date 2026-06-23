#!/usr/bin/env node
/**
 * Build a .vsix archive for the bsjs-push-pull VS Code extension.
 *
 * Because esbuild bundles every runtime dep (including @bluestep-systems/b6p-core)
 * into dist/extension.js, the .vsix only needs to ship: package.json, dist/, and
 * src/main/resources/. No node_modules dance required.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const archiver = require('archiver');

const cwd = path.resolve(__dirname);
process.chdir(cwd);

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const extensionName = packageJson.name;
const version = packageJson.version;
const vsixFileName = `${extensionName}-${version}.vsix`;

console.log(`📦 Packaging VS Code extension: ${extensionName} v${version}`);

function runCommand(command, description) {
  console.log(`🔧 ${description}...`);
  try {
    execSync(command, { stdio: 'inherit' });
    console.log(`✅ ${description} completed`);
  } catch (error) {
    console.error(`❌ ${description} failed:`, error.message);
    process.exit(1);
  }
}

function createVsix() {
  return new Promise((resolve, reject) => {
    console.log(`🗂️  Creating VSIX file: ${vsixFileName}...`);

    const output = fs.createWriteStream(vsixFileName);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
      console.log(`✅ VSIX file created: ${vsixFileName} (${archive.pointer()} bytes)`);
      resolve();
    });

    archive.on('error', (err) => {
      console.error('❌ Error creating VSIX:', err);
      reject(err);
    });

    archive.pipe(output);

    // package.json at the extension root
    archive.file('package.json', { name: 'extension/package.json' });

    // Optional doc files (README/CHANGELOG/LICENSE) — pulled from the repo root
    // since they're not duplicated into each workspace.
    const repoRoot = path.resolve(cwd, '..', '..');
    for (const docName of ['README.md', 'CHANGELOG.md', 'LICENSE']) {
      const local = path.join(cwd, docName);
      const root = path.join(repoRoot, docName);
      if (fs.existsSync(local)) {
        archive.file(local, { name: `extension/${docName}` });
      } else if (fs.existsSync(root)) {
        archive.file(root, { name: `extension/${docName}` });
      }
    }

    // Bundled JS — esbuild has already inlined every runtime dep, including
    // @bluestep-systems/b6p-core, so this directory is the entire payload.
    if (fs.existsSync('dist')) {
      archive.directory('dist/', 'extension/dist/');
    } else {
      console.error('⚠️  WARNING: dist directory not found!');
    }

    // Static resources referenced by package.json (icons, etc.)
    if (fs.existsSync('src/main/resources')) {
      archive.directory('src/main/resources/', 'extension/src/main/resources/');
    }

    archive.finalize();
  });
}

async function main() {
  try {
    runCommand('npm run clean', 'Cleaning previous builds');
    runCommand('npm run package', 'Building extension for production');

    if (!fs.existsSync('dist/extension.js')) {
      console.error('❌ dist/extension.js missing after build!');
      process.exit(1);
    }

    await createVsix();

    console.log('🎉 Extension packaging completed successfully!');
    console.log(`📁 Package file: ${vsixFileName}`);
  } catch (error) {
    console.error('❌ Packaging failed:', error);
    process.exit(1);
  }
}

main();
