const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BRIDGE_ORIGIN = process.env.MINERADIO_BRIDGE_ORIGIN || 'http://127.0.0.1:37891';
const PAIR_URL = BRIDGE_ORIGIN + '/pair';

function openUrl(url) {
  const child = spawn('cmd', ['/c', 'start', '', url], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  child.unref();
}

function checkHealth() {
  return new Promise(resolve => {
    const req = http.get(BRIDGE_ORIGIN + '/health', res => {
      res.resume();
      resolve(res.statusCode >= 200 && res.statusCode < 300);
    });
    req.setTimeout(900, () => {
      req.destroy();
      resolve(false);
    });
    req.on('error', () => resolve(false));
  });
}

async function waitForBridge() {
  for (let i = 0; i < 28; i++) {
    if (await checkHealth()) return true;
    await new Promise(resolve => setTimeout(resolve, 350));
  }
  return false;
}

(async () => {
  const alreadyRunning = await checkHealth();
  let child = null;
  if (!alreadyRunning) {
    child = spawn(process.execPath, [path.join(ROOT, 'bridge', 'server.js')], {
      cwd: ROOT,
      stdio: 'inherit',
      windowsHide: false,
    });
    child.on('exit', code => {
      if (code && code !== 0) process.exitCode = code;
    });
  }

  const ready = alreadyRunning || await waitForBridge();
  if (ready) {
    console.log('[Mineradio Bridge] Ready: ' + BRIDGE_ORIGIN);
    console.log('[Mineradio Bridge] Pair:  ' + PAIR_URL);
    openUrl(PAIR_URL);
  } else {
    console.error('[Mineradio Bridge] Failed to start. Keep this window open and check errors above.');
  }

  if (!child && alreadyRunning) {
    setTimeout(() => process.exit(0), 1200);
  }
})();
