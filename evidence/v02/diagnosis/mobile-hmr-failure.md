# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: v02-mobile.spec.ts >> V02 mobile 1170:540 >> actual dual Pointer Events control the full chapter and remain live during gravity rotation
- Location: src/tests/e2e/v02-mobile.spec.ts:5:165

# Error details

```
Error: terminal{"ready":true,"input":{"x":0,"y":0},"error":null,"world":"VESTIBULE","slot":"A","foot":[0,-8.344658519732207e-9,33],"body":[0,0.8759999916553415,33],"eye":[0,1.5499999916553415,33],"up":[0,1,0],"gravity":[0,-9.81,0],"bodyRotation":[0,0,0,1],"cameraRotation":[0,0,0,1],"yaw":0,"pitch":0,"theta":0,"thetaDegrees":0,"s":-1.5,"mode":"NORMAL","grounded":true,"supportNormal":[0,1,0],"velocity":[0,6.079673764425308e-7,0],"step":1858,"progress":"ARRIVAL","terminal":false,"returned":false,"interactable":false,"events":[],"transferState":"ARMED","rejection":null,"blocked":null,"rotationQueries":0,"translationQueries":0,"supportQueries":1858,"witness":{"position":{"x":109.35003662109375,"y":4.197056770324707,"z":0.5881818532943726},"velocity":{"x":0.000012939795851707458,"y":0.00006829412450315431,"z":-0.00007866071246098727},"resets":3},"render":{"targetWidth":410,"targetHeight":189,"quality":0.75,"mainDrawCalls":9,"offscreenDrawCalls":12,"geometries":19,"textures":34,"programs":10,"context":"active","passes":1,"targetResizes":2},"performance":{"samples":14,"fps":0.6097800000870719,"averageMs":1639.9357142858207,"p50Ms":1066.199999999255,"p95Ms":7266.300000000745,"p99Ms":7266.300000000745,"physicsMs":0,"gpuMs":null},"errors":[],"elapsed":30.96666666666619}

expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false
```

# Page snapshot

```yaml
- main [ref=e3]:
  - generic:
    - link "THRESHOLD 门界" [ref=e7] [cursor=pointer]:
      - /url: "?"
    - generic: THE FIRST THRESHOLD V0.2
  - navigation [ref=e8]:
    - button "安全复位" [ref=e9] [cursor=pointer]: ↺
    - button "设置" [ref=e10] [cursor=pointer]: ⋯
  - generic:
    - text: 01 / VESTIBULE
    - paragraph: 沿下沉庭院两侧绕行，走向黑色门界。
    - text: 左侧移动 · 右侧观察
  - generic [aria-hidden]:
    - generic: MOVE
    - generic: ＋ LOOK
```

# Test source

```ts
  1  | import{test,expect,type CDPSession}from'@playwright/test';
  2  | import{writeFile}from'node:fs/promises';
  3  | import{chapterReady,chapterRead,routeStages}from'./v02-helpers';
  4  | class Contacts{points=new Map<number,{id:number;x:number;y:number}>();constructor(readonly c:CDPSession){}async send(type:'touchStart'|'touchMove'|'touchEnd'|'touchCancel'){await this.c.send('Input.dispatchTouchEvent',{type,touchPoints:[...this.points.values()].map(p=>({...p,radiusX:3,radiusY:3,force:1}))});if(type==='touchMove')await this.c.send('Runtime.evaluate',{expression:'new Promise(resolve=>requestAnimationFrame(resolve))',awaitPromise:true});}async start(id:number,x:number,y:number){this.points.set(id,{id,x,y});await this.send('touchStart');}async move(id:number,x:number,y:number){this.points.set(id,{id,x,y});await this.send('touchMove');}async end(id:number){const point=this.points.get(id);this.points.delete(id);await this.c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:point?[{...point,radiusX:3,radiusY:3,force:1}]:[]});}}
  5  | for(const width of [1170,1200])test.describe(`V02 mobile ${width}:540`,()=>{test.use({viewport:{width,height:540},hasTouch:true,isMobile:true,deviceScaleFactor:1});test('actual dual Pointer Events control the full chapter and remain live during gravity rotation',async({page})=>{
  6  |  test.setTimeout(180000);await chapterReady(page);const touch=new Contacts(await page.context().newCDPSession(page));await page.evaluate(()=>{Reflect.set(window,'_v02Pointers',[]);document.querySelector('canvas')!.addEventListener('pointerdown',e=>(Reflect.get(window,'_v02Pointers')as number[]).push((e as PointerEvent).pointerId));});
  7  |  await touch.start(1,150,360);await touch.move(1,150,302);await touch.start(2,width-180,220);await touch.move(2,width-205,230);const look=await chapterRead(page);expect(Math.abs(look.yaw)).toBeGreaterThan(.04);expect(Math.abs(look.pitch)).toBeGreaterThan(.01);
  8  |  const captured=await page.locator('canvas').evaluate(c=>(Reflect.get(window,'_v02Pointers')as number[]).map(id=>c.hasPointerCapture(id)));expect(captured).toEqual([true,true]);
  9  |  await touch.move(2,width-180,220);await touch.end(2);
  10 |  const trace=[];
  11 |  for(const stage of routeStages){const axis=stage==='around'||stage==='landing'?[1,0]:stage==='align'||stage==='ground'?[-1,0]:stage==='backlanding'||stage==='portalin'?[0,-1]:[0,1];await touch.move(1,150+axis[0]*58,360-axis[1]*58);
> 12 |  const result=await page.evaluate(stage=>{const a=window.__V02_TEST__!;let done=false;let n=0;for(;n<1800;n++){const s=a.snapshot();if(!s.ready)throw Error('Not ready');const f=s.foot;const conditions={entryhall:f[2]<18,around:f[0]>8,nave:f[2]<-14,align:f[0]<.02,portalout:s.slot==='B',arcroom:f[2]<-7,landing:s.s>3.2*Math.PI/2+.8,terminal:f[2]<-16.4,backlanding:f[2]>-7.02,ground:s.mode==='NORMAL'&&f[0]<.02,portalin:s.slot==='A'};if(conditions[stage]){done=true;break;}a.runtime.advance(1/60);}a.render();return {done,n,snapshot:a.snapshot()};},stage);expect(result.done,stage+JSON.stringify(result.snapshot)).toBe(true);trace.push({stage,...result});
     |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     ^ Error: terminal{"ready":true,"input":{"x":0,"y":0},"error":null,"world":"VESTIBULE","slot":"A","foot":[0,-8.344658519732207e-9,33],"body":[0,0.8759999916553415,33],"eye":[0,1.5499999916553415,33],"up":[0,1,0],"gravity":[0,-9.81,0],"bodyRotation":[0,0,0,1],"cameraRotation":[0,0,0,1],"yaw":0,"pitch":0,"theta":0,"thetaDegrees":0,"s":-1.5,"mode":"NORMAL","grounded":true,"supportNormal":[0,1,0],"velocity":[0,6.079673764425308e-7,0],"step":1858,"progress":"ARRIVAL","terminal":false,"returned":false,"interactable":false,"events":[],"transferState":"ARMED","rejection":null,"blocked":null,"rotationQueries":0,"translationQueries":0,"supportQueries":1858,"witness":{"position":{"x":109.35003662109375,"y":4.197056770324707,"z":0.5881818532943726},"velocity":{"x":0.000012939795851707458,"y":0.00006829412450315431,"z":-0.00007866071246098727},"resets":3},"render":{"targetWidth":410,"targetHeight":189,"quality":0.75,"mainDrawCalls":9,"offscreenDrawCalls":12,"geometries":19,"textures":34,"programs":10,"context":"active","passes":1,"targetResizes":2},"performance":{"samples":14,"fps":0.6097800000870719,"averageMs":1639.9357142858207,"p50Ms":1066.199999999255,"p95Ms":7266.300000000745,"p99Ms":7266.300000000745,"physicsMs":0,"gpuMs":null},"errors":[],"elapsed":30.96666666666619}
  13 |  if(stage==='landing'){const s=await chapterRead(page);expect(s.mode).toBe('WALL');expect(s.bodyRotation[2]).toBeCloseTo(Math.SQRT1_2);await page.screenshot({path:`evidence/v02/mobile-${width}-wall.png`});}
  14 |  if(stage==='terminal'){await touch.end(1);await page.getByRole('button',{name:'激活终端'}).tap();expect((await chapterRead(page)).terminal).toBe(true);await touch.start(1,150,360);}
  15 |  }
  16 |  await touch.end(1);const final=await chapterRead(page);expect(final.returned).toBe(true);expect(final.events).toHaveLength(2);expect(final.up).toEqual([0,1,0]);expect(final.errors).toEqual([]);
  17 |  await page.getByRole('button',{name:'设置',exact:true}).tap();await page.getByRole('checkbox').check();const body=final.bodyRotation;await page.evaluate(()=>window.__V02_TEST__!.render());expect((await chapterRead(page)).bodyRotation).toEqual(body);await page.getByRole('button',{name:'设置',exact:true}).tap();await page.getByRole('button',{name:'安全复位'}).tap();expect((await chapterRead(page)).foot.every(Number.isFinite)).toBe(true);expect(await page.evaluate(()=>[scrollX,scrollY])).toEqual([0,0]);await page.screenshot({path:`evidence/v02/mobile-${width}-returned.png`});await writeFile(`evidence/v02/mobile-${width}.json`,JSON.stringify({emulation:'Chromium CDP, not real Android',captured,trace,final},null,2));
  18 | });});
  19 | 
```