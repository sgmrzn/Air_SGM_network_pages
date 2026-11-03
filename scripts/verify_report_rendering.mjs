import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import ts from 'typescript';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const root=path.resolve(import.meta.dirname,'..'),demo=path.join(root,'public/demo');
await import('./native-ui-loader.mjs');
const {networkScreeningReportHtml}=await import(pathToFileURL(path.join(root,'src/demo/networkReport.ts')));
const catalog=JSON.parse(await fs.readFile(path.join(demo,process.argv[2] || 'catalog.json'),'utf8'));
const read=async file=>JSON.parse(zlib.gunzipSync(await fs.readFile(path.join(demo,file))).toString());
async function restore(value,dir){
 if(Array.isArray(value))return Promise.all(value.map(v=>restore(v,dir)));
 if(value && typeof value==='object'){
  if(value.$air_sgm_block){const b=await read(dir+value.$air_sgm_block+'.json.gz');return JSON.stringify(b).includes('"$air_sgm_block"')?restore(b,dir):b;}
  return Object.fromEntries(await Promise.all(Object.entries(value).map(async([k,v])=>[k,await restore(v,dir)])));
 }
 return value;
}
const selected=catalog.filter(row=>row.post_count===7 && row.planning_mode==='new_network' && (row.city==='Рязань'||row.meteo_profile==='annual'));
const zeroRow=catalog.find(row=>row.city==='Рязань'&&row.post_count===0&&row.planning_mode==='expand'&&row.analysis_profile==='extended_diagnostics'&&row.placement_mode==='population_coverage'&&row.meteo_profile==='annual');assert.ok(zeroRow);selected.push(zeroRow);selected.push(...catalog.filter(row=>row.city==='Кораблино'&&row.post_count===2&&row.planning_mode==='expand'&&row.placement_mode.includes('industrial')&&row.meteo_profile==='annual')); 
await fs.mkdir(path.join(root,'.precompute/report-qa'),{recursive:true});
for(const row of selected){const saved=await read(row.file),run=await restore(saved.runs ? saved.runs[row.preset_key] : saved.tree,saved.shared_dir),html=networkScreeningReportHtml(run);
 assert.ok(html.includes('<!DOCTYPE html>')||html.includes('<!doctype html>'));assert.ok(html.includes(row.id));assert.ok(!html.includes('window.print()'));assert.ok(!/\sdownload[=\s>]/i.test(html));assert.ok(html.length>1000000);
 if(run.demo_transport_snapshot)assert.ok(html.includes('Местные дороги OSM'));
 if(row.city==='Кораблино'){await fs.writeFile(path.join(root,'.precompute/report-qa/korablino-'+row.analysis_profile+'.html'),html);;}
 if(row.city==='Рязань'&&row.placement_mode==='population_coverage'&&row.meteo_profile==='annual'&&row.analysis_profile==='coverage_backbone')await fs.writeFile(path.join(root,'.precompute/report-qa/two-step-run.json'),JSON.stringify(run));
 if(row===zeroRow)await fs.writeFile(path.join(root,'.precompute/report-qa/zero-posts.html'),html);
 if(row.city==='Спасск-Рязанский')await fs.writeFile(path.join(root,'.precompute/report-qa/local-roads.html'),html);
}
console.log('HTML reports verified:',selected.length);
