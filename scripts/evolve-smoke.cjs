const { _electron } = require('playwright-core');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const root = path.resolve(__dirname, '..');
const codec = require('../evolve-desktop/upstream/lib/lz-string.min.js');
async function until(predicate, timeout = 45000) {
  const deadline = Date.now() + timeout;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('Timed out waiting for disk backup');
    await new Promise(resolve => setTimeout(resolve, 200));
  }
}
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'evolve-original-test-'));
const output = path.join(root, 'evolve-desktop', 'test-results');
fs.mkdirSync(output, { recursive: true });
const packaged = process.env.EVOLVE_EXECUTABLE;
const args = [...(packaged ? [] : [path.join(root, 'evolve-desktop')]), '--disable-gpu', `--user-data-dir=${profile}`];
if (process.platform === 'linux') args.push('--no-sandbox');
const launch = () => _electron.launch({ executablePath: packaged || require('electron'), args,
  env: { ...process.env, XDG_CONFIG_HOME: path.join(profile, 'config'), XDG_CACHE_HOME: path.join(profile, 'cache') }, timeout: 30000 });
const snapshot = p => p.evaluate(() => JSON.parse(LZString.decompressFromBase64(window.exportGame())));
async function ready(app) {
  const page = await app.firstWindow(); page.setDefaultTimeout(15000);
  await page.waitForFunction(() => typeof window.exportGame === 'function' && !!document.querySelector('#topBar'), null, { timeout: 30000 });
  return page;
}
(async () => {
  let app = await launch(); const errors = [];
  try {
    let page = await ready(app); page.on('pageerror', error => errors.push(error.message));
    assert.equal((await snapshot(page)).version, '1.4.10');
    for (let i = 0; i < 30; i++) await page.locator('#evolution-rna > a.button').click();
    assert.equal((await snapshot(page)).resource.RNA.amount, 30);
    for (let i = 0; i < 4; i++) await page.locator('#evolution-dna > a.button').click();
    assert.equal((await snapshot(page)).resource.DNA.amount, 4);
    await page.locator('#evolution-organelles > a.button').click();
    const afterPurchase = await snapshot(page); assert.equal(afterPurchase.evolution.organelles.count, 1);
    await page.waitForFunction(before => JSON.parse(LZString.decompressFromBase64(exportGame())).resource.RNA.amount > before, afterPurchase.resource.RNA.amount, { timeout: 10000 });
    console.log('PASS: original RNA/DNA costs, organelle purchase and worker production');

    await page.getByRole('tab', { name: 'Settings', exact: true }).click();
    await page.getByRole('button', { name: 'English (US)', exact: true }).click();
    await page.getByText('한국어', { exact: true }).click();
    await page.waitForFunction(() => typeof exportGame === 'function' && JSON.parse(LZString.decompressFromBase64(exportGame())).settings.locale === 'ko-KR');
    assert.equal((await snapshot(page)).settings.locale, 'ko-KR');
    assert.ok((await page.locator('body').innerText()).includes('설정'));
    console.log('PASS: original Korean language selection and reload');

    const exported = await page.evaluate(() => window.exportGame());
    await page.getByRole('tab', { name: '설정', exact: true }).click();
    await page.locator('#importExport').fill(exported);
    const importLabel = JSON.parse(fs.readFileSync(path.join(root, 'evolve-desktop/upstream/strings/strings.ko-KR.json'), 'utf8')).import;
    await page.getByRole('button', { name: importLabel, exact: true }).click();
    await page.waitForFunction(() => typeof exportGame === 'function' && JSON.parse(LZString.decompressFromBase64(exportGame())).evolution.organelles.count === 1);
    console.log('PASS: unmodified Evolve import/export format round trip');

    const wikiPromise = app.waitForEvent('window');
    await page.locator('a[href="wiki.html#changelog"]').click();
    const wiki = await wikiPromise; wiki.on('pageerror', error => errors.push(error.message));
    await wiki.waitForFunction(() => document.body?.innerText.includes('1.4.10'), null, { timeout: 30000 });
    assert.ok(wiki.url().startsWith('evolve://game/wiki.html'));
    await wiki.screenshot({ path: path.join(output, 'original-wiki.png') });
    console.log('PASS: offline original wiki changelog opens in its own window');
    await wiki.close();

    await until(() => fs.existsSync(path.join(profile, 'last-save.txt')));
    const periodic = JSON.parse(codec.decompressFromBase64(fs.readFileSync(path.join(profile, 'last-save.txt'), 'utf8')));
    assert.equal(periodic.evolution.organelles.count, 1);
    assert.ok(fs.readdirSync(path.join(profile, 'backups')).some(n => n.endsWith('.txt')));
    console.log('PASS: periodic file backup exists while the app is still running');

    const beforeClose = await snapshot(page);
    await page.screenshot({ path: path.join(output, 'original-game-ko.png') });
    const stopped = app.waitForEvent('close');
    await app.evaluate(({ app }) => { setTimeout(() => app.quit(), 0); });
    await stopped; app = null;
    assert.ok(fs.existsSync(path.join(profile, 'last-save.txt')), 'Close-time backup must exist');
    app = await launch(); page = await ready(app);
    const resumed = await snapshot(page);
    assert.equal(resumed.settings.locale, 'ko-KR');
    assert.equal(resumed.evolution.organelles.count, beforeClose.evolution.organelles.count);
    assert.ok(resumed.resource.RNA.amount >= beforeClose.resource.RNA.amount);
    assert.deepEqual(errors, []);
    console.log('PASS: full app restart preserves original progress and locale; no page errors');
    // Use the real recovery handler on the real local-origin guard page. Only
    // native chooser responses are substituted; storage and files remain real.
    const recoveryResult = await app.evaluate(async ({ app, BrowserWindow }) => {
      const require = process.getBuiltinModule('module').createRequire(`${app.getAppPath()}/package.json`);
      const path = require('node:path');
      const { inspectStorage } = require(path.join(app.getAppPath(), 'recovery.cjs'));
      const { SaveStore } = require(path.join(app.getAppPath(), 'saves.cjs'));
      const codec = require(path.join(app.getAppPath(), 'web/lib/lz-string.min.js'));
      const win = BrowserWindow.getAllWindows()[0];
      await win.loadURL('evolve://game/desktop-start.html');
      await win.webContents.executeJavaScript("localStorage.setItem('evolved', 'intentionally damaged test save')");
      let prompted = false;
      const proceed = await inspectStorage(win, new SaveStore(app.getPath('userData'), codec), codec, async (_, options) => {
        prompted = options.title === 'Evolve 저장 복구';
        return { response: 0 };
      });
      const recovered = await win.webContents.executeJavaScript("localStorage.getItem('evolved')");
      if (proceed) await win.loadURL('evolve://game/index.html');
      return { prompted, proceed, recovered };
    });
    assert.equal(recoveryResult.prompted, true); assert.equal(recoveryResult.proceed, true);
    assert.equal(JSON.parse(codec.decompressFromUTF16(recoveryResult.recovered)).evolution.organelles.count, 1);
    page = await ready(app);
    assert.equal((await snapshot(page)).settings.locale, 'ko-KR');
    assert.ok(fs.readdirSync(profile).some(n => n.startsWith('before-recovery-')));
    console.log('PASS: damaged storage recovery runs before game load and preserves the damaged original');

    const restoreState = JSON.parse(codec.decompressFromBase64(exported));
    restoreState.settings.locale = 'en-US';
    const restoreFile = path.join(profile, 'chosen-backup.txt');
    fs.writeFileSync(restoreFile, codec.compressToBase64(JSON.stringify(restoreState)));
    await app.evaluate(({ Menu, dialog }, file) => {
      const originalOpen = dialog.showOpenDialog; const originalMessage = dialog.showMessageBox;
      dialog.showOpenDialog = async () => { dialog.showOpenDialog = originalOpen; return { canceled: false, filePaths: [file] }; };
      dialog.showMessageBox = async () => { dialog.showMessageBox = originalMessage; return { response: 1 }; };
      Menu.getApplicationMenu().items[0].submenu.items.find(item => item.label === '백업 파일 복구').click();
    }, restoreFile);
    await page.waitForFunction(() => typeof exportGame === 'function' && JSON.parse(LZString.decompressFromBase64(exportGame())).settings.locale === 'en-US');
    assert.equal((await snapshot(page)).evolution.organelles.count, 1);
    console.log('PASS: game menu restores a chosen original-format backup');

    // exit() bypasses the close handler, exercising restart without a close backup.
    await until(() => {
      const saved = JSON.parse(codec.decompressFromBase64(fs.readFileSync(path.join(profile, 'last-save.txt'), 'utf8')));
      return saved.settings.locale === 'en-US';
    });
    const exited = app.waitForEvent('close');
    await app.evaluate(({ app }) => { setTimeout(() => app.exit(0), 0); });
    await exited; app = null;
    app = await launch(); page = await ready(app);
    assert.equal((await snapshot(page)).settings.locale, 'en-US');
    assert.equal((await snapshot(page)).evolution.organelles.count, 1);
    console.log('PASS: restart after exit without the close handler retains periodic progress');
    fs.writeFileSync(path.join(output, 'smoke-result.json'), JSON.stringify({ passed: true, platform: process.platform, version: resumed.version, packaged: Boolean(packaged), checks: ['RNA/DNA clicks','organelle production','Korean locale','save import/export','offline wiki','periodic backup','app restart','corrupt storage recovery','chosen backup restore','exit without close handler'] }, null, 2));
  } finally { if (app) await app.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
