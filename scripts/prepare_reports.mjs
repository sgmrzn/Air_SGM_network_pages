import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import zlib from 'node:zlib';
const root=path.resolve(import.meta.dirname,'..');
let source=await fs.readFile(path.join(root,'src/pages/NetworkDesignPage.tsx'),'utf8');
source=source.slice(0,source.indexOf('export function NetworkDesignPage'));
source=source.replace(/^import[\s\S]*?;\r?\n/gm,'');
source=source.replace(/^const MapPanel = lazy\([^\n]*\n/m,'');
source='const DEFAULT_TERRITORY={id:"osm-area-1782722",name:"Рязань",label:"Рязань, Рязанская область",gridKm:1};\n'+source+'\n';
const result=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}});
const temp=path.join(root,'scripts/.report-renderer.mjs');
await fs.writeFile(temp,result.outputText);
const {networkScreeningReportHtml}=await import(pathToFileURL(temp));
const demo=path.join(root,'public/demo');
const catalog=JSON.parse(await fs.readFile(path.join(demo,'catalog.json'),'utf8'));
if(catalog.every(item=>item.generated_report)){
 await fs.unlink(temp);
 console.log('Reports are generated locally from precomputed passports when downloaded. No static HTML archive is required.');
 process.exit(0);
}
await fs.mkdir(path.join(demo,'reports'),{recursive:true});
for(const item of catalog){
 let bytes=await fs.readFile(path.join(demo,item.file));
 if(item.file.endsWith('.gz'))bytes=zlib.gunzipSync(bytes);
 const run=JSON.parse(bytes.toString('utf8'));
 let html=networkScreeningReportHtml(run);
 html=html.replace('<body>','<body><div style="padding:12px 20px;background:#eaf3fe;color:#284364">Air SGM · Демонстрация Рязанской области · сохранённый расчёт</div>');
 await fs.writeFile(path.join(demo,'reports',`${item.id}.html`),html);
 item.report_size_bytes=Buffer.byteLength(html);
 item.empty_baseline=Boolean(run.demo_baseline);
}
await fs.writeFile(path.join(demo,'catalog.json'),JSON.stringify(catalog));
await fs.unlink(temp);
console.log(`Reports prepared: ${catalog.length}`);
