const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');
const sass = require('sass');

const watch = process.argv.includes('--watch');
const headerPath = path.join(__dirname, 'src', 'header.js');
const entryPath = path.join(__dirname, 'src', 'main.js');
const outPath = path.join(__dirname, 'ArcheAgeExtraUI.user.js');

const HEADER = fs.readFileSync(headerPath, 'utf-8').trimEnd() + '\n';

/** Compile .scss imports → default export of CSS string */
const scssPlugin = {
  name: 'scss',
  setup(build) {
    build.onResolve({ filter: /\.scss$/ }, args => ({
      path: path.resolve(args.resolveDir, args.path),
      namespace: 'scss',
    }));
    build.onLoad({ filter: /.*/, namespace: 'scss' }, async (args) => {
      const result = sass.compileString(await fs.promises.readFile(args.path, 'utf8'), {
        loadPaths: [path.dirname(args.path)],
      });
      return {
        contents: `export default ${JSON.stringify(result.css)};`,
        loader: 'js',
        resolveDir: path.dirname(args.path),
      };
    });
  },
};

const buildOptions = {
  entryPoints: [entryPath],
  bundle: true,
  format: 'iife',
  target: ['es2020'],
  platform: 'browser',
  write: false,
  minify: false,
  keepNames: true,
  legalComments: 'none',
  logLevel: 'info',
  plugins: [scssPlugin],
};

function fixVarDeclarations(code) {
  return code.replace(/^(\s+)var /gm, '$1let ');
}

function writeOutput(bundled) {
  const code = HEADER + fixVarDeclarations(bundled);
  fs.writeFileSync(outPath, code);
  console.log('[build] Built successfully:', outPath, `(${(code.length / 1024).toFixed(1)} KB)`);
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

if (watch) {
  esbuild.context({
    ...buildOptions,
    write: true,
    banner: { js: HEADER },
    outfile: outPath,
    plugins: [
      scssPlugin,
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
    console.log('[build] Watching for changes...');
  }).catch(e => {
    console.error('[build] Failed:', e);
    process.exit(1);
  });
} else {
  build();
}
