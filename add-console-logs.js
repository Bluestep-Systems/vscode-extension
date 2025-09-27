#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

/**
 * Adds console.log statements to TypeScript files for debugging load order
 */

const srcDir = './src';
const pattern = path.join(srcDir, '**/*.ts');

function addConsoleLogToFile(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        const fileName = path.basename(filePath, '.ts');

        // Check if first line is already a console.log with this filename
        if (lines.length > 0 && lines[0] === `console.log('${fileName}');`) {
            console.log(`Already has console.log: ${filePath}`);
            return false;
        }

        // Add console.log as first line
        const modifiedContent = `console.log('${fileName}');\n` + content;
        fs.writeFileSync(filePath, modifiedContent, 'utf8');
        console.log(`Added console.log to: ${filePath}`);
        return true;
    } catch (error) {
        console.error(`Error processing ${filePath}:`, error.message);
        return false;
    }
}

function main() {
    console.log('Adding console.log statements to TypeScript files...');

    const files = glob.sync(pattern);
    let addedCount = 0;

    files.forEach(file => {
        if (addConsoleLogToFile(file)) {
            addedCount++;
        }
    });

    console.log(`\nCompleted: Added console.log statements to ${addedCount} files`);
}

if (require.main === module) {
    main();
}

module.exports = { addConsoleLogToFile };