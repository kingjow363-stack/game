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
export const fresh=(now=Date.now())=>({resources:{ore:0,energy:0,alloy:0,science:0,fleet:0},buildings:Object.fromEntries(buildings.map(b=>[b.id,0])),tech:[],conquests:0,meta:{points:0,rebirths:0,conquests:0},reserve:20000,clicks:0,timestamp:now});
export function costOf(b,s){return Object.fromEntries(Object.entries(b.cost).map(([r,n])=>[r,Math.ceil(n*1.18**s.buildings[b.id])]))}
export const canPay=(s,cost)=>Object.entries(cost).every(([r,n])=>s.resources[r]>=n);
function pay(s,cost){for(const [r,n]of Object.entries(cost))s.resources[r]-=n}
export function build(s,id){const b=buildings.find(b=>b.id===id);if(!b||(b.tech&&!s.tech.includes(b.tech)))return false;const cost=costOf(b,s);if(!canPay(s,cost))return false;pay(s,cost);s.buildings[id]++;return true}
export function research(s,id){const t=technologies.find(t=>t.id===id);if(!t||s.tech.includes(id)||(t.requires&&!s.tech.includes(t.requires))||!canPay(s,t.cost))return false;pay(s,t.cost);s.tech.push(id);return true}
export function conquer(s){const sector=sectors[s.conquests];if(!sector||!s.tech.includes(sector.requires)||!canPay(s,sector.cost))return false;pay(s,sector.cost);s.conquests++;s.meta.conquests++;return true}
export function mine(s){if(s.reserve<=0)return 0;const n=Math.min(s.reserve,s.tech.includes('industry')?3:1);s.reserve-=n;s.resources.ore+=n;s.clicks++;return n}
export function multiplier(s){return(1+s.meta.points*.1)*(s.tech.includes('logistics')?2:1)*(s.tech.includes('singularity')?3:1)*(s.conquests>=1?1.5:1)*(s.conquests>=5?2:1)}
function step(s,dt){const mult=multiplier(s);for(const b of buildings){const count=s.buildings[b.id];if(!count)continue;let units=count*dt*mult;if(b.id==='mine')units=Math.min(units,s.reserve/2);if(b.input)for(const[r,n]of Object.entries(b.input))units=Math.min(units,s.resources[r]/n);if(b.input)for(const[r,n]of Object.entries(b.input))s.resources[r]=Math.max(0,s.resources[r]-n*units);for(const[r,n]of Object.entries(b.output))s.resources[r]+=n*units;if(b.id==='mine')s.reserve=Math.max(0,s.reserve-2*units)}if(s.conquests>=2)s.resources.ore+=10*dt*mult;if(s.conquests>=3){s.resources.ore+=25*dt*mult;s.resources.science+=3*dt*mult}if(s.conquests>=4){s.resources.energy+=60*dt*mult;s.resources.ore+=50*dt*mult}if(s.conquests>=6){s.resources.ore+=200*dt*mult;s.resources.science+=20*dt*mult}}
export function advance(s,now=Date.now()){let dt=Math.min(8*3600,Math.max(0,(now-s.timestamp)/1000));const elapsed=dt;while(dt>0){const slice=Math.min(1,dt);step(s,slice);dt-=slice}s.timestamp=now;return elapsed}
export function restore(raw,now=Date.now()){try{const s=JSON.parse(raw);if(s&&!s.meta)s.meta={points:0,rebirths:0,conquests:s.conquests||0};if(!s||!s.meta||!['points','rebirths','conquests'].every(k=>Number.isSafeInteger(s.meta[k])&&s.meta[k]>=0)||!s.resources||!s.buildings||!Array.isArray(s.tech)||!s.tech.every(t=>technologies.some(x=>x.id===t))||!Number.isInteger(s.conquests)||s.conquests<0||s.conquests>sectors.length||!['reserve','clicks','timestamp'].every(k=>Number.isFinite(s[k])&&s[k]>=0)||s.reserve>20000||!Object.keys(fresh().resources).every(k=>Number.isFinite(s.resources[k])&&s.resources[k]>=0)||!buildings.every(b=>Number.isInteger(s.buildings[b.id])&&s.buildings[b.id]>=0&&s.buildings[b.id]<=1000))return fresh(now);return s}catch{return fresh(now)}}

export const prestigeReward=s=>s.conquests*s.conquests;
export function prestige(s,now=Date.now()){const next=fresh(now);next.meta={points:s.meta.points+prestigeReward(s),rebirths:s.meta.rebirths+1,conquests:s.meta.conquests};return next}
