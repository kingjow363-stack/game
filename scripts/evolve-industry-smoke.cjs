const {_electron}=require('playwright-core');
const fs=require('node:fs');const path=require('node:path');const os=require('node:os');const assert=require('node:assert/strict');const esbuild=require('esbuild');
const root=path.resolve(__dirname,'..'),source=path.join(root,'evolve-desktop/build-source/src');
const output=path.join(root,'evolve-desktop/test-results');fs.mkdirSync(output,{recursive:true});
// A separate test harness bundles the exact patched modules, preserving upstream
// import order. It is injected only by this test and is never shipped in the EXE.
const imports=fs.readFileSync(path.join(source,'main.js'),'utf8').split('\n').filter(line=>line.startsWith('import ')).join('\n');
const harness=esbuild.buildSync({stdin:{contents:imports+`\nimport * as core from './industry-core.mjs';\nimport * as runtime from './industry-runtime.js';\nimport * as resets from './resets.js';\nimport { adjustCosts } from './functions.js';\ninitMessageQueue();\nwindow.industryHarness={global,actions,production,p_on,support_on,int_on,core,runtime,resets,adjustCosts};`,resolveDir:source},bundle:true,write:false,logLevel:'silent'}).outputFiles[0].text;
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'evolve-industry-test-'));
const packaged=process.env.EVOLVE_EXECUTABLE;
const args=[...(packaged?[]:[path.join(root,'evolve-desktop')]),'--disable-gpu',`--user-data-dir=${profile}`];if(process.platform==='linux')args.push('--no-sandbox');
(async()=>{
 const app=await _electron.launch({executablePath:packaged||require('electron'),args,env:{...process.env,XDG_CONFIG_HOME:path.join(profile,'config'),XDG_CACHE_HOME:path.join(profile,'cache')},timeout:30000});
 const errors=[];try {
  const page=await app.firstWindow();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
  await page.waitForFunction(()=>typeof exportGame==='function'&&document.querySelector('#industry-open'));
  await page.locator('#industry-open').click();await page.getByText('원본 우주 탐사 단계',{exact:false}).waitFor();
  assert.equal(await page.locator('#industry-enabled').isDisabled(),true);await page.locator('[data-close]').click();
  await page.evaluate(()=>{const g=JSON.parse(LZString.decompressFromBase64(exportGame()));g.settings.expose=true;g.resource.RNA.amount=1e6;g.resource.DNA.amount=1e6;g.resource.RNA.max=1e6;g.resource.DNA.max=1e6;g.tech.evo=7;g.tech.evo_humanoid=2;g.evolution.final=100;importGame(LZString.compressToBase64(JSON.stringify(g)));});
  await page.waitForFunction(()=>window.evolve?.actions?.evolution?.sentience);
  await page.evaluate(()=>{const a=evolve.actions.evolution.sentience;a.action.call(a,{});});
  await page.waitForFunction(()=>JSON.parse(LZString.decompressFromBase64(exportGame())).race.species!=='protoplasm');
  // Pause the original worker. The harness can now deterministically exercise real
  // cost, power, support and reset functions using this valid sentient save.
  await page.evaluate(()=>{const g=JSON.parse(LZString.decompressFromBase64(exportGame()));g.settings.pause=true;importGame(LZString.compressToBase64(JSON.stringify(g)));});
  await page.waitForFunction(()=>typeof exportGame==='function'&&JSON.parse(LZString.decompressFromBase64(exportGame())).settings.pause);
  await page.addScriptTag({content:harness});
  const purchase=await page.evaluate(()=>{
    const h=industryHarness,g=h.global;g.settings.pause=false;g.tech.space=3;g.tech.luna=1;
    g.city.power=100;g.queue={queue:[]};g.r_queue={queue:[]};
    for(const id of ['moon_base','iridium_mine','helium_mine']){const a=h.actions.space.spc_moon[id];g.space[id]=structuredClone(a.struct().d);g.space[id].count=4;g.space[id].on=4;h.p_on[id]=4;h.support_on[id]=4;}
    g.space.moon_base.s_max=100;g.space.moon_base.support=8;
    for(const id of ['Money','Lumber','Titanium','Iridium','Mythril','Oil']){g.resource[id].display=true;g.resource[id].max=1e9;g.resource[id].amount=1e9;}
    h.runtime.captureIndustry();const s=h.core.ensureIndustry(g);s.enabled=true;s.reserve=.3;s.rules.iridium_mine.enabled=true;
    const a=h.actions.space.spc_moon.iridium_mine;
    const costs=Object.fromEntries(Object.entries(h.adjustCosts(a)).map(([id,fn])=>[id,fn()]));
    const before={count:g.space.iridium_mine.count,resources:Object.fromEntries(Object.keys(costs).map(id=>[id,g.resource[id].amount]))};
    const bought=h.runtime.runAutomation(100000);
    const after={count:g.space.iridium_mine.count,resources:Object.fromEntries(Object.keys(costs).map(id=>[id,g.resource[id].amount]))};
    h.support_on.iridium_mine=g.space.iridium_mine.count;g.space.moon_base.support=9;
    const cooldown=h.runtime.runAutomation(100001);
    s.reserve=.95;g.resource.Titanium.amount=g.resource.Titanium.max*.94;
    const blocked=h.runtime.runAutomation(120000);
    const reason=h.runtime.industryStatus.reasons.iridium_mine;
    g.resource.Titanium.amount=1e9;s.reserve=0;g.queue.queue=[{id:'city-test'}];
    const queued=h.runtime.runAutomation(140000);g.queue.queue=[];
    g.space.moon_base.s_max=g.space.moon_base.support;
    const supportBlocked=h.runtime.runAutomation(160000);
    return {before,after,costs,bought,cooldown,blocked,reason,queued,supportBlocked};
  });
  assert.equal(purchase.bought,1);assert.equal(purchase.after.count,purchase.before.count+1);
  for(const [id,cost] of Object.entries(purchase.costs))assert.equal(purchase.after.resources[id],purchase.before.resources[id]-cost,id);
  assert.equal(purchase.cooldown,0);assert.equal(purchase.blocked,0);assert.match(purchase.reason,/비축/);assert.equal(purchase.queued,0);assert.equal(purchase.supportBlocked,0);
  console.log('PASS: real Evolve construction pays exact adjusted costs; reserves, cooldown, support and manual queues block automation');
  const rates=await page.evaluate(()=>{
    const h=industryHarness,g=h.global,s=h.core.ensureIndustry(g);s.run.goals={};
    const before=h.production('red_mine','copper').f,ground=h.production('oil_well');
    s.run.goals={mars:true,planet:true,solar:true,network:true};
    const after=h.production('red_mine','copper').f;
    return {before,after,ground,groundAfter:h.production('oil_well'),factor:h.core.productionFactors(g,'red_mine').total};
  });
  assert.equal(rates.after,rates.before*12);assert.equal(rates.factor,12);assert.equal(rates.groundAfter,rates.ground);
  console.log('PASS: native production formula receives space multipliers while ground oil production is unchanged');
  await page.evaluate(()=>{
    const h=industryHarness,g=h.global;const s=h.core.ensureIndustry(g);s.enabled=false;
    for(const f of h.core.FACILITIES){const a=h.actions[f.era][f.area][f.id];if(!g[f.era][f.id])g[f.era][f.id]=structuredClone(a.struct().d);g[f.era][f.id].count=15;g[f.era][f.id].on=15;h.p_on[f.id]=15;h.support_on[f.id]=15;h.int_on[f.id]=15;}
    h.runtime.captureIndustry();s.legacy.civil=20;s.legacy.stellar=8;
    document.querySelector('#industry-open').remove();document.querySelector('#industry-panel').remove();h.runtime.mountIndustry();
  });
  await page.locator('#industry-open').click();await page.locator('#industry-scope').selectOption('solar');await page.locator('#industry-policy').selectOption('mining');await page.locator('[data-apply]').click();
  assert.equal(await page.locator('input[data-rule="iridium_ship"][data-field="enabled"]').isChecked(),true);
  assert.equal(await page.locator('#industry-enabled').isChecked(),false);
  await page.locator('[data-tab="goals"]').click();await page.screenshot({path:path.join(output,'industry-goals.png')});
  await page.locator('[data-tab="legacy"]').click();await page.locator('[data-upgrade="production"]').click();
  assert.equal(await page.evaluate(()=>industryHarness.global.industryExpansion.legacy.civil),18);
  await page.screenshot({path:path.join(output,'industry-legacy.png')});
  await page.locator('[data-tab="operations"]').click();await page.screenshot({path:path.join(output,'industry-operations.png')});
  console.log('PASS: industry dashboard, goals, solar policy and prestige purchase UI work');
  // Invoke the original MAD reset, including its save and full reload, not just
  // the pure reward calculator. Other 12 hooks are verified by the build tests.
  const expected=await page.evaluate(()=>{const h=industryHarness,g=h.global,s=h.core.ensureIndustry(g);g.civic.mad.armed=false;g.settings.pause=true;return {civil:s.legacy.civil+h.core.resetReward(g,'mad').civil,stellar:s.legacy.stellar};});
  await page.locator('[data-close]').click();await page.evaluate(()=>industryHarness.resets.warhead());
  await page.waitForFunction(()=>typeof exportGame==='function'&&JSON.parse(LZString.decompressFromBase64(exportGame())).race.species==='protoplasm');
  const reset=await page.evaluate(()=>JSON.parse(LZString.decompressFromBase64(exportGame())).industryExpansion);
  assert.equal(reset.legacy.civil,expected.civil);assert.equal(reset.legacy.stellar,expected.stellar);assert.deepEqual(reset.run.goals,{});assert.equal(reset.enabled,false);assert.equal(reset.legacy.upgrades.production,1);
  assert.equal(reset.rules.iridium_ship.enabled,true);assert.deepEqual(errors,[]);
  console.log('PASS: original MAD reset saves industry prestige, keeps policy and clears run progress');
  fs.writeFileSync(path.join(output,'industry-result.json'),JSON.stringify({passed:true,platform:process.platform,packaged:Boolean(packaged),checks:['early game gate','real purchase costs','reserve/cooldown/support/queue protection','native production multipliers','solar policy UI','prestige purchase UI','original MAD reset and reload']},null,2));
 }finally{await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
