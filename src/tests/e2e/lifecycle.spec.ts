import { expect,test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

test('WebGL2 context loss/restoration resumes real portal passes',async({page},testInfo)=>{
  await page.goto('/?test=1&debug=1');
  await page.waitForFunction(()=>Boolean(window.__THRESHOLD__?.snapshot().ready));
  const support=await page.evaluate(async()=>{
    const gl=window.__THRESHOLD__!.runtime.gl;
    const context=gl.getContext();
    const extension=context.getExtension('WEBGL_lose_context');
    if(!extension)return false;
    Object.defineProperty(window,'__contextRestoreForTest',{value:()=>extension.restoreContext(),configurable:true});
    extension.loseContext();return context instanceof WebGL2RenderingContext;
  });
  expect(support,'Software Chromium must expose WebGL2 and loss extension; absence is a test failure').toBe(true);
  await page.waitForFunction(()=>window.__THRESHOLD__?.snapshot().render.context==='lost');
  await page.evaluate(()=>Reflect.get(window,'__contextRestoreForTest')());
  await page.waitForFunction(()=>window.__THRESHOLD__?.snapshot().render.context==='active');
  await page.waitForFunction(()=>{const render=window.__THRESHOLD__?.snapshot().render;return Boolean(render&&render.mainDrawCalls>0&&render.offscreenDrawCalls>0);});
  const after=await page.evaluate(()=>window.__THRESHOLD__!.snapshot());
  expect(after.render.passes).toBe(1);expect(after.render.textures).toBeGreaterThan(0);
  await writeFile('evidence/context-restoration.json',JSON.stringify(after,null,2));
  await testInfo.attach('context-restoration.json',{body:JSON.stringify(after,null,2),contentType:'application/json'});
});

test('resize and render quality retain aspect and bounded GPU resources; disposal releases resources',async({page},testInfo)=>{
  await page.goto('/?test=1');await page.waitForFunction(()=>Boolean(window.__THRESHOLD__?.snapshot().ready));
  await page.waitForFunction(()=>window.__THRESHOLD__!.snapshot().render.textures>0);
  const initial=await page.evaluate(()=>window.__THRESHOLD__!.snapshot().render);
  const samples=[];
  for(const [width,height] of [[1280,720],[960,640],[1080,720],[1600,900],[1920,1080],[1280,720]]){
    await page.setViewportSize({width,height});
    await expect.poll(()=>page.evaluate(()=>{const runtime=window.__THRESHOLD__!.runtime;const m=runtime.portalRenderer.metrics;return [m.targetWidth,m.targetHeight,runtime.gl.domElement.width,runtime.gl.domElement.height];})).toEqual([Math.round(width*.85),Math.round(height*.85),width,height]);
    const result=await page.evaluate(()=>window.__THRESHOLD__!.snapshot().render);samples.push({...result});
    expect(result.geometries).toBe(initial.geometries);expect(result.textures).toBe(initial.textures);
    expect(result.programs).toBeLessThanOrEqual(initial.programs+1);
  }
  const quality=await page.evaluate(async()=>{
    const runtime=window.__THRESHOLD__!.runtime;
    runtime.portalRenderer.resize(1280,720,runtime.gl.getPixelRatio(),.5);runtime.portalRenderer.render(runtime.state.worldId);
    return {...runtime.portalRenderer.metrics};
  });
  expect(quality.quality).toBe(.5);expect(quality.targetWidth).toBe(640);expect(quality.targetHeight).toBe(360);expect(quality.targetWidth/quality.targetHeight).toBeCloseTo(16/9,2);
  const disposed=await page.evaluate(async()=>{
    const runtime=window.__THRESHOLD__!.runtime;
    runtime.dispose();
    return {...runtime.gl.info.memory,programs:runtime.gl.info.programs?.length};
  });
  expect(disposed.geometries).toBe(0);expect(disposed.textures).toBe(0);expect(disposed.programs).toBe(0);
  await writeFile('evidence/resize-resources.json',JSON.stringify({initial,samples,quality,disposed},null,2));
  await testInfo.attach('resize-resources.json',{body:JSON.stringify({initial,samples,quality,disposed},null,2),contentType:'application/json'});
});
