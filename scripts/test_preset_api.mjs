// Unit test the actual static adapter against exported files; no browser or DOM.
import fs from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const root=path.resolve(import.meta.dirname,'..'),data=path.join(root,'public/demo');
globalThis.window={fetch:async input=>{
 const file=path.resolve(data,new URL(input).pathname.replace(/^\/demo\//,''));
 assert.ok(file.startsWith(data+path.sep));
 try{return new Response(await fs.readFile(file));}catch{return new Response('',{status:404});}
}};
await import('./native-ui-loader.mjs');
const source=(await fs.readFile(path.join(root,'src/demo/api.ts'),'utf8')).replaceAll('../shared/sourceNamesRu',pathToFileURL(path.join(root,'src/shared/sourceNamesRu.ts')).href).replaceAll('import.meta.env.BASE_URL',JSON.stringify('http://demo.local/')).replaceAll('import.meta.env.VITE_DEMO_CATALOG',JSON.stringify('catalog.json'));
const temp=path.join(root,'scripts/.preset-api-test.mjs');
await fs.writeFile(temp,ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);
const api=await import(pathToFileURL(temp));
for(const placement of ['population_coverage','industrial_influence','transport_influence','urban_background','integrated_screening']){
 const request={territory_kind:'settlement',territory_id:'osm-area-1782722',placement_mode:placement,planning_mode:'new_network',post_count:15,meteo_profile:'annual',post_type:'stationary',research_mode:true,analysis_profile:'extended_diagnostics',sensitivity_mode:'standard',sensitivity_grid_km:[1,.5],sensitivity_radii_m:[2500,5000],network_size_mode:'required_network_size',grid_km:1,radius_m:2500,use_exclusion_masks:true,source_context_radius_km:25,wind_sector_tolerance_deg:22.5,selected_source_ids:[],transport_evidence_mode:'auto'};
 const response=await api.resolveDemoApi(new URL('http://demo.local/api/spatial/network-design/runs/async'),{method:'POST',body:JSON.stringify(request)});
 assert.equal(response.status,201);
 const run=await response.json();assert.equal(run.status,'completed');assert.equal(run.request.placement_mode,placement);assert.equal(run.request.post_count,15);assert.equal(run.request.analysis_profile,'extended_diagnostics');assert.equal(run.request.sensitivity_mode,'standard');assert.equal(run.scenario_results.length,3);assert.equal(run.sensitivity.status,'ready');assert.equal(run.sensitivity.variants.length,2);
 const fetched=await api.resolveDemoApi(new URL('http://demo.local/api/spatial/network-design/runs/'+run.id));assert.equal((await fetched.json()).id,run.id);
 console.log('Research adapter verified:',placement,'15 posts, 3 periods, 2 geometric variants');
}
for (const meteo of ['annual','cold_period','warm_period','weak_wind','calm_accumulation','accumulation_risk']) for (const analysis of ['coverage_backbone','extended_diagnostics']) for (const count of [0,15]) {
 const research=analysis==='extended_diagnostics';
 const request={territory_kind:'settlement',territory_id:'osm-area-5807474',placement_mode:'integrated_screening',planning_mode:'expand',post_count:count,meteo_profile:meteo,post_type:'stationary',research_mode:true,analysis_profile:analysis,sensitivity_mode:research?'standard':'off',sensitivity_grid_km:[1,.5],sensitivity_radii_m:[2500,5000],network_size_mode:'required_network_size',grid_km:1,radius_m:2500,use_exclusion_masks:true,source_context_radius_km:25,wind_sector_tolerance_deg:22.5,selected_source_ids:[],transport_evidence_mode:'auto'};
 const response=await api.resolveDemoApi(new URL('http://demo.local/api/spatial/network-design/runs/async'),{method:'POST',body:JSON.stringify(request)});
 assert.equal(response.status,201);const run=await response.json();assert.equal(run.request.meteo_profile,meteo);assert.equal(run.request.analysis_profile,analysis);assert.ok(run.demo_baseline);assert.equal(run.scenario_results.length,research?(['annual','cold_period','warm_period'].includes(meteo)?3:4):1);if(research){assert.equal(run.sensitivity.status,count?'ready':'disabled');assert.equal(run.sensitivity.variants.length,count?2:0);}
 console.log('Expansion adapter verified:',meteo,analysis,count);
}
await fs.unlink(temp);
