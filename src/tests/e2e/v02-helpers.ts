import type{Page}from'@playwright/test';
import type{ChapterRuntime}from'../../chapter/runtime/ChapterRuntime';
export type ChapterSnapshot=Extract<ReturnType<ChapterRuntime['snapshot']>,{ready:true}>;
export async function chapterReady(page:Page){await page.goto('/?mode=chapter&test=1');await page.waitForFunction(()=>window.__V02_TEST__?.snapshot().ready,{},{timeout:60000});await page.evaluate(()=>window.__V02_TEST__!.pause(true));}
export async function chapterRead(page:Page):Promise<ChapterSnapshot>{const s=await page.evaluate(()=>window.__V02_TEST__!.snapshot());if(!s.ready)throw Error(s.error??'Not ready');return s;}
export const routeStages=['entryhall','around','nave','align','portalout','arcroom','landing','terminal','backlanding','ground','portalin'] as const;
export type RouteStage=typeof routeStages[number];
/** Test-driver feedback only. The game runtime contains no route follower. */
export async function driveBatch(page:Page,stage:RouteStage,count=60){return page.evaluate(({stage,count})=>{const api=window.__V02_TEST__!;let done=false;let steps=0;for(;steps<count;steps++){const s=api.snapshot();if(!s.ready)throw Error('Not ready');const f=s.foot;const conditions={entryhall:f[2]<18,around:f[0]>8,nave:f[2]<-14,align:f[0]<.02,portalout:s.slot==='B',arcroom:f[2]<-7,landing:s.s>3.2*Math.PI/2+.8,terminal:f[2]<-16.4,backlanding:f[2]>-7.02,ground:s.mode==='NORMAL'&&f[0]<.02,portalin:s.slot==='A'};done=conditions[stage];if(done)break;const axis=stage==='around'||stage==='landing'?[1,0]:stage==='align'||stage==='ground'?[-1,0]:stage==='backlanding'||stage==='portalin'?[0,-1]:[0,1];const yaw=s.yaw;api.step(1,Math.cos(yaw)*axis[0]+Math.sin(yaw)*axis[1],-Math.sin(yaw)*axis[0]+Math.cos(yaw)*axis[1]);}return {done,steps,snapshot:api.snapshot()};},{stage,count});}
