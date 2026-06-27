const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const OUT_ROOT = path.join(ROOT, 'release');
const STAGE = path.join(OUT_ROOT, 'Mineradio-Bridge-win-x64');
const ZIP = path.join(OUT_ROOT, 'Mineradio-Bridge-win-x64.zip');

function rm(target) {
  fs.rmSync(target, { recursive: true, force: true });
}

function mkdir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyFile(src, dest) {
  mkdir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function copyDir(src, dest, filter) {
  if (!fs.existsSync(src)) return;
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (filter && !filter(from, entry)) continue;
    if (entry.isDirectory()) copyDir(from, to, filter);
    else if (entry.isFile()) copyFile(from, to);
  }
}

function findNodeExe() {
  const explicit = process.env.MINERADIO_NODE_EXE;
  if (explicit && fs.existsSync(explicit)) return explicit;
  return process.execPath;
}

function shouldCopyNodeModule(file, entry) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  if (rel.includes('/.cache/')) return false;
  if (rel.includes('/test/') || rel.includes('/tests/')) return false;
  if (entry.isDirectory()) {
    if (entry.name === '.git') return false;
    if (entry.name === '.bin') return false;
  }
  return true;
}

rm(STAGE);
mkdir(STAGE);
mkdir(path.join(STAGE, 'bridge'));
mkdir(path.join(STAGE, 'node'));

copyFile(path.join(ROOT, 'bridge', 'server.js'), path.join(STAGE, 'bridge', 'server.js'));
copyFile(path.join(ROOT, 'bridge', 'start-bridge.js'), path.join(STAGE, 'bridge', 'start-bridge.js'));
copyFile(path.join(ROOT, 'package.json'), path.join(STAGE, 'package.json'));
copyFile(path.join(ROOT, 'Start-Mineradio-Bridge.cmd'), path.join(STAGE, 'Start-Mineradio-Bridge.cmd'));
copyFile(path.join(ROOT, 'Install-Mineradio-Bridge-Startup.cmd'), path.join(STAGE, 'Install-Mineradio-Bridge-Startup.cmd'));
copyFile(path.join(ROOT, 'Uninstall-Mineradio-Bridge-Startup.cmd'), path.join(STAGE, 'Uninstall-Mineradio-Bridge-Startup.cmd'));
['LICENSE', 'NOTICE.md', 'PRIVACY.md', 'SECURITY.md'].forEach(name => {
  const src = path.join(ROOT, name);
  if (fs.existsSync(src)) copyFile(src, path.join(STAGE, name));
});

copyFile(findNodeExe(), path.join(STAGE, 'node', 'node.exe'));
copyDir(path.join(ROOT, 'node_modules'), path.join(STAGE, 'node_modules'), shouldCopyNodeModule);

const readme = [
  '# Mineradio Bridge for Windows',
  '',
  '1. Double-click `Start-Mineradio-Bridge.cmd`.',
  '2. The pairing page opens automatically.',
  '3. Keep the Bridge window running while using Mineradio Web.',
  '',
  'Optional: double-click `Install-Mineradio-Bridge-Startup.cmd` to start Bridge after Windows login.',
  '',
  'The Bridge only listens on `127.0.0.1:37891`.',
  '',
].join('\r\n');
fs.writeFileSync(path.join(STAGE, 'README.txt'), readme, 'utf8');

rm(ZIP);
const ps = spawnSync('powershell', [
  '-NoProfile',
  '-ExecutionPolicy', 'Bypass',
  '-Command',
  `Compress-Archive -Path ${JSON.stringify(path.join(STAGE, '*'))} -DestinationPath ${JSON.stringify(ZIP)} -Force`,
], { stdio: 'inherit' });
if (ps.status !== 0) process.exit(ps.status || 1);
console.log('Packaged bridge:', ZIP);
