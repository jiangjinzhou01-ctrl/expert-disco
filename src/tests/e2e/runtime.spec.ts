import { test,expect,type Page } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

async function ready(page:Page){
 await page.goto('/?test=1&debug=1');
 await page.waitForFunction(()=>window.__THRESHOLD__?.snapshot().ready===true);
 await page.evaluate(()=>window.__THRESHOLD__!.pause(true));
}

test('real Rapier state crosses both ways and preserves committed event order',async({page})=>{
 await ready(page);
 const result=await page.evaluate(()=>{
  const api=window.__THRESHOLD__!;api.setPose([0,.89,-7.3]);
  const initial=api.snapshot();
  for(let i=0;i<30;i++)api.step(1,api.snapshot().worldId==='A'?[0,0,-3]:[3,0,0]);const outbound=api.snapshot();
  api.look(-Math.PI/.0025,0);
  for(let i=0;i<30;i++)api.step(1,api.snapshot().worldId==='B'?[-3,0,0]:[0,0,3]);const inbound=api.snapshot();
  api.render();return {initial,outbound,inbound};
 });
 expect(result.outbound.worldId).toBe('B');
 expect(result.outbound.lastEventId).toBe(1);
 expect(result.outbound.position[0]).toBeGreaterThan(32);
 expect(Math.abs(result.outbound.velocity[0])).toBeCloseTo(3,3);
 expect(result.inbound.worldId).toBe('A');
 expect(result.inbound.lastEventId).toBe(2);
 expect(result.inbound.events.map(event=>event.id)).toEqual([1,2]);
 expect(new Set(result.inbound.events.map(event=>event.step)).size).toBe(2);
 expect(result.inbound.position.every(Number.isFinite)).toBe(true);
 expect(result.inbound.rotation.every(Number.isFinite)).toBe(true);
 expect(result.inbound.position[2]).toBeGreaterThan(-8);
 await writeFile('evidence/browser-bidirectional.json',JSON.stringify(result,null,2));
 await page.locator('canvas').screenshot({path:'evidence/browser-returned-A.png'});
});

test('door frame blocks the capsule, blocked exit rejects then recovers',async({page})=>{
 await ready(page);
 const result=await page.evaluate(()=>{
  const api=window.__THRESHOLD__!;
  api.setPose([1.3,.89,-7]);api.step(50,[0,0,-3]);const frame=api.snapshot();
  api.reset();api.setPose([0,.89,-7.3]);api.setExitBlocked(true);
  api.step(30,[0,0,-3]);const blocked=api.snapshot();
  api.setExitBlocked(false);api.step(30,[0,0,-3]);const recovered=api.snapshot();
  return {frame,blocked,recovered};
 });
 expect(result.frame.worldId).toBe('A');expect(result.frame.lastEventId).toBe(0);
 expect(result.frame.position[2]).toBeGreaterThan(-8);
 expect(result.blocked.worldId).toBe('A');expect(result.blocked.lastEventId).toBe(0);
 expect(result.blocked.lastRejection).toBeTruthy();
 expect(result.recovered.worldId).toBe('B');expect(result.recovered.lastEventId).toBe(1);
 await writeFile('evidence/browser-collision.json',JSON.stringify(result,null,2));
});

test('fast segments retain remaining displacement and long frames cap catch-up',async({page})=>{
 await ready(page);
 const result=await page.evaluate(()=>{
  const api=window.__THRESHOLD__!;
  api.setPose([0,.89,-6]);api.step(1,[0,0,-240]);const fast=api.snapshot();
  api.reset();api.setPose([0,.89,-7.8]);
  const steps=api.advance(3,[0,0,-3]);const delayed=api.snapshot();
  const nextSteps=api.advance(3,[0,0,-3]);const next=api.snapshot();
  return {fast,steps,delayed,nextSteps,next};
 });
 expect(result.fast.worldId).toBe('B');expect(result.fast.lastEventId).toBe(1);
 expect(result.fast.position[0]).toBeGreaterThan(33.9);
 expect(result.steps).toBe(5);expect(result.nextSteps).toBe(5);
 expect(result.next.droppedSeconds).toBeGreaterThan(5);
 expect(result.next.lastEventId).toBe(2);
 expect(new Set(result.next.events.map(event=>event.step)).size).toBe(result.next.events.length);
 await writeFile('evidence/browser-fast-longframe.json',JSON.stringify(result,null,2));
});

test('desktop keyboard moves the real capsule and R resets it',async({page})=>{
 await ready(page);
 await page.evaluate(()=>window.__THRESHOLD__!.pause(false));
 const start=await page.evaluate(()=>window.__THRESHOLD__!.snapshot());
 await page.keyboard.down('w');await page.waitForTimeout(500);await page.keyboard.up('w');
 const moved=await page.evaluate(()=>window.__THRESHOLD__!.snapshot());
 expect(moved.position[2]).toBeLessThan(start.position[2]-.3);
 await page.keyboard.press('r');
 await expect.poll(async()=>page.evaluate(()=>window.__THRESHOLD__!.snapshot().position[2])).toBeCloseTo(-3,1);
});
