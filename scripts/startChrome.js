const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const envPath = path.join(root, '.env');
const check = process.argv.includes('--check');

function loadEnv() {
  if (!fs.existsSync(envPath)) return;

  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^(?:"|')|(?:"|')$/g, '');
  }
}

function findChromeForTesting() {
  const candidates = [
    process.env.CHROME_FOR_TESTING_PATH,
    path.join(root, 'tools', 'chromeForTesting', 'chrome-win64', 'chrome.exe'),
  ].filter(Boolean);

  return candidates.find(candidate => fs.existsSync(candidate));
}

function fail(message) {
  console.error(`[start] ${message}`);
  process.exit(1);
}

loadEnv();

const chrome = findChromeForTesting();
if (!chrome) {
  fail('Chrome for Testing не найден. Однократно выполните: npm run setup:chromeForTesting');
}

const extensionDir = path.join(root, 'dist', 'chrome');
const profileDir = path.join(root, '.chromeDevProfile');
try {
  require('./closeDevChrome')(path.resolve(chrome), profileDir);
} catch (error) {
  fail(error.message);
}

const build = spawnSync(process.execPath, ['build.js'], {
  cwd: root,
  stdio: 'inherit',
});
if (build.status !== 0) process.exit(build.status || 1);

const chromeArgs = [
  `--user-data-dir=${profileDir}`,
  `--disable-extensions-except=${extensionDir}`,
  `--load-extension=${extensionDir}`,
  ...(check ? ['--remote-debugging-pipe'] : []),
  'https://archeage.ru/',
];

const browser = spawn(chrome, chromeArgs, {
  detached: !check,
  stdio: check ? ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'] : 'ignore',
});
if (!check) browser.unref();

console.log('[start] Chrome for Testing запущен с расширением из dist/chrome.');
console.log('[start] Это отдельный профиль. Войдите в личный кабинет один раз — авторизация сохранится.');
console.log('[start] Изменения собираются автоматически; после них нажимайте «Обновить» у расширения на chrome://extensions.');

const watcher = spawn(process.execPath, ['build.js', '--watch', '--skip-initial-build'], {
  cwd: root,
  stdio: 'inherit',
});

function stopWatcher() {
  watcher.kill();
}

process.on('SIGINT', stopWatcher);
process.on('SIGTERM', stopWatcher);
watcher.on('exit', code => process.exit(process.exitCode || code || 0));

if (check) {
  require('./checkChrome.cjs').checkChrome(browser).catch(error => {
    console.error('[check:chrome]', error.message);
    process.exitCode = 1;
  }).finally(stopWatcher);
}
