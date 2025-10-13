const fs = require('fs');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const tmpVersion = packageJson.version.split(".");
tmpVersion[2] = parseInt(tmpVersion[2]) + 1;
const version = tmpVersion.join(".");
packageJson.version = version;
fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2));

// Output the new version to stdout for the build script to capture
console.log(version);