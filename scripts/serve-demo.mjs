import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
const directory=path.resolve(import.meta.dirname,'../dist');
const prefix=process.argv.find(x=>x.startsWith('--prefix='))?.slice(9)||'/';
const port=Number(process.env.PORT || 5186);
const shouldOpen=!process.argv.includes('--no-open');
if(!/^\/[a-zA-Z0-9/_-]*$/.test(prefix) || !prefix.endsWith('/') || !Number.isInteger(port) || port<0 || port>65535)throw new Error('Некорректный адрес или порт просмотрщика.');
let selectedPort=port;
function openPage(url){
 if(!shouldOpen)return;
 if(process.platform==='win32')execFile('rundll32.exe',['url.dll,FileProtocolHandler',url],{windowsHide:true},error=>{if(error)console.log('Откройте адрес выше в браузере.');});
}
async function existingDemo(candidate){
 return new Promise(resolve=>{
  const req=http.get(`http://127.0.0.1:${candidate}/__air_sgm_demo_info`,res=>{
   let body='';
   res.on('data',chunk=>{body+=chunk;if(body.length>4096)req.destroy();});
   res.on('end',()=>{try{const info=JSON.parse(body);resolve(info.kind==='air-sgm-network-demo-v1' && info.directory===directory ? info : null);}catch{resolve(null);}});
  });
  req.setTimeout(1000,()=>req.destroy());
  req.on('error',()=>resolve(null));
 });
}
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.gz':'application/gzip','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.woff2':'font/woff2'};
const server=http.createServer(async(req,res)=>{
 try{
  if(req.method!=='GET' && req.method!=='HEAD'){res.writeHead(405);res.end();return;}
  const url=new URL(req.url,'http://127.0.0.1');
  const pathname=decodeURIComponent(url.pathname);
  if(pathname==='/__air_sgm_demo_info'){
   const body=JSON.stringify({kind:'air-sgm-network-demo-v1',directory,url:`http://127.0.0.1:${selectedPort}${prefix}`});
   res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-cache'});res.end(body);return;
  }
  if(pathname==='/' && prefix!=='/'){res.writeHead(302,{Location:prefix});res.end();return;}
  if(!pathname.startsWith(prefix)){res.writeHead(404);res.end('Not found');return;}
  let name=pathname.slice(prefix.length)||'index.html';
  if(name.endsWith('/'))name+='index.html';
  const file=path.resolve(directory,name);
  if(!file.startsWith(directory+path.sep)){res.writeHead(403);res.end();return;}
  const stat=await fs.stat(file);
  if(!stat.isFile()){res.writeHead(404);res.end();return;}
  const bytes=await fs.readFile(file);
  res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Content-Length':bytes.length,'Cache-Control':'no-cache'});
  res.end(req.method==='HEAD'?undefined:bytes);
 }catch{res.writeHead(404);res.end('Not found');}
});
server.on('error',async e=>{
 if(e.code!=='EADDRINUSE'){console.error(e.message);process.exitCode=1;return;}
 const existing=await existingDemo(selectedPort);
 if(existing){console.log(`Демонстрация уже запущена: ${existing.url}`);openPage(existing.url);return;}
 // Keep a stable address where possible, then let the OS choose a free port.
 selectedPort=selectedPort>=port+20 || selectedPort>=65535 ? 0 : selectedPort+1;
 server.listen(selectedPort,'127.0.0.1');
});
server.on('listening',()=>{
 selectedPort=server.address().port;
 const url=`http://127.0.0.1:${selectedPort}${prefix}`;
 console.log(`Air SGM · ${url}\nЗакройте это окно для остановки просмотра.`);
 openPage(url);
});
server.listen(selectedPort,'127.0.0.1');
