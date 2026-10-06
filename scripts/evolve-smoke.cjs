const { _electron } = require('playwright-core');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const root = path.resolve(__dirname, '..');
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
    fs.writeFileSync(path.join(output, 'smoke-result.json'), JSON.stringify({ passed: true, platform: process.platform, version: resumed.version, packaged: Boolean(packaged), checks: ['RNA/DNA clicks','organelle production','Korean locale','save import/export','offline wiki','app restart'] }, null, 2));
  } finally { if (app) await app.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
