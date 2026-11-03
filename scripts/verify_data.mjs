import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
const root=path.resolve(import.meta.dirname,'../public/demo');
async function json(file){let bytes=await fs.readFile(path.join(root,file));if(file.endsWith('.gz'))bytes=zlib.gunzipSync(bytes);return JSON.parse(bytes.toString('utf8'));}
const cities=await json('cities.json'),catalog=await json('catalog.json'),manifest=await json('manifest.json');
assert.equal(cities.length,12);assert.equal(catalog.length,372);assert.equal(new Set(catalog.map(x=>x.key)).size,372);
const cityIds=new Set(cities.map(c=>c.id));
for(const city of cities){
 const rows=catalog.filter(x=>x.city_id===city.id);
 assert.deepEqual(rows.filter(x=>x.planning_mode==='new_network').map(x=>x.post_count).sort((a,b)=>a-b),Array.from({length:15},(_,i)=>i+1));
 assert.deepEqual(rows.filter(x=>x.planning_mode==='expand').map(x=>x.post_count).sort((a,b)=>a-b),Array.from({length:16},(_,i)=>i));
 for(const layer of ['residential','roads','constraints']){const input=await json(`cities/${city.id}/${layer}.json`);assert.equal(input.features.length,input.total);}
}
let empty=0,unfilled=0;
for(const item of catalog){
 assert.ok(cityIds.has(item.city_id));
 const run=await json(item.file);
 assert.equal(run.status,'completed');assert.equal(run.id,item.id);
 assert.equal(run.request.territory_id,item.city_id);assert.equal(run.request.post_count,item.post_count);assert.equal(run.request.planning_mode,item.planning_mode);
 assert.equal(run.request.radius_m,2500);assert.equal(run.request.grid_km,1);assert.equal(run.request.placement_mode,'population_coverage');assert.equal(run.request.research_mode,true);
 assert.equal(run.ensemble.resolved_post_count,item.resolved_post_count);assert.equal(run.ensemble.scenarios.length,item.resolved_post_count);
 assert.equal(run.input_fingerprint,item.input_fingerprint);assert.equal(run.scenario_results.length,1);
 if(run.demo_baseline){empty++;assert.equal(run.ensemble.baseline.active_stations,0);assert.equal(item.empty_baseline,true);}
 if(item.resolved_post_count<item.post_count)unfilled++;
 const html=await fs.readFile(path.join(root,'reports',`${item.id}.html`),'utf8');
 assert.ok(html.includes(run.id));assert.ok(html.includes('<meta name="air-sgm-report-kind" content="network-design">'));assert.equal(Buffer.byteLength(html),item.report_size_bytes);
 if(run.demo_baseline)assert.ok(html.includes(run.demo_baseline.note));
}
assert.equal(empty,11*16);
for(const file of manifest.files){
 const bytes=await fs.readFile(path.join(root,file.path));assert.equal(bytes.length,file.bytes,file.path);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),file.sha256,file.path);
}
const summary={cities:cities.length,runs:catalog.length,reports:catalog.length,empty_baseline_runs:empty,scenarios_with_unfilled_slots:unfilled,verified_files:manifest.files.length};
console.log(JSON.stringify(summary,null,2));
