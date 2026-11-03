import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

let storedDraft = null;
globalThis.window={fetch:globalThis.fetch,localStorage:{getItem:()=>storedDraft}};
const {NetworkDesignPage}=await import('../src/pages/NetworkDesignPage.tsx');
const {HelpPage}=await import('../src/demo/Help.tsx');
const render=()=>renderToStaticMarkup(React.createElement(NetworkDesignPage));
function options(html,label) {
  const start=html.indexOf(`<span>${label}</span>`);
  assert.ok(start>=0,label);
  const select=html.slice(start).match(/<select\b[^>]*>([\s\S]*?)<\/select>/)[1];
  return [...select.matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/g)].map(([,attributes,text])=>({
    value:attributes.match(/value="([^"]*)"/)[1],disabled:/\bdisabled=/.test(attributes),selected:/\bselected=/.test(attributes),text,
  }));
}
const enabled=(list)=>list.filter(item=>!item.disabled).map(item=>item.value);
const html=render();
storedDraft=JSON.stringify({schemaVersion:9,meteoProfile:'accumulation_risk'});
assert.equal(options(render(),'Период розы ветров ERA5').find(x=>x.selected).value,'weak_wind');
assert.ok(!options(html,'Период розы ветров ERA5').some(x=>x.value==='accumulation_risk'));
storedDraft=null;
assert.deepEqual(enabled(options(html,'Шаг аналитической сетки')),['1']);
assert.deepEqual(enabled(options(html,'Сценарный радиус охвата поста')),['2500']);
assert.deepEqual(enabled(options(html,'Режим размера сети')),['required_network_size']);
// Before readiness is loaded, even the enabled mask requires confirmation of data.
assert.ok(options(html,'Маски непригодности').find(x=>x.value==='off').disabled);
assert.equal(options(html,'Период розы ветров ERA5').filter(x=>!x.disabled).length,5);
assert.equal(options(html,'Глубина проверки').filter(x=>!x.disabled).length,2);
assert.deepEqual(enabled(options(html,'Постов в новой сети')),Array.from({length:15},(_,i)=>String(i+1)));
for(const mode of ['new_network','expand']) {
  storedDraft=JSON.stringify({schemaVersion:9,planningMode:mode,gridKm:0.2,radiusM:10000,postCount:20,networkSizeMode:'budget_ceiling',useExclusionMasks:false,screeningProfile:'robustness'});
  const restored=render();
  for (const [label,value] of [['Шаг аналитической сетки','1'],['Сценарный радиус охвата поста','2500'],['Режим размера сети','required_network_size']]) {
    const choice=options(restored,label).find(x=>x.selected);
    assert.equal(choice.value,value);assert.equal(choice.disabled,false);
  }
  assert.equal(options(restored,'Маски непригодности').find(x=>x.selected).value,'on');
  const counts=options(restored,mode==='expand'?'Добавить стационарных постов':'Постов в новой сети');
  assert.equal(counts.find(x=>x.selected).value,'15');
  assert.deepEqual(enabled(counts),Array.from({length:mode==='expand'?16:15},(_,i)=>String(i+(mode==='expand'?0:1))));
  assert.equal(options(restored,'Глубина проверки').find(x=>x.selected).value,'robustness');
  assert.ok(restored.includes('периоды ERA5 и 2 дополнительных варианта сетки и радиуса.'));
}
// Ensure the wizard's enabled values actually occur in the shipped catalogue.
const catalogue=JSON.parse(await fs.readFile(new URL('../public/demo/catalog.json',import.meta.url),'utf8'));
const cities=JSON.parse(await fs.readFile(new URL('../public/demo/cities.json',import.meta.url),'utf8'));
const cityOptions=options(html,'Населённый пункт');
assert.equal(cityOptions.length,12);
assert.deepEqual(new Set(enabled(cityOptions)),new Set(cities.map(city=>city.id)));
assert.deepEqual(new Set(enabled(cityOptions)),new Set(catalogue.map(row=>row.city_id)));
assert.equal(cityOptions.find(item=>item.selected).value,'osm-area-1782722');
assert.ok(!html.includes('aria-autocomplete="list"'));
for (const city of cities) {
  storedDraft=JSON.stringify({schemaVersion:9,territoryId:city.id,territoryQuery:city.name});
  assert.equal(options(render(),'Населённый пункт').find(item=>item.selected).value,city.id);
}
storedDraft=JSON.stringify({schemaVersion:9,territoryId:'not-in-publication',territoryQuery:'Old search'});
assert.equal(options(render(),'Населённый пункт').find(item=>item.selected).value,'osm-area-1782722');
for(const [field,label] of [['grid_km','Шаг аналитической сетки'],['radius_m','Сценарный радиус охвата поста'],['network_size_mode','Режим размера сети']]) {
  assert.deepEqual(new Set(catalogue.map(x=>String(x[field]))),new Set(enabled(options(html,label))));
}
const help=renderToStaticMarkup(React.createElement(HelpPage));
for(const page of [html,help])for(const text of ['Доступные режимы: публикация и основная система','22 320','200, 250, 300, 400, 500 м','1–15','1–20','только дополнительное сравнение'])assert.ok(page.includes(text),text);
console.log('Publication settings verified: disabled options match catalogue, old drafts migrate, both planning modes and shared help are consistent.');
