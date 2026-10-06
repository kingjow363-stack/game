export const buildings = [
 {id:'mine',name:'자동 채굴기',desc:'초당 광석 2 · 지구 매장량을 소모',cost:{ore:15},output:{ore:2}},
 {id:'solar',name:'태양광 발전소',desc:'초당 에너지 3',cost:{ore:30},output:{energy:3}},
 {id:'factory',name:'합금 공장',desc:'초당 광석 3 + 에너지 2 → 합금 1',cost:{ore:60,energy:20},input:{ore:3,energy:2},output:{alloy:1},tech:'industry'},
 {id:'lab',name:'연구소',desc:'초당 에너지 2 → 과학 1',cost:{ore:80,alloy:15},input:{energy:2},output:{science:1},tech:'industry'},
 {id:'fleet',name:'궤도 조선소',desc:'초당 합금 2 + 에너지 5 → 함대 0.2',cost:{alloy:100,energy:200},input:{alloy:2,energy:5},output:{fleet:.2},tech:'space'},
];
export const technologies = [
 {id:'industry',name:'산업 자동화',desc:'해금: 합금 공장 · 연구소',cost:{ore:50,energy:20}},
 {id:'logistics',name:'행성 물류망',desc:'모든 생산량 ×2 · 지구 영향력 확장',cost:{science:30,alloy:30},requires:'industry'},
 {id:'space',name:'성간 항법',desc:'해금: 궤도 조선소 · 우주 정복',cost:{science:100,alloy:100,energy:300},requires:'logistics'},
 {id:'singularity',name:'특이점 공학',desc:'모든 생산량 추가 ×3',cost:{science:500,alloy:500},requires:'space'},
];
export const sectors = [
 {name:'지구 산업권',desc:'대륙의 산업망을 통합합니다. 생산량 +50%.',cost:{alloy:50,energy:100},requires:'logistics'},
 {name:'달 전초기지',desc:'외계 채굴 시작 · 초당 광석 10. 지구 자원을 소모하지 않습니다.',cost:{fleet:5,alloy:100,energy:200},requires:'space'},
 {name:'화성 식민지',desc:'초당 광석 +25 · 과학 +3.',cost:{fleet:20,alloy:300,energy:500},requires:'space'},
 {name:'목성 자원권',desc:'초당 에너지 +60 · 광석 +50.',cost:{fleet:60,alloy:800,science:300},requires:'space'},
 {name:'태양계 통합',desc:'태양계를 하나의 생산망으로. 전체 생산량 ×2.',cost:{fleet:150,alloy:2000,science:800},requires:'singularity'},
 {name:'알파 센타우리',desc:'첫 성간 제국. 초당 광석 +200 · 과학 +20.',cost:{fleet:350,alloy:5000,science:2000},requires:'singularity'},
 {name:'은하 패권',desc:'이 프로토타입의 최종 목표: 은하 산업 제국 완성.',cost:{fleet:1000,alloy:15000,science:6000},requires:'singularity'},
];

export const resourceNames = { ore: '광석', energy: '에너지', alloy: '합금', science: '과학', fleet: '함대' };
export const perks = [
  { id: 'bootstrap', name: '개척 보급품', desc: '새 우주를 시작할 때 단계당 광석 50 · 에너지 30', base: 2, max: 5 },
  { id: 'efficiency', name: '정밀 공정', desc: '단계당 공장·연구소·조선소 투입 자원 5% 절감', base: 3, max: 5 },
  { id: 'memory', name: '기술 아카이브', desc: '단계당 연구 비용 5% 절감', base: 3, max: 5 },
];
const zeroResources = () => Object.fromEntries(Object.keys(resourceNames).map(id => [id, 0]));
export const fresh = (now = Date.now()) => ({
  version: 2, resources: zeroResources(),
  buildings: Object.fromEntries(buildings.map(b => [b.id, 0])),
  active: Object.fromEntries(buildings.map(b => [b.id, 0])),
  tech: [], conquests: 0, reserve: 20000, clicks: 0, timestamp: now,
  paused: false, queue: [],
  meta: { points: 0, spent: 0, rebirths: 0, conquests: 0, perks: { bootstrap: 0, efficiency: 0, memory: 0 } },
});
export const canPay = (s, cost) => Object.entries(cost).every(([r, n]) => Number.isFinite(n) && s.resources[r] >= n);
function pay(s, cost) { for (const [r, n] of Object.entries(cost)) s.resources[r] -= n; }
export const costOf = (b, s) => Object.fromEntries(Object.entries(b.cost).map(([r, n]) => [r, Math.ceil(n * 1.18 ** s.buildings[b.id])]));
export const researchCost = (t, s) => Object.fromEntries(Object.entries(t.cost).map(([r, n]) => [r, Math.ceil(n * (1 - s.meta.perks.memory * .05))]));
export const unlocked = (s, b) => !b.tech || s.tech.includes(b.tech);
export function build(s, id) {
  const b = buildings.find(b => b.id === id);
  if (!b || !unlocked(s, b) || s.buildings[id] >= 1000 || !canPay(s, costOf(b, s))) return false;
  pay(s, costOf(b, s)); s.buildings[id]++; s.active[id]++; return true;
}
export function setActive(s, id, count) {
  if (!buildings.some(b => b.id === id) || !Number.isInteger(count)) return false;
  s.active[id] = Math.max(0, Math.min(s.buildings[id], count)); return true;
}
export function enqueue(s, id) {
  const b = buildings.find(b => b.id === id);
  if (!b || !unlocked(s, b) || s.queue.length >= 8 || s.buildings[id] + s.queue.filter(item => item === id).length >= 1000) return false;
  s.queue.push(id); return true;
}
export function cancelQueued(s, index) {
  if (!Number.isInteger(index) || index < 0 || index >= s.queue.length) return false;
  s.queue.splice(index, 1); return true;
}
function processQueue(s) {
  while (s.queue.length && build(s, s.queue[0])) s.queue.shift();
}
export function research(s, id) {
  const t = technologies.find(t => t.id === id);
  if (!t || s.tech.includes(id) || (t.requires && !s.tech.includes(t.requires)) || !canPay(s, researchCost(t, s))) return false;
  pay(s, researchCost(t, s)); s.tech.push(id); return true;
}
export function conquer(s) {
  const sector = sectors[s.conquests];
  if (!sector || !s.tech.includes(sector.requires) || !canPay(s, sector.cost)) return false;
  pay(s, sector.cost); s.conquests++; s.meta.conquests++; return true;
}
export const clickPower = s => s.tech.includes('industry') ? 3 : 1;
export function mine(s) {
  if (s.paused || s.reserve <= 0) return 0;
  const amount = Math.min(s.reserve, clickPower(s));
  s.reserve -= amount; s.resources.ore += amount; s.clicks++; return amount;
}
export function multiplier(s) {
  return (1 + s.meta.points * .1) * (s.tech.includes('logistics') ? 2 : 1)
    * (s.tech.includes('singularity') ? 3 : 1) * (s.conquests >= 1 ? 1.5 : 1) * (s.conquests >= 5 ? 2 : 1);
}
function step(s, dt, status) {
  const mult = multiplier(s);
  // Off-world ore is available before factories consume it in the same tick.
  if (s.conquests >= 2) s.resources.ore += 10 * dt * mult;
  if (s.conquests >= 3) { s.resources.ore += 25 * dt * mult; s.resources.science += 3 * dt * mult; }
  if (s.conquests >= 4) { s.resources.energy += 60 * dt * mult; s.resources.ore += 50 * dt * mult; }
  if (s.conquests >= 6) { s.resources.ore += 200 * dt * mult; s.resources.science += 20 * dt * mult; }
  const efficiency = 1 - s.meta.perks.efficiency * .05;
  for (const b of buildings) {
    const count = s.active[b.id];
    if (!count) { if (status) status[b.id] = { fraction: 0, reason: s.buildings[b.id] ? '가동 중지' : '시설 없음' }; continue; }
    const wanted = count * dt * mult;
    let units = wanted, reason = '정상 가동';
    if (b.id === 'mine' && s.reserve / 2 < units) { units = s.reserve / 2; reason = '지구 매장량 부족'; }
    for (const [r, n] of Object.entries(b.input ?? {})) {
      const supported = s.resources[r] / (n * efficiency);
      if (supported < units) { units = supported; reason = `${resourceNames[r]} 부족`; }
    }
    for (const [r, n] of Object.entries(b.input ?? {})) s.resources[r] = Math.max(0, s.resources[r] - n * efficiency * units);
    for (const [r, n] of Object.entries(b.output)) s.resources[r] += n * units;
    if (b.id === 'mine') s.reserve = Math.max(0, s.reserve - 2 * units);
    if (status) status[b.id] = { fraction: wanted ? units / wanted : 0, reason };
  }
}
export function production(s) {
  const copy = structuredClone(s), before = { ...s.resources }, status = {};
  if (!s.paused) step(copy, 1, status);
  else for (const b of buildings) status[b.id] = { fraction: 0, reason: '전체 일시정지' };
  return { rates: Object.fromEntries(Object.keys(before).map(r => [r, copy.resources[r] - before[r]])), status };
}
export function advance(s, now = Date.now()) {
  if (!Number.isFinite(now) || now <= s.timestamp) return 0;
  let dt = Math.min(8 * 3600, (now - s.timestamp) / 1000);
  s.timestamp = now;
  if (s.paused) return 0;
  const elapsed = dt;
  while (dt > 1e-8) {
    processQueue(s);
    const slice = Math.min(1, dt); step(s, slice); dt -= slice;
  }
  processQueue(s); return elapsed;
}
export const prestigeReward = s => s.conquests ** 2 + s.tech.length;
export const availablePoints = s => s.meta.points - s.meta.spent;
export const perkCost = (s, p) => p.base * (s.meta.perks[p.id] + 1);
export function buyPerk(s, id) {
  const p = perks.find(p => p.id === id);
  if (!p || s.meta.perks[id] >= p.max || availablePoints(s) < perkCost(s, p)) return false;
  s.meta.spent += perkCost(s, p); s.meta.perks[id]++; return true;
}
export function prestige(s, now = Date.now()) {
  const next = fresh(now);
  next.meta = structuredClone(s.meta);
  next.meta.points += prestigeReward(s); next.meta.rebirths++;
  next.resources.ore = 50 * next.meta.perks.bootstrap;
  next.resources.energy = 30 * next.meta.perks.bootstrap;
  return next;
}
const nonnegative = n => Number.isFinite(n) && n >= 0;
const integer = n => Number.isSafeInteger(n) && n >= 0;
export function parseSave(raw) {
  try {
    const input = JSON.parse(raw);
    if (!input || (input.version !== undefined && ![1, 2].includes(input.version))) return null;
    const s = fresh();
    if (!input.resources || !Object.keys(resourceNames).every(r => nonnegative(input.resources[r]) && input.resources[r] <= 1e100)) return null;
    if (!input.buildings || !buildings.every(b => integer(input.buildings[b.id]) && input.buildings[b.id] <= 1000)) return null;
    if (!Array.isArray(input.tech) || new Set(input.tech).size !== input.tech.length || !input.tech.every(id => technologies.some(t => t.id === id))) return null;
    if (!integer(input.conquests) || input.conquests > sectors.length || !nonnegative(input.reserve) || input.reserve > 20000 || !integer(input.clicks) || !nonnegative(input.timestamp)) return null;
    const meta = input.meta ?? { points: 0, rebirths: 0, conquests: input.conquests };
    if (!['points', 'rebirths', 'conquests'].every(k => integer(meta[k]))) return null;
    const spent = meta.spent ?? 0, savedPerks = meta.perks ?? s.meta.perks;
    if (!integer(spent) || spent > meta.points || !perks.every(p => integer(savedPerks[p.id]) && savedPerks[p.id] <= p.max)) return null;
    // Reject forged/corrupt perk accounting instead of importing an inconsistent economy.
    const expectedSpent = perks.reduce((sum, p) => sum + p.base * savedPerks[p.id] * (savedPerks[p.id] + 1) / 2, 0);
    if (spent !== expectedSpent) return null;
    const active = input.active ?? input.buildings;
    if (!buildings.every(b => integer(active[b.id]) && active[b.id] <= input.buildings[b.id])) return null;
    if (input.paused !== undefined && typeof input.paused !== 'boolean') return null;
    const queue = input.queue ?? [];
    if (!Array.isArray(queue) || queue.length > 8 || !queue.every(id => buildings.some(b => b.id === id && (!b.tech || input.tech.includes(b.tech))))) return null;
    // Copy known fields only; save contents are never inserted into HTML.
    s.resources = Object.fromEntries(Object.keys(resourceNames).map(r => [r, input.resources[r]]));
    for (const b of buildings) { s.buildings[b.id] = input.buildings[b.id]; s.active[b.id] = active[b.id]; }
    s.tech = [...input.tech]; s.conquests = input.conquests; s.reserve = input.reserve;
    s.clicks = input.clicks; s.timestamp = input.timestamp; s.paused = input.paused ?? false; s.queue = [...queue];
    s.meta = { points: meta.points, spent, rebirths: meta.rebirths, conquests: meta.conquests,
      perks: Object.fromEntries(perks.map(p => [p.id, savedPerks[p.id]])) };
    return s;
  } catch { return null; }
}
export const restore = (raw, now = Date.now()) => parseSave(raw) ?? fresh(now);
export function nextGoal(s) {
  if (!s.buildings.mine) return { title: '첫 자동 채굴기 건설', desc: '광석 15개를 모아 자동 채굴기를 건설하세요. 이후부터는 자동으로 광석을 생산합니다.', tab: 'build', cost: costOf(buildings[0], s) };
  if (!s.buildings.solar) return { title: '생산망에 전력 공급', desc: '태양광 발전소를 건설해 연구와 공장에 필요한 에너지를 모으세요.', tab: 'build', cost: costOf(buildings[1], s) };
  if (!s.tech.includes('industry')) return { title: '산업 자동화 연구', desc: '합금 공장과 연구소를 해금하고 클릭 채굴량을 3으로 높입니다.', tab: 'research', cost: researchCost(technologies[0], s) };
  if (!s.buildings.factory) return { title: '첫 합금 공장 건설', desc: '광석과 에너지를 합금으로 가공하세요. 광석을 비축하려면 공장 가동 수를 줄일 수 있습니다.', tab: 'build', cost: costOf(buildings[2], s) };
  if (!s.buildings.lab) return { title: '연구소 건설', desc: '과학을 생산해 행성 물류망과 성간 항법을 연구하세요.', tab: 'build', cost: costOf(buildings[3], s) };
  if (s.conquests >= sectors.length) return { title: '은하 산업 제국 완성', desc: '환생 보상으로 영구 기술을 발전시키고 다음 우주에 도전하세요.', tab: 'prestige', cost: {} };
  const energyDemand = buildings.reduce((sum, b) => sum + (b.input?.energy ?? 0) * s.active[b.id] * (1 - s.meta.perks.efficiency * .05), 0);
  const energySupply = s.active.solar * 3 + (s.conquests >= 4 ? 60 : 0);
  if (energySupply <= energyDemand && s.resources.energy < 500) return { title: '전력 생산 여유 확보', desc: '공장·연구소·조선소가 에너지를 모두 소비하고 있습니다. 발전소를 늘리거나 일부 시설을 멈춰 연구와 정복에 쓸 에너지를 비축하세요.', tab: 'build', cost: costOf(buildings[1], s) };
  const sector = sectors[s.conquests];
  if (!sector) return { title: '은하 산업 제국 완성', desc: '환생 보상으로 영구 기술을 발전시키고 다음 우주에 도전하세요.', tab: 'prestige', cost: {} };
  if (!s.tech.includes(sector.requires)) {
    let t = technologies.find(t => t.id === sector.requires);
    while (t.requires && !s.tech.includes(t.requires)) t = technologies.find(x => x.id === t.requires);
    return { title: `${t.name} 연구`, desc: t.desc, tab: 'research', cost: researchCost(t, s) };
  }
  if (sector.cost.fleet && !s.buildings.fleet) return { title: '궤도 조선소 건설', desc: '합금과 에너지로 함대를 생산합니다. 충분히 모이면 조선소를 멈춰 합금을 확보하세요.', tab: 'build', cost: costOf(buildings[4], s) };
  return { title: sector.name, desc: sector.desc, tab: 'conquest', cost: sector.cost };
}
