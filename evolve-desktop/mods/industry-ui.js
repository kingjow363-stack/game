// This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
import { FACILITIES, REGIONS, GOALS, UPGRADES, ensureIndustry, spaceEra, autoUnlocked, productionFactors,
  applyPolicy, buyUpgrade, upgradeCost, resetReward, researchMultiplier, legacyMultiplier, restricted } from './industry-core.mjs';
let game, measure, status, panel, tab='operations';
const policyDraft={scope:'moon',mode:'balanced',cap:30};
const escape = s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>Number(n || 0).toLocaleString('ko-KR',{maximumFractionDigits:2});
export function mountPanel(g,m,s) {
  game=g; measure=m; status=s;
  if(document.getElementById('industry-open')) return;
  const open=document.createElement('button');open.id='industry-open';open.type='button';open.textContent='우주 산업';
  open.addEventListener('click',()=>{panel.showModal();refreshPanel(true);});document.body.append(open);
  panel=document.createElement('dialog');panel.id='industry-panel';panel.setAttribute('aria-label','우주 산업 관리');
  panel.innerHTML=`<header><div><small>EVOLVE · INDUSTRY R2</small><h2>우주 산업 관리</h2></div><button type="button" data-close aria-label="우주 산업 창 닫기">닫기</button></header>
    <nav><button data-tab="operations">산업 운영</button><button data-tab="goals">목표·승수</button><button data-tab="legacy">문명 계승</button></nav><div id="industry-content"></div>`;
  document.body.append(panel);
  panel.addEventListener('click',event=>{
    const target=event.target.closest('button'); if(!target) return;
    if(target.hasAttribute('data-close')) { panel.close(); return; }
    if(target.dataset.tab) { tab=target.dataset.tab; refreshPanel(true); }
    if(target.dataset.upgrade) { buyUpgrade(game,target.dataset.upgrade); refreshPanel(true); }
    if(target.dataset.apply) {
      const scope=panel.querySelector('#industry-scope').value, mode=panel.querySelector('#industry-policy').value, cap=Number(panel.querySelector('#industry-policy-cap').value);
      applyPolicy(game,scope,mode,cap); refreshPanel(true);
    }
  });
  panel.addEventListener('change',event=>{
    const s=ensureIndustry(game),t=event.target; if(!s)return;
    if(t.id==='industry-scope') policyDraft.scope=t.value;
    if(t.id==='industry-policy') policyDraft.mode=t.value;
    if(t.id==='industry-policy-cap') policyDraft.cap=Math.max(0,Math.min(10000,Number(t.value)||0));
    if(!t.dataset.rule && !['industry-enabled','industry-reserve','industry-interval','industry-shortage'].includes(t.id)) return;
    if(t.id==='industry-enabled') s.enabled=t.checked;
    if(t.id==='industry-reserve') s.reserve=Math.max(0,Math.min(.95,Number(t.value)/100 || 0));
    if(t.id==='industry-interval') s.interval=Math.max(5,Math.min(60,Number(t.value)||10));
    if(t.id==='industry-shortage') s.shortageFirst=t.checked;
    if(t.dataset.rule) {
      const r=s.rules[t.dataset.rule];
      r[t.dataset.field]=t.type==='checkbox'?t.checked:Number(t.value);
      ensureIndustry(game);
    }
    refreshPanel(true);
  });
  setInterval(()=>refreshPanel(),1000);
}
export function refreshPanel(force=false) {
  if(!panel?.open || (!force && /^(INPUT|SELECT)$/.test(document.activeElement?.tagName))) return;
  const s=ensureIndustry(game),container=panel.querySelector('#industry-content');
  if(!s) { container.textContent='이 저장에는 더 새로운 산업 확장 버전이 필요합니다. 원본 게임은 계속 플레이할 수 있습니다.'; return; }
  const m=measure(),era=spaceEra(game);
  panel.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tab===tab)));
  let body=`<div class="industry-summary"><article><small>태양계 산업력</small><strong>${fmt(m.solar)}</strong></article><article><small>성간 산업력</small><strong>${fmt(m.remote)}</strong></article><article><small>연결된 성간 거점</small><strong>${m.remoteSystems} / 3</strong></article><article><small>이번 문명 자동 건설</small><strong>${fmt(s.run.builds)}</strong></article></div>`;
  if(!era) body+='<p class="industry-note">원본 우주 탐사 단계(우주 기술 3)부터 산업력이 집계됩니다. 초기 진화·문명 발전은 기존 방식으로 진행하세요. 계승 기술을 구매했다면 다음 문명부터 효과를 받습니다.</p>';
  if(status.error) body+=`<p role="alert" class="industry-note">${escape(status.error)}</p>`;
  if(tab==='operations') {
    body+=`<section><h3>자동 건설</h3><div class="industry-controls"><label><input id="industry-enabled" type="checkbox" ${s.enabled?'checked':''} ${!era?'disabled':''}> 자동화 실행</label>
      <label>건설 후 최소 비축 <input id="industry-reserve" type="number" min="0" max="95" value="${Math.round(s.reserve*100)}"> %</label>
      <label>실행 간격 <input id="industry-interval" type="number" min="5" max="60" value="${s.interval}"> 초</label>
      <label><input id="industry-shortage" type="checkbox" ${s.shortageFirst?'checked':''}> 부족 자원 우선</label></div>
      <p class="industry-muted">비축 비율은 각 건설 비용 자원의 저장고 최대치 기준입니다. 기존 건설·연구 큐를 먼저 처리합니다. 같은 지역은 한 주기에 1개만 건설하며, 전력·지원량·가동 연료가 부족하면 기다립니다.</p>
      <p role="status">${game.settings.pause?'게임 일시정지 중':!s.enabled?'자동화 꺼짐':escape(status.last)}</p></section>`;
    if(s.run.goals.planet || s.run.goals.solar || s.run.goals.network) {
      const scopes=[...Object.entries(REGIONS).map(([id,r])=>[id,r.label]),...(s.run.goals.solar?[['solar','태양계 전체']]:[]),...(s.run.goals.network?[['network','성간 산업망 전체']]:[])];
      body+=`<section><h3>지역·산업망 일괄 정책</h3><div class="industry-controls"><select id="industry-scope" aria-label="정책 적용 범위">${scopes.map(([id,label])=>`<option value="${id}">${label}</option>`).join('')}</select><select id="industry-policy" aria-label="산업 정책"><option value="balanced">균형 확장</option><option value="mining">채굴 우선</option><option value="research">연구 우선</option><option value="off">자동 증설 해제</option></select><label>시설별 상한 <input id="industry-policy-cap" type="number" min="0" max="10000" value="30"></label><button data-apply="yes">정책 적용</button></div><p class="industry-muted">선택 범위의 시설 설정을 함께 변경합니다. 아직 해금되지 않은 자동화는 목표 달성 후 작동합니다. 자동화 실행 스위치는 별도로 켜세요.</p></section>`;
    }
    body+='<section><h3>행성·성간 거점</h3><div class="industry-regions">';
    for(const [id,r] of Object.entries(REGIONS)) {
      const f=FACILITIES.find(f=>f.region===id && f.kind==='mining') || FACILITIES.find(f=>f.region===id);
      body+=`<article><strong>${r.label}</strong><span>산업력 ${fmt(m.regions[id])}</span><span>대상 생산 ×${fmt(productionFactors(game,f.id).total)}</span><small>${autoUnlocked(game,id)?'자동화 해금':'자동화 목표 대기'}</small></article>`;
    }
    body+='</div><p class="industry-muted">산업력 = 실제 가동 수 × 시설 가중치. 전력·지원량·연료 부족과 꺼진 시설은 가동 수에 반영됩니다. 연구·주거·지원 시설은 산업력에 기여하고, 자원 승수는 아래 목록의 채굴·연료 생산에 적용됩니다.</p></section><section><h3>시설별 자동화</h3><div class="industry-table"><table><thead><tr><th>사용</th><th>시설 / 산업력 가중치</th><th>보유 / 상한</th><th>우선순위</th><th>상태</th></tr></thead><tbody>';
    for(const f of FACILITIES) {
      const r=s.rules[f.id],unlocked=autoUnlocked(game,f.region),owned=game[f.era]?.[f.id]?.count || 0;
      const reason=!unlocked?'목표 달성 필요':!r.enabled?'사용 안 함':!s.enabled?'전체 자동화 꺼짐':status.reasons[f.id] || '다음 실행 대기';
      body+=`<tr><td><input aria-label="${f.label} 자동화" type="checkbox" data-rule="${f.id}" data-field="enabled" ${r.enabled?'checked':''} ${!unlocked?'disabled':''}></td><td>${f.label}<small>${REGIONS[f.region].label} · 가동 1개당 ${f.weight}</small></td><td>${fmt(owned)} / <input aria-label="${f.label} 상한" type="number" min="0" max="10000" data-rule="${f.id}" data-field="cap" value="${r.cap}"></td><td><input aria-label="${f.label} 우선순위" type="number" min="1" max="10" data-rule="${f.id}" data-field="priority" value="${r.priority}"></td><td>${escape(reason)}</td></tr>`;
    }
    body+='</tbody></table></div></section>';
  } else if(tab==='goals') {
    body+='<section><h3>다음 산업 목표</h3><p class="industry-muted">목표 보상은 이번 문명 동안 유지됩니다. 생산 승수는 서로 곱해지며, 태양계·산업망의 상위 보정은 하위 보정을 대체합니다. 성간 산업망은 태양계 1,000 + 성간 거점 2곳 + 성간 산업력 1,500이 필요합니다.</p><div class="industry-goals">';
    for(const goal of GOALS) {
      const done=s.run.goals[goal.id],n=era?goal.metric(m,game):0;
      body+=`<article><h4>${done?'✓ ':''}${goal.label}</h4><p>${goal.reward}</p><progress value="${Math.min(goal.target,n)}" max="${goal.target}" aria-label="${goal.label} 달성도"></progress><small>${done?'달성 완료':`${fmt(n)} / ${fmt(goal.target)}`}</small></article>`;
    }
    body+='</div></section><section><h3>생산 승수 내역</h3><p>전체 생산 계승 ×'+fmt(legacyMultiplier(game,'production'))+' · 연구 추가 ×'+fmt(researchMultiplier(game))+'</p><div class="industry-table"><table><thead><tr><th>생산 시설</th><th>지역</th><th>태양계</th><th>산업망</th><th>항성 계승</th><th>합계</th></tr></thead><tbody>';
    for(const f of FACILITIES.filter(f=>['mining','fuel'].includes(f.kind))) { const b=productionFactors(game,f.id); body+=`<tr><td>${f.label}</td>${['regional','solar','network','legacy','total'].map(k=>`<td>×${fmt(b[k])}</td>`).join('')}</tr>`; }
    body+='</tbody></table></div><p class="industry-muted">원본 생산 내역의 해당 시설 기본량에도 이 보정이 반영됩니다. 소비량·연료·일회성 보상에는 생산 승수를 적용하지 않습니다. 연구 목표는 전체 지식 생산 효율을 높입니다.</p></section>';
  } else {
    const mad=resetReward(game,'mad'),space=resetReward(game,'bioseed');
    body+=`<section><h3>문명과 항성의 계승</h3><p>문명 포인트 <strong>${fmt(s.legacy.civil)}</strong> · 항성 포인트 <strong>${fmt(s.legacy.stellar)}</strong></p><p>현재 달성도 기준 다음 리셋 보상: MAD 문명 +${mad.civil} / 우주 리셋 문명 +${space.civil}, 항성 +${space.stellar}</p><p class="industry-muted">원본 리셋 버튼과 Plasmid·Phage 보상은 그대로입니다. 문명 산업력 최고치 120부터 문명 포인트, 성간 최고치 400부터 MAD 이외 리셋의 항성 포인트를 받습니다. 여기서는 포인트만 사용하며, 리셋은 원본 화면에서 진행합니다. 반복 리셋 보상은 이번 문명의 산업 성장에 따라 다시 계산됩니다.</p>
      ${restricted(game)?'<p class="industry-note">현재 챌린지의 no_plasmid / no_crispr 제한 또는 시뮬레이션에서는 추가 계승 효과가 작동하지 않습니다.</p>':''}
      <div class="industry-goals">`;
    for(const [id,u] of Object.entries(UPGRADES)) {
      const level=s.legacy.upgrades[id],cost=upgradeCost(game,id),max=level>=u.max;
      body+=`<article><h4>${u.label} ${level} / ${u.max}</h4><p>${u.description}</p><button data-upgrade="${id}" ${max||s.legacy[u.currency]<cost||game.sim?'disabled':''}>${max?'최대 단계':`${u.currency==='civil'?'문명':'항성'} ${cost} 사용`}</button></article>`;
    }
    body+='</div><p class="industry-muted">문명 리셋 후 자동화 실행은 꺼집니다. 시설별 정책과 비축 설정은 남습니다. 재건 보급은 각 자원이 해금될 때 한 번만 지급하며 저장고를 넘지 않습니다.</p></section>';
  }
  container.innerHTML=body;
  if(tab==='operations' && panel.querySelector('#industry-scope')) {
    panel.querySelector('#industry-scope').value=policyDraft.scope;
    if(!panel.querySelector('#industry-scope').value) panel.querySelector('#industry-scope').selectedIndex=0;
    panel.querySelector('#industry-policy').value=policyDraft.mode;
    panel.querySelector('#industry-policy-cap').value=policyDraft.cap;
  }
}
