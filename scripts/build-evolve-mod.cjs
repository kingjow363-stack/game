const fs=require('node:fs');
const path=require('node:path');
const esbuild=require('esbuild');
const root=path.resolve(__dirname,'..');
const app=path.join(root,'evolve-desktop');
const build=path.join(app,'build-source');
fs.rmSync(build,{recursive:true,force:true});
fs.cpSync(path.join(app,'upstream/src'),path.join(build,'src'),{recursive:true});
fs.cpSync(path.join(app,'upstream/strings'),path.join(build,'strings'),{recursive:true});
for(const name of ['industry-core.mjs','industry-runtime.js','industry-ui.js']) fs.copyFileSync(path.join(app,'mods',name),path.join(build,'src',name));
const changes=[];
function patch(file,from,to,count=1) {
  const dest=path.join(build,'src',file);let text=fs.readFileSync(dest,'utf8');
  const found=text.split(from).length-1;
  if(found!==count) throw new Error(`${file}: patch anchor expected ${count}, found ${found}: ${from.slice(0,80)}`);
  fs.writeFileSync(dest,text.split(from).join(to)); changes.push({file,anchor:from,count});
}
patch('main.js',"import { enableDebug, updateDebugData } from './debug.js';", "import { enableDebug, updateDebugData } from './debug.js';\nimport { mountIndustry, industryTick } from './industry-runtime.js';\nimport { legacyMultiplier, researchMultiplier, productionFactors } from './industry-core.mjs';");
patch('main.js','index();','index();\nsetTimeout(mountIndustry,0);');
patch('main.js','function longLoop(){','function longLoop(){\n    industryTick();');
patch('main.js',"    if (global.prestige.Supercoiled.count > 0){", "    global_multiplier *= legacyMultiplier(global,'production');\n    if (legacyMultiplier(global,'production') !== 1) breakdown.p.Global['문명 생산 기록'] = ((legacyMultiplier(global,'production')-1)*100)+'%';\n    if (global.prestige.Supercoiled.count > 0){");
patch('main.js','            if (gene_consume > 0) {',"            delta *= researchMultiplier(global);\n            if (researchMultiplier(global) !== 1) breakdown.p.Knowledge['산업 연구·계승'] = ((researchMultiplier(global)-1)*100)+'%';\n            if (gene_consume > 0) {");
// Mining droid allocation is also used for fuel/operating costs: scale only the
// four production bases, never the allocated worker counts.
const main=fs.readFileSync(path.join(build,'src/main.js'),'utf8');
const droidBases=[...main.matchAll(/let (?:base|driod_base) = miner_droids\['(?:alum|coal|uran|adam)'\][^;]+;/g)].map(m=>m[0]);
if(droidBases.length!==4) throw new Error(`Expected four droid production bases, found ${droidBases.length}`);
for(const line of droidBases) patch('main.js',line,line.replace(';'," * productionFactors(global,'mining_droid').total;"));
patch('prod.js','export function production(id,val,wiki){',"export function production(id,val,wiki){ return scaleProduction(global,id,baseProduction(id,val,wiki)); }\nfunction baseProduction(id,val,wiki){");
patch('prod.js',"import { global,", "import { scaleProduction } from './industry-core.mjs';\nimport { global,");
patch('functions.js',"import { global,", "import { costFactor, launchFactor } from './industry-core.mjs';\nimport { global,");
// Prefixes are distinct so city and space discounts apply once, before rounding.
patch('functions.js','export function costMultiplier(structure,offset,base,multiplier,cat){',"export function costMultiplier(structure,offset,base,multiplier,cat){\n    base *= costFactor(global,'city');");
patch('functions.js','export function spaceCostMultiplier(action,offset,base,multiplier,sector,c_min){',"export function spaceCostMultiplier(action,offset,base,multiplier,sector,c_min){\n    base *= costFactor(global,'space');");
// Space-entry tech and missions: reduce numeric resource costs through the same
// adjusted-cost path used by tooltips, affordability checks and payment.
patch('functions.js','    return craftAdjust(costs, offset, wiki);',`    costs = craftAdjust(costs, offset, wiki);
    const entry = /^(tech-(rocketry|space|moon|mars|gas_giant|asteroid)|space-.*mission)$/.test(c_action.id || '');
    if (entry && launchFactor(global) !== 1) {
        const prior = costs; costs = {};
        Object.keys(prior).forEach(res => { costs[res] = (...args) => {
            const value = prior[res](...args);
            return global.resource[res] && typeof value === 'number' ? value * launchFactor(global) : value;
        }; });
    }
    return costs;`);
patch('resets.js',"import { global,", "import { awardReset } from './industry-core.mjs';\nimport { global,");
const resets=fs.readFileSync(path.join(build,'src/resets.js'),'utf8');
const resetCalls=[...resets.matchAll(/let gains = calcPrestige\('([^']+)'\);/g)];
if(resetCalls.length!==13) throw new Error('Reset hook count changed');
for(const [line,type] of resetCalls) patch('resets.js',line,`${line}\n    awardReset(global,'${type}');`);
fs.copyFileSync(path.join(app,'upstream/LICENSE'),path.join(build,'LICENSE'));
fs.copyFileSync(path.join(app,'UPSTREAM-NOTICE.md'),path.join(build,'UPSTREAM-NOTICE.md'));
fs.writeFileSync(path.join(build,'PATCHES.json'),JSON.stringify({upstream:require(path.join(app,'upstream-manifest.json')).commit,revision:'industry-r2',changes},null,2));
esbuild.buildSync({entryPoints:[path.join(build,'src/main.js')],bundle:true,minify:true,outfile:path.join(app,'web/evolve/main.js'),logLevel:'info'});
fs.copyFileSync(path.join(app,'mods/industry.css'),path.join(app,'web/industry.css'));
let html=fs.readFileSync(path.join(app,'web/index.html'),'utf8');
html=html.replace('</head>','<link rel="stylesheet" href="industry.css">\n</head>');
fs.writeFileSync(path.join(app,'web/index.html'),html);
console.log(`Built industry-r2 from original source with ${changes.length} checked patch anchors.`);
