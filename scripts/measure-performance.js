import {chromium} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const url=process.argv[2]??'http://127.0.0.1:5173/?test=1&debug=1';
const duration=Number(process.argv[3]??15);
assert(Number.isFinite(duration)&&duration>=1&&duration<=600,'Duration must be 1–600 seconds');
const browser=await chromium.launch({args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
 await page.goto(url);await page.waitForFunction(()=>window.__THRESHOLD__?.snapshot().ready,{},{timeout:30000});
 await page.waitForTimeout(3000);
 await page.evaluate(()=>window.__THRESHOLD__.runtime.performance.reset());
 const startedAt=new Date().toISOString();const start=performance.now();await page.waitForTimeout(duration*1000);
 const measurement=await page.evaluate(()=>{const gl=document.querySelector('canvas').getContext('webgl2');const extension=gl.getExtension('WEBGL_debug_renderer_info');return {userAgent:navigator.userAgent,viewport:[innerWidth,innerHeight],dpr:devicePixelRatio,renderer:extension?gl.getParameter(extension.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),gpuTimerSupported:!!gl.getExtension('EXT_disjoint_timer_query_webgl2'),snapshot:window.__THRESHOLD__.snapshot()};});
 const report={kind:'cloud-software-renderer-benchmark',startedAt,finishedAt:new Date().toISOString(),sampleWallSeconds:(performance.now()-start)/1000,warmupSeconds:3,url,note:'SwiftShader cloud measurement. No real desktop GPU or Android performance conclusion.',...measurement};
 await writeFile('evidence/performance-software-chromium.json',JSON.stringify(report,null,2));
 await page.screenshot({path:'evidence/desktop-diagnostics.png'});
 console.log(JSON.stringify({sampleWallSeconds:report.sampleWallSeconds,renderer:report.renderer,performance:report.snapshot.performance,render:report.snapshot.render}));
}finally{await browser.close();}
