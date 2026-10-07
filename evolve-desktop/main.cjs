const { app, BrowserWindow, Menu, protocol, session, shell, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const { readAsset } = require('./assets.cjs');
const HOME_URL = 'evolve://game/index.html';
const SOURCE_URL = 'https://github.com/kingjow363-stack/game/tree/main/evolve-desktop/upstream';
const { SaveStore, decode, closeScript } = require('./saves.cjs');
const { inspectStorage } = require('./recovery.cjs');
const codec = require('./web/lib/lz-string.min.js');
const START_URL = 'evolve://game/desktop-start.html';
let saveStore, gameReady = false, restoring = false, choosingRestore = false;
let backupStatus = '이번 실행의 파일 백업을 기다리고 있습니다.';
let backupFailed = false;
function timed(operation, milliseconds = 8000) {
  let timer;
  return Promise.race([operation, new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('저장 응답 시간이 초과되었습니다.')), milliseconds);
  })]).finally(() => clearTimeout(timer));
}
async function backup(win, live = false) {
  if (!gameReady || restoring || win.webContents.isDestroyed()) return;
  try {
    const raw = await timed(win.webContents.executeJavaScript(live ? closeScript : "localStorage.getItem('evolved')"));
    if (!raw) return; // A deliberate reset may temporarily remove this key.
    const save = decode(raw, codec, true);
    await saveStore.write(save.text);
    win.webContents.session.flushStorageData();
    backupStatus = `마지막 파일 백업: ${new Date().toLocaleString()}`;
    backupFailed = false;
    win.setTitle('Evolve 1.4.10 — Desktop · 우주 산업 확장 r2');
  } catch (error) {
    backupFailed = true; backupStatus = `파일 백업 실패: ${error.message}`;
    if (!win.isDestroyed()) win.setTitle('Evolve — 백업 실패 · 게임 메뉴에서 저장 상태 확인');
    throw error;
  }
}
async function prepareStart(win) {
  await win.loadURL(START_URL);
  if (!await inspectStorage(win, saveStore, codec, (...args) => dialog.showMessageBox(...args))) { win.destroy(); return; }
  await win.loadURL(HOME_URL);
  gameReady = true;
}
async function restoreBackup() {
  const win = gameWindow;
  if (!win || !gameReady || restoring || choosingRestore) return;
  choosingRestore = true;
  try {
    const selected = await dialog.showOpenDialog(win, { title: 'Evolve 백업 복구', defaultPath: saveStore.backups,
    properties: ['openFile'], filters: [{ name: 'Evolve 저장', extensions: ['txt'] }] });
    if (selected.canceled) return;
    const saved = decode(await fs.readFile(selected.filePaths[0], 'utf8'), codec);
    const choice = await dialog.showMessageBox(win, { type: 'question', message: '선택한 백업 시점으로 돌아갑니다.',
      detail: '현재 진행 상황은 복구 전 파일에 보관합니다.', buttons: ['취소', '복구'], defaultId: 0, cancelId: 0, noLink: true });
    if (choice.response !== 1) return;
    // Do not lose progress made while the file picker was open.
    await backup(win, true);
    restoring = true;
    await win.loadURL(START_URL); // Stop the worker before replacing storage.
    const raw = await win.webContents.executeJavaScript("localStorage.getItem('evolved')");
    await saveStore.quarantine(raw);
    await win.webContents.executeJavaScript(`localStorage.setItem('evolved', ${JSON.stringify(saved.raw)})`);
    win.webContents.session.flushStorageData();
    await win.loadURL(HOME_URL);
  } catch (error) {
    await dialog.showMessageBox(win, { type: 'error', message: '백업 복구를 완료하지 못했습니다.', detail: error.message });
    if (win.webContents.getURL() === START_URL) await win.loadURL(HOME_URL);
  } finally { restoring = false; choosingRestore = false; }
}

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
    backgroundColor: '#1b1b1b', title: isGame ? 'Evolve 1.4.10 — Desktop · 우주 산업 확장 r2' : 'Evolve Wiki',
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
  let closing = false, closePending = false, timer;
  if (isGame) {
    timer = setInterval(() => {
      if (!closePending) void backup(win).catch(error => console.error('Evolve periodic backup:', error.message));
    }, 30000);
    win.on('closed', () => { clearInterval(timer); gameReady = false; });
    win.on('close', event => {
      if (closing || win.webContents.isDestroyed()) return;
      event.preventDefault();
      if (closePending || restoring || choosingRestore) return;
      closePending = true;
      void (async () => {
        try { await backup(win, true); }
        catch (error) {
          const result = await dialog.showMessageBox(win, { type: 'warning', message: '마지막 파일 백업에 실패했습니다.',
            detail: `${error.message}\n기존 백업은 보존됩니다. 계속 플레이하거나 저장 폴더를 확인할 수 있습니다.`,
            buttons: ['계속 플레이', '그래도 종료'], defaultId: 0, cancelId: 0, noLink: true });
          if (result.response === 0) { closePending = false; return; }
        }
        closing = true; win.close();
      })();
    });
    void prepareStart(win).catch(async error => {
      if (win.isDestroyed()) return;
      await dialog.showMessageBox(win, { type: 'error', message: '저장을 안전하게 확인할 수 없어 시작을 중단했습니다.', detail: error.message });
      win.destroy();
    });
  } else void win.loadURL(url);
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
      { label: '지금 파일 백업', click: () => { if (gameWindow) void backup(gameWindow, true).catch(() => {}); } },
      { label: '저장 상태 확인', click: () => void dialog.showMessageBox({ type: backupFailed ? 'warning' : 'info',
        message: backupStatus, detail: '원본 자동저장 + 30초 간격 파일 백업 · 최근 10개 보관\n게임 → 백업 파일 복구에서 이전 시점으로 돌아갈 수 있습니다.' }) },
      { label: '백업 파일 복구', click: () => void restoreBackup() },
      { label: '저장 폴더 열기', click: () => void shell.openPath(app.getPath('userData')) },
      { type: 'separator' }, { role: 'quit', label: '종료' },
    ] },
    { label: '보기', submenu: [{ role: 'reload', label: '새로고침' }, { role: 'resetZoom', label: '기본 크기' }, { role: 'zoomIn', label: '확대' }, { role: 'zoomOut', label: '축소' }, { role: 'togglefullscreen', label: '전체 화면' }] },
    { label: '도움말', submenu: [
      { label: '원본 소스와 라이선스', click: () => external(SOURCE_URL) },
      { label: '이 실행 파일 정보', click: () => void dialog.showMessageBox({ type: 'info', title: 'Evolve Original Desktop', message: 'Evolve Idle 1.4.10 · Industry r2 · 개인용 확장', detail: '게임 제작: Peter Motschmann 및 Evolve 기여자\n라이선스: MPL-2.0\n원본 초중반 진행에 우주 산업·자동화·계승 시스템을 추가했습니다.\n외부 라이브러리·위키는 앱에 포함됩니다.\nEXO Industries 저장과는 별개입니다.\n\n소스: ' + SOURCE_URL }) },
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
    saveStore = new SaveStore(app.getPath('userData'), codec);
    setupMenu(); gameWindow = createWindow(HOME_URL, true);
    gameWindow.on('closed', () => { gameWindow = null; if (wikiWindow && !wikiWindow.isDestroyed()) wikiWindow.close(); });
  });
  app.on('window-all-closed', () => app.quit());
}
