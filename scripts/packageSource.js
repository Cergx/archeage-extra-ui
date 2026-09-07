const fs = require('fs');
const path = require('path');
const { createZip, collectFiles } = require('./archive');

const projectRoot = path.resolve(__dirname, '..');
const packagePath = path.join(projectRoot, 'archeage-extra-ui-source.zip');
const sourceItems = [
  'src', 'scripts', 'build.js', 'package.json', 'package-lock.json', 'tsconfig.json',
  'README.md', 'PRIVACY_POLICY.md', 'LICENSE',
];

const entries = sourceItems.flatMap((item) => {
  const itemPath = path.join(projectRoot, item);
  if (!fs.existsSync(itemPath)) throw new Error(`Source archive is missing required file: ${itemPath}`);
  if (!fs.statSync(itemPath).isDirectory()) return [{ name: item, path: itemPath }];
  return collectFiles(projectRoot, item).map((name) => ({ name, path: path.join(projectRoot, name) }));
});

createZip(packagePath, entries);
console.log(`[package:source] ${packagePath}`);
