// Exercise the actual report-to-map handler against the real static catalogue.
import fs from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const root=path.resolve(import.meta.dirname,'..'),data=path.join(root,'public/demo');
globalThis.window={fetch:async input=>{const file=path.resolve(data,new URL(input).pathname.replace(/^\/demo\//,''));assert.ok(file.startsWith(data+path.sep));try{return new Response(await fs.readFile(file));}catch{return new Response('',{status:404});}}};
await import('./native-ui-loader.mjs');
const apiSource=(await fs.readFile(path.join(root,'src/demo/api.ts'),'utf8')).replaceAll('../shared/sourceNamesRu',pathToFileURL(path.join(root,'src/shared/sourceNamesRu.ts')).href).replaceAll('import.meta.env.BASE_URL',JSON.stringify('http://demo.local/')).replaceAll('import.meta.env.VITE_DEMO_CATALOG',JSON.stringify('catalog.json'));
const temp=path.join(root,'scripts/.report-map-api-test.mjs');
await fs.writeFile(temp,ts.transpileModule(apiSource,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);
try {
 const api=await import(pathToFileURL(temp)),rows=await api.catalog();
 const reports=await (await api.resolveDemoApi(new URL('http://demo.local/api/spatial/network-design/reports'))).json();
 assert.equal(reports.length,22320);
 const component=(await fs.readFile(path.join(root,'src/pages/NetworkReportsPage.tsx'),'utf8')).replaceAll('\r\n','\n');
 const handler=component.slice(component.indexOf('const openMap = async'),component.indexOf('\n\n  const load ='));
 const js=ts.transpileModule(handler,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 let opened=null,error='',preparing=null;
 const openMap=new Function('catalog','loadDemoRun','onOpenRun','setPreparing','setError',js+';return openMap;')(api.catalog,api.loadDemoRun,run=>opened=run,value=>preparing=value,value=>error=value);
 for(const criteria of [
  {city:'Рязань',planning:'new_network',analysis:'coverage_backbone',count:7},
  {city:'Рязань',planning:'expand',analysis:'extended_diagnostics',count:15},
  {city:'Кораблино',planning:'expand',analysis:'extended_diagnostics',count:0}
 ]){
  const item=reports.find(r=>r.territory===criteria.city&&r.demo_mode===criteria.planning&&r.demo_analysis===criteria.analysis&&r.demo_count===criteria.count);
  assert.ok(item);opened=null;await openMap(item);assert.equal(error,'');assert.equal(preparing,null);assert.equal(opened.id,item.run_id);assert.equal(opened.request.post_count,criteria.count);assert.equal(opened.request.analysis_profile,criteria.analysis);assert.equal(opened.request.planning_mode,criteria.planning);console.log('Report-to-map verified:',criteria.city,criteria.planning,criteria.analysis,criteria.count);
 }
 await openMap({id:'missing',run_id:'missing'});assert.ok(error.includes('не найден'));assert.equal(preparing,null);
 assert.ok(!(await fs.readFile(path.join(root,'src/App.tsx'),'utf8')).includes('DemoCatalog'));
 console.log('Missing report handled; duplicate catalogue removed.');
}finally{await fs.unlink(temp);}
