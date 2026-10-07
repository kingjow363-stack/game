import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { FACILITIES, GOALS, ensureIndustry, metrics, updateGoals, autoUnlocked, scaleProduction, productionFactors,
  costFactor, legacyMultiplier, researchMultiplier, launchFactor, resetReward, awardReset, buyUpgrade, grantSupplies, reserveReason, candidates, applyPolicy } from '../evolve-desktop/mods/industry-core.mjs';
const fresh = () => ({race:{species:'human'},tech:{space:3},settings:{},resource:{Titanium:{amount:0,max:1e6,display:true}},space:{},interstellar:{},stats:{}});
function developed(g,n=10) { const active={}; for(const f of FACILITIES) {g[f.era][f.id]={count:n,on:n};active[f.id]=n;} return active; }

test('legacy saves receive isolated defaults; future schemas are not rewritten',()=>{
  const g=fresh(),before=structuredClone(g); const s=ensureIndustry(g);
  assert.equal(s.enabled,false); assert.equal(s.reserve,.3);
  const copy=structuredClone(g);delete copy.industryExpansion;assert.deepEqual(copy,before);
  s.extra={keep:true};assert.deepEqual(ensureIndustry(g).extra,{keep:true});
  g.industryExpansion={version:9,unknown:123};assert.equal(ensureIndustry(g),null);assert.deepEqual(g.industryExpansion,{version:9,unknown:123});
});
test('first life before space retains production, costs and zero industry',()=>{
  const g=fresh();g.tech.space=2;const active=developed(g,100);
  const m=metrics(g,active);assert.equal(m.total,0);assert.deepEqual(updateGoals(g,m),[]);
  assert.equal(scaleProduction(g,'red_mine',2),2);assert.equal(scaleProduction(g,'oil_well',2),2);
  assert.equal(costFactor(g,'city'),1);assert.equal(legacyMultiplier(g,'production'),1);assert.equal(researchMultiplier(g),1);
});
test('industry uses actual working counts and aggregates each region exactly once',()=>{
  const g=fresh();const active=developed(g,10);active.red_mine=2;active.iridium_ship=0;
  const m=metrics(g,active);assert.equal(m.regions.mars,(25+10+15+40)*10+25*2);
  assert.equal(m.solar,Object.entries(m.regions).filter(([id])=>['moon','mars','belt','gas'].includes(id)).reduce((s,[,n])=>s+n,0));
  assert.equal(m.total,m.solar+m.remote);assert.equal(m.remoteSystems,3);
  assert.equal(metrics(g,{}).total,0);
});
test('goals unlock once and multiplicative tiers replace lower tiers',()=>{
  const g=fresh(),a=developed(g,100);g.resource.Titanium.amount=200000;
  assert.equal(updateGoals(g,metrics(g,a)).length,GOALS.length);assert.deepEqual(updateGoals(g,metrics(g,a)),[]);
  const b=productionFactors(g,'red_mine');assert.deepEqual(b,{regional:3,solar:5,network:3,legacy:1,total:45});
  assert.equal(scaleProduction(g,'red_mine',2),90);assert.equal(scaleProduction(g,'oil_well',2),2);
  assert.deepEqual(scaleProduction(g,'red_mine',{b:2,f:3,g:.5}),{b:90,f:135,g:.5});
  assert.equal(costFactor(g,'city'),1);assert.equal(costFactor(g,'space'),.95);
});
test('network goals require separate reached systems and solar industry',()=>{
  const g=fresh();const m={regions:{moon:0,mars:0,belt:0},solar:900,remote:10000,total:10900,research:0,remoteSystems:1};
  updateGoals(g,m);assert.equal(g.industryExpansion.run.goals.network,undefined);
  assert.equal(g.industryExpansion.run.goals.network2,undefined);
  m.solar=1000;m.remoteSystems=2;updateGoals(g,m);assert.equal(g.industryExpansion.run.goals.network,true);
});
test('reserves protect every cost resource after payment and reject unsupported costs',()=>{
  const g=fresh();g.resource.Titanium={amount:60,max:100};
  assert.equal(reserveReason(g,{Titanium:30},.3),'');assert.match(reserveReason(g,{Titanium:31},.3),/비축/);
  assert.match(reserveReason(g,{Titanium:61},0),/부족/);assert.ok(reserveReason(g,{Unknown:1},0));
  assert.ok(reserveReason(g,{Titanium:NaN},0));assert.ok(reserveReason(g,{Titanium:-1},0));
});
test('automation respects opt-in, unlocks, pause and shortage priority',()=>{
  const g=fresh(),s=ensureIndustry(g);s.rules.iridium_ship.enabled=true;s.rules.iron_ship.enabled=true;
  assert.deepEqual(candidates(g),[]);s.enabled=true;assert.deepEqual(candidates(g),[]);
  s.run.goals.belt=true;g.resource.Iron={amount:1,max:100,display:true};
  assert.equal(candidates(g)[0].id,'iron_ship');g.settings.pause=true;assert.deepEqual(candidates(g),[]);
});
test('policies scale from regional control to system and network without auto-enabling spending',()=>{
  const g=fresh(),s=ensureIndustry(g);assert.equal(applyPolicy(g,'solar','mining'),false);
  s.run.goals.planet=true;assert.equal(applyPolicy(g,'mars','research',44),true);
  assert.equal(s.rules.exotic_lab.cap,44);assert.equal(s.rules.exotic_lab.priority,9);assert.equal(s.rules.iridium_ship.enabled,false);
  s.run.goals.solar=true;applyPolicy(g,'solar','mining',50);assert.equal(s.rules.iridium_ship.enabled,true);assert.equal(s.rules.starport.enabled,false);
  s.run.goals.network=true;applyPolicy(g,'network','balanced',100);assert.equal(s.rules.neutron_miner.enabled,true);assert.equal(s.enabled,false);
});
test('reset gives points once and keeps lifetime data while resetting run goals and spending',()=>{
  const g=fresh(),s=ensureIndustry(g);developed(g);s.run.peak=15000;s.run.remotePeak=5000;s.run.goals.mars=true;s.legacy.completed.mars=true;s.enabled=true;
  assert.ok(resetReward(g,'bioseed').stellar>0);assert.equal(resetReward(g,'mad').stellar,0);
  awardReset(g,'bioseed');assert.ok(s.legacy.civil>0);assert.ok(s.legacy.stellar>0);assert.equal(s.enabled,false);assert.deepEqual(s.run.goals,{});
  const balance=s.legacy.civil;awardReset(g,'bioseed');assert.equal(s.legacy.civil,balance);assert.equal(s.legacy.completed.mars,true);
});
test('prestige upgrades debit currency, scale effects and respect limits and challenges',()=>{
  const g=fresh(),s=ensureIndustry(g);assert.equal(buyUpgrade(g,'production'),false);
  s.legacy.civil=1000;s.legacy.stellar=1000;assert.equal(buyUpgrade(g,'production'),true);assert.equal(s.legacy.civil,998);
  assert.equal(legacyMultiplier(g,'production'),1.2);buyUpgrade(g,'economy');assert.equal(costFactor(g,'city'),.96);
  buyUpgrade(g,'launch');assert.equal(launchFactor(g),.9);buyUpgrade(g,'automation');assert.equal(buyUpgrade(g,'automation'),false);
  g.race.no_plasmid=true;assert.equal(legacyMultiplier(g,'production'),1);assert.equal(costFactor(g,'city'),1);assert.equal(launchFactor(g),1);
});
test('automation memory requires prior achievement AND reaching the region again',()=>{
  const g=fresh(),s=ensureIndustry(g);s.legacy.upgrades.automation=1;s.legacy.completed.mars=true;
  assert.equal(autoUnlocked(g,'mars'),false);g.space.red_mine={count:1,on:1};assert.equal(autoUnlocked(g,'mars'),true);
  assert.equal(autoUnlocked(g,'belt'),false);g.tech.space=0;assert.equal(autoUnlocked(g,'mars'),false);
});
test('supplies grant only once per unlocked resource and never exceed capacity',()=>{
  const g=fresh(),s=ensureIndustry(g);s.legacy.upgrades.supplies=2;awardReset(g,'bioseed');g.resource.RNA={display:true,amount:90,max:100};g.resource.DNA={display:false,amount:0,max:100};
  grantSupplies(g);assert.equal(g.resource.RNA.amount,100);assert.equal(g.resource.DNA.amount,0);
  g.resource.RNA.amount=0;grantSupplies(g);assert.equal(g.resource.RNA.amount,0);
  g.resource.DNA.display=true;grantSupplies(g);assert.equal(g.resource.DNA.amount,10);
  const restored=JSON.parse(JSON.stringify(g));grantSupplies(restored);assert.equal(restored.resource.DNA.amount,10);
});
test('simulation reset cannot mint persistent points',()=>{const g=fresh(),s=ensureIndustry(g);s.run.peak=1e6;g.sim=true;awardReset(g,'bioseed');assert.equal(s.legacy.civil,0);});
test('all original reset paths hook awards exactly once; shared resource mutation stays untouched',()=>{
  const source=fs.readFileSync(new URL('../evolve-desktop/build-source/src/resets.js',import.meta.url),'utf8');
  assert.equal((source.match(/awardReset\(global,'/g)||[]).length,13);
  const original=fs.readFileSync(new URL('../evolve-desktop/upstream/src/functions.js',import.meta.url),'utf8');
  const modified=fs.readFileSync(new URL('../evolve-desktop/build-source/src/functions.js',import.meta.url),'utf8');
  const extract=s=>s.slice(s.indexOf('export function modRes('),s.indexOf('export function costMultiplier('));
  assert.equal(extract(original),extract(modified));
});
