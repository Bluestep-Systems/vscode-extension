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

    // Add package.json at root level
    archive.file('package.json', { name: 'extension/package.json' });
    
    // Add other files
    if (fs.existsSync('README.md')) {
      archive.file('README.md', { name: 'extension/README.md' });
    }
    if (fs.existsSync('CHANGELOG.md')) {
      archive.file('CHANGELOG.md', { name: 'extension/CHANGELOG.md' });
    }
    if (fs.existsSync('LICENSE')) {
      archive.file('LICENSE', { name: 'extension/LICENSE' });
    }
    
    // Add dist directory
    if (fs.existsSync('dist')) {
      archive.directory('dist/', 'extension/dist/');
    }
    
    // Add resources
    if (fs.existsSync('src/main/resources')) {
      archive.directory('src/main/resources/', 'extension/src/main/resources/');
    }
    
    // Add only production node_modules (simplified approach)
    if (fs.existsSync('node_modules')) {
      // Copy all node_modules for now - filtering will be done by npm ci --only=production
      archive.directory('node_modules/', 'extension/node_modules/');
    }

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
