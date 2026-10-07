// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
import { global, p_on, support_on, int_on } from './vars.js';
import { actions, checkAffordable, checkPowerRequirements, postBuild } from './actions.js';
import { adjustCosts, messageQueue } from './functions.js';
import { checkSpaceRequirements, fuel_adjust, int_fuel_adjust } from './space.js';
import { FACILITIES, REGIONS, GOALS, ensureIndustry, spaceEra, metrics, updateGoals, candidates, reserveReason, grantSupplies } from './industry-core.mjs';
import { mountPanel, refreshPanel } from './industry-ui.js';
export const industryStatus = { reasons:{}, last:'자동화는 기본적으로 꺼져 있습니다.', next:0, error:'' };
export function activeFacilities() {
  const active={};
  for(const f of FACILITIES) {
    const state=global[f.era]?.[f.id],action=actions[f.era]?.[f.area]?.[f.id];
    if(!state || !action) { active[f.id]=0; continue; }
    const supported=action.support && action.support()<0;
    const table=supported ? f.era==='space'?support_on:int_on : p_on;
    active[f.id]=Math.max(0,Math.min(state.count, state.on===undefined?state.count:(table[f.id] || 0)));
  }
  return active;
}
export function captureIndustry() {
  const m=metrics(global,activeFacilities());
  for(const id of updateGoals(global,m)) {
    const goal=GOALS.find(goal=>goal.id===id);
    messageQueue(`우주 산업 목표 달성: ${goal.label} — ${goal.reward}`,'success',false,['progress']);
  }
  return m;
}
// Only repeatable, explicitly catalogued facilities reach this adapter.
export function purchaseReason(f, power=global.city?.power || 0) {
  const s=ensureIndustry(global),rule=s?.rules[f.id];
  const action=actions[f.era]?.[f.area]?.[f.id], state=global[f.era]?.[f.id];
  if(!action || !checkSpaceRequirements(f.era,f.area,f.id) || !checkPowerRequirements(action)) return '연구·진입 조건 미충족';
  if((state?.count || 0)>=rule.cap) return '설정한 시설 수 도달';
  // Respect the player's queue ahead of spending from the same resource pool.
  if(global.queue?.queue?.length || global.r_queue?.queue?.length) return '기존 건설·연구 큐 우선';
  if(state?.count>0 && state.on!==undefined && activeFacilities()[f.id]<state.count) return '기존 시설 가동·인력·연료 확인';
  const demand=Math.max(0,action.powered?.() || 0);
  if(demand>power) return '전력 부족';
  const support=action.support?.() || 0;
  if(support<0) {
    const provider=global[f.era]?.[REGIONS[f.region].support];
    if(!provider || !(provider.s_max-provider.support>=-support)) return '지역 지원량 부족';
  }
  const costs=Object.fromEntries(Object.entries(adjustCosts(action)).map(([r,fn])=>[r,fn()]));
  const fallback={space_station:[['Helium_3',fuel_adjust(2.5,true)],['Food',global.race.fasting?0:global.race.cataclysm?1:10]],starport:[['Helium_3',int_fuel_adjust(5)]],nexus:[['Money',350]],neutron_miner:[['Helium_3',int_fuel_adjust(3)]]};
  const fuel=action.support_fuel?.() || action.p_fuel?.();
  const fuelNeeds=fuel?[[fuel.r,f.era==='space'?fuel_adjust(fuel.a,true):int_fuel_adjust(fuel.a)]]:fallback[f.id] || [];
  for(const [id,rate] of fuelNeeds) {
    if((global.resource[id]?.amount || 0)-(costs[id] || 0)<rate*30) return `${id} 가동 연료 부족`;
  }
  const reason=reserveReason(global,costs,s.reserve);
  if(reason) return reason;
  return checkAffordable(action)?'':'원본 구매 조건 미충족';
}
export function runAutomation(now=Date.now()) {
  const s=ensureIndustry(global);
  if(!s || !spaceEra(global) || global.settings.pause || !s.enabled || now<industryStatus.next) return 0;
  industryStatus.next=now+s.interval*1000;
  let remaining=s.run.goals.solar2?3:s.run.goals.solar?2:1, power=global.city.power || 0, bought=0;
  const visited=new Set(); industryStatus.reasons={};
  for(const f of candidates(global)) {
    if(visited.has(f.region)) continue;
    const reason=purchaseReason(f,power); industryStatus.reasons[f.id]=reason;
    if(reason) continue;
    const action=actions[f.era][f.area][f.id];
    if(action.action.call(action,{isQueue:false})) {
      if(global.race.inflation && global.tech.primitive && (!Object.hasOwn(action,'inflation') || action.inflation)) global.race.inflation++;
      postBuild(action,f.era,f.id);
      power-=Math.max(0,action.powered?.() || 0); visited.add(f.region);
      s.run.builds=(s.run.builds || 0)+1; bought++;
      industryStatus.last=`${f.label} 자동 건설 · ${new Date(now).toLocaleTimeString()}`;
      industryStatus.reasons[f.id]='건설 완료';
      if(--remaining<=0) break;
    } else industryStatus.reasons[f.id]='원본 건설 함수가 구매를 보류했습니다.';
  }
  return bought;
}
export function industryTick() {
  try { captureIndustry(); grantSupplies(global); runAutomation(); industryStatus.error=''; }
  catch(error) {
    const s=ensureIndustry(global); if(s) s.enabled=false;
    industryStatus.error=`자동화를 중지했습니다: ${error.message}`;
    console.error('Industry expansion:',error);
  }
  refreshPanel();
}
export function mountIndustry() {
  ensureIndustry(global);
  mountPanel(global,()=>metrics(global,activeFacilities()),industryStatus);
}
