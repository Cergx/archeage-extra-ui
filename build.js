const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');
const sass = require('sass');

const isProd = process.argv.includes('--prod');
const isWatch = process.argv.includes('--watch');
const headerPath = path.join(__dirname, 'src', 'header.js');
const entryPath = path.join(__dirname, 'src', 'main.js');
const outPath = path.join(__dirname, 'ArcheAgeExtraUI.user.js');

const HEADER = fs.readFileSync(headerPath, 'utf-8').trimEnd() + '\n';

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

const scssPlugin = createScssPlugin(isProd);

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
  plugins: [scssPlugin],
};

function fixVarDeclarations(code) {
  return code.replace(/^(\s+)var /gm, '$1let ');
}

function writeOutput(bundled) {
  const code = HEADER + (isProd ? bundled : fixVarDeclarations(bundled));
  fs.writeFileSync(outPath, code);
  console.log(`[build:${isProd ? 'prod' : 'dev'}]`, outPath, `(${(code.length / 1024).toFixed(1)} KB)`);
}

async function build() {
  try {
    const result = await esbuild.build(buildOptions);
    writeOutput(result.outputFiles[0].text);
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
    ],
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
