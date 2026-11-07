import { test,expect,type Page } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

type DiagnosticSnapshot={ready:boolean;error:string|null;worldId:'A'|'B';position:number[];yaw:number;lastEventId:number;events:{id:number;step:number}[];render:{context:string;offscreenDrawCalls:number;targetWidth:number;targetHeight:number};movingReference:number[];};
async function read(page:Page):Promise<DiagnosticSnapshot>{return page.evaluate(()=>{
 const diagnostics=(window as unknown as {__THRESHOLD_DIAGNOSTICS__:()=>DiagnosticSnapshot}).__THRESHOLD_DIAGNOSTICS__;
 return diagnostics();
});}

test('normal production bundle runs WebGL and real desktop input traverses both ways',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/?debug=1&test=1');
 await page.waitForFunction(()=>{
  const diagnostics=(window as unknown as {__THRESHOLD_DIAGNOSTICS__?:()=>DiagnosticSnapshot}).__THRESHOLD_DIAGNOSTICS__;
  return diagnostics?.().ready===true;
 });
 expect(await page.evaluate(()=>typeof window.__THRESHOLD__)).toBe('undefined');
 expect(await page.locator('canvas').evaluate(canvas=>(canvas as HTMLCanvasElement).getContext('webgl2') instanceof WebGL2RenderingContext)).toBe(true);
 const initial=await read(page);expect(initial.error).toBeNull();expect(initial.worldId).toBe('A');
 await page.keyboard.down('w');
 try{await expect.poll(async()=>(await read(page)).worldId,{timeout:20000}).toBe('B');await expect.poll(async()=>(await read(page)).position[0],{timeout:15000}).toBeGreaterThan(32.5);}finally{await page.keyboard.up('w');}
 const outbound=await read(page);expect(outbound.lastEventId).toBe(1);
 expect(outbound.position[0]).toBeGreaterThan(32.35);
 await page.locator('canvas').screenshot({path:'evidence/production-B.png'});
 // Desktop look is exercised through real pointer input, without mutation adapters.
 await page.mouse.move(1450,420);await page.mouse.down();await page.mouse.move(193.363,420,{steps:30});await page.mouse.up();
 await expect.poll(async()=>Math.cos((await read(page)).yaw-Math.PI/2),{timeout:5000}).toBeGreaterThan(.99);
 await page.keyboard.down('w');
 try{await expect.poll(async()=>(await read(page)).worldId,{timeout:20000}).toBe('A');}finally{await page.keyboard.up('w');}
 const inbound=await read(page);expect(inbound.lastEventId).toBe(2);
 expect(inbound.events.map(event=>event.id)).toEqual([1,2]);
 expect(inbound.position.every(Number.isFinite)).toBe(true);
 expect(inbound.render.context).toBe('active');expect(inbound.render.offscreenDrawCalls).toBeGreaterThan(5);
 expect(errors).toEqual([]);
 await page.locator('canvas').screenshot({path:'evidence/production-returned-A.png'});
 await writeFile('evidence/production-browser.json',JSON.stringify({initial,outbound,inbound,errors},null,2));
 await page.keyboard.press('r');
 await expect.poll(async()=>(await read(page)).position[2]).toBeCloseTo(-3,1);
});

test('V02 production: genuine keyboard journey from spawn through the turn, interaction and return',async({page})=>{
 const browserErrors:string[]=[];page.on('pageerror',error=>browserErrors.push(error.message));
 test.setTimeout(900000);await page.setViewportSize({width:640,height:360});await page.goto('/?mode=chapter');await page.waitForFunction(()=>window.__THRESHOLD_V02__?.().ready===true,{},{timeout:60000});
 expect(await page.evaluate(()=>typeof window.__V02_TEST__)).toBe('undefined');
 const trace:unknown[]=[];
 async function keyUntil(key:string,condition:string){await page.keyboard.down(key);try{await page.waitForFunction(condition,{},{timeout:150000});}catch(error){await writeFile('evidence/v02/production-failure-state.json',JSON.stringify({key,condition,trace,snapshot:await page.evaluate(()=>window.__THRESHOLD_V02__!())},null,2));throw error;}finally{await page.keyboard.up(key);}const s=await page.evaluate(()=>window.__THRESHOLD_V02__!());trace.push({key,snapshot:s});console.log('production input stage',key,s.ready?{world:s.world,foot:s.foot,mode:s.mode,step:s.step}:s);}
 const read='window.__THRESHOLD_V02__()';
 await keyUntil('w',`${read}.foot[2]<18`);await keyUntil('d',`${read}.foot[0]>8`);await keyUntil('w',`${read}.foot[2]<-14`);await keyUntil('a',`${read}.foot[0]<.1`);await keyUntil('w',`${read}.slot==='B'`);await keyUntil('w',`${read}.foot[2]<-7`);
 await keyUntil('d',`${read}.s>3.2*Math.PI/2+.8`);await keyUntil('w',`${read}.foot[2]<-16.3`);await page.keyboard.press('e');await page.waitForFunction(()=>{const s=window.__THRESHOLD_V02__!();return s.ready&&s.terminal;});
 const beforeLook=await page.evaluate(()=>window.__THRESHOLD_V02__!());await page.mouse.move(440,180);await page.mouse.down();await page.mouse.move(410,180,{steps:5});const duringLook=await page.evaluate(()=>window.__THRESHOLD_V02__!());expect(beforeLook.ready&&duringLook.ready).toBe(true);if(beforeLook.ready&&duringLook.ready){expect(Math.abs(duringLook.yaw-beforeLook.yaw)).toBeGreaterThan(.06);expect(duringLook.bodyRotation).toEqual(beforeLook.bodyRotation);}await page.mouse.move(440,180,{steps:5});await page.mouse.up();trace.push({desktopLookOnWall:{beforeLook,duringLook}});
 await page.screenshot({path:'evidence/v02/production-wall-terminal.png'});
 await keyUntil('s',`${read}.foot[2]>-7.1`);await keyUntil('a',`${read}.mode==='NORMAL'&&${read}.foot[0]<.1`);await keyUntil('s',`${read}.slot==='A'`);
 const final=await page.evaluate(()=>window.__THRESHOLD_V02__!());expect(final.ready).toBe(true);if(!final.ready)throw Error('Not ready');expect(final.returned).toBe(true);expect(final.up).toEqual([0,1,0]);expect(final.events.map(e=>e.id)).toEqual([1,2]);expect(final.errors).toEqual([]);await page.screenshot({path:'evidence/v02/production-returned.png'});expect(browserErrors).toEqual([]);const resources=await page.evaluate(()=>performance.getEntriesByType('resource').filter(e=>e.name.startsWith(location.origin)).map(e=>{const r=e as PerformanceResourceTiming;return {url:r.name,transferSize:r.transferSize,encodedBodySize:r.encodedBodySize,decodedBodySize:r.decodedBodySize};}));await writeFile('evidence/v02/production-journey.json',JSON.stringify({trace,final,browserErrors,resources,note:'Actual production browser Resource Timing. Encoded/decoded body bytes exclude embedded textures counted inside GLB; no compression is inferred.'},null,2));
});
