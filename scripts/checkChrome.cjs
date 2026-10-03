const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const inspectPanel = `(() => {
  const panel = document.querySelector('.tm-side-panel');
  const rect = panel?.getBoundingClientRect();
  return {
    url: location.href, ready: document.readyState, panel: !!panel,
    x: rect?.x, y: rect?.y, width: rect?.width, height: rect?.height,
    display: panel && getComputedStyle(panel).display,
    visibility: panel && getComputedStyle(panel).visibility,
  };
})()`;

async function checkChrome(browser, { navigate = false, beforeInspection, expectPanel = true, screenshot = true } = {}) {
  const pending = new Map();
  const events = [];
  let seq = 0;
  let buffer = '';
  let stderr = '';
  let exited = false;
  const exit = new Promise(resolve => browser.once('exit', (code, signal) => {
    exited = true;
    for (const request of pending.values()) {
      clearTimeout(request.timeout);
      request.reject(new Error(`Chrome exited with code ${code} (${signal || 'no signal'})`));
    }
    pending.clear();
    resolve();
  }));
  browser.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-4000); });
  browser.stdio[4].on('data', chunk => {
    buffer += chunk.toString();
    let end;
    while ((end = buffer.indexOf('\0')) !== -1) {
      const message = JSON.parse(buffer.slice(0, end));
      buffer = buffer.slice(end + 1);
      if (!message.id) { events.push(message); continue; }
      const request = pending.get(message.id);
      if (!request) continue;
      pending.delete(message.id);
      clearTimeout(request.timeout);
      if (message.error) request.reject(new Error(JSON.stringify(message.error)));
      else request.resolve(message.result);
    }
  });
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    if (exited) return reject(new Error('Chrome is no longer running'));
    const id = ++seq;
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`${method} timed out`)); }, 15000);
    pending.set(id, { resolve, reject, timeout });
    browser.stdio[3].write(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }) + '\0');
  });

  try {
    const version = await send('Browser.getVersion');
    console.log('[check:chrome]', version.product, version.userAgent);
    const { targetInfos } = await send('Target.getTargets');
    const target = targetInfos.find(target => target.type === 'page' && target.url === 'https://archeage.ru/')
      || targetInfos.find(target => target.type === 'page');
    if (!target) throw new Error('Chrome has no page target');
    const { sessionId } = await send('Target.attachToTarget', { targetId: target.targetId, flatten: true });
    await send('Runtime.enable', {}, sessionId);
    await send('Debugger.enable', {}, sessionId);
    await send('Page.enable', {}, sessionId);
    if (navigate) await send('Page.navigate', { url: 'https://archeage.ru/' }, sessionId);
    if (beforeInspection) await beforeInspection(send, sessionId, events);

    let state;
    for (let attempt = 0; attempt < 30; attempt++) {
      await delay(1000);
      const result = await send('Runtime.evaluate', { expression: inspectPanel, returnByValue: true }, sessionId);
      state = result.result.value;
      if (state?.ready === 'complete' && state.panel === expectPanel) break;
    }
    // Check again after the site's own scripts have finished initializing.
    await delay(3000);
    const result = await send('Runtime.evaluate', { expression: inspectPanel, returnByValue: true }, sessionId);
    state = result.result.value;
    const scripts = [...new Set(events.filter(event => event.method === 'Debugger.scriptParsed'
      && event.params.url.startsWith('chrome-extension://')).map(event => event.params.url))];
    const errors = events.filter(event => event.method === 'Runtime.exceptionThrown'
      && (event.params.exceptionDetails.url || '').startsWith('chrome-extension://'))
      .map(event => event.params.exceptionDetails);
    console.log('[check:chrome]', JSON.stringify({ ...state, scripts, errors }, null, 2));
    if (screenshot && state?.panel) {
      const shot = await send('Page.captureScreenshot', {
        format: 'png', clip: { x: state.x, y: state.y, width: state.width, height: state.height, scale: 1 },
      }, sessionId);
      const output = path.join(root, '.test/start-check.png');
      fs.mkdirSync(path.dirname(output), { recursive: true });
      fs.writeFileSync(output, Buffer.from(shot.data, 'base64'));
      console.log('[check:chrome] Screenshot:', output);
    }
    if (!state || state.url !== 'https://archeage.ru/' || state.panel !== expectPanel || errors.length
      || (expectPanel && (!(state.width > 0) || !(state.height > 0) || state.display === 'none' || state.visibility === 'hidden'))) {
      throw new Error('Chrome extension DOM check failed');
    }
  } finally {
    try { await send('Browser.close'); } catch { browser.kill(); }
    await Promise.race([exit, delay(5000)]);
    if (stderr) console.log('[check:chrome] Browser stderr:', stderr);
  }
}

module.exports = { checkChrome };
