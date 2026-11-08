import {test,expect,type Page} from '@playwright/test';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {chapterReady,chapterRead} from './v02-helpers';

test.use({viewport:{width:640,height:360},deviceScaleFactor:1});
test.setTimeout(180000);

async function record(name:string,value:unknown) {
  await mkdir('evidence/orbital',{recursive:true});
  await writeFile(`evidence/orbital/${name}.json`,JSON.stringify(value,null,2));
}

async function stream(page:Page) {
  return page.evaluate(()=>window.__V02_TEST__!.runtime.streaming.snapshot());
}

test('orbital product: highest default, closable diagnostics, saved choices, help and real canvas photo',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await chapterReady(page);
  await page.getByRole('button',{name:'设置',exact:true}).click();
  await expect(page.getByRole('combobox',{name:'画面质量'})).toHaveValue('1');
  expect((await chapterRead(page)).render.quality).toBe(1);

  const sensitivity=page.getByRole('slider',{name:'视角灵敏度',exact:true});
  await sensitivity.focus();await sensitivity.press('ArrowRight');
  const changedSensitivity=await sensitivity.inputValue();
  expect(Number(changedSensitivity)).toBeGreaterThan(1.3);
  await page.getByRole('combobox',{name:'画面质量'}).selectOption('0.75');
  await page.getByRole('button',{name:'关闭设置',exact:true}).click();

  await page.keyboard.press('F3');
  await expect(page.getByTestId('chapter-diagnostics')).toBeVisible();
  await page.getByRole('button',{name:'关闭诊断',exact:true}).click();
  await expect(page.getByTestId('chapter-diagnostics')).toHaveCount(0);
  await page.keyboard.press('F3');await expect(page.getByTestId('chapter-diagnostics')).toBeVisible();
  await page.keyboard.press('Escape');await expect(page.getByTestId('chapter-diagnostics')).toHaveCount(0);

  // A reload exercises the actual storage boundary rather than React state alone.
  await page.reload();await page.waitForFunction(()=>window.__V02_TEST__?.snapshot().ready===true,null,{timeout:90000});
  await page.evaluate(()=>window.__V02_TEST__!.pause(true));
  await page.getByRole('button',{name:'设置',exact:true}).click();
  await expect(page.getByRole('combobox',{name:'画面质量'})).toHaveValue('0.75');
  await expect(page.getByRole('slider',{name:'视角灵敏度',exact:true})).toHaveValue(changedSensitivity);
  await page.getByRole('combobox',{name:'画面质量'}).selectOption('1');
  await page.getByRole('button',{name:'关于本作',exact:true}).click();
  await page.getByRole('button',{name:'关闭关于本作',exact:true}).click();
  if(await page.getByRole('button',{name:'关闭设置',exact:true}).isVisible())await page.getByRole('button',{name:'关闭设置',exact:true}).click();
  await page.getByRole('button',{name:'操作帮助',exact:true}).click();
  await page.getByRole('button',{name:'关闭操作帮助',exact:true}).click();

  const before=await chapterRead(page);
  await page.getByRole('button',{name:'摄影模式',exact:true}).click();
  await expect(page.getByRole('button',{name:'退出摄影模式',exact:true})).toBeVisible();
  const downloadPromise=page.waitForEvent('download');
  await page.getByRole('button',{name:'导出照片',exact:true}).click();
  const download=await downloadPromise;
  await mkdir('evidence/orbital',{recursive:true});
  await download.saveAs('evidence/orbital/photo-export.png');
  const png=await readFile('evidence/orbital/photo-export.png');
  expect(png.subarray(0,8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(png.length).toBeGreaterThan(1000);
  await page.getByRole('button',{name:'退出摄影模式',exact:true}).click();
  await expect(page.getByRole('button',{name:'摄影模式',exact:true})).toBeVisible();
  const after=await chapterRead(page);
  expect(after.slot).toBe(before.slot);expect(after.foot).toEqual(before.foot);
  expect(after.errors).toEqual([]);expect(errors).toEqual([]);
  await record('product-controls',{changedSensitivity,before,after,pageErrors:errors,photoBytes:png.length});
});

test.describe('orbital touch response',()=>{
  test.use({hasTouch:true,isMobile:true});
  test('equal-distance fast gesture turns further; release and cancellation stop input',async({page})=>{
    await chapterReady(page);
    await page.getByRole('button',{name:'设置',exact:true}).tap();
    await expect(page.getByRole('combobox',{name:'画面质量'})).toHaveValue('1');
    await page.getByRole('button',{name:'关闭设置',exact:true}).tap();
    const result=await page.evaluate(()=>{
      const a=window.__V02_TEST__!,canvas=document.querySelector('canvas')!;
      function send(type:string,id:number,x:number,y:number,time:number) {
        const event=new PointerEvent(type,{pointerId:id,pointerType:'touch',clientX:x,clientY:y,bubbles:true,cancelable:true,isPrimary:id===21});
        Object.defineProperty(event,'timeStamp',{value:time});canvas.dispatchEvent(event);
      }
      function drag(interval:number,id:number) {
        const before=a.snapshot();if(!before.ready)throw Error('Runtime not ready');
        const start=performance.now();send('pointerdown',id,430,180,start);
        for(let i=1;i<=8;i++)send('pointermove',id,430+i*10,180,start+i*interval);
        const moved=a.snapshot();if(!moved.ready)throw Error('Runtime not ready');
        send('pointerup',id,510,180,start+8*interval+1);
        a.runtime.advance(1/60);const released=a.snapshot();if(!released.ready)throw Error('Runtime not ready');
        return {angle:Math.abs(moved.yaw-before.yaw),afterRelease:Math.abs(released.yaw-moved.yaw)};
      }
      const slow=drag(180,21),fast=drag(8,22);
      const time=performance.now();send('pointerdown',23,120,240,time);send('pointermove',23,120,182,time+20);
      const moving=a.snapshot();send('pointercancel',23,120,182,time+30);const canceled=a.snapshot();
      return {slow,fast,moving,canceled,method:'Deterministic browser Pointer Events with explicit sample timestamps; real touch hardware is a separate acceptance item.'};
    });
    expect(result.fast.angle).toBeGreaterThan(result.slow.angle*1.15);
    expect(result.fast.afterRelease).toBeLessThan(1e-10);expect(result.slow.afterRelease).toBeLessThan(1e-10);
    expect(result.moving.ready&&result.canceled.ready).toBe(true);
    if(result.moving.ready&&result.canceled.ready){expect(result.moving.input.y).toBeGreaterThan(.9);expect(result.canceled.input).toMatchObject({x:0,y:0,jump:false,crouch:false,sprint:false,brake:false});}
    expect(await page.evaluate(()=>[scrollX,scrollY])).toEqual([0,0]);
    await record('touch-response',result);
  });
});

test('orbital streaming: deferred GLBs retain proxies, visible portal requests destination, hidden content evicts',async({page})=>{
  let release=()=>{};
  const held=new Promise<void>(resolve=>{release=resolve;});
  const requested:string[]=[];
  await page.route('**/assets/orbital/architecture/*.glb',async route=>{
    requested.push(route.request().url());await held;await route.continue();
  });
  try{
    await chapterReady(page);
    await expect.poll(async()=>(await stream(page)).loading).toBeGreaterThan(0);
    const pending=await stream(page);
    const manifest=await(await page.request.get('/assets/orbital/architecture/manifest.json')).json() as {chunks:unknown[]};
    expect(pending.total).toBe(manifest.chunks.length);expect(pending.total).toBeGreaterThan(2);expect(pending.resident).toBe(0);
    expect(pending.chunks.some(c=>c.visible&&c.lod==='proxy')).toBe(true);
    expect(requested.length).toBeLessThan(pending.total);
    release();
    await expect.poll(async()=>(await stream(page)).resident,{timeout:60000}).toBeGreaterThan(0);
    await page.evaluate(()=>{const a=window.__V02_TEST__!;a.camera('CROSSING');a.render();});
    const portal=await stream(page);
    expect((await chapterRead(page)).slot).toBe('A');
    expect(portal.interests.some(i=>i.kind==='portal'&&i.worldId==='B')).toBe(true);
    await expect.poll(async()=>(await stream(page)).chunks.filter(c=>c.worldId==='B'&&c.state==='resident').length,{timeout:60000}).toBeGreaterThan(0);
    const refined=await stream(page);
    await page.evaluate(()=>{
      const a=window.__V02_TEST__!;a.look(-Math.PI/.0025,0);a.render();
      a.runtime.updateStreaming(a.runtime.elapsed+9);
    });
    const hidden=await stream(page);
    expect(hidden.interests.some(i=>i.kind==='portal')).toBe(false);
    expect(hidden.culled).toBeGreaterThan(0);expect(hidden.evictions).toBeGreaterThan(0);
    expect((await chapterRead(page)).errors).toEqual([]);
    await record('streaming',{pending,portal,refined,hidden,requested,clockNote:'The real runtime streaming update receives a9s-later clock while physics is paused; result counters are never modified.'});
  }finally{release();}
});

test('orbital streaming: failed optional detail preserves structural physics and records error',async({page})=>{
  const failedRequests:string[]=[];
  await page.route('**/assets/orbital/architecture/B-gravity-instruments.glb',async route=>{failedRequests.push(route.request().url());await route.abort('failed');});
  await chapterReady(page);
  await page.evaluate(()=>{const a=window.__V02_TEST__!;a.camera('C1');a.step(1,0,0);a.render();});
  await expect.poll(async()=>(await stream(page)).failed,{timeout:60000}).toBeGreaterThan(0);
  const state=await chapterRead(page),streaming=await stream(page);
  expect(failedRequests.length).toBeGreaterThan(0);
  expect(state.ready).toBe(true);expect(state.grounded).toBe(true);expect(state.errors).toEqual([]);
  const failed=streaming.chunks.find(c=>c.id==='B-gravity-instruments');
  expect(failed).toBeDefined();expect(failed?.state).toBe('error');
  if(failed?.visible)expect(failed.lod).toBe('proxy');
  await record('streaming-failure',{state,streaming,failedRequests});
});

test('orbital interactions: observatory records a visit and a released sample obeys Rapier sideways gravity',async({page})=>{
  await chapterReady(page);
  const arrival=await chapterRead(page);
  await page.getByRole('button',{name:'轨道观测',exact:true}).click();await page.getByRole('button',{name:'关闭轨道观测台',exact:true}).click();
  await expect.poll(async()=>(await chapterRead(page)).observed).toBe(true);
  const observed=await chapterRead(page);
  expect(observed.foot).toEqual(arrival.foot);expect(observed.slot).toBe('A');
  // Placement belongs to the gated regression adapter, not to the public UI.
  // The released object is stepped by the unchanged actual Rapier world.
  await page.evaluate(()=>{const a=window.__V02_TEST__!;a.place([0,0,4],'B');a.render();});
  const before=await chapterRead(page);
  await page.getByRole('button',{name:'释放重力样本',exact:true}).click();
  const released=await chapterRead(page);
  expect(released.sampleReleased).toBe(before.sampleReleased+1);
  expect(released.witness.resets).toBeGreaterThan(before.witness.resets);
  await page.evaluate(()=>{const a=window.__V02_TEST__!;a.step(20,0,0);a.render();});
  const falling=await chapterRead(page);
  expect(falling.witness.position.x).toBeGreaterThan(released.witness.position.x+.1);
  expect(falling.witness.velocity.x).toBeGreaterThan(1);
  expect(falling.errors).toEqual([]);expect(falling.grounded).toBe(true);
  await record('interactions',{arrival,observed,before,released,falling});
});
