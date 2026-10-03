const fs = require('fs');
const path = require('path');
const { createZip, collectFiles } = require('./archive');

const projectRoot = path.resolve(__dirname, '..');
const sourceDir = path.join(projectRoot, 'dist', 'firefox');
const packagePath = path.join(projectRoot, 'archeage-extra-ui-firefox.xpi');
if (!fs.existsSync(path.join(sourceDir, 'manifest.json'))) {
  throw new Error(`Firefox build output was not found: ${sourceDir}`);
}
const entries = collectFiles(sourceDir).map((name) => ({ name, path: path.join(sourceDir, name) }));

createZip(packagePath, entries);
console.log(`[package:firefox] ${packagePath}`);
