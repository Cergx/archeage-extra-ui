const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');
const sass = require('sass');

const isProd = process.argv.includes('--prod');
const isWatch = process.argv.includes('--watch');
const isChrome = process.argv.includes('--chrome');

const entryPath = path.join(__dirname, 'src', 'main.ts');

const META = JSON.parse(fs.readFileSync(path.join(__dirname, 'src', 'meta.json'), 'utf-8'));

const HEADER = isChrome ? '' : (
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

const outPath = isChrome
    ? path.join(__dirname, 'dist', 'chrome', 'contentScript.js')
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

function createAdapterPlugin(chrome) {
  if (!chrome) return null;
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
const adapterPlugin = createAdapterPlugin(isChrome);

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
  const target = isChrome ? (isProd ? 'chrome-prod' : 'chrome') : (isProd ? 'prod' : 'dev');
  console.log(`[build:${target}]`, outPath, `(${(code.length / 1024).toFixed(1)} KB)`);
}

async function build() {
  try {
    const result = await esbuild.build(buildOptions);
    writeOutput(result.outputFiles[0].text);

    if (isChrome) {
      const iconSrc = path.join(__dirname, 'src', 'icons', 'icon128.png');
      const iconDest = path.join(__dirname, 'dist', 'chrome', 'icon128.png');
      if (fs.existsSync(iconSrc)) fs.copyFileSync(iconSrc, iconDest);

      const pageScriptSrc = path.join(__dirname, 'src', 'adapter', 'pageScript.js');
      const pageScriptDest = path.join(__dirname, 'dist', 'chrome', 'pageScript.js');
      fs.copyFileSync(pageScriptSrc, pageScriptDest);

      const manifest = {
        manifest_version: 3,
        name: META.name,
        version: META.version,
        description: META.description,
        icons: { '128': 'icon128.png' },
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
        path.join(__dirname, 'dist', 'chrome', 'manifest.json'),
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
