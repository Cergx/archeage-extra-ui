const fs = require('fs');
const path = require('path');
const { createZip } = require('./archive');

const projectRoot = path.resolve(__dirname, '..');
const sourceDir = path.join(projectRoot, 'dist', 'firefox');
const packagePath = path.join(projectRoot, 'archeage-extra-ui-firefox.xpi');
const files = ['contentScript.js', 'icon128.png', 'manifest.json', 'pageScript.js'];

const entries = files.map((name) => {
  const filePath = path.join(sourceDir, name);
  if (!fs.existsSync(filePath)) throw new Error(`Firefox build output was not found: ${filePath}`);
  return { name, path: filePath };
});

createZip(packagePath, entries);
console.log(`[package:firefox] ${packagePath}`);
