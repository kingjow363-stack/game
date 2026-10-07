// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
// Desktop industry expansion. Original Evolve remains in ../upstream.
export const REGIONS = {
  moon: { label: '달', era: 'space', area: 'spc_moon', system: 'solar', support: 'moon_base' },
  mars: { label: '화성', era: 'space', area: 'spc_red', system: 'solar', support: 'spaceport' },
  belt: { label: '소행성대', era: 'space', area: 'spc_belt', system: 'solar', support: 'space_station' },
  gas: { label: '가스 행성', era: 'space', area: 'spc_gas', system: 'solar' },
  alpha: { label: '알파 센타우리', era: 'interstellar', area: 'int_alpha', system: 'alpha', support: 'starport' },
  nebula: { label: '성운', era: 'interstellar', area: 'int_nebula', system: 'nebula', support: 'nexus' },
  neutron: { label: '중성자별', era: 'interstellar', area: 'int_neutron', system: 'neutron' },
};
// The list is deliberately explicit: missions, reset triggers and prestige purchases
// must never become automatic just because they appear in an upstream action table.
const facility = (id, region, label, weight, kind, outputs = []) => ({ ...REGIONS[region], id, region, label, weight, kind, outputs });
export const FACILITIES = [
  facility('moon_base','moon','달 기지',15,'support'),
  facility('iridium_mine','moon','달 이리듐 광산',15,'mining',['Iridium']),
  facility('helium_mine','moon','달 헬륨 광산',15,'fuel',['Helium_3']),
  facility('spaceport','mars','화성 우주항',25,'support'),
  facility('living_quarters','mars','화성 거주 구역',10,'support'),
  facility('red_mine','mars','화성 광산',25,'mining',['Copper','Titanium']),
  facility('biodome','mars','화성 생태 돔',15,'fuel',['Food']),
  facility('exotic_lab','mars','화성 특수 연구소',40,'research',['Knowledge']),
  facility('space_station','belt','소행성 우주 정거장',20,'support'),
  facility('iron_ship','belt','철 채굴선',25,'mining',['Iron']),
  facility('iridium_ship','belt','이리듐 채굴선',30,'mining',['Iridium']),
  facility('elerium_ship','belt','엘레륨 채굴선',45,'mining',['Elerium']),
  facility('gas_mining','gas','가스 행성 채굴',30,'fuel',['Helium_3']),
  facility('starport','alpha','성간 우주항',50,'support'),
  facility('mining_droid','alpha','채굴 드로이드',60,'mining',['Adamantite','Uranium','Coal','Aluminium']),
  facility('laboratory','alpha','성간 연구소',80,'research',['Knowledge']),
  facility('nexus','nebula','성운 연결 기지',70,'support'),
  facility('harvester','nebula','성운 수집기',80,'fuel',['Helium_3','Deuterium']),
  facility('elerium_prospector','nebula','엘레륨 탐사기',100,'mining',['Elerium']),
  facility('neutron_miner','neutron','중성자 채굴기',150,'mining',['Neutronium']),
];
export const BY_ID = Object.fromEntries(FACILITIES.map(f => [f.id, f]));
export const GOALS = [
  { id:'lunar', label:'달 채굴 기반', target:60, metric:m=>m.regions.moon, reward:'달 자동 증설 · 달 생산 ×1.5' },
  { id:'mars', label:'화성 산업 정착', target:120, metric:m=>m.regions.mars, reward:'화성 자동 증설 · 화성 생산 ×1.5' },
  { id:'belt', label:'소행성 채굴망', target:100, metric:m=>m.regions.belt, reward:'소행성·가스 행성 자동 증설 · 소행성 생산 ×2' },
  { id:'planet', label:'행성 산업권', target:500, metric:m=>m.regions.mars, reward:'화성 생산 추가 ×2 · 행성 단위 정책' },
  { id:'stock', label:'궤도 물류 비축', target:200000, metric:(m,g)=>g.resource?.Titanium?.amount || 0, reward:'우주 시설 건설 비용 −5%' },
  { id:'science', label:'우주 연구 협력', target:5, metric:m=>m.research, reward:'전체 연구 생산 ×1.25' },
  { id:'solar', label:'태양계 산업 통합', target:1000, metric:m=>m.solar, reward:'대상 우주 생산 ×2 · 태양계 일괄 정책 · 주기당 2회 구매' },
  { id:'solar2', label:'태양계 거대 산업', target:10000, metric:m=>m.solar, reward:'태양계 보정 ×2 → ×5 · 주기당 3회 구매' },
  { id:'stellar', label:'성간 산업 개척', target:400, metric:m=>m.remote, reward:'성간 시설 자동 증설 · 성간 생산 ×1.5' },
  { id:'network', label:'성간 산업망', target:1500, metric:m=>m.solar>=1000 && m.remoteSystems>=2 ? m.remote : 0, reward:'대상 우주 생산 추가 ×2 · 성간 일괄 정책' },
  { id:'network2', label:'성간 산업 연합', target:10000, metric:m=>m.solar>=1000 && m.remoteSystems>=3 ? m.remote : 0, reward:'산업망 보정 ×2 → ×3' },
];
export const UPGRADES = {
  production:{ label:'문명 생산 기록', currency:'civil', base:2, max:5, description:'전체 생산 ×1.2 / 단계' },
  research:{ label:'연구 지식 계승', currency:'civil', base:2, max:5, description:'연구 생산 ×1.2 / 단계' },
  economy:{ label:'표준 건설 설계', currency:'civil', base:3, max:5, description:'지상·우주 시설 비용 ×0.96 / 단계' },
  supplies:{ label:'문명 재건 보급', currency:'civil', base:2, max:3, description:'다음 문명에서 자원 해금 시 1회 시작 자원 지급' },
  automation:{ label:'산업 운영 기억', currency:'stellar', base:2, max:1, description:'이전에 해금한 자동화를 해당 지역 재진입 시 사용' },
  space:{ label:'항성 생산 기술', currency:'stellar', base:2, max:5, description:'대상 우주 생산 ×1.5 / 단계' },
  launch:{ label:'우주 진입 설계', currency:'stellar', base:2, max:3, description:'우주 연구·탐사 임무 비용 ×0.9 / 단계 (기존 연구 선행 조건 유지)' },
};
const number = (n, fallback=0) => Number.isFinite(n) && n>=0 ? n : fallback;
export function ensureIndustry(g) {
  if (!g.industryExpansion) g.industryExpansion = {};
  const s = g.industryExpansion;
  // Do not overwrite an unknown future schema.
  if (s.version && s.version !== 1) return null;
  s.version = 1;
  s.legacy ??= { civil:0, stellar:0, earnedCivil:0, earnedStellar:0, upgrades:{}, completed:{} };
  for (const k of ['civil','stellar','earnedCivil','earnedStellar']) s.legacy[k] = number(s.legacy[k]);
  s.legacy.upgrades ??= {}; s.legacy.completed ??= {};
  for (const [id,u] of Object.entries(UPGRADES)) s.legacy.upgrades[id] = Math.min(u.max, Math.floor(number(s.legacy.upgrades[id])));
  s.run ??= { goals:{}, peak:0, remotePeak:0, supplies:{}, supplyLevel:0, builds:0 };
  s.run.goals ??= {}; s.run.supplies ??= {};
  s.rules ??= {}; s.policies ??= {};
  s.enabled = s.enabled === true;
  s.reserve = Math.max(0, Math.min(0.95, number(s.reserve, 0.3)));
  s.interval = Math.max(5, Math.min(60, number(s.interval, 10)));
  s.shortageFirst = s.shortageFirst !== false;
  for (const f of FACILITIES) {
    s.rules[f.id] ??= { enabled:false, cap:30, priority:5 };
    const r = s.rules[f.id]; r.enabled = r.enabled === true;
    r.cap = Math.min(10000, Math.max(0, Math.floor(number(r.cap,30))));
    r.priority = Math.min(10, Math.max(1, Math.floor(number(r.priority,5))));
  }
  return s;
}
export function spaceEra(g) { return g.race?.species !== 'protoplasm' && (g.tech?.space || 0)>=3 && !Object.hasOwn(g.race || {},'geck') && !g.sim; }
export function restricted(g) { return !!(g.sim || g.race?.no_plasmid || g.race?.no_crispr); }
export function metrics(g, active = {}) {
  const regions = Object.fromEntries(Object.keys(REGIONS).map(k=>[k,0])); let research=0;
  if (spaceEra(g)) for (const f of FACILITIES) {
    const count = Math.min(number(g[f.era]?.[f.id]?.count),number(active[f.id]));
    regions[f.region] += count * f.weight;
    if(f.kind==='research') research += count;
  }
  const systems = Object.fromEntries(['solar','alpha','nebula','neutron'].map(k=>[k,0]));
  for(const [r,n] of Object.entries(regions)) systems[REGIONS[r].system] += n;
  const remote = systems.alpha + systems.nebula + systems.neutron;
  return { regions, systems, solar:systems.solar, remote, total:systems.solar+remote, research, remoteSystems:['alpha','nebula','neutron'].filter(k=>systems[k]>0).length };
}
export function updateGoals(g, m) {
  const s=ensureIndustry(g); if (!s || !spaceEra(g)) return [];
  s.run.peak = Math.max(number(s.run.peak),m.total); s.run.remotePeak = Math.max(number(s.run.remotePeak),m.remote);
  const unlocked=[];
  for(const goal of GOALS) if(!s.run.goals[goal.id] && goal.metric(m,g)>=goal.target) {
    s.run.goals[goal.id]=true; s.legacy.completed[goal.id]=true; unlocked.push(goal.id);
  }
  return unlocked;
}
export function autoUnlocked(g, region) {
  const s=ensureIndustry(g); if(!s || !spaceEra(g)) return false;
  const id={moon:'lunar',mars:'mars',belt:'belt',gas:'belt',alpha:'stellar',nebula:'stellar',neutron:'stellar'}[region];
  const arrived=FACILITIES.some(f=>f.region===region && (g[f.era]?.[f.id]?.count || 0)>0);
  return !!(s.run.goals[id] || (!restricted(g) && s.legacy.upgrades.automation && s.legacy.completed[id] && arrived));
}
export function productionFactors(g,id) {
  const s=ensureIndustry(g),f=BY_ID[id];
  if(!s || !f || !spaceEra(g)) return {regional:1,solar:1,network:1,legacy:1,total:1};
  const q=s.run.goals;
  let regional=f.region==='moon'&&q.lunar ? 1.5 : f.region==='mars'&&q.mars ? 1.5 : f.region==='belt'&&q.belt ? 2 : f.era==='interstellar'&&q.stellar ? 1.5 : 1;
  if(f.region==='mars' && q.planet) regional*=2;
  const solar=q.solar2?5:q.solar?2:1, network=q.network2?3:q.network?2:1;
  const legacy=restricted(g)?1:1.5**s.legacy.upgrades.space;
  return {regional,solar,network,legacy,total:regional*solar*network*legacy};
}
export function scaleProduction(g,id,value) {
  const factor=productionFactors(g,id).total;
  if(factor===1) return value;
  if(typeof value==='number') return value*factor;
  if(value && typeof value==='object') { const copy={...value}; for(const key of ['b','f','n']) if(Number.isFinite(copy[key])) copy[key]*=factor; return copy; }
  return value;
}
export function legacyMultiplier(g,type) {
  const s=ensureIndustry(g); if(!s || restricted(g)) return 1;
  return type==='research' ? 1.2**s.legacy.upgrades.research : 1.2**s.legacy.upgrades.production;
}
export function researchMultiplier(g) {
  const s=ensureIndustry(g); return legacyMultiplier(g,'research')*(spaceEra(g) && s?.run.goals.science ? 1.25:1);
}
export function costFactor(g,kind) {
  const s=ensureIndustry(g); if(!s) return 1;
  const legacy=restricted(g)?1:0.96**s.legacy.upgrades.economy;
  return legacy*(kind==='space' && spaceEra(g) && s.run.goals.stock ? 0.95:1);
}
export function launchFactor(g) { const s=ensureIndustry(g); return !s||restricted(g)?1:0.9**s.legacy.upgrades.launch; }
export function resetReward(g,type) {
  const s=ensureIndustry(g); if(!s || g.sim) return {civil:0,stellar:0};
  const peak=number(s.run.peak), remote=number(s.run.remotePeak);
  return {civil:peak>=120?Math.floor(Math.log2(1+peak/100)):0,stellar:type!=='mad'&&remote>=400?Math.floor(Math.log2(1+remote/200)):0};
}
export function awardReset(g,type) {
  const s=ensureIndustry(g); if(!s || g.sim) return;
  const reward=resetReward(g,type);
  for(const k of ['civil','stellar']) s.legacy[k]+=reward[k];
  s.legacy.earnedCivil+=reward.civil; s.legacy.earnedStellar+=reward.stellar;
  s.lastReset={type,...reward};
  s.run={goals:{},peak:0,remotePeak:0,supplies:{},supplyLevel:s.legacy.upgrades.supplies,builds:0};
  s.enabled=false; // Keep policies, but let the player enable spending for the new run.
}
export function upgradeCost(g,id) { const s=ensureIndustry(g),u=UPGRADES[id]; return s&&u ? u.base*2**s.legacy.upgrades[id] : Infinity; }
export function buyUpgrade(g,id) {
  const s=ensureIndustry(g),u=UPGRADES[id]; if(!s||!u||g.sim) return false;
  const cost=upgradeCost(g,id);
  if(s.legacy.upgrades[id]>=u.max || s.legacy[u.currency]<cost) return false;
  s.legacy[u.currency]-=cost; s.legacy.upgrades[id]++; return true;
}
export function grantSupplies(g) {
  const s=ensureIndustry(g); if(!s || restricted(g) || !s.run.supplyLevel) return;
  const base={RNA:20,DNA:5,Food:100,Lumber:100,Stone:100,Knowledge:50,Copper:50,Iron:50};
  for(const [id,n] of Object.entries(base)) {
    const r=g.resource?.[id]; if(s.run.supplies[id] || !r?.display || !(r.max>0)) continue;
    r.amount=Math.min(r.max,r.amount+n*s.run.supplyLevel); s.run.supplies[id]=true;
  }
}
export function reserveReason(g,costs,reserve) {
  for(const [res,amount] of Object.entries(costs)) {
    const r=g.resource?.[res];
    if(!Number.isFinite(amount)||amount<0 || !r) return '지원하지 않는 비용 조건';
    if(r.amount<amount) return `${res} 부족`;
    if(r.amount-amount < Math.max(0,number(r.max))*reserve) return `${res} 비축량 보호`;
  }
  return '';
}
export function candidates(g) {
  const s=ensureIndustry(g); if(!s||!spaceEra(g)||!s.enabled||g.settings?.pause) return [];
  return FACILITIES.filter(f=>s.rules[f.id].enabled && autoUnlocked(g,f.region))
    .sort((a,b)=>score(b)-score(a));
  function score(f) {
    const shortage=s.shortageFirst && f.outputs.some(id=>{const r=g.resource?.[id];return r?.display && r.max>0 && r.amount/r.max<0.2;});
    return s.rules[f.id].priority+(shortage?20:0)-(g[f.era]?.[f.id]?.count || 0)*0.0001;
  }
}
export function applyPolicy(g,scope,mode,cap=30) {
  const s=ensureIndustry(g); if(!s || !spaceEra(g)) return false;
  if(scope==='solar'&&!s.run.goals.solar || scope==='network'&&!s.run.goals.network) return false;
  if(REGIONS[scope]&&!s.run.goals.planet&&!s.run.goals.solar) return false;
  if(!['balanced','mining','research','off'].includes(mode) || !(scope==='solar'||scope==='network'||REGIONS[scope])) return false;
  for(const f of FACILITIES.filter(f=>scope==='network'||scope==='solar'&&f.system==='solar'||scope===f.region)) {
    s.rules[f.id]={enabled:mode!=='off',cap:Math.max(0,Math.min(10000,Math.floor(number(Number(cap),30)))),priority:f.kind==='support'?8:mode==='mining'&&f.kind==='mining'||mode==='research'&&f.kind==='research'?9:5};
  }
  s.policies[scope]=mode; return true;
}
