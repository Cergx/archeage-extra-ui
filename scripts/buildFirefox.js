const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const sourceDir = path.join(projectRoot, 'dist', 'chrome');
const targetDir = path.join(projectRoot, 'dist', 'firefox');
fs.rmSync(targetDir, { recursive: true, force: true });
fs.mkdirSync(targetDir, { recursive: true });
for (const file of require('./archive').collectFiles(sourceDir).filter(name => name !== 'manifest.json')) {
  const source = path.join(sourceDir, file);
  const target = path.join(targetDir, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

const manifest = JSON.parse(fs.readFileSync(path.join(sourceDir, 'manifest.json'), 'utf8'));
manifest.browser_specific_settings = {
  gecko: {
    id: 'archeage-extra-ui@cergx',
    strict_min_version: '128.0',
    data_collection_permissions: { required: ['none'] },
  },
};

fs.writeFileSync(path.join(targetDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`[build:firefox] ${targetDir}`);
