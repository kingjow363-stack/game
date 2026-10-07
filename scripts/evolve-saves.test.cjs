const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const codec = require('../evolve-desktop/upstream/lib/lz-string.min.js');
const { SaveStore, decode, atomicWrite, closeScript } = require('../evolve-desktop/saves.cjs');
const { inspectStorage } = require('../evolve-desktop/recovery.cjs');
const state = n => ({ version: '1.4.10', settings: { locale: 'ko-KR' }, stats: { plasmid: 0 },
  evolution: {}, resource: { RNA: { amount: n } }, race: {}, futureExtension: { retained: true } });
const encoded = n => codec.compressToBase64(JSON.stringify(state(n)));
async function directory(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'evolve-save-test-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true })); return dir;
}

test('original base64 and UTF16 formats preserve unknown fields and older versions', () => {
  const older = { ...state(15), version: '1.3.0' };
  const text = codec.compressToBase64(JSON.stringify(older));
  const saved = decode(text, codec);
  assert.deepEqual(decode(saved.raw, codec, true).data, older);
  assert.equal(saved.text, text);
  for (const bad of ['', 'damaged', codec.compressToBase64('{}'), codec.compressToBase64('null')]) {
    assert.throws(() => decode(bad, codec));
  }
});

test('serial backups retain ten recovery points; invalid saves cannot overwrite progress', async t => {
  const dir = await directory(t); const store = new SaveStore(dir, codec);
  await Promise.all(Array.from({ length: 14 }, (_, n) => store.write(encoded(n))));
  assert.equal((await store.latest()).data.resource.RNA.amount, 13);
  assert.equal((await fs.readdir(store.backups)).length, 10);
  await store.write(encoded(13));
  assert.equal((await fs.readdir(store.backups)).length, 10, 'unchanged states do not rotate history');
  await assert.rejects(store.write('corrupt'));
  assert.equal(await fs.readFile(store.last, 'utf8'), encoded(13));
  await store.write(encoded(14)); // A failed job does not poison the queue.
  assert.equal((await store.latest()).data.resource.RNA.amount, 14);
});

test('interrupted latest-file replacement leaves old save and a recoverable new snapshot', async t => {
  const dir = await directory(t); const store = new SaveStore(dir, codec);
  await store.write(encoded(1));
  const io = { ...fs, rename: async (from, to) => {
    if (to === store.last) throw Object.assign(new Error('disk failure'), { code: 'EIO' });
    return fs.rename(from, to);
  } };
  await assert.rejects(new SaveStore(dir, codec, { io }).write(encoded(2)), /disk failure/);
  assert.equal(await fs.readFile(store.last, 'utf8'), encoded(1));
  assert.equal((await store.latest()).data.resource.RNA.amount, 2);
  assert.ok(!(await fs.readdir(dir)).some(n => n.endsWith('.tmp')));
});

test('atomic write failure preserves destination and removes incomplete files', async t => {
  const dir = await directory(t); const file = path.join(dir, 'last-save.txt');
  await fs.writeFile(file, 'previous');
  const io = { ...fs, open: async (...args) => {
    const handle = await fs.open(...args);
    return { writeFile: () => { throw new Error('disk full'); }, close: () => handle.close() };
  } };
  await assert.rejects(atomicWrite(file, 'new', io), /disk full/);
  assert.equal(await fs.readFile(file, 'utf8'), 'previous');
  assert.deepEqual(await fs.readdir(dir), ['last-save.txt']);
});

test('recovery skips corrupt snapshots and preserves pre-recovery data separately', async t => {
  const dir = await directory(t); const store = new SaveStore(dir, codec);
  assert.equal(await store.latest(), null);
  await store.write(encoded(7));
  await fs.writeFile(store.last, 'broken');
  await fs.writeFile(path.join(store.backups, 'save-9999.txt'), 'broken');
  await fs.writeFile(path.join(store.backups, 'save-incomplete.tmp'), encoded(99));
  assert.equal((await store.latest()).data.resource.RNA.amount, 7);
  await store.quarantine('damaged original');
  const protectedFile = (await fs.readdir(dir)).find(n => n.startsWith('before-recovery-'));
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(dir, protectedFile), 'utf8')), { evolved: 'damaged original' });
});

test('close captures live progress but respects geck and noexport states', () => {
  for (const race of [{}, { geck: 0 }, { geck: 3 }, { noexport: 'Custom' }]) {
    const data = { ...state(99), race }; let stored = decode(encoded(1), codec).raw;
    const context = { LZString: codec, window: { exportGame: () => race.noexport ? 'Export is not available' : codec.compressToBase64(JSON.stringify(data)) },
      localStorage: { getItem: () => stored, setItem: (_, value) => { stored = value; } } };
    const result = vm.runInNewContext(closeScript, context);
    assert.equal(decode(result, codec, true).data.resource.RNA.amount, Object.keys(race).length ? 1 : 99);
    assert.equal(result, stored);
  }
});

test('startup protects corrupt or missing storage until a recovery choice is made', async t => {
  const dir = await directory(t); const store = new SaveStore(dir, codec);
  await store.write(encoded(40));
  for (const initial of ['corrupt', '', null]) {
    let raw = initial;
    const context = { localStorage: { getItem: () => raw, setItem: (_, value) => { raw = value; }, removeItem: () => { raw = null; } } };
    const win = { webContents: { executeJavaScript: async script => vm.runInNewContext(script, context), session: { flushStorageData() {} } } };
    assert.equal(await inspectStorage(win, store, codec, async (_, options) => {
      assert.equal(raw, initial); assert.equal(options.buttons[1], '종료'); return { response: 1 };
    }), false);
    assert.equal(raw, initial, 'cancel must not overwrite the original');
    assert.equal(await inspectStorage(win, store, codec, async () => ({ response: 0 })), true);
    assert.equal(decode(raw, codec, true).data.resource.RNA.amount, 40);
  }
});

test('startup prefers valid current saves and never resurrects backups silently', async t => {
  const dir = await directory(t); const store = new SaveStore(dir, codec);
  await store.write(encoded(100));
  let raw = decode(encoded(2), codec).raw;
  const context = { localStorage: { getItem: () => raw, removeItem: () => { raw = null; } } };
  const win = { webContents: { executeJavaScript: async script => vm.runInNewContext(script, context), session: { flushStorageData() {} } } };
  assert.equal(await inspectStorage(win, store, codec, () => assert.fail('valid save must not prompt')), true);
  assert.equal(decode(raw, codec, true).data.resource.RNA.amount, 2);
  raw = null;
  assert.equal(await inspectStorage(win, store, codec, async (_, options) => {
    assert.equal(options.buttons[2], '새 게임 시작'); return { response: 2 };
  }), true);
  assert.equal(raw, null);
  assert.equal((await store.latest()).data.resource.RNA.amount, 100);
});
