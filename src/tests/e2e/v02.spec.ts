import{test,expect}from'@playwright/test';
import{mkdir,writeFile}from'node:fs/promises';
import{chapterReady,chapterRead,driveBatch,routeStages}from'./v02-helpers';
test.setTimeout(180000);
test('V02: complete input-driven chapter, trigger, return, and deterministic uncut frame sequence',async({page})=>{
 test.setTimeout(270000);
 await page.setViewportSize({width:960,height:540});await chapterReady(page);await mkdir('evidence/v02/path',{recursive:true});const initial=await chapterRead(page);const commands=[];const frames:unknown[]=[{file:'0000.png',fixedStep:0,snapshot:initial}];let counter=0;let fixedStep=0;
 await page.evaluate(()=>window.__V02_TEST__!.render());await page.screenshot({path:'evidence/v02/path/0000.png'});
 for(const stage of routeStages){let done=false;for(let batch=0;batch<80&&!done;batch++){const result=await driveBatch(page,stage,60-fixedStep%60);done=result.done;fixedStep+=result.steps;commands.push({stage,steps:result.steps,snapshot:result.snapshot});if(fixedStep%60===0&&result.steps>0){await page.evaluate(()=>window.__V02_TEST__!.render());const name=String(++counter).padStart(4,'0');await page.screenshot({path:`evidence/v02/path/${name}.png`});frames.push({file:`${name}.png`,fixedStep,snapshot:await chapterRead(page)});}}
  expect(done,stage).toBe(true);if(stage==='terminal'){expect((await chapterRead(page)).interactable).toBe(true);await page.getByRole('button',{name:'激活终端'}).click();expect((await chapterRead(page)).terminal).toBe(true);}
 }
 const final=await chapterRead(page);expect(final.returned).toBe(true);expect(final.events.map(e=>e.id)).toEqual([1,2]);expect(final.up).toEqual([0,1,0]);expect(final.errors).toEqual([]);expect(final.rotationQueries).toBeGreaterThan(500);
 await page.evaluate(()=>window.__V02_TEST__!.render());await page.screenshot({path:'evidence/v02/chapter-returned.png'});await writeFile('evidence/v02/continuous-path.json',JSON.stringify({initial,method:'fixed-step frame sequence, one frame every 60 physics ticks; every tick is input-driven; no pose/camera teleport; no omitted input commands',dt:1/60,frames,commands,final},null,2));
 const response=await page.evaluate(()=>{const a=window.__V02_TEST__!;const before=a.snapshot();a.look(-Math.PI/.0025,0);let steps=0;for(;steps<520;steps++){const s=a.snapshot();if(!s.ready)throw Error('Not ready');if(s.foot[2]>.98)break;a.step(1,0,1);}a.look(0,247);a.render();const mesh=a.runtime.scenes.A.device,material=mesh.material as import('three').MeshStandardMaterial;return {before,steps,lookInputs:[[-Math.PI/.0025,0],[0,247]],movement:[0,1],after:a.snapshot(),mesh:{color:material.color.getHexString(),scale:mesh.scale.toArray(),position:mesh.position.toArray()},coverage:a.frameVisibility()};});expect(response.mesh.color).toBe('b6a087');expect(response.mesh.scale).toEqual([1.3,1.3,1.3]);expect(response.coverage.counts.VESTIBULE_RESONATOR??0,'actual warm resonator must be visible from the reachable pit edge').toBeGreaterThanOrEqual(6);await page.screenshot({path:'evidence/v02/resonator-response.png'});await writeFile('evidence/v02/resonator-response.json',JSON.stringify({method:'After the completed chapter, walk and look from the actual returned pose; no placement or state flag mutation',...response},null,2));

});
test('V02: CR1 cameras show real geometry and both fixed-axis witnesses after the turn',async({page})=>{
 test.setTimeout(300000);await chapterReady(page);const views=[];for(const id of ['ARRIVAL','CROSSING','C1','C2','C3']){await page.evaluate(id=>{window.__V02_TEST__!.camera(id);window.__V02_TEST__!.render();},id);await page.waitForTimeout(250);const snapshot=await chapterRead(page);const visibility=await page.evaluate(()=>({slab:window.__V02_TEST__!.visibility('ORIGINAL_AXIS_CANTILEVER'),pier:window.__V02_TEST__!.visibility('ORIGINAL_AXIS_PIER')})) as {slab:{visibleSamples:number};pier:{visibleSamples:number}};
  if(id==='C2'){expect(visibility.slab.visibleSamples,id+' slab').toBeGreaterThan(50);expect(visibility.pier.visibleSamples,id+' pier').toBeGreaterThan(50);}if(id==='C3'){expect(visibility.slab.visibleSamples).toBeGreaterThan(2);expect(visibility.pier.visibleSamples).toBeGreaterThan(2);}
  const coverage=id==='C3'?await page.evaluate(()=>window.__V02_TEST__!.frameVisibility()):null;if(coverage){expect(coverage.counts.ORIGINAL_AXIS_CANTILEVER??0,'real slab screen area').toBeGreaterThanOrEqual(8);expect(coverage.counts.ORIGINAL_AXIS_PIER??0,'real pier screen area').toBeGreaterThanOrEqual(8);expect(coverage.counts['I-continuous-ground-arc-wall']??0,'actual supporting wall must be in frame').toBeGreaterThanOrEqual(6);expect(coverage.stairs,'recognizable old-gravity risers must be in frame').toBeGreaterThanOrEqual(8);}
  if(id==='C3'){expect(snapshot.mode).toBe('WALL');expect(snapshot.up[0]).toBe(-1);expect(snapshot.eye[0]).toBeCloseTo(3.15,3);}
  await page.screenshot({path:`evidence/v02/${id}-1920.png`});views.push({id,snapshot,visibility,coverage});}
 await writeFile('evidence/v02/camera-visibility.json',JSON.stringify(views,null,2));
});
test('V02: offscreen portal culling, resizing, context restoration, and checkpoint reset',async({page})=>{
 await chapterReady(page);await page.evaluate(()=>{const a=window.__V02_TEST__!;a.place([0,0,-15],'A');a.look(0,0);a.render();});expect((await chapterRead(page)).render.passes).toBe(1);
 const allocations=(await chapterRead(page)).render.targetResizes;await page.evaluate(()=>{for(let i=0;i<8;i++)window.__V02_TEST__!.render();});expect((await chapterRead(page)).render.targetResizes).toBe(allocations);
 await page.evaluate(()=>{window.__V02_TEST__!.look(-Math.PI/.0025,0);window.__V02_TEST__!.render();});expect((await chapterRead(page)).render.passes).toBe(0);
 // A wider view legitimately loads new cells and retains them for six seconds.
 // Warm the exact viewport sequence before asserting repeated resize allocations.
 const sizes=[[1170,540],[1200,540],[960,540]];
 async function resizeCycle(){for(const [width,height]of sizes){await page.setViewportSize({width,height});await page.waitForFunction(ratio=>Math.abs(window.__V02_TEST__!.runtime.camera.aspect-ratio)<.0001,width/height);await page.evaluate(async()=>{const a=window.__V02_TEST__!;a.render();await a.runtime.streaming.settle();a.render();});}}
 await resizeCycle();const before=(await chapterRead(page)).render;
 await resizeCycle();const resized=(await chapterRead(page)).render;
 expect(resized.geometries).toBeLessThanOrEqual(before.geometries+1);expect(resized.textures).toBeLessThanOrEqual(before.textures+2);
 const supported=await page.evaluate(()=>{const gl=window.__V02_TEST__!.runtime.gl.getContext();const e=gl.getExtension('WEBGL_lose_context');if(!e)return false;e.loseContext();setTimeout(()=>e.restoreContext(),150);return true;});expect(supported).toBe(true);await page.waitForTimeout(500);await page.evaluate(()=>window.__V02_TEST__!.render());expect((await chapterRead(page)).render.context).toBe('active');
 await page.getByRole('button',{name:'安全复位'}).click();expect((await chapterRead(page)).foot.every(Number.isFinite)).toBe(true);const after=await chapterRead(page);const disposed=await page.evaluate(()=>{const a=window.__V02_TEST__!;a.runtime.dispose();return {ready:a.runtime.ready,memory:{...a.runtime.gl.info.memory}};});expect(disposed.ready).toBe(false);expect(disposed.memory.geometries).toBe(0);expect(disposed.memory.textures).toBe(0);await writeFile('evidence/v02/lifecycle.json',JSON.stringify({before,resized,after,disposed},null,2));
});

test('V02: seeded free look and free movement expose real enclosing geometry beyond hero cameras',async({page})=>{
 await page.setViewportSize({width:1280,height:720});await chapterReady(page);for(let n=0;n<6;n++)await driveBatch(page,'entryhall',60);const samples=[];let seed=0x1a2b3c4d;const random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296;};
 for(let n=0;n<8;n++){const dx=(random()-.5)*480,dy=(random()-.5)*100,x=(random()-.5)*1.6,y=(random()-.5)*1.6;await page.evaluate(({dx,dy,x,y})=>{const a=window.__V02_TEST__!;a.look(dx,dy);a.step(40,x,y);a.render();},{dx,dy,x,y});const state=await chapterRead(page);expect(state.foot.every(Number.isFinite)).toBe(true);expect(state.grounded).toBe(true);expect(state.errors).toEqual([]);if(n%2===0)await page.screenshot({path:`evidence/v02/free-${n}.png`});samples.push({dx,dy,x,y,state});}
 await page.getByRole('button',{name:'设置',exact:true}).click();await page.getByRole('button',{name:'碰撞几何',exact:true}).click();await page.evaluate(()=>window.__V02_TEST__!.render());await page.screenshot({path:'evidence/v02/collision-observer.png'});await writeFile('evidence/v02/seeded-free-route.json',JSON.stringify({seed:'0x1a2b3c4d',teleports:0,samples},null,2));
});
