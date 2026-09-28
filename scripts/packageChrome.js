const fs = require('fs');
const path = require('path');
const { createZip, collectFiles } = require('./archive');

const projectRoot = path.resolve(__dirname, '..');
const sourceDir = path.join(projectRoot, 'dist', 'chrome');
const packagePath = path.join(projectRoot, 'chrome-extension.zip');

if (!fs.existsSync(path.join(sourceDir, 'manifest.json'))) {
  throw new Error(`Chrome build output was not found: ${sourceDir}`);
}

const entries = collectFiles(sourceDir)
  .map((name) => ({ name, path: path.join(sourceDir, name) }));

createZip(packagePath, entries);
console.log(`[package:chrome] ${packagePath}`);
