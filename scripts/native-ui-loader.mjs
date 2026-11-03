import {registerHooks} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import ts from 'typescript';
registerHooks({
 resolve(specifier,context,next){
  if(specifier.endsWith('?raw')){const resolved=next(specifier.slice(0,-4),context);return {...resolved,url:resolved.url+'?raw'};}
  if(specifier.startsWith('.')&&context.parentURL?.startsWith('file:')){
   const candidate=fileURLToPath(new URL(specifier,context.parentURL));
   for(const suffix of ['.ts','.tsx','.css'])if(fs.existsSync(candidate+suffix))return {url:pathToFileURL(candidate+suffix).href,shortCircuit:true};
  }
  return next(specifier,context);
 },
 load(url,context,next){
  if(url.endsWith('?raw'))return {format:'module',source:'export default '+JSON.stringify(fs.readFileSync(fileURLToPath(new URL(url)),'utf8')),shortCircuit:true};
  if(url.endsWith('.json'))return {format:'module',source:'export default '+fs.readFileSync(fileURLToPath(url),'utf8'),shortCircuit:true};
  if(url.endsWith('.css'))return {format:'module',source:'export default "";',shortCircuit:true};
  if(/\.(ts|tsx)$/.test(url)&&!url.includes('/node_modules/')){
   const input=fs.readFileSync(fileURLToPath(url),'utf8').replaceAll('import.meta.env',JSON.stringify({BASE_URL:'http://demo.local/',VITE_DEMO_CATALOG:'catalog.json'}));
   return {format:'module',source:ts.transpileModule(input,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,shortCircuit:true};
  }
  return next(url,context);
 }
});
