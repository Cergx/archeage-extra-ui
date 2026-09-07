const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const sourceDir = path.join(projectRoot, 'dist', 'chrome');
const targetDir = path.join(projectRoot, 'dist', 'firefox');
const meta = JSON.parse(fs.readFileSync(path.join(projectRoot, 'src', 'meta.json'), 'utf8'));

for (const file of ['contentScript.js', 'pageScript.js', 'icon128.png']) {
  const source = path.join(sourceDir, file);
  if (!fs.existsSync(source)) throw new Error(`Chrome build artifact is missing: ${source}`);
  fs.mkdirSync(targetDir, { recursive: true });
  fs.copyFileSync(source, path.join(targetDir, file));
}

const manifest = {
  manifest_version: 3,
  name: meta.name,
  version: meta.version,
  description: meta.description,
  icons: { '128': 'icon128.png' },
  action: {
    default_title: meta.name,
    default_icon: { '128': 'icon128.png' },
  },
  browser_specific_settings: {
    gecko: {
      id: 'archeage-extra-ui@cergx',
      strict_min_version: '128.0',
      data_collection_permissions: {
        required: ['none'],
      },
    },
  },
  content_scripts: [{
    matches: meta.matches,
    js: ['pageScript.js'],
    run_at: 'document_start',
    world: 'MAIN',
  }, {
    matches: meta.matches,
    js: ['contentScript.js'],
    run_at: 'document_start',
  }],
};

fs.writeFileSync(path.join(targetDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`[build:firefox] ${targetDir}`);
