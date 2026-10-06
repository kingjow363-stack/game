const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { readAsset } = require('../evolve-desktop/assets.cjs');
const app = path.resolve(__dirname, '../evolve-desktop');
const manifest = require('../evolve-desktop/upstream-manifest.json');
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

test('every vendored upstream file matches the pinned original source', () => {
  for (const [file, expected] of Object.entries(manifest.files)) assert.equal(hash(path.join(app, 'upstream', file)), expected, file);
});
test('runtime game, worker, CSS, wiki and all translations are byte-identical to upstream', () => {
  for (const [file, expected] of Object.entries(manifest.files)) {
    if (/^(evolve|wiki|strings|lib|font)\//.test(file)) assert.equal(hash(path.join(app, 'web', file)), expected, file);
  }
});
test('offline HTML scripts retain their original integrity hashes and resolve locally', () => {
  for (const file of ['index.html', 'wiki.html', 'save.html']) {
    const html = fs.readFileSync(path.join(app, 'web', file), 'utf8');
    assert.doesNotMatch(html, /<(?:script|link)\b[^>]*(?:src|href)="https?:/i);
    for (const match of html.matchAll(/<script[^>]*src="([^"]+)"[^>]*integrity="sha384-([^"]+)"[^>]*>/g)) {
      assert.equal(crypto.createHash('sha384').update(fs.readFileSync(path.join(app, 'web', match[1]))).digest('base64'), match[2]);
    }
  }
});
test('local origin serves translation JSON, worker and wiki with correct content types', async () => {
  const root = path.join(app, 'web');
  for (const [file, type] of [['strings/strings.ko-KR.json','application/json'],['evolve/evolve.js','text/javascript'],['wiki.html','text/html']]) {
    const response = await readAsset(`evolve://game/${file}`, root); assert.equal(response.status, 200); assert.ok(response.type.startsWith(type)); assert.ok(response.body.length > 100);
  }
  assert.equal((await readAsset('evolve://other/index.html',root)).status,403);
  assert.equal((await readAsset('evolve://game/..%2fmain.cjs',root)).status,403);
  assert.equal((await readAsset('evolve://game/missing.js',root)).status,404);
});
test('upstream and vendor licenses are included', () => {
  assert.match(fs.readFileSync(path.join(app,'web/LICENSE'),'utf8'),/Mozilla Public License Version 2.0/);
  assert.ok(fs.existsSync(path.join(app,'web/vendor/lato/LICENSE')));
  const notices=JSON.parse(fs.readFileSync(path.join(app,'web/vendor/NOTICES.json')));
  assert.equal(notices.length,6);
  for(const item of notices)assert.ok(fs.existsSync(path.join(app,'web/vendor',item.license)));
});
