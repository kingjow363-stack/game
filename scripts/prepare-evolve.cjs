const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const app = path.join(root, 'evolve-desktop');
const upstream = path.join(app, 'upstream');
const web = path.join(app, 'web');
const manifest = require(path.join(app, 'upstream-manifest.json'));

// Preserve the pinned baseline. Future gameplay mods must use a separate patch/build stage.
for (const [file, expected] of Object.entries(manifest.files)) {
  const actual = crypto.createHash('sha256').update(fs.readFileSync(path.join(upstream, file))).digest('hex');
  if (actual !== expected) throw new Error(`Original Evolve file changed: ${file}`);
}
fs.rmSync(web, { recursive: true, force: true });
fs.mkdirSync(web, { recursive: true });
for (const name of ['evolve', 'wiki', 'lib', 'font', 'strings', 'index.html', 'wiki.html', 'save.html', 'package.json', 'LICENSE', 'evolved.ico', 'evolved-light.ico']) {
  fs.cpSync(path.join(upstream, name), path.join(web, name), { recursive: true });
}
fs.copyFileSync(path.join(app, 'desktop-start.html'), path.join(web, 'desktop-start.html'));
const libraries = {
  'jquery@3.6.3/dist/jquery.min.js': 'jquery/dist/jquery.min.js',
  'vue@2.7.14/dist/vue.min.js': 'vue/dist/vue.min.js',
  'buefy@0.9.22/dist/buefy.min.js': 'buefy/dist/buefy.min.js',
  '@popperjs/core@2.9.2/dist/umd/popper.min.js': '@popperjs/core/dist/umd/popper.min.js',
  'sortablejs@1.10.2/Sortable.min.js': 'sortablejs/Sortable.min.js',
  'chart.js@3.8.2/dist/chart.min.js': 'chart.js/dist/chart.min.js',
};
fs.mkdirSync(path.join(web, 'vendor'), { recursive: true });
const notices = [];
for (const [cdnPath, installedPath] of Object.entries(libraries)) {
  const pkg = installedPath.startsWith('@') ? installedPath.split('/').slice(0, 2).join('/') : installedPath.split('/')[0];
  const from = path.join(root, 'node_modules', installedPath);
  const name = `${pkg.replace('/', '-')}.js`;
  fs.copyFileSync(from, path.join(web, 'vendor', name));
  const pkgDir = path.join(root, 'node_modules', pkg);
  const license = fs.readdirSync(pkgDir).find(f => /^licen[sc]e(?:\.md|\.txt)?$/i.test(f));
  if (!license) throw new Error(`License file missing for ${pkg}`);
  const licenseName = `${pkg.replace('/', '-')}-LICENSE.txt`;
  fs.copyFileSync(path.join(pkgDir, license), path.join(web, 'vendor', licenseName));
  notices.push({ package: pkg, version: JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'))).version, license: licenseName });
  for (const htmlName of ['index.html', 'wiki.html']) {
    const target = path.join(web, htmlName);
    let html = fs.readFileSync(target, 'utf8');
    const url = `https://unpkg.com/${cdnPath}`;
    if (!html.includes(url)) continue;
    const tag = html.match(new RegExp(`<script[^>]+src="${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>`))?.[0];
    const expected = tag?.match(/integrity="sha384-([^"]+)"/)?.[1];
    const actual = crypto.createHash('sha384').update(fs.readFileSync(from)).digest('base64');
    if (!expected || actual !== expected) throw new Error(`Original SRI mismatch: ${cdnPath}`);
    html = html.replace(url, `vendor/${name}`); // Keep original SRI and crossorigin intact.
    fs.writeFileSync(target, html);
  }
}
// Package the same Lato typeface locally; other fonts use the original system fallbacks.
const fontRoot = path.join(root, 'node_modules', '@fontsource', 'lato');
fs.cpSync(fontRoot, path.join(web, 'vendor', 'lato'), { recursive: true });
for (const htmlName of ['index.html', 'wiki.html', 'save.html']) {
  const target = path.join(web, htmlName);
  let html = fs.readFileSync(target, 'utf8');
  html = html.replace('https://fonts.googleapis.com/css?family=Lato&display=swap', 'vendor/lato/400.css');
  html = html.replace(/\s*<script async src="https:\/\/www\.googletagmanager\.com[^\"]*"><\/script>/g, '');
  // Original inline gtag queue remains so game event calls do not require code changes.
  if (/<(?:script|link)\b[^>]*(?:src|href)="https?:/i.test(html)) throw new Error(`External runtime asset remains: ${htmlName}`);
  fs.writeFileSync(target, html);
}
fs.writeFileSync(path.join(web, 'vendor', 'NOTICES.json'), JSON.stringify(notices, null, 2));
console.log(`Prepared original Evolve ${manifest.version}: ${Object.keys(manifest.files).length} upstream files verified; all 6 scripts match upstream SRI.`);
