const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

// Match the original import contract, plus the objects needed by its startup.
// Unknown fields and older versions are retained, never migrated here.
function validState(data) {
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  return object(data) && ['settings', 'stats', 'evolution', 'resource', 'race'].every(key => object(data[key]))
    && Number.isFinite(data.stats.plasmid);
}

function decode(text, codec, utf16 = false) {
  if (typeof text !== 'string' || !text.length) throw new Error('저장 데이터가 비어 있습니다.');
  let json, data;
  try {
    json = utf16 ? codec.decompressFromUTF16(text) : codec.decompressFromBase64(text.trim());
    data = JSON.parse(json);
  } catch { throw new Error('저장 데이터의 압축 또는 JSON이 손상되었습니다.'); }
  if (!validState(data)) throw new Error('Evolve 저장 데이터 형식을 확인할 수 없습니다.');
  return { data, json, text: codec.compressToBase64(json), raw: codec.compressToUTF16(json) };
}

async function atomicWrite(file, text, io = fs) {
  const temporary = `${file}.${randomUUID()}.tmp`;
  let handle;
  try {
    handle = await io.open(temporary, 'wx');
    await handle.writeFile(text, 'utf8');
    await handle.sync();
    await handle.close(); handle = null;
    await io.rename(temporary, file);
  } finally {
    if (handle) await handle.close().catch(() => {});
    await io.rm(temporary, { force: true }).catch(() => {});
  }
}

class SaveStore {
  constructor(directory, codec, { io = fs, limit = 10 } = {}) {
    this.directory = directory; this.codec = codec; this.io = io; this.limit = limit;
    this.backups = path.join(directory, 'backups');
    this.last = path.join(directory, 'last-save.txt');
    this.queue = Promise.resolve(); this.timestamp = 0;
  }
  write(text) {
    const operation = this.queue.then(async () => {
      const save = decode(text, this.codec);
      await this.io.mkdir(this.backups, { recursive: true });
      let previous;
      try { previous = await this.io.readFile(this.last, 'utf8'); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
      if (previous === save.text) return;
      this.timestamp = Math.max(Date.now(), this.timestamp + 1);
      const name = `save-${new Date(this.timestamp).toISOString().replace(/[:.]/g, '-')}-${randomUUID()}.txt`;
      // Commit a standalone recovery point before replacing the latest pointer.
      await atomicWrite(path.join(this.backups, name), save.text, this.io);
      await atomicWrite(this.last, save.text, this.io);
      const names = (await this.io.readdir(this.backups)).filter(n => /^save-.*\.txt$/.test(n)).sort().reverse();
      for (const old of names.slice(this.limit)) await this.io.unlink(path.join(this.backups, old));
    });
    this.queue = operation.catch(() => {});
    return operation;
  }
  async latest() {
    let names = [];
    try { names = (await this.io.readdir(this.backups)).filter(n => /^save-.*\.txt$/.test(n)).sort().reverse(); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    // A snapshot may have committed just before an interrupted last-save update.
    const candidates = [];
    for (const file of [...names.map(n => path.join(this.backups, n)), this.last]) {
      try {
        const stat = await this.io.stat(file);
        const save = decode(await this.io.readFile(file, 'utf8'), this.codec);
        candidates.push({ ...save, file, modified: stat.mtimeMs });
      } catch (error) {
        if (error.code && error.code !== 'ENOENT') throw error;
        // Malformed snapshots are never recovery candidates.
      }
    }
    return candidates.sort((a, b) => b.modified - a.modified)[0] || null;
  }
  async quarantine(raw) {
    await this.io.mkdir(this.directory, { recursive: true });
    await atomicWrite(path.join(this.directory, `before-recovery-${Date.now()}-${randomUUID()}.json`), JSON.stringify({ evolved: raw }), this.io);
  }
}

// Periodic backups copy the original autosave, without calling exportGame:
// exportGame changes accelerated-time bookkeeping. Only orderly close captures live state.
const closeScript = `(() => {
  const stored = () => localStorage.getItem('evolved');
  if (typeof window.exportGame !== 'function' || typeof LZString === 'undefined') return stored();
  const text = window.exportGame();
  let json, data;
  try { json = LZString.decompressFromBase64(text); data = JSON.parse(json); } catch { return stored(); }
  if (!(${validState.toString()})(data) || Object.prototype.hasOwnProperty.call(data.race, 'geck') || data.race.noexport) return stored();
  const raw = LZString.compressToUTF16(json);
  localStorage.setItem('evolved', raw);
  return raw;
})()`;

module.exports = { validState, decode, atomicWrite, SaveStore, closeScript };
