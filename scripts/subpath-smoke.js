import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdir,readFile,stat,writeFile } from 'node:fs/promises';
import { extname,resolve,sep } from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

// Separate output preserves the normal production build and concurrent preview tests.
const outputDirectory='/tmp/threshold-v02-subpath';
const prefix='/threshold-v02/';
const port=4181;
const logs=[];
const evidence={capturedAt:new Date().toISOString(),command:'npx vite build --base=/threshold-v02/ --outDir /tmp/threshold-v02-subpath',url:`http://127.0.0.1:${port}${prefix}?debug=1&test=1`,result:'FAIL',requests:[],pageErrors:[],requestFailures:[],browser:null,snapshot:null};
let browser;let server;
try{
  const build=spawnSync('npx',['vite','build','--base=/threshold-v02/','--outDir',outputDirectory],{encoding:'utf8'});
  logs.push(build.stdout,build.stderr);
  assert.equal(build.status,0,'Subpath production build must pass');
  const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.wasm':'application/wasm','.svg':'image/svg+xml','.png':'image/png'};
  server=createServer(async(request,response)=>{
    try{
      if(request.method!=='GET'&&request.method!=='HEAD'){response.writeHead(405).end();return;}
      const pathname=decodeURIComponent(new URL(request.url,'http://127.0.0.1').pathname);
      if(pathname==='/favicon.ico'){response.writeHead(204).end();return;}
      if(!pathname.startsWith(prefix)){response.writeHead(404).end();return;}
      const relative=pathname.slice(prefix.length)||'index.html';
      const file=resolve(outputDirectory,relative);
      if(!file.startsWith(outputDirectory+sep)){response.writeHead(403).end();return;}
      const fileStat=await stat(file);
      if(!fileStat.isFile()){response.writeHead(404).end();return;}
      response.writeHead(200,{'content-type':mime[extname(file)]??'application/octet-stream','cache-control':'no-store'});
      response.end(request.method==='HEAD'?undefined:await readFile(file));
    }catch(error){response.writeHead(error instanceof URIError?400:404).end();}
  });
  await new Promise((resolveReady,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolveReady);});
  browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  evidence.browser=browser.version();
  const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
  page.on('response',response=>{evidence.requests.push({url:response.url(),status:response.status()});});
  page.on('pageerror',error=>evidence.pageErrors.push(error.message));
  page.on('requestfailed',request=>evidence.requestFailures.push({url:request.url(),error:request.failure()?.errorText}));
  const response=await page.goto(evidence.url,{waitUntil:'networkidle'});
  assert.equal(response.status(),200);
  await page.waitForFunction(()=>window.__THRESHOLD_DIAGNOSTICS__?.().ready===true,{},{timeout:30000});
  await page.waitForFunction(()=>window.__THRESHOLD_DIAGNOSTICS__?.().render.offscreenDrawCalls>0,{},{timeout:30000});
  evidence.snapshot=await page.evaluate(()=>({
    diagnostics:window.__THRESHOLD_DIAGNOSTICS__(),
    webgl2:document.querySelector('canvas').getContext('webgl2') instanceof WebGL2RenderingContext,
    mutationAdapter:typeof window.__THRESHOLD__,
    userAgent:navigator.userAgent,
    viewport:[innerWidth,innerHeight],dpr:devicePixelRatio,
  }));
  assert.equal(evidence.snapshot.webgl2,true);
  assert.equal(evidence.snapshot.mutationAdapter,'undefined');
  assert.equal(evidence.snapshot.diagnostics.error,null);
  assert.equal(evidence.snapshot.diagnostics.render.context,'active');
  assert.equal(evidence.snapshot.diagnostics.render.passes,1);
  assert(evidence.snapshot.diagnostics.render.mainDrawCalls>0);
  assert(evidence.requests.some(request=>request.url.includes('/threshold-v02/assets/')&&request.url.endsWith('.js')));
  assert(evidence.requests.every(request=>request.status<400));
  assert.deepEqual(evidence.pageErrors,[]);
  assert.deepEqual(evidence.requestFailures,[]);
  await page.screenshot({path:'evidence/subpath-smoke.png'});
  await page.goto(`http://127.0.0.1:${port}${prefix}?mode=chapter&debug=1&test=1`);
  await page.waitForFunction(()=>window.__THRESHOLD_V02__?.().ready===true,{},{timeout:60000});
  evidence.chapter=await page.evaluate(()=>({snapshot:window.__THRESHOLD_V02__(),mutationAdapter:typeof window.__V02_TEST__}));
  assert.equal(evidence.chapter.mutationAdapter,'undefined');
  assert.equal(evidence.chapter.snapshot.world,'VESTIBULE');
  assert.equal(evidence.chapter.snapshot.error,null);
  assert(evidence.requests.filter(r=>r.url.endsWith('.glb')).length>=2);
  assert(evidence.requests.every(r=>r.status<400));
  await page.screenshot({path:'evidence/v02/subpath-chapter.png'});
  evidence.result='PASS';
  logs.push(`PASS Chromium ${evidence.browser}; WebGL2 active; ready=${evidence.snapshot.diagnostics.ready}; main/portal draws=${evidence.snapshot.diagnostics.render.mainDrawCalls}/${evidence.snapshot.diagnostics.render.offscreenDrawCalls}; ${evidence.requests.length} successful requests; mutation adapter absent.\n`);
}catch(error){
  evidence.error=String(error);logs.push(`${error.stack??error}\n`);process.exitCode=1;
}finally{
  await browser?.close();
  if(server?.listening)await new Promise(resolveClosed=>server.close(resolveClosed));
  await mkdir('evidence',{recursive:true});
  await writeFile('evidence/subpath-smoke.json',JSON.stringify(evidence,null,2));
  await writeFile('evidence/subpath-smoke.log',logs.join('\n'));
  process.stdout.write(logs.join('\n'));
}
