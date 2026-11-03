import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'../public/demo');
const json=async file=>{let b=await fs.readFile(path.join(root,file));return JSON.parse((file.endsWith('.gz')?zlib.gunzipSync(b):b).toString());};
const cities=await json('cities.json'),catalog=await json(process.argv[2] || 'catalog.json');
const modes=['population_coverage','industrial_influence','transport_influence','urban_background','integrated_screening'];
const profiles=['annual','cold_period','warm_period','weak_wind','calm_accumulation','accumulation_risk'];
assert.equal(cities.length,12);assert.equal(catalog.length,22320);assert.equal(new Set(catalog.map(r=>r.key)).size,22320);assert.equal(new Set(catalog.map(r=>r.id)).size,22320);
for(const city of cities) for(const mode of modes) for(const profile of profiles) for(const analysis of ['coverage_backbone','extended_diagnostics']) for(const planning of ['new_network','expand']){
 const rows=catalog.filter(r=>r.city_id===city.id && r.placement_mode===mode && r.meteo_profile===profile && r.planning_mode===planning && r.analysis_profile===analysis);
 assert.deepEqual(rows.map(r=>r.post_count).sort((a,b)=>a-b),Array.from({length:planning==='expand'?16:15},(_,n)=>n+(planning==='expand'?0:1)),`${city.name}/${mode}/${profile}/${planning}`);
}
let cache=new Map();
async function block(dir,id){const key=dir+id+'.json.gz';if(!cache.has(key)){if(cache.size>=200)cache.delete(cache.keys().next().value);cache.set(key,await json(key));}return cache.get(key);}
async function restore(value,dir){
 if(Array.isArray(value))return Promise.all(value.map(v=>restore(v,dir)));
 if(value && typeof value==='object'){
  if(Object.keys(value).length===1 && value.$air_sgm_block){const node=await block(dir,value.$air_sgm_block);return JSON.stringify(node).includes('"$air_sgm_block"')?restore(node,dir):node;}
  return Object.fromEntries(await Promise.all(Object.entries(value).map(async([k,v])=>[k,await restore(v,dir)])));
 }
 return value;
}
let empty=0,unfilled=0,checked=0;
let lastFile='',lastBundle;
for(const row of catalog){
 if(row.file!==lastFile){lastBundle=await json(row.file);lastFile=row.file;}
 const saved=lastBundle;assert.equal(saved.format,'air-sgm-preset-bundle-v1');
 const run=saved.runs[row.preset_key];
 assert.match(saved.hashes[row.preset_key],/^[a-f0-9]{64}$/);
 const scenarios=run.ensemble.scenarios?.$air_sgm_block ? await block(saved.shared_dir,run.ensemble.scenarios.$air_sgm_block) : run.ensemble.scenarios;
 assert.equal(run.id,row.id);assert.equal(run.status,'completed');
 for(const key of ['placement_mode','meteo_profile','planning_mode','post_count'])assert.equal(run.request[key],row[key],`${row.key}:${key}`);
 assert.equal(run.request.territory_id,row.city_id);assert.equal(run.request.grid_km,1);assert.equal(run.request.radius_m,2500);
 assert.equal(run.ensemble.resolved_post_count,row.resolved_post_count);
 assert.equal(scenarios.length,row.resolved_post_count);assert.equal(run.input_fingerprint,row.input_fingerprint);
 assert.equal(run.request.analysis_profile,row.analysis_profile);
 assert.equal(run.scenario_results.length,row.scenario_count);
 if(row.analysis_profile==='extended_diagnostics'){
  assert.equal(run.request.sensitivity_mode,'standard');
  assert.equal(run.scenario_results.length,['annual','cold_period','warm_period'].includes(row.meteo_profile)?3:4);
  assert.equal(run.sensitivity.status,row.post_count>0?'ready':'disabled');
  assert.equal(run.sensitivity.variants.length,row.post_count>0?2:0);
  for(const variant of run.sensitivity.variants)assert.ok(variant.resolved_post_count===0 || variant.resolved_post_count===row.post_count,`${row.key}: exact size in sensitivity variant`);
 }else{assert.equal(run.request.sensitivity_mode,'off');assert.equal(run.scenario_results.length,1);}
 if(row.empty_baseline){empty++;assert.ok(run.demo_baseline);assert.equal(run.ensemble.baseline.active_stations,0);}
 if(row.resolved_post_count<row.post_count)unfilled++;
 // Packaging checks every complete passport against its original native hash
 // during export. Here verify all request/coverage contracts and shared blocks.
 checked++;if(checked%1000===0)console.log('Verified',checked);
}
const manifest=await json('manifest.json');
for(const entry of manifest.files){const b=await fs.readFile(path.join(root,entry.path));assert.equal(b.length,entry.bytes);assert.equal(crypto.createHash('sha256').update(b).digest('hex'),entry.sha256,entry.path);}
console.log(JSON.stringify({cities:12,modes:5,wind_profiles:6,runs:checked,empty_baseline_runs:empty,unfilled_scenarios:unfilled},null,2));
