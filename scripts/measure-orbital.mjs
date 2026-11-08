import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import console from 'node:console';
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:640,height:360},deviceScaleFactor:1});
 await page.goto('http://127.0.0.1:5180/?mode=chapter&test=1');await page.waitForFunction(()=>window.__V02_TEST__?.snapshot().ready===true,null,{timeout:90000});
 const samples=[];
 for(const view of ['ARRIVAL','C3']){
  await page.evaluate(async view=>{const a=window.__V02_TEST__;a.pause(true);a.camera(view);a.render();await a.runtime.streaming.settle();a.render();a.runtime.performance.reset();a.pause(false);},view);
  const started=performance.now();await page.waitForTimeout(15000);
  const state=await page.evaluate(()=>{const a=window.__V02_TEST__;a.pause(true);return a.snapshot();});
  samples.push({view,seconds:(performance.now()-started)/1000,performance:state.performance,render:state.render,streaming:state.streaming,materials:state.materials});console.log(view,JSON.stringify(state.performance));
 }
 const environment=await page.evaluate(()=>{const gl=document.querySelector('canvas').getContext('webgl2');const info=gl.getExtension('WEBGL_debug_renderer_info');return {userAgent:navigator.userAgent,renderer:info?gl.getParameter(info.UNMASKED_RENDERER_WEBGL):'Unavailable',viewport:[innerWidth,innerHeight],dpr:devicePixelRatio};});
 await mkdir('evidence/orbital',{recursive:true});await writeFile('evidence/orbital/software-performance.json',JSON.stringify({browser:browser.version(),environment,samples,note:'Software-rendered cloud browser, not a physical phone/desktop GPU. Fixed view sampling does not certify input latency or thermal performance.'},null,2));
}finally{await browser.close();}
