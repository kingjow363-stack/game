import test from 'node:test';import assert from 'node:assert/strict';import {fresh,mine,build,research,conquer,advance,restore,prestige,multiplier,setActive,enqueue,cancelQueued,production,parseSave,buyPerk,availablePoints,researchCost,technologies,nextGoal}from './engine.mjs';
test('채굴은 유한 매장량을 소모하고 건설은 비용을 차감한다',()=>{const s=fresh(0);assert.equal(build(s,'mine'),false);for(let i=0;i<15;i++)mine(s);assert.equal(build(s,'mine'),true);assert.equal(s.resources.ore,0);advance(s,1000);assert.equal(s.resources.ore,2);assert.equal(s.reserve,19983);s.reserve=0;assert.equal(mine(s),0)});
test('연구 선행조건, 자동 생산 투입 자원, 영토 순서',()=>{const s=fresh(0);s.resources={ore:10000,energy:10000,alloy:10000,science:10000,fleet:10000};assert.equal(research(s,'space'),false);assert.equal(build(s,'factory'),false);for(const id of ['industry','logistics','space'])assert.equal(research(s,id),true);assert.equal(build(s,'factory'),true);s.resources.energy=0;const before=s.resources.alloy;advance(s,1000);assert.equal(s.resources.alloy,before);s.resources.energy=10000;assert.equal(conquer(s),true);assert.equal(conquer(s),true);s.reserve=0;const ore=s.resources.ore;advance(s,2000);assert.ok(s.resources.ore>ore)});
test('오프라인은 최대 8시간이고 중복 지급하지 않는다',()=>{const s=fresh(0);s.buildings.solar=1;s.active.solar=1;advance(s,10*3600*1000);assert.equal(s.resources.energy,8*3600*3);advance(s,10*3600*1000);assert.equal(s.resources.energy,8*3600*3)});
test('환생은 진행을 초기화하고 영구 보너스와 누적 정복을 유지한다',()=>{const s=fresh(0);s.conquests=3;s.meta.conquests=5;s.meta.points=2;const n=prestige(s,100);assert.equal(n.meta.points,11);assert.equal(n.meta.rebirths,1);assert.equal(n.meta.conquests,5);assert.equal(n.reserve,20000);assert.equal(n.conquests,0);assert.equal(multiplier(n),2.1);assert.deepEqual(restore(JSON.stringify(n)),n);assert.deepEqual(restore('bad',100),fresh(100))});
test('전체 진행 경로로 은하 정복 후 환생 가능',()=>{const s=fresh(0);for(const r in s.resources)s.resources[r]=1e7;for(const id of ['industry','logistics','space','singularity'])assert.equal(research(s,id),true);for(let i=0;i<7;i++)assert.equal(conquer(s),true);assert.equal(conquer(s),false);assert.equal(prestige(s).meta.points,53)});

test('가동 중지한 시설은 원료를 소비하지 않고 재가동할 수 있다', () => {
  const s = fresh(0); s.tech = ['industry']; s.resources.ore = 100; s.resources.energy = 100;
  build(s, 'factory'); setActive(s, 'factory', 0);
  const before = structuredClone(s.resources); advance(s, 1000); assert.deepEqual(s.resources, before);
  setActive(s, 'factory', 99); assert.equal(s.active.factory, 1); advance(s, 2000);
  assert.equal(s.resources.alloy, 1); assert.equal(s.resources.ore, before.ore - 3);
});
test('건설 예약은 자원을 미리 쓰지 않고 순서와 가격 상승을 지킨다', () => {
  const s = fresh(0); s.resources.ore = 30;
  assert.equal(enqueue(s, 'solar'), true); assert.equal(enqueue(s, 'mine'), true);
  assert.equal(s.resources.ore, 30); advance(s, 1000);
  assert.equal(s.buildings.solar, 1); assert.equal(s.buildings.mine, 0); assert.deepEqual(s.queue, ['mine']);
  s.resources.ore = 32; enqueue(s, 'mine'); advance(s, 2000);
  assert.equal(s.buildings.mine, 2); assert.equal(s.resources.ore, 1); // 32 - 15 + 2 production - 18
  assert.deepEqual(s.queue, []);
});
test('예약 취소와 최대 8개 제한 및 잠긴 시설 예약 방지', () => {
  const s = fresh(0); assert.equal(enqueue(s, 'factory'), false);
  for (let i = 0; i < 8; i++) assert.equal(enqueue(s, 'mine'), true);
  assert.equal(enqueue(s, 'mine'), false); assert.equal(cancelQueued(s, 3), true);
  assert.equal(s.queue.length, 7); assert.equal(cancelQueued(s, -1), false);
});
test('초당 수지와 병목 계산은 상태를 바꾸지 않는다', () => {
  const s = fresh(0); s.buildings.factory = s.active.factory = 1; s.resources.ore = 2; s.resources.energy = 10;
  const before = structuredClone(s), p = production(s);
  assert.equal(p.status.factory.reason, '광석 부족'); assert.equal(p.rates.ore, -2);
  assert.ok(Math.abs(p.rates.alloy - 2 / 3) < 1e-10); assert.deepEqual(s, before);
});
test('일시정지는 저장 복원 후에도 오프라인 생산과 예약을 멈춘다', () => {
  const s = fresh(0); s.paused = true; s.resources.ore = 100; enqueue(s, 'mine');
  s.buildings.solar = s.active.solar = 1;
  const loaded = parseSave(JSON.stringify(s)); advance(loaded, 8 * 3600 * 1000);
  assert.equal(loaded.resources.energy, 0); assert.equal(loaded.buildings.mine, 0); assert.equal(mine(loaded), 0);
  loaded.paused = false; advance(loaded, 8 * 3600 * 1000 + 1000); assert.equal(loaded.resources.energy, 3);
});
test('시계가 뒤로 가도 같은 구간의 생산을 다시 지급하지 않는다', () => {
  const s = fresh(10000); s.buildings.solar = s.active.solar = 1;
  advance(s, 5000); assert.equal(s.timestamp, 10000); advance(s, 11000); assert.equal(s.resources.energy, 3);
});
test('v0.2 저장의 시설·환생 기록을 잃지 않고 이전한다', () => {
  const old = { resources: { ore: 10, energy: 20, alloy: 30, science: 40, fleet: 5 }, buildings: { mine: 3, solar: 2, factory: 1, lab: 1, fleet: 1 }, tech: ['industry','logistics','space'], conquests: 2, meta: { points: 12, rebirths: 3, conquests: 7 }, reserve: 12345, clicks: 55, timestamp: 1000 };
  const loaded = parseSave(JSON.stringify(old)); assert.ok(loaded); assert.deepEqual(loaded.resources, old.resources);
  assert.deepEqual(loaded.active, old.buildings); assert.equal(loaded.meta.points, 12); assert.equal(loaded.meta.spent, 0); assert.equal(loaded.version, 2);
  assert.deepEqual(parseSave(JSON.stringify(loaded)), loaded);
});
test('잘못된 저장 버전·가동 수·기술·포인트 계산을 거부한다', () => {
  for (const mutate of [s=>s.version=99, s=>s.active.mine=3, s=>s.tech=['unknown'], s=>s.queue=['factory'], s=>s.meta.perks.bootstrap=1, s=>s.resources.ore=-1, s=>s.paused='yes']) {
    const s = fresh(0); mutate(s); assert.equal(parseSave(JSON.stringify(s)), null);
  }
});
test('영구 기술 구입은 누적 생산 보너스를 유지하고 다음 환생에 적용한다', () => {
  const s = fresh(0); s.meta.points = 20; const initial = multiplier(s);
  assert.equal(buyPerk(s, 'bootstrap'), true); assert.equal(availablePoints(s), 18); assert.equal(multiplier(s), initial);
  assert.equal(s.resources.ore, 0); const next = prestige(s, 1000);
  assert.equal(next.resources.ore, 50); assert.equal(next.resources.energy, 30); assert.equal(next.meta.perks.bootstrap, 1);
  assert.deepEqual(parseSave(JSON.stringify(next)), next);
});
test('공정 효율은 투입만 줄이고 연구 비용 절감도 적용한다', () => {
  const s = fresh(0); s.meta.points = 20; buyPerk(s, 'efficiency'); buyPerk(s, 'memory');
  s.buildings.factory = s.active.factory = 1; s.resources.ore = 100; s.resources.energy = 100;
  advance(s, 1000); assert.ok(Math.abs(s.resources.ore - (100 - 3 * 3 * .95)) < 1e-10);
  assert.equal(s.resources.alloy, 3); assert.equal(researchCost(technologies[0], s).ore, 48);
});
test('새 게임 목표는 실제 다음 행동부터 안내하고 연구만 해도 환생 보상을 준다', () => {
  const s = fresh(0); assert.equal(nextGoal(s).title, '첫 자동 채굴기 건설');
  s.resources.ore = 100; build(s, 'mine'); assert.equal(nextGoal(s).title, '생산망에 전력 공급');
  s.tech = ['industry']; assert.equal(prestige(s).meta.points, 1);
});
test('초기 자원 주입 없이 지구 자원이 남은 상태에서 달에 도달한다', () => {
  const s = fresh(0); let now = 0;
  function waitUntil(predicate) { for (let i = 0; !predicate() && i < 3600; i++) { now += 1000; advance(s, now); } assert.ok(predicate(), '진행에 필요한 자원을 생산해야 함'); }
  function afford(cost) { waitUntil(() => Object.entries(cost).every(([r,n]) => s.resources[r] >= n)); }
  for (let i = 0; i < 15; i++) mine(s); build(s, 'mine');
  afford({ore:30}); build(s,'solar'); afford({ore:36}); build(s,'solar');
  afford({ore:50,energy:20}); research(s,'industry');
  afford({ore:60,energy:20}); build(s,'factory');
  afford({alloy:15}); setActive(s,'factory',0); afford({ore:80}); build(s,'lab'); setActive(s,'factory',1);
  afford({science:30,alloy:30}); research(s,'logistics');
  afford({alloy:50,energy:100}); conquer(s);
  afford({science:100,alloy:100,energy:300}); research(s,'space');
  setActive(s,'factory',0); afford({ore:42}); build(s,'solar'); afford({ore:50}); build(s,'solar'); setActive(s,'factory',1);
  afford({alloy:100,energy:200}); build(s,'fleet');
  afford({fleet:5}); setActive(s,'fleet',0); afford({alloy:100,energy:200}); assert.equal(conquer(s),true);
  assert.equal(s.conquests,2); assert.ok(s.reserve > 0); assert.ok(now < 3600*1000);
});
