const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');
const sass = require('sass');

const isProd = process.argv.includes('--prod');
const isWatch = process.argv.includes('--watch');
const root = __dirname;
const sourceRoot = path.join(root, 'src');
const extensionDir = path.join(root, 'dist', 'chrome');
const modulesDir = path.join(extensionDir, 'modules');
const meta = JSON.parse(fs.readFileSync(path.join(sourceRoot, 'meta.json'), 'utf8'));

const entries = {
  archeage: 'pages/archeage/index.ts',
  gisaa: 'pages/gisaa/index.ts',
  cart: 'pages/cart/index.ts',
  itemRestore: 'pages/itemRestore/index.ts',
  marathon: 'pages/marathon/index.ts',
};

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const filePath = path.join(dir, entry.name);
  return entry.isDirectory() ? walk(filePath) : [filePath];
});

let sourceModules = [];
let entryStyles = {};
const importsOf = (source) => [...source.matchAll(/\b(?:import|export)\s+(?:[^'";]*?\s+from\s*)?['"]([^'"]+)['"]/g)].map((match) => match[1]);

function resolveSourceModule(importer, specifier) {
  if (!specifier.startsWith('.')) return null;
  let candidate = path.resolve(path.dirname(importer), specifier);
  if (candidate.endsWith(`${path.sep}adapter${path.sep}env.js`)) {
    candidate = path.join(sourceRoot, 'adapter', 'env.chrome.ts');
  } else if (candidate.endsWith('.js')) {
    const tsCandidate = candidate.slice(0, -3) + '.ts';
    if (fs.existsSync(tsCandidate)) candidate = tsCandidate;
  }
  return fs.existsSync(candidate) && /\.[jt]sx?$/.test(candidate) ? candidate : null;
}

function collectStyles(entryFile) {
  const visited = new Set();
  const styles = new Set();
  const visit = (filePath) => {
    if (visited.has(filePath)) return;
    visited.add(filePath);
    const source = fs.readFileSync(filePath, 'utf8');
    for (const specifier of importsOf(source)) {
      if (!specifier.startsWith('.')) continue;
      const resolved = path.resolve(path.dirname(filePath), specifier);
      if (resolved.endsWith('.scss') && fs.existsSync(resolved)) {
        styles.add(resolved);
      } else {
        const dependency = resolveSourceModule(filePath, specifier);
        if (dependency) visit(dependency);
      }
    }
  };
  visit(entryFile);
  return [...styles];
}

function emittedStylePath(sourcePath) {
  return `modules/${path.relative(sourceRoot, sourcePath).replace(/\\/g, '/').replace(/\.scss$/, '.css')}`;
}

function emittedModulePath(sourcePath) {
  return `modules/${path.relative(sourceRoot, sourcePath).replace(/\\/g, '/').replace(/\.[jt]sx?$/, '.js')}`;
}

async function emitPageScripts() {
  await Promise.all(sourceModules.map(async (sourcePath) => {
    const options = { format: 'esm', target: ['es2020'], charset: 'utf8', legalComments: 'none' };
    const result = await esbuild.transform(fs.readFileSync(sourcePath, 'utf8'), {
      ...options,
      loader: path.extname(sourcePath).slice(1),
    });
    // Styles come from manifest CSS; image bytes stay in assets. Process asset
    // imports after TS parsing so type imports and comments cannot be mistaken
    // for runtime dependencies.
    let code = result.code.replace(/^import\s+([\w$]+)\s+from\s+["']([^"']+\.(?:scss|png))["'];$/gm, (_, name, specifier) => {
      const asset = path.resolve(path.dirname(sourcePath), specifier);
      if (!fs.existsSync(asset)) throw new Error(`Missing asset ${specifier} in ${path.relative(sourceRoot, sourcePath)}`);
      if (specifier.endsWith('.scss')) return `const ${name} = "";`;
      const assetPath = `assets/${path.relative(sourceRoot, asset).replace(/\\/g, '/')}`;
      return `const ${name} = (typeof browser !== 'undefined' ? browser : chrome).runtime.getURL(${JSON.stringify(assetPath)});`;
    }).replace(/^import\s+["'][^"']+\.scss["'];$/gm, '');

    code = code.replace(/(\b(?:import|export)\s+(?:[^'";]*?\s+from\s*)?)(['"])([^'"]+)\2/g, (statement, prefix, quote, specifier) => {
      const dependency = resolveSourceModule(sourcePath, specifier);
      if (!dependency) throw new Error(`Unresolved module ${specifier} in ${path.relative(sourceRoot, sourcePath)}`);
      let relative = path.relative(path.dirname(emittedModulePath(sourcePath)), emittedModulePath(dependency)).replace(/\\/g, '/');
      if (!relative.startsWith('.')) relative = `./${relative}`;
      return `${prefix}${quote}${relative}${quote}`;
    });
    code = (await esbuild.transform(code, { ...options, loader: 'js', minify: true })).code;
    const outputPath = path.join(extensionDir, emittedModulePath(sourcePath));
    await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.promises.writeFile(outputPath, code);
  }));
}

async function emitStylesAndAssets() {
  const importedStyles = new Set(Object.values(entryStyles).flat());
  for (const sourcePath of importedStyles) {
    // Manifest CSS is inserted before the site's stylesheets. A shared :root
    // scope makes extension overrides win equal site selectors while keeping
    // hover/modifier precedence and stylesheet order within the extension.
    const result = sass.compileString(`
      @use "sass:meta";
      :root { @include meta.load-css(${JSON.stringify(path.basename(sourcePath))}); }
    `, {
      loadPaths: [path.dirname(sourcePath)],
      style: 'compressed',
    });
    const outputPath = path.join(extensionDir, emittedStylePath(sourcePath));
    await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.promises.writeFile(outputPath, result.css.replace(/^\uFEFF/, ''));
  }

  const importedImages = new Set();
  for (const modulePath of sourceModules) {
    for (const specifier of importsOf(fs.readFileSync(modulePath, 'utf8'))) {
      if (!specifier.startsWith('.') || !specifier.endsWith('.png')) continue;
      const sourcePath = path.resolve(path.dirname(modulePath), specifier);
      if (fs.existsSync(sourcePath)) importedImages.add(sourcePath);
    }
  }
  for (const sourcePath of importedImages) {
    const relativePath = path.relative(sourceRoot, sourcePath).replace(/\\/g, '/');
    const assetPath = `assets/${relativePath}`;
    const targetPath = path.join(extensionDir, assetPath);
    await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.promises.copyFile(sourcePath, targetPath);
  }
}

function writeManifest() {
  const pageEntries = [
    { entry: 'archeage', matches: ['*://archeage.ru/*', '*://*.archeage.ru/*'], exclude_matches: ['*://archeage.ru/cart*', '*://archeage.ru/itemrestore*', '*://archeage.ru/promo/marathon*', '*://*.archeage.ru/cart*', '*://*.archeage.ru/itemrestore*', '*://*.archeage.ru/promo/marathon*'] },
    { entry: 'cart', matches: ['*://archeage.ru/cart*', '*://*.archeage.ru/cart*'] },
    { entry: 'itemRestore', matches: ['*://archeage.ru/itemrestore*', '*://*.archeage.ru/itemrestore*'] },
    { entry: 'marathon', matches: ['*://archeage.ru/promo/marathon*', '*://*.archeage.ru/promo/marathon*'] },
    { entry: 'gisaa', matches: ['*://gisaa.ru/veksel/*'] },
  ];
  const manifest = {
    manifest_version: 3,
    name: meta.name,
    version: meta.version,
    description: meta.description,
    icons: { '128': 'icon128.png' },
    action: { default_title: meta.name, default_icon: { '128': 'icon128.png' } },
    content_scripts: [{
      matches: ['*://archeage.ru/*', '*://*.archeage.ru/*'],
      js: ['modules/adapter/pageScript.js'],
      run_at: 'document_start',
      world: 'MAIN',
    }, ...pageEntries.map(({ entry, matches, exclude_matches }) => ({
      matches,
      ...(exclude_matches ? { exclude_matches } : {}),
      js: ['modules/extension/contentScript.js'],
      css: entryStyles[entry].map(emittedStylePath),
      run_at: 'document_idle',
    }))],
    web_accessible_resources: [{
      resources: [
        ...sourceModules.filter(file => !file.endsWith(`${path.sep}adapter${path.sep}pageScript.js`) && !file.endsWith(`${path.sep}extension${path.sep}contentScript.js`)).map(emittedModulePath),
        'assets/*',
      ],
      matches: ['*://archeage.ru/*', '*://*.archeage.ru/*', '*://gisaa.ru/*'],
    }],
  };
  fs.writeFileSync(path.join(extensionDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
}

async function copyStaticFiles() {
  await fs.promises.copyFile(path.join(sourceRoot, 'icons', 'icon128.png'), path.join(extensionDir, 'icon128.png'));
}

async function build({ clean = true } = {}) {
  try {
    sourceModules = walk(sourceRoot).filter(file => /\.[jt]sx?$/.test(file) && !file.endsWith('.d.ts'));
    entryStyles = Object.fromEntries(Object.entries(entries).map(([name, file]) => [name, collectStyles(path.join(sourceRoot, file))]));
    if (clean) fs.rmSync(extensionDir, { recursive: true, force: true });
    await fs.promises.mkdir(modulesDir, { recursive: true });
    await emitPageScripts();
    await emitStylesAndAssets();
    await copyStaticFiles();
    await writeManifest();
    console.log(`[build:chrome${isProd ? '-prod' : ''}]`, extensionDir);
  } catch (error) {
    console.error('[build] Failed:', error);
    process.exit(1);
  }
}

if (isWatch) {
  const initialBuild = process.argv.includes('--skip-initial-build') ? Promise.resolve() : build();
  initialBuild.then(() => {
    const watcher = fs.watch(sourceRoot, { recursive: true }, () => {
      if (watcher.busy) return;
      watcher.busy = true;
      build({ clean: false }).finally(() => { watcher.busy = false; });
    });
    console.log('[build:dev] Watching source files...');
  });
} else {
  build();
}
