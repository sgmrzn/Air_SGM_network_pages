import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'..'),directory=path.join(root,'public/demo');
globalThis.window={fetch:async input=>{
  const file=path.resolve(directory,new URL(input).pathname.replace(/^\/demo\//,''));
  assert.ok(file.startsWith(directory+path.sep));
  try{return new Response(await fs.readFile(file));}catch{return new Response('',{status:404});}
}};
await import('./native-ui-loader.mjs');
const {resolveDemoApi,demoData}=await import('../src/demo/api.ts');
const call=async(type,search='')=>(await resolveDemoApi(new URL(`http://demo.local/api/spatial/sources${type}?${new URLSearchParams({limit:'20000',search})}`))).json();
const raw=JSON.parse(await fs.readFile(path.join(directory,'sources.json'),'utf8'));
const translated=await call('');
assert.equal(translated.items.length,46);
assert.deepEqual(new Set(translated.items.map(x=>x.id)),new Set(raw.items.map(x=>x.id)));
for(const item of translated.items){
  const source=raw.items.find(x=>x.id===item.id);
  assert.equal(item.original_name,source.name);
  assert.equal(item.latitude,source.latitude);assert.equal(item.longitude,source.longitude);
  assert.ok(/[А-Яа-яЁё]/.test(item.name));
}
assert.equal(translated.items.filter(x=>x.original_name==='Unknown name').length,11);
assert.equal(translated.items.filter(x=>x.original_name==='OpenStreetMap Landfill').length,25);
for(const [ru,en] of [['Дягилевская','Diaghilevskaya'],['Ново-Рязанская','Novo-Ryazan'],['Михайловцемент','Mikhaylovcement']]){
  const a=await call('',ru),b=await call('',en);
  assert.ok(a.total);assert.deepEqual(new Set(a.items.map(x=>x.id)),new Set(b.items.map(x=>x.id)));
}
const osm=JSON.parse(await fs.readFile(path.join(directory,'osm.json'),'utf8'));
const localizedOsm=await call('/osm');assert.equal(localizedOsm.features.length,3161);
for(const feature of localizedOsm.features){
  const source=osm.features.find(x=>x.properties.id===feature.properties.id);
  assert.deepEqual(feature.geometry,source.geometry);
  assert.equal(feature.properties.original_name,source.properties.name);
  if(/[A-Za-z]/.test(source.properties.name||''))assert.ok(!/[A-Za-z]/.test(feature.properties.name));
}
assert.equal((await call('/osm','Бервел')).total,1);
assert.equal((await call('/osm','Доширак')).total,1);
assert.equal((await call('/osm','АГ-Тех')).total,1);
assert.deepEqual(await demoData('sources.json'),raw,'Presentation must not mutate the cached original snapshot');
assert.deepEqual(await demoData('osm.json'),osm);
console.log('Russian source names verified: 46 registry records, 3161 OSM objects, bilingual search, original names, IDs and geometry preserved.');
