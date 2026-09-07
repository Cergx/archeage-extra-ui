const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');
const sass = require('sass');

const isProd = process.argv.includes('--prod');
const isWatch = process.argv.includes('--watch');
const isChrome = process.argv.includes('--chrome');
const isExtension = isChrome;

const entryPath = path.join(__dirname, 'src', 'main.ts');

const META = JSON.parse(fs.readFileSync(path.join(__dirname, 'src', 'meta.json'), 'utf-8'));

const HEADER = isExtension ? '' : (
`// ==UserScript==
// @name         ${META.name}
// @namespace    https://archeage.ru/
// @version      ${META.version}
// @description  ${META.description}
// @author       Cergx
${META.matches.map(m => `// @match        ${m}`).join('\n')}
// @icon         https://www.google.com/s2/favicons?sz=64&domain=archeage.ru
// @grant        unsafeWindow
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==
`);

const extensionTarget = 'chrome';
const outPath = isExtension
    ? path.join(__dirname, 'dist', extensionTarget, 'contentScript.js')
    : path.join(__dirname, 'ArcheAgeExtraUI.user.js');

function createScssPlugin(prod) {
  return {
    name: 'scss',
    setup(build) {
      build.onResolve({ filter: /\.scss$/ }, args => ({
        path: path.resolve(args.resolveDir, args.path),
        namespace: 'scss',
      }));
      build.onLoad({ filter: /.*/, namespace: 'scss' }, async (args) => {
        const result = sass.compileString(await fs.promises.readFile(args.path, 'utf8'), {
          loadPaths: [path.dirname(args.path)],
          style: prod ? 'compressed' : 'expanded',
        });
        const css = result.css.replace(/^\uFEFF/, '');
        return {
          contents: `export default ${JSON.stringify(css)};`,
          loader: 'js',
          resolveDir: path.dirname(args.path),
        };
      });
    },
  };
}

function createAdapterPlugin(extension) {
  if (!extension) return null;
  return {
    name: 'chrome-adapter',
    setup(build) {
      build.onResolve({ filter: /adapter\/env\.js$/ }, args => {
        return { path: path.resolve(__dirname, 'src', 'adapter', 'env.chrome.ts') };
      });
    },
  };
}

const scssPlugin = createScssPlugin(isProd);
const adapterPlugin = createAdapterPlugin(isExtension);

const buildOptions = {
  entryPoints: [entryPath],
  bundle: true,
  format: 'iife',
  target: ['es2020'],
  platform: 'browser',
  charset: 'utf8',
  write: false,
  minify: isProd,
  keepNames: !isProd,
  legalComments: 'none',
  loader: { '.png': 'dataurl' },
  logLevel: 'info',
  plugins: [scssPlugin, adapterPlugin].filter(Boolean),
};

function fixVarDeclarations(code) {
  return code.replace(/^(\s+)var /gm, '$1let ');
}

function writeOutput(bundled) {
  const dir = path.dirname(outPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const code = HEADER + (isProd ? bundled : fixVarDeclarations(bundled));
  fs.writeFileSync(outPath, code);
  const target = isExtension
    ? `${extensionTarget}${isProd ? '-prod' : ''}`
    : (isProd ? 'prod' : 'dev');
  console.log(`[build:${target}]`, outPath, `(${(code.length / 1024).toFixed(1)} KB)`);
}

async function build() {
  try {
    const result = await esbuild.build(buildOptions);
    writeOutput(result.outputFiles[0].text);

    if (isExtension) {
      const iconSrc = path.join(__dirname, 'src', 'icons', 'icon128.png');
      const extensionDir = path.join(__dirname, 'dist', extensionTarget);
      const iconDest = path.join(extensionDir, 'icon128.png');
      if (fs.existsSync(iconSrc)) fs.copyFileSync(iconSrc, iconDest);

      const pageScriptSrc = path.join(__dirname, 'src', 'adapter', 'pageScript.js');
      const pageScriptDest = path.join(extensionDir, 'pageScript.js');
      fs.copyFileSync(pageScriptSrc, pageScriptDest);

      const manifest = {
        manifest_version: 3,
        name: META.name,
        version: META.version,
        description: META.description,
        icons: { '128': 'icon128.png' },
        action: {
          default_title: META.name,
          default_icon: { '128': 'icon128.png' },
        },
        content_scripts: [{
          matches: META.matches,
          js: ['pageScript.js'],
          run_at: 'document_start',
          world: 'MAIN',
        }, {
          matches: META.matches,
          js: ['contentScript.js'],
          run_at: 'document_start',
        }],
      };
      fs.writeFileSync(
        path.join(extensionDir, 'manifest.json'),
        JSON.stringify(manifest, null, 2),
      );
    }
  } catch (e) {
    console.error('[build] Failed:', e);
    process.exit(1);
  }
}

if (isWatch) {
  const watchScssPlugin = createScssPlugin(false);
  esbuild.context({
    ...buildOptions,
    minify: false,
    keepNames: true,
    write: true,
    banner: { js: HEADER },
    outfile: outPath,
    plugins: [
      watchScssPlugin,
      {
        name: 'fix-var',
        setup(b) {
          b.onEnd(result => {
            if (result.errors.length > 0) return;
            const code = fs.readFileSync(outPath, 'utf-8');
            fs.writeFileSync(outPath, fixVarDeclarations(code));
          });
        },
      },
    ].filter(Boolean),
  }).then(ctx => {
    ctx.watch();
    console.log('[build:dev] Watching for changes...');
  }).catch(e => {
    console.error('[build] Failed:', e);
    process.exit(1);
  });
} else {
  build();
}
