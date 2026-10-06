const fs = require('node:fs/promises');
const path = require('node:path');
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.eot': 'application/vnd.ms-fontobject',
  '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8',
};
async function readAsset(url, root) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'evolve:' || parsed.hostname !== 'game') return { status: 403, body: 'Unknown origin' };
    const relative = decodeURIComponent(parsed.pathname).replace(/^\/+/, '') || 'index.html';
    const file = path.resolve(root, relative);
    if (!file.startsWith(path.resolve(root) + path.sep)) return { status: 403, body: 'Outside game assets' };
    const body = await fs.readFile(file);
    return { status: 200, body, type: types[path.extname(file)] || 'text/plain; charset=utf-8' };
  } catch (error) {
    return { status: error.code === 'ENOENT' || error.code === 'EISDIR' ? 404 : 400, body: 'Asset unavailable' };
  }
}
module.exports = { readAsset };
