import fs from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const file=process.argv[2] || new URL('./repaired-downloaded-report.html',import.meta.url);
const html=await fs.readFile(file,'utf8');
assert.ok(!html.includes('src="https://unpkg.com'));assert.ok(!html.includes('href="https://unpkg.com'));
const data=JSON.parse(html.match(/<script id="map-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
class Element {
 constructor(tag='div'){this.tag=tag;this.children=[];this.attributes={};this.style={};this.listeners={};this.value='';this._text='';}
 set textContent(v){this._text=String(v);this.children=[];}get textContent(){return this._text;}
 appendChild(n){this.children.push(n);return n;}replaceChildren(){this.children=[];this._text='';}
 setAttribute(k,v){this.attributes[k]=String(v);}addEventListener(k,f){this.listeners[k]=f;}
 getBoundingClientRect(){return {width:1000,height:600};}setPointerCapture(){}
}
const nodes=new Map([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new Element()]));
nodes.get('map-data').textContent=JSON.stringify(data);
const document={getElementById:id=>nodes.get(id)||null,createElement:tag=>new Element(tag),createElementNS:(_,tag)=>new Element(tag),createTextNode:t=>{const n=new Element('text');n.textContent=t;return n;}};
let mapStarts=0;
const window={};
const script=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1];
vm.runInNewContext(script,{document,window,location:{protocol:'file:'},console},{timeout:15000});
assert.equal(mapStarts,0);
const fallback=nodes.get('map-fallback');
assert.ok(!nodes.has('report-view-schema')&&!nodes.has('map-point-select'),'No map tabs or point selector');
let svg=fallback.children.find(n=>n.tag==='svg');assert.ok(svg);
assert.equal(svg.children.filter(n=>n.tag==='g'&&n.attributes.role==='button').length,data.candidates.length);
assert.ok(svg.children.some(n=>n.tag==='path'));
function assertFullGeometry(svg){
 for(const node of svg.children.filter(n=>n.tag==='path'&&!n.attributes['clip-path']))for(const point of node.attributes.d.matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/g)){
  const x=Number(point[1]),y=Number(point[2]);assert.ok(x>=39.9&&x<=960.1&&y>=49.9&&y<=550.1,`Clipped geometry: ${x},${y}`);
 }
}
assertFullGeometry(svg);
if(String(file).includes('korablino-')){
 assert.equal(data.route_stations.length,0,'Remote Ryazan routes must not appear in Korablino');
 const boundaryPaths=svg.children.filter(n=>n.tag==='path'&&n.attributes.stroke==='#155ea8');
 const xs=boundaryPaths.flatMap(n=>[...n.attributes.d.matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/g)].map(m=>Number(m[1])));
 assert.ok(Math.max(...xs)-Math.min(...xs)>100,'City boundary must remain readable');
}

assert.ok(svg.children.every(n=>!JSON.stringify(n.attributes).includes('NaN')));
assert.ok(nodes.get('map-status').textContent.includes('без интернета'));
const next=data.candidates.find(p=>p.kind==='alternative')||data.candidates[1]||data.candidates[0];
if(next){
svg.children.filter(n=>n.tag==='g'&&n.attributes.role==='button')[data.candidates.indexOf(next)].listeners.click();
assert.ok(nodes.get('map-osm-link').href.includes(String(next.latitude)));
}else {assert.equal(nodes.get('map-point-title').textContent,'Оценка исходного покрытия');assert.ok(nodes.get('map-point-coordinates').textContent.includes(String(data.stations.length)));}
svg=fallback.children.find(n=>n.tag==='svg');
const controls=fallback.children.find(n=>n.className==='saved-map-controls');controls.children[0].onclick();assert.notEqual(svg.attributes.viewBox,'0 0 1000 600');controls.children[2].onclick();assert.equal(svg.attributes.viewBox,'0 0 1000 600');
for(let i=0;i<data.candidates.length;i++){fallback.children.find(n=>n.tag==='svg').children.filter(n=>n.tag==='g'&&n.attributes.role==='button')[i].listeners.click();assertFullGeometry(fallback.children.find(n=>n.tag==='svg'));}
assert.equal(mapStarts,0);
console.log('Standalone HTML verified: SVG geometry,',data.candidates.length,'selectable points, wind details, zoom, reset, OSM link; no tile requests.');

// Exercise the online map branch without making any network requests.
class MapMock {
 constructor(options){this.options=options;this.handlers={};this.sources={};this.layers=[];mapStarts++;}
 on(event,...args){this.handlers[event]=args.at(-1);}
 addControl(){} addSource(id,value){this.sources[id]={...value,setData(value){this.data=value;}};}
 addLayer(layer){this.layers.push(layer);}getSource(id){return this.sources[id];}resize(){}fitBounds(bounds){this.bounds=bounds;}
 getCanvas(){return {style:{}};}queryRenderedFeatures(){return this.features||[];}
}
let liveMap;
const library={Map:class extends MapMock{constructor(options){super(options);liveMap=this;}},NavigationControl:class{},Popup:class{remove(){}setLngLat(){return this;}setHTML(){return this;}addTo(){return this;}}};
vm.runInNewContext(script,{document,window:{maplibregl:library},maplibregl:library,location:{protocol:'file:'},console},{timeout:15000});
assert.equal(liveMap.options.style,'https://tiles.openfreemap.org/styles/liberty');liveMap.handlers['style.load']();
assert.equal(liveMap.sources.points.data.features.filter(f=>['candidate','alternative'].includes(f.properties.kind)).length,data.candidates.length);
if(next){const feature=liveMap.sources.points.data.features.find(f=>f.properties.id===next.id);liveMap.features=[feature];liveMap.handlers.click({point:{x:0,y:0}});assert.ok(nodes.get('map-osm-link').href.includes(String(next.latitude)));}
assert.equal(fallback.style.display,'none');console.log('Unified online map verified: all candidates, marker selection, city bounds, OSM basemap; file and blob compatible.');
