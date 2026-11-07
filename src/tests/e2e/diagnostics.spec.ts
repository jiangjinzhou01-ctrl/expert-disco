import { test,expect,type Page } from '@playwright/test';
import { readFile,writeFile } from 'node:fs/promises';
import type { ExperienceLoop } from '../../engine/runtime/ExperienceLoop';

type Snapshot=ReturnType<ExperienceLoop['snapshot']>;
async function ready(page:Page){
 await page.goto('/?test=1');
 await page.waitForFunction(()=>window.__THRESHOLD__?.snapshot().ready===true);
 await page.evaluate(()=>window.__THRESHOLD__!.pause(true));
}

test('F3 diagnostics exports a real JSON download and UI quality resizes the live target',async({page})=>{
 await ready(page);
 const overlay=page.getByTestId('diagnostics');
 await expect(overlay).toBeHidden();
 await page.keyboard.press('F3');await expect(overlay).toBeVisible();
 for(const field of ['ROOM / PHASE','POSITION m','VELOCITY m/s','STEP / EVENT','LINK','PLANE DISTANCE m','P95 / P99','RENDER TARGET','WEBGL 2'])await expect(overlay.getByText(field,{exact:true})).toBeVisible();
 const original=await page.evaluate(()=>window.__THRESHOLD__!.snapshot());
 await page.getByRole('combobox',{name:'渲染质量'}).selectOption('0.5');
 await expect.poll(async()=>page.evaluate(()=>window.__THRESHOLD__!.snapshot().render.targetWidth)).toBe(960);
 const quality=await page.evaluate(()=>window.__THRESHOLD__!.snapshot());
 expect(quality.render.quality).toBe(.5);expect(quality.render.targetHeight).toBe(540);
 expect(quality.render.targetWidth/quality.render.targetHeight).toBeCloseTo(1920/1080,8);
 expect(quality.render.targetWidth).toBeLessThan(original.render.targetWidth);
 const committed=await page.evaluate(()=>{
  const api=window.__THRESHOLD__!;api.setPose([0,.89,-7.3]);
  for(let i=0;i<30;i++)api.step(1,api.snapshot().worldId==='A'?[0,0,-3]:[3,0,0]);
  api.render();return api.snapshot();
 });
 expect(committed.worldId).toBe('B');expect(committed.lastEventId).toBe(1);
 const downloadPromise=page.waitForEvent('download');
 await page.getByRole('button',{name:'导出 JSON',exact:true}).click();
 const download=await downloadPromise;
 expect(download.suggestedFilename()).toMatch(/^threshold-g0-\d+\.json$/);
 const downloadPath=await download.path();expect(downloadPath).not.toBeNull();
 const text=await readFile(downloadPath!,'utf8');
 const report=JSON.parse(text) as {schema:string;capturedAt:string;environment:{userAgent:string;viewport:number[];dpr:number};snapshot:Snapshot};
 expect(report.schema).toBe('threshold-g0-diagnostics-v1');
 expect(Number.isFinite(Date.parse(report.capturedAt))).toBe(true);
 expect(report.environment.userAgent).toContain('Chrome/');expect(report.environment.viewport).toEqual([1920,1080]);expect(report.environment.dpr).toBe(1);
 expect(report.snapshot.ready).toBe(true);expect(report.snapshot.worldId).toBe('B');
 expect(report.snapshot.position).toEqual(committed.position);
 expect(report.snapshot.events.map(event=>event.id)).toEqual([1]);
 expect(report.snapshot.events[0].sourceWorldId).toBe('A');expect(report.snapshot.events[0].destinationWorldId).toBe('B');
 expect(report.snapshot.render.quality).toBe(.5);
 await writeFile('evidence/diagnostics-export.json',text);
 await page.screenshot({path:'evidence/diagnostics-ui.png'});
 await page.keyboard.press('F3');await expect(overlay).toBeHidden();
});

test('Esc cancels held keyboard and mouse drag, development geometry remains observational',async({page})=>{
 await ready(page);
 const initial=await page.evaluate(()=>window.__THRESHOLD__!.snapshot());
 await page.keyboard.down('w');
 await page.evaluate(()=>window.__THRESHOLD__!.advance(.1));
 const moving=await page.evaluate(()=>window.__THRESHOLD__!.snapshot());
 expect(moving.position[2]).toBeLessThan(initial.position[2]-.15);
 await page.mouse.move(900,600);await page.mouse.down();await page.mouse.move(1000,600);
 const dragging=await page.evaluate(()=>window.__THRESHOLD__!.snapshot());
 expect(dragging.yaw).toBeLessThan(initial.yaw-.1);
 await page.keyboard.press('Escape');
 await page.evaluate(()=>window.__THRESHOLD__!.advance(.1));
 await page.mouse.move(1200,600);
 const stopped=await page.evaluate(()=>window.__THRESHOLD__!.snapshot());
 expect(Math.hypot(stopped.position[0]-moving.position[0],stopped.position[2]-moving.position[2])).toBeLessThan(.001);
 expect((stopped.input as {movement:{x:number;y:number}}).movement).toEqual({x:0,y:0});expect(stopped.yaw).toBe(dragging.yaw);
 await page.keyboard.up('w');await page.mouse.up();
 await page.keyboard.press('F3');
 const baseline=await page.evaluate(()=>{window.__THRESHOLD__!.render();return window.__THRESHOLD__!.snapshot();});
 await page.getByRole('button',{name:'几何 OFF',exact:true}).click();
 await expect.poll(async()=>page.evaluate(()=>window.__THRESHOLD__!.snapshot().render.geometries)).toBeGreaterThan(baseline.render.geometries);
 const visible=await page.evaluate(()=>window.__THRESHOLD__!.snapshot());
 expect(visible.position).toEqual(baseline.position);expect(visible.step).toBe(baseline.step);expect(visible.lastEventId).toBe(baseline.lastEventId);
 expect(visible.render.mainDrawCalls).toBeGreaterThan(baseline.render.mainDrawCalls);
 await page.getByRole('button',{name:'几何 ON',exact:true}).click();
 await expect.poll(async()=>page.evaluate(()=>window.__THRESHOLD__!.snapshot().render.mainDrawCalls)).toBe(baseline.render.mainDrawCalls);
 const hidden=await page.evaluate(()=>window.__THRESHOLD__!.snapshot());
 expect(hidden.position).toEqual(baseline.position);expect(hidden.step).toBe(baseline.step);
 await writeFile('evidence/diagnostics-input-geometry.json',JSON.stringify({initial,moving,dragging,stopped,baseline,visible,hidden},null,2));
});
