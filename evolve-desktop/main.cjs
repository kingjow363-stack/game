const { app, BrowserWindow, Menu, protocol, session, shell, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const { readAsset } = require('./assets.cjs');
const HOME_URL = 'evolve://game/index.html';
const SOURCE_URL = 'https://github.com/kingjow363-stack/game/tree/main/evolve-desktop/upstream';
const saveScript = `(() => {
  if (typeof window.exportGame !== 'function' || typeof LZString === 'undefined') return null;
  const text = window.exportGame();
  const decoded = LZString.decompressFromBase64(text);
  if (!decoded) return null;
  const data = JSON.parse(decoded);
  if (!data.settings || !data.stats) return null;
  localStorage.setItem('evolved', LZString.compressToUTF16(decoded));
  return text;
})()`;

app.setName('evolve-original-desktop');
const profileOverride = app.commandLine.getSwitchValue('user-data-dir');
app.setPath('userData', profileOverride ? path.resolve(profileOverride) : path.join(app.getPath('appData'), 'evolve-original-desktop'));
protocol.registerSchemesAsPrivileged([{ scheme: 'evolve', privileges: {
  standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true,
} }]);
let gameWindow, wikiWindow;
const isLocal = url => { try { const u = new URL(url); return u.protocol === 'evolve:' && u.hostname === 'game'; } catch { return false; } };
function external(url) {
  try { const u = new URL(url); if (u.protocol === 'https:' || u.protocol === 'http:') void shell.openExternal(u.href); } catch {}
}
function createWindow(url, isGame = false) {
  const win = new BrowserWindow({ width: 1440, height: 960, minWidth: 800, minHeight: 600,
    backgroundColor: '#1b1b1b', title: isGame ? 'Evolve 1.4.10 — Original Desktop' : 'Evolve Wiki',
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, backgroundThrottling: false },
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isLocal(url)) openWiki(url); else external(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, target) => {
    if (!isLocal(target)) { event.preventDefault(); external(target); }
  });
  win.webContents.on('did-fail-load', (_event, code, description) => {
    if (code !== -3) console.error(`Evolve load error: ${code} ${description}`);
  });
  let closing = false;
  if (isGame) win.on('close', event => {
    if (closing || win.webContents.isDestroyed()) return;
    event.preventDefault();
    void (async () => {
      try {
        const exported = await win.webContents.executeJavaScript(saveScript);
        win.webContents.session.flushStorageData();
        if (exported) {
          const backupPath = path.join(app.getPath('userData'), 'last-save.txt');
          await fs.mkdir(app.getPath('userData'), { recursive: true });
          await fs.writeFile(`${backupPath}.tmp`, exported, 'utf8');
          await fs.rename(`${backupPath}.tmp`, backupPath);
        }
      } catch (error) { console.error('Evolve close backup:', error.message); }
      finally { closing = true; win.close(); }
    })();
  });
  void win.loadURL(url);
  return win;
}
function openWiki(url = 'evolve://game/wiki.html') {
  if (!wikiWindow || wikiWindow.isDestroyed()) {
    wikiWindow = createWindow(url);
    wikiWindow.on('closed', () => { wikiWindow = null; });
  } else { void wikiWindow.loadURL(url); wikiWindow.focus(); }
}
function setupMenu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: '게임', submenu: [
      { label: '게임 화면', click: () => gameWindow?.focus() },
      { label: '원본 위키 (오프라인)', click: () => openWiki() },
      { label: '저장 문자열 보기', click: () => openWiki('evolve://game/save.html') },
      { label: '저장 폴더 열기', click: () => void shell.openPath(app.getPath('userData')) },
      { type: 'separator' }, { role: 'quit', label: '종료' },
    ] },
    { label: '보기', submenu: [{ role: 'reload', label: '새로고침' }, { role: 'resetZoom', label: '기본 크기' }, { role: 'zoomIn', label: '확대' }, { role: 'zoomOut', label: '축소' }, { role: 'togglefullscreen', label: '전체 화면' }] },
    { label: '도움말', submenu: [
      { label: '원본 소스와 라이선스', click: () => external(SOURCE_URL) },
      { label: '이 실행 파일 정보', click: () => void dialog.showMessageBox({ type: 'info', title: 'Evolve Original Desktop', message: 'Evolve Idle 1.4.10 · 개인용 비공식 데스크톱 패키지', detail: '게임 제작: Peter Motschmann 및 Evolve 기여자\n라이선스: MPL-2.0\n원본 게임 로직과 저장 형식을 그대로 사용합니다.\n외부 라이브러리·위키는 앱에 포함됩니다.\nEXO Industries 저장과는 별개입니다.\n\n소스: ' + SOURCE_URL }) },
    ] },
  ]));
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (gameWindow && !gameWindow.isDestroyed()) { if (gameWindow.isMinimized()) gameWindow.restore(); gameWindow.focus(); } });
  app.whenReady().then(() => {
    protocol.handle('evolve', async request => {
      const asset = await readAsset(request.url, path.join(__dirname, 'web'));
      return new Response(asset.body, { status: asset.status, headers: { 'Content-Type': asset.type || 'text/plain' } });
    });
    // All game dependencies are local. Analytics/update polling never go onto the network.
    session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (_details, callback) => callback({ cancel: true }));
    setupMenu(); gameWindow = createWindow(HOME_URL, true);
    gameWindow.on('closed', () => { gameWindow = null; if (wikiWindow && !wikiWindow.isDestroyed()) wikiWindow.close(); });
  });
  app.on('window-all-closed', () => app.quit());
}
