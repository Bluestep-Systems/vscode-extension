#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const archiver = require('archiver');

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const extensionName = packageJson.name;
const version = packageJson.version;
const vsixFileName = `${extensionName}-${version}.vsix`;

console.log(`📦 Packaging VS Code extension: ${extensionName} v${version}`);

// Files and directories to include in the package
const filesToInclude = [
  'package.json',
  'README.md',
  'CHANGELOG.md',
  'dist/',
  'src/main/resources/',
  'node_modules/' // Only production dependencies will be included
];

// Files and directories to exclude
const filesToExclude = [
  'node_modules/.bin/',
  'node_modules/@types/',
  'node_modules/typescript/',
  'node_modules/eslint*/',
  'node_modules/@typescript-eslint/',
  'node_modules/@vscode/test*/',
  'node_modules/mocha/',
  'node_modules/esbuild/',
  '.git/',
  '.vscode/',
  'out/',
  'src/',
  '*.ts',
  '*.map',
  'tsconfig.json',
  'eslint.config.mjs',
  'esbuild.js',
  '.gitignore'
];

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

    // Add files and directories
    filesToInclude.forEach(item => {
      if (fs.existsSync(item)) {
        const stats = fs.statSync(item);
        if (stats.isDirectory()) {
          archive.directory(item, item);
        } else {
          archive.file(item, { name: item });
        }
      } else {
        console.log(`⚠️  Skipping missing file/directory: ${item}`);
      }
    });

    archive.finalize();
  });
}

async function main() {
  try {
    // Clean and build
    runCommand('npm run clean || true', 'Cleaning previous builds');
    runCommand('npm run package', 'Building extension for production');

    // Install only production dependencies
    console.log('🔧 Installing production dependencies...');
    runCommand('npm ci --only=production', 'Installing production dependencies');

    // Create the VSIX file
    await createVsix();

    // Reinstall all dependencies for development
    console.log('🔧 Reinstalling all dependencies for development...');
    runCommand('npm ci', 'Reinstalling all dependencies');

    console.log('🎉 Extension packaging completed successfully!');
    console.log(`📁 Package file: ${vsixFileName}`);
    
  } catch (error) {
    console.error('❌ Packaging failed:', error);
    process.exit(1);
  }
}

main();
