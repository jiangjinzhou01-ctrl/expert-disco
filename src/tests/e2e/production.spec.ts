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
