import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
const root=path.resolve(import.meta.dirname,'../public/demo');
const catalog=JSON.parse(await fs.readFile(path.join(root,'catalog.json'),'utf8'));
if(catalog.length!==372) throw new Error(`Incomplete catalog: ${catalog.length}/372`);
for(const item of catalog){
 if(item.file.endsWith('.gz'))continue;
 const file=path.resolve(root,item.file);
 if(!file.startsWith(root+path.sep))throw new Error('Out-of-root file');
 const bytes=await fs.readFile(file);
 const packed=zlib.gzipSync(bytes,{level:9});
 if(!zlib.gunzipSync(packed).equals(bytes))throw new Error('Compression changed input');
 await fs.writeFile(file+'.gz',packed);
 item.file+='.gz';
 // Only this known, fully preserved source file is removed; no recursive deletion.
 await fs.unlink(file);
}
await fs.writeFile(path.join(root,'catalog.json'),JSON.stringify(catalog));
const files=[];
async function walk(dir){
 for(const entry of await fs.readdir(dir,{withFileTypes:true})){
  const file=path.join(dir,entry.name);
  if(entry.isDirectory())await walk(file);
  else if(entry.name!=='manifest.json'){
   const bytes=await fs.readFile(file);
   files.push({path:path.relative(root,file).replaceAll('\\','/'),bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
  }
 }
}
await walk(root);
const manifest={region:'Рязанская область',city_count:12,run_count:372,empty_registry_expansion_cities:11,compression:'gzip-lossless; native JSON restored by browser',exported_at:new Date().toISOString(),files};
await fs.writeFile(path.join(root,'manifest.json'),JSON.stringify(manifest,null,2));
console.log(`Finalized ${catalog.length} runs; ${(files.reduce((s,f)=>s+f.bytes,0)/1024/1024).toFixed(1)} MB`);
