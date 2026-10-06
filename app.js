import {
  buildings, technologies, sectors, perks, resourceNames as names, fresh, costOf, canPay, build,
  research, researchCost, conquer, mine, clickPower, advance, parseSave, multiplier,
  prestige, prestigeReward, availablePoints, perkCost, buyPerk, setActive, enqueue,
  cancelQueued, production, nextGoal, unlocked,
} from './engine.mjs';

const $ = id => document.getElementById(id);
const icons = { ore: '◇', energy: 'ϟ', alloy: '▧', science: '⌬', fleet: '△' };
const key = 'exo-industries-v1'; // Keep v0.2 saves compatible.
const fmt = n => new Intl.NumberFormat('ko-KR', {
  maximumFractionDigits: Math.abs(n) < 10 ? 1 : 0, notation: Math.abs(n) >= 1e6 ? 'compact' : 'standard',
}).format(n);
const signed = n => `${n > .0001 ? '+' : ''}${fmt(Math.abs(n) < .0001 ? 0 : n)}`;
let tab = 'overview', lastSave = Date.now(), toastTimer, signature = '', savingBlocked = false;
let recoveryRaw = '', notice = '', raw = null, backup = null;
try { raw = localStorage.getItem(key); backup = localStorage.getItem(`${key}-backup`); }
catch { savingBlocked = true; notice = '저장 공간에 접근할 수 없습니다. 종료 전에 설정에서 저장 파일을 내보내세요.'; }
let state = parseSave(raw);
if (raw && !state) {
  recoveryRaw = raw;
  try { localStorage.setItem(`${key}-recovery`, raw); } catch { savingBlocked = true; }
  state = parseSave(backup);
  notice = state ? '저장 데이터 오류가 있어 마지막 정상 백업을 복구했습니다.' : '저장 데이터가 손상되어 새 화면을 열었습니다. 원본은 보존했습니다. 설정에서 백업 파일을 불러오세요.';
  if (!state) savingBlocked = true;
}
state ??= fresh();
const offlineBefore = { ...state.resources };
const elapsed = advance(state);

function toast(text) {
  $('toast').textContent = text; $('toast').classList.add('visible');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 4000);
}
function save() {
  if (savingBlocked) { $('save-status').textContent = '자동 저장 중지 · 설정 확인'; return; }
  try {
    const old = localStorage.getItem(key);
    if (parseSave(old)) localStorage.setItem(`${key}-backup`, old);
    localStorage.setItem(key, JSON.stringify(state));
    $('save-status').textContent = '자동 저장 활성';
  } catch { $('save-status').textContent = '저장 실패 · 파일로 백업하세요'; }
}
function download(text, filename) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = filename;
  document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function costHTML(cost) {
  return Object.entries(cost).map(([r, n]) => `<span class="${state.resources[r] < n ? 'missing' : ''}">${names[r]} ${fmt(n)}</span>`).join(' · ') || '추가 자원 없음';
}
function requirement(id) { return technologies.find(t => t.id === id)?.name ?? ''; }
function buildingHTML(b) {
  const locked = !unlocked(state, b), owned = state.buildings[b.id];
  return `<article class="card ${locked ? 'locked' : ''}">
    <div class="card-top"><span class="card-icon">${icons[Object.keys(b.output)[0]]}</span><span class="card-count">보유 ${owned} 시설</span></div>
    <h3>${b.name}</h3><p>${b.desc}</p>
    <div class="production-status" data-status="${b.id}"></div>
    <div class="facility-control"><span>가동 <b>${state.active[b.id]}</b> / ${owned}</span>
      <div><button data-active="${b.id}" data-delta="-1" aria-label="${b.name} 가동 수 줄이기" ${!state.active[b.id] ? 'disabled' : ''}>−</button>
      <button data-active="${b.id}" data-delta="1" aria-label="${b.name} 가동 수 늘리기" ${state.active[b.id] >= owned ? 'disabled' : ''}>+</button>
      <button data-toggle="${b.id}" ${!owned ? 'disabled' : ''}>${state.active[b.id] ? '모두 중지' : '모두 가동'}</button></div>
    </div>
    <div class="cost" data-cost-build="${b.id}"></div>
    <div class="button-row"><button class="buy" data-build="${b.id}">${locked ? `${requirement(b.tech)} 필요` : '+ 시설 건설'}</button>
    <button class="buy secondary" data-queue="${b.id}" ${locked ? 'disabled' : ''} aria-label="${b.name} 건설 예약">예약 +</button></div>
  </article>`;
}
function queueHTML() {
  return `<section class="panel queue-panel"><div class="panel-heading"><h2>건설 예약 <span>${state.queue.length}/8</span></h2><span>먼저 예약한 시설부터</span></div>
    <p class="helper">자원이 모이면 현재 가격으로 자동 건설합니다. 자원을 미리 차감하지 않으며, 일시정지 중에는 예약도 멈춥니다.</p>
    ${state.queue.length ? `<ol class="queue-list">${state.queue.map((id, i) => `<li><span>${buildings.find(b => b.id === id).name}</span><button data-cancel="${i}" aria-label="${i + 1}번째 건설 예약 취소">취소</button></li>`).join('')}</ol>` : '<p class="helper">시설의 ‘예약 +’를 눌러 다음 건설을 준비하세요.</p>'}
    <p id="queue-status" class="helper"></p></section>`;
}
function overviewHTML() {
  const goal = nextGoal(state);
  return `<div class="overview-grid"><section class="panel"><div class="panel-heading"><h2>지구 자원 채굴</h2><span>TERRA / SOL SYSTEM</span></div>
    <div class="planet-stage"><div class="orbit"></div><div class="orbit second"></div><div class="planet"></div><span class="planet-label">SECTOR 001 · HOMEWORLD</span></div>
    <button class="mine-button" data-mine></button><div class="reserve-label"><span>지구 잔여 매장량</span><span id="reserve-label"></span></div>
    <progress id="reserve-progress" max="20000"></progress><p id="reserve-warning" class="warning"></p></section>
    <section class="panel"><div class="panel-heading"><h2>지금 할 일</h2><span>완료된 영토 ${state.conquests} / ${sectors.length}</span></div>
    <h3 class="mission-title">${goal.title}</h3><p class="mission-description">${goal.desc}</p><div class="cost" id="goal-cost"></div>
    <div class="checklist">${[['산업 자동화', state.tech.includes('industry')], ['행성 물류망', state.tech.includes('logistics')], ['성간 항법', state.tech.includes('space')], ['외계 자원 확보', state.conquests >= 2]].map(([n, ok]) => `<div class="check ${ok ? 'complete' : ''}"><span>${ok ? '✓' : '○'}</span>${n}</div>`).join('')}</div>
    <button class="buy" data-go="${goal.tab}">목표 진행하기 →</button><div class="callout">환생 보상 +${prestigeReward(state)} 포인트<br>영토 정복 수² + 완료한 연구 수. 사용한 포인트도 생산 보너스에 계속 포함됩니다.</div>
    <button class="buy" data-go="prestige">환생과 영구 기술 확인 →</button></section></div>
    <div class="section-heading"><h2>기초 생산망</h2><span>BUILD YOUR FOUNDATION</span></div><div class="cards">${buildings.slice(0, 2).map(buildingHTML).join('')}</div>`;
}
function prestigeHTML() {
  return `<section class="panel"><div class="panel-heading"><h2>다음 우주로 이어지는 유산</h2><span>환생 ${state.meta.rebirths}회</span></div>
    <div class="prestige-stats"><div><small>누적 획득 포인트</small><b>${fmt(state.meta.points)}</b></div><div><small>사용 가능한 포인트</small><b>${fmt(availablePoints(state))}</b></div><div><small>이번 환생 보상</small><b>+${prestigeReward(state)}</b></div></div>
    <p class="helper">포인트를 사용해도 누적 획득 포인트 ×10%의 생산 보너스는 유지됩니다. 영구 기술은 구매 즉시 적용되며 개척 보급품은 다음 환생부터 받습니다.</p>
    <div class="callout">유지: 영구 기술 · 누적 포인트 · 환생 횟수 · 누적 정복 기록<br>초기화: 자원 · 시설 · 연구 · 영토 · 건설 예약<br>예상 보상: 영토 ${state.conquests}² + 연구 ${state.tech.length} = ${prestigeReward(state)}</div>
    <button class="buy" data-prestige>${prestigeReward(state) ? `+${prestigeReward(state)} 포인트를 받고 환생` : '보상 없이 다시 시작'}</button></section>
    <div class="section-heading"><h2>영구 기술</h2><span>우주가 바뀌어도 유지</span></div><div class="cards">${perks.map(p => `<article class="card"><div class="card-top"><span class="card-icon">✧</span><span class="card-count">${state.meta.perks[p.id]} / ${p.max}</span></div><h3>${p.name}</h3><p>${p.desc}</p><div class="cost">${perkCost(state, p)} 영구 포인트</div><button class="buy" data-perk="${p.id}" ${state.meta.perks[p.id] >= p.max || availablePoints(state) < perkCost(state, p) ? 'disabled' : ''}>${state.meta.perks[p.id] >= p.max ? '최고 단계' : '영구 기술 구매'}</button></article>`).join('')}</div>`;
}
function settingsHTML() {
  return `<section class="panel"><h2>내 게임 저장 관리</h2><p class="helper">업데이트 전 저장 파일을 내보내 두세요. v0.2 저장도 읽을 수 있으며 잘못된 파일은 현재 게임을 덮어쓰지 않습니다.</p>
    <div class="button-row"><button class="buy" data-export>현재 저장 내보내기</button><button class="buy" data-import>저장 파일 불러오기</button></div>
    <p class="helper">저장 파일에는 현재 우주와 영구 기술, 건설 예약, 일시정지 상태가 포함됩니다. 같은 PC의 Windows 앱은 기존 저장을 자동으로 이어갑니다.</p>
    <button class="buy secondary" data-recovery>보존된 손상 원본 내보내기</button>
    <div class="callout">일시정지는 재접속 후에도 유지됩니다. 실행 중 생산과 오프라인 생산을 모두 멈추며, ‘생산 재개’를 누르면 다시 진행합니다.</div>
    <button class="buy danger" data-reset>모든 진행과 영구 기록 초기화</button></section>`;
}
const headings = {
  overview: ['작전 개요', '지구의 마지막 산업 혁명은 당신의 손에서 시작됩니다.'],
  build: ['생산 시설', '시설 가동 수를 조절해 원료를 비축하고 병목을 해결하세요.'],
  research: ['기술 연구', '산업 자동화에서 특이점까지, 새로운 시대를 열어보세요.'],
  conquest: ['영토 확장', '지구를 통합하고 새로운 행성의 자원을 확보하세요.'],
  prestige: ['환생과 유산', '이번 우주의 성과를 다음 우주의 시작으로 바꾸세요.'],
  settings: ['저장과 설정', '진행을 백업하고 안전하게 이어가세요.'],
};
function structureSignature() { return JSON.stringify([tab, state.buildings, state.active, state.tech, state.conquests, state.queue, state.meta, tab === 'overview' ? nextGoal(state).title : null]); }
function renderSection() {
  const focus = document.activeElement?.closest('button')?.outerHTML;
  $('heading').textContent = headings[tab][0]; $('subtitle').textContent = headings[tab][1];
  document.querySelectorAll('[data-tab]').forEach(b => { b.classList.toggle('active', b.dataset.tab === tab); b.setAttribute('aria-current', b.dataset.tab === tab ? 'page' : 'false'); });
  let html = '';
  if (tab === 'overview') html = overviewHTML();
  if (tab === 'build') html = `${queueHTML()}<div class="callout">시설 설명은 기본값입니다. 아래 가동률은 현재 자원으로 다음 1초 동안 생산할 수 있는 비율입니다. 상단 초당 수지는 소비량을 뺀 실제 변화량입니다.</div>` + `<div class="section-heading"><h2>산업 인프라</h2><span>5 FACILITY TYPES</span></div><div class="cards">${buildings.map(buildingHTML).join('')}</div>`;
  if (tab === 'research') html = `<div class="cards">${technologies.map(t => { const done = state.tech.includes(t.id), locked = t.requires && !state.tech.includes(t.requires); return `<article class="card ${locked ? 'locked' : ''}"><div class="card-top"><span class="card-icon">⌬</span><span class="card-count">${done ? '연구 완료' : 'TECHNOLOGY'}</span></div><h3>${t.name}</h3><p>${t.desc}</p><div class="cost" data-cost-research="${t.id}"></div><button class="buy" data-research="${t.id}">${done ? '✓ 연구 완료' : locked ? `${requirement(t.requires)} 필요` : '기술 연구'}</button></article>`; }).join('')}</div>`;
  if (tab === 'conquest') html = sectors.map((s, i) => { const done = i < state.conquests, locked = i > state.conquests || !state.tech.includes(s.requires); return `<article class="panel territory ${locked ? 'locked' : ''}"><span class="territory-index">${String(i + 1).padStart(2, '0')}</span><div class="body"><h3>${s.name}</h3><p>${s.desc}</p><div class="cost" data-cost-sector="${i}"></div></div><button class="buy" data-conquer="${i}">${done ? '✓ 통합 완료' : i > state.conquests ? '이전 영토 필요' : locked ? `${requirement(s.requires)} 필요` : '영토 통합 →'}</button></article>`; }).join('');
  if (tab === 'prestige') html = prestigeHTML();
  if (tab === 'settings') html = settingsHTML();
  $('content').innerHTML = html; signature = structureSignature();
  if (focus) [...$('content').querySelectorAll('button')].find(b => b.outerHTML === focus)?.focus({ preventScroll: true });
}
function update() {
  if (signature !== structureSignature()) renderSection();
  const report = production(state);
  for (const r of Object.keys(names)) {
    $(`resource-${r}`).textContent = fmt(state.resources[r]);
    $(`rate-${r}`).textContent = `${signed(report.rates[r])} / 초`;
    $(`rate-${r}`).classList.toggle('negative', report.rates[r] < -.0001);
  }
  $('phase').textContent = state.conquests >= 6 ? 'PHASE 04 / 성간 제국' : state.tech.includes('space') ? 'PHASE 03 / 우주 시대' : state.tech.includes('industry') ? 'PHASE 02 / 산업 시대' : 'PHASE 01 / 채굴 시대';
  $('summary').textContent = `생산 배율 ×${fmt(multiplier(state))} · 환생 ${state.meta.rebirths}회 · 영구 포인트 ${fmt(state.meta.points)} · 누적 정복 ${state.meta.conquests}개`;
  $('pause').textContent = state.paused ? '생산 재개' : '일시정지'; $('pause').setAttribute('aria-pressed', String(state.paused));
  document.querySelectorAll('[data-status]').forEach(el => { const status = report.status[el.dataset.status]; el.textContent = `${status.reason} · 가동률 ${Math.round(status.fraction * 100)}%`; el.classList.toggle('negative', status.fraction < .99 && state.active[el.dataset.status] > 0); });
  document.querySelectorAll('[data-cost-build]').forEach(el => { el.innerHTML = costHTML(costOf(buildings.find(b => b.id === el.dataset.costBuild), state)); });
  document.querySelectorAll('[data-build]').forEach(el => { const b = buildings.find(b => b.id === el.dataset.build); el.disabled = !unlocked(state, b) || !canPay(state, costOf(b, state)) || state.buildings[b.id] >= 1000; });
  document.querySelectorAll('[data-queue]').forEach(el => { const b = buildings.find(b => b.id === el.dataset.queue); el.disabled = !unlocked(state, b) || state.queue.length >= 8 || state.buildings[b.id] + state.queue.filter(id => id === b.id).length >= 1000; });
  document.querySelectorAll('[data-cost-research]').forEach(el => { el.innerHTML = costHTML(researchCost(technologies.find(t => t.id === el.dataset.costResearch), state)); });
  document.querySelectorAll('[data-research]').forEach(el => { const t = technologies.find(t => t.id === el.dataset.research); el.disabled = state.tech.includes(t.id) || (t.requires && !state.tech.includes(t.requires)) || !canPay(state, researchCost(t, state)); });
  document.querySelectorAll('[data-cost-sector]').forEach(el => { el.innerHTML = costHTML(sectors[Number(el.dataset.costSector)].cost); });
  document.querySelectorAll('[data-conquer]').forEach(el => { const i = Number(el.dataset.conquer), s = sectors[i]; el.disabled = i !== state.conquests || !state.tech.includes(s.requires) || !canPay(state, s.cost); });
  if ($('reserve-label')) {
    $('reserve-label').textContent = `${fmt(state.reserve)} / 20,000`; $('reserve-progress').value = state.reserve;
    const button = document.querySelector('[data-mine]'); button.disabled = state.paused || state.reserve <= 0;
    button.textContent = state.paused ? '생산 일시정지 중' : state.reserve <= 0 ? '지구 자원 고갈' : `광석 채굴 +${clickPower(state)} ◇`;
    $('reserve-warning').textContent = state.conquests >= 2 ? '외계 채굴망 확보 완료. 지구 고갈 후에도 외계 광석으로 생산할 수 있습니다.' : state.reserve < 4000 ? '지구 자원이 얼마 남지 않았습니다. 채굴기 가동을 줄이고 달 진출을 준비하세요. 연구 보상을 받고 환생할 수도 있습니다.' : '지구 자원은 유한합니다. 달 전초기지를 확보하면 지구 고갈 후에도 광석을 생산합니다.';
    $('goal-cost').innerHTML = costHTML(nextGoal(state).cost);
  }
  if ($('queue-status') && state.queue.length) {
    const cost = costOf(buildings.find(b => b.id === state.queue[0]), state);
    const missing = Object.entries(cost).filter(([r, n]) => state.resources[r] < n).map(([r, n]) => `${names[r]} ${fmt(n - state.resources[r])}`);
    $('queue-status').textContent = state.paused ? '일시정지 중 · 예약 유지' : missing.length ? `첫 예약 대기: ${missing.join(' · ')} 더 필요` : '다음 생산 갱신에 건설됩니다.';
  }
  $('notice').textContent = notice; $('notice').hidden = !notice;
}
function sync() { advance(state); }
function switchTab(next) { if (headings[next]) { tab = next; renderSection(); update(); } }
async function importFile(file) {
  if (!file) return;
  if (file.size > 1_000_000) { toast('저장 파일이 너무 큽니다. 1MB 이하 JSON 파일을 선택하세요.'); return; }
  const parsed = parseSave(await file.text());
  if (!parsed) { toast('올바른 게임 저장 파일이 아닙니다. 현재 진행은 유지됩니다.'); return; }
  if (!confirm('이 저장 파일로 현재 진행을 바꿀까요? 현재 진행은 자동 백업합니다.')) return;
  try { localStorage.setItem(`${key}-backup`, JSON.stringify(state)); }
  catch { toast('현재 진행을 백업할 수 없어 불러오기를 중단했습니다. 먼저 저장을 내보내세요.'); return; }
  state = parsed; advance(state); savingBlocked = false; notice = '';
  // Write imported state directly so save() does not replace the pre-import backup.
  try { localStorage.setItem(key, JSON.stringify(state)); } catch { savingBlocked = true; notice = '불러왔지만 자동 저장에 실패했습니다. 종료 전에 저장 파일을 내보내세요.'; }
  signature = ''; update(); toast('저장 파일을 불러왔습니다.');
}
$('save-file').addEventListener('change', async e => { try { await importFile(e.target.files[0]); } catch { toast('저장 파일을 읽지 못했습니다. 현재 진행은 유지됩니다.'); } finally { e.target.value = ''; } });
document.addEventListener('click', e => {
  const button = e.target.closest('button'); if (!button || button.disabled) return;
  sync(); const d = button.dataset;
  if (d.tab) switchTab(d.tab); if (d.go) switchTab(d.go);
  if ('mine' in d) mine(state);
  if (d.build && build(state, d.build)) toast('생산 시설을 건설했습니다.');
  if (d.queue && enqueue(state, d.queue)) toast('건설을 예약했습니다.');
  if ('cancel' in d) cancelQueued(state, Number(d.cancel));
  if (d.active) setActive(state, d.active, state.active[d.active] + Number(d.delta));
  if (d.toggle) setActive(state, d.toggle, state.active[d.toggle] ? 0 : state.buildings[d.toggle]);
  if (d.research && research(state, d.research)) toast('새 기술을 확보했습니다.');
  if ('conquer' in d && Number(d.conquer) === state.conquests && conquer(state)) toast('새 영토가 제국에 통합되었습니다.');
  if (d.perk && buyPerk(state, d.perk)) toast('영구 기술을 강화했습니다.');
  if ('prestige' in d && confirm(`자원·시설·연구·영토·예약을 초기화하고 영구 포인트 ${prestigeReward(state)}개를 얻을까요? 영구 기술과 누적 기록은 유지됩니다.`)) {
    state = prestige(state); toast('영구 기술과 함께 새 우주를 시작합니다.');
  }
  if (button.id === 'pause') { state.paused = !state.paused; state.timestamp = Date.now(); }
  if ('export' in d) download(JSON.stringify(state, null, 2), `EXO-save-${new Date().toISOString().slice(0, 10)}.json`);
  if ('import' in d) $('save-file').click();
  if ('recovery' in d) {
    try { const original = recoveryRaw || localStorage.getItem(`${key}-recovery`); if (original) download(original, 'EXO-recovery-original.json'); else toast('보존된 손상 원본이 없습니다.'); }
    catch { toast('보존된 원본을 읽을 수 없습니다.'); }
  }
  if ('reset' in d && confirm('영구 기술과 누적 기록까지 모두 삭제할까요? 먼저 저장 내보내기를 권장합니다.')) {
    state = fresh(); savingBlocked = false; notice = ''; toast('모든 진행을 초기화했습니다.');
  }
  update(); save();
});
$('resources').innerHTML = Object.entries(names).map(([r, n]) => `<div class="resource"><div class="resource-label">${n}<span>${icons[r]}</span></div><b id="resource-${r}">0</b><small id="rate-${r}"></small></div>`).join('');
setInterval(() => { sync(); update(); if (Date.now() - lastSave >= 3000) { save(); lastSave = Date.now(); } }, 500);
window.addEventListener('pagehide', () => { sync(); save(); });
document.addEventListener('visibilitychange', () => { sync(); save(); update(); });
update(); save();
if (elapsed > 60 && !notice) {
  const gains = Object.keys(names).filter(r => state.resources[r] > offlineBefore[r] + 1).map(r => `${names[r]} +${fmt(state.resources[r] - offlineBefore[r])}`);
  toast(`오프라인 ${Math.floor(elapsed / 60)}분 반영 · ${gains.join(' · ') || '생산 자원 없음'} (최대 8시간)`);
}
