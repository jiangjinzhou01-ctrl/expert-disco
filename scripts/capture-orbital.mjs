import console from 'node:console';
import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const evidence={browser:browser.version(),errors:[],views:[]};
try{
const page=await browser.newPage({viewport:{width:960,height:540},deviceScaleFactor:1});page.on('pageerror',e=>evidence.errors.push(String(e)));
await page.goto('http://127.0.0.1:5180/?mode=chapter&test=1');await page.waitForFunction(()=>window.__V02_TEST__?.snapshot().ready===true,null,{timeout:90000});await page.evaluate(()=>window.__V02_TEST__.pause(true));
const tutorial=page.getByRole('button',{name:'关闭操作提示'});if(await tutorial.isVisible())await tutorial.click();
await mkdir('evidence/orbital',{recursive:true});
for(const id of ['CAPSULE','ARRIVAL','CROSSING','C3']){
await page.evaluate(async id=>{const a=window.__V02_TEST__;if(id==='CAPSULE'){a.restart();a.look(-440,-50);}else a.camera(id);a.render();await a.runtime.streaming.settle();a.render();},id);
await page.waitForTimeout(250);await page.screenshot({path:`evidence/orbital/${id}.png`});const state=await page.evaluate(()=>window.__V02_TEST__.snapshot());evidence.views.push({id,state});console.log(id,{draws:state.render.mainDrawCalls,portal:state.render.offscreenDrawCalls,chunks:state.streaming.resident,loading:state.streaming.loading});
}
if(evidence.errors.length)throw Error(JSON.stringify(evidence.errors));
await writeFile('evidence/orbital/art-capture.json',JSON.stringify(evidence,null,2));
}finally{await browser.close();}
