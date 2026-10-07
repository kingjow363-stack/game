const { decode } = require('./saves.cjs');

// Called on the local guard page before the original game can read or overwrite storage.
async function inspectStorage(win, store, codec, choose) {
  const raw = await win.webContents.executeJavaScript("localStorage.getItem('evolved')");
  let valid = false;
  if (raw) { try { decode(raw, codec, true); valid = true; } catch {} }
  if (!valid) {
    const candidate = await store.latest();
    if (raw !== null || candidate) {
      const buttons = candidate ? ['최근 정상 백업 복구', '종료', '새 게임 시작'] : ['종료', '새 게임 시작'];
      const result = await choose(win, {
        type: 'warning', title: 'Evolve 저장 복구', message: raw !== null ? '현재 저장 데이터를 읽을 수 없습니다.' : '현재 저장이 없지만 파일 백업이 있습니다.',
        detail: candidate ? `복구 가능한 백업: ${new Date(candidate.modified).toLocaleString()}\n새 게임을 선택해도 기존 데이터는 복구 전 파일로 보관합니다.` : '정상 백업을 찾지 못했습니다. 기존 데이터는 삭제 전에 별도 파일로 보관합니다.',
        buttons, defaultId: 0, cancelId: candidate ? 1 : 0, noLink: true,
      });
      if (buttons[result.response] === '종료') { return false; }
      await store.quarantine(raw);
      if (candidate && result.response === 0) {
        await win.webContents.executeJavaScript(`localStorage.setItem('evolved', ${JSON.stringify(candidate.raw)})`);
      } else await win.webContents.executeJavaScript("localStorage.removeItem('evolved')");
      win.webContents.session.flushStorageData();
    }
  }
  return true;
}

module.exports = { inspectStorage };
