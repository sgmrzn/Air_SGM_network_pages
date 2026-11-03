import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
const root=path.resolve(import.meta.dirname,'../public/demo');
const catalog=JSON.parse(await fs.readFile(path.join(root,'catalog.json'),'utf8'));
if(catalog.length!==22320)throw new Error(`Incomplete catalogue ${catalog.length}/22320`);
const files=[];
async function walk(dir){
 for(const entry of await fs.readdir(dir,{withFileTypes:true})){
  const file=path.join(dir,entry.name);
  if(entry.isDirectory())await walk(file);
  else if(!['manifest.json','qa-catalog.json','catalog-next.json','catalog-next-packed.json'].includes(entry.name)){
   const bytes=await fs.readFile(file);files.push({path:path.relative(root,file).replaceAll('\\','/'),bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
  }
 }
}
await walk(root);
const total=files.reduce((sum,f)=>sum+f.bytes,0);
const methodologyVersions=[...new Set(catalog.map(row=>row.methodology_version))];
if(total>950*1024*1024)throw new Error(`Static payload too large: ${total} bytes`);
const manifest={region:'Рязанская область',city_count:12,run_count:22320,analysis_profiles:['coverage_backbone','extended_diagnostics'],sensitivity_modes:['off','standard'],placement_modes:['population_coverage','industrial_influence','transport_influence','urban_background','integrated_screening'],meteo_profiles:['annual','cold_period','warm_period','weak_wind','calm_accumulation','accumulation_risk'],grid_km:1,radius_m:2500,research_comparison_grids_km:[1,.5],research_comparison_radii_m:[2500,5000],new_network_runs:10800,expansion_runs:11520,methodology_version:methodologyVersions.length===1?methodologyVersions[0]:'mixed-version-catalogue',compression:'gzip and lossless shared JSON blocks; every original passport round-trip verified',report_delivery:'HTML generated from precomputed passports and downloaded locally',exported_at:new Date().toISOString(),total_bytes:total,files};
await fs.writeFile(path.join(root,'manifest.json'),JSON.stringify(manifest,null,2));
manifest.methodology_versions=methodologyVersions;
try { manifest.calculation_revision=JSON.parse(await fs.readFile(path.join(root,'revisions/rnpk-20261026/summary.json'),'utf8')); } catch(error) { if(error.code!=='ENOENT')throw error; }
manifest.local_road_proxy_extension={cities:['Спасск-Рязанский','Новомичуринск'],class_weights:{secondary:0.25,tertiary:0.125},interpretation:'User-approved geometric OSM screening extension; no measured traffic or pollutant concentration'};
await fs.writeFile(path.join(root,'manifest.json'),JSON.stringify(manifest,null,2));
console.log(JSON.stringify({runs:catalog.length,files:files.length,megabytes:Number((total/1048576).toFixed(1))},null,2));
