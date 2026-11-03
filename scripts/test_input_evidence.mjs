// Exercise the real static API adapter, including project-page base URLs.
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {pathToFileURL} from 'node:url';
const root=path.resolve(import.meta.dirname,'..'), data=path.join(root,'public/demo');
globalThis.window={fetch:async input=>{
  const pathname=new URL(input).pathname;
  assert.ok(pathname.startsWith('/repository/demo/'),pathname);
  const file=path.resolve(data,pathname.slice('/repository/demo/'.length));
  assert.ok(file.startsWith(data+path.sep));
  try { return new Response(await fs.readFile(file),{headers:{'Content-Type':file.endsWith('.zip')?'application/zip':'application/json'}}); }
  catch { return new Response('',{status:404}); }
}};
await import('./native-ui-loader.mjs');
const source=(await fs.readFile(path.join(root,'src/demo/api.ts'),'utf8'))
  .replaceAll('../shared/sourceNamesRu',pathToFileURL(path.join(root,'src/shared/sourceNamesRu.ts')).href).replaceAll('import.meta.env.BASE_URL',JSON.stringify('http://demo.local/repository/'))
  .replaceAll('import.meta.env.VITE_DEMO_CATALOG',JSON.stringify('catalog.json'));
const temp=path.join(root,'scripts/.input-evidence-test.mjs');
await fs.writeFile(temp,ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);
try {
  const api=await import(pathToFileURL(temp));
  const request=async(endpoint,params)=>api.resolveDemoApi(new URL(`http://demo.local/api/spatial/network-design/${endpoint}?${new URLSearchParams(params)}`));
  const cities=JSON.parse(await fs.readFile(path.join(data,'cities.json'),'utf8'));
  for (const city of cities) {
    const passport=await (await request('input-passport',{territory_id:city.id})).json();
    assert.equal(passport.territory.id,city.id);
    assert.equal(passport.scope,'published_input_snapshot_not_saved_run');
    for (const layer of ['residential','roads','constraints']) {
      const response=await request('input-layer',{territory_id:city.id,layer});
      assert.equal(response.status,200);
      const value=await response.json();
      assert.equal(value.layer,layer);
      assert.equal(value.summary.total,value.features.length);
      assert.deepEqual(value.summary,passport.vectors[layer]);
      assert.ok(value.boundary.coordinates.length);
      assert.equal(Object.values(value.summary.spatial_counts).reduce((a,b)=>a+b,0),value.features.length);
      const zip=await request('input-export',{territory_id:city.id,layer,offset:'25',limit:'25'});
      assert.equal(zip.status,200);
      assert.equal(zip.headers.get('Content-Type'),'application/zip');
      const buffer=Buffer.from(await zip.arrayBuffer());
      assert.equal(buffer.readUInt32LE(),0x04034b50);
      assert.deepEqual(buffer,await fs.readFile(path.join(data,'input-evidence',city.id,layer+'.zip')));
    }
  }
  assert.equal((await request('input-layer',{territory_id:'not-exported',layer:'residential'})).status,404);
  assert.equal((await request('input-layer',{territory_id:cities[0].id,layer:'invalid'})).status,422);
  const manifest=JSON.parse(await fs.readFile(path.join(data,'input-evidence/manifest.json'),'utf8'));
  assert.equal(Object.keys(manifest.files).length,cities.length*7);
  for (const [file,hash] of Object.entries(manifest.files)) {
    const bytes=await fs.readFile(path.join(data,file));
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),hash,file);
    if (file.endsWith('.gz')) JSON.parse(zlib.gunzipSync(bytes));
  }
  console.log(`Input evidence verified: ${cities.length} passports, ${cities.length*3} full layers and ZIPs; project base URL, errors and SHA256.`);
} finally { await fs.unlink(temp); }
