#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

/**
 * Removes console.log statements added for debugging from TypeScript files
 */

const srcDir = './src';
const pattern = path.join(srcDir, '**/*.ts');

function removeConsoleLogFromFile(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');

        // Check if first line is a console.log with just a filename
        if (lines.length > 0 && lines[0].match(/^console\.log\('[^']+'\);$/)) {
            // Remove the first line
            const modifiedContent = lines.slice(1).join('\n');
            fs.writeFileSync(filePath, modifiedContent, 'utf8');
            console.log(`Removed console.log from: ${filePath}`);
            return true;
        }
        return false;
    } catch (error) {
        console.error(`Error processing ${filePath}:`, error.message);
        return false;
    }
}

function main() {
    console.log('Removing console.log statements from TypeScript files...');

    const files = glob.sync(pattern);
    let removedCount = 0;

    files.forEach(file => {
        if (removeConsoleLogFromFile(file)) {
            removedCount++;
        }
    });

    console.log(`\nCompleted: Removed console.log statements from ${removedCount} files`);
}

if (require.main === module) {
    main();
}

module.exports = { removeConsoleLogFromFile };