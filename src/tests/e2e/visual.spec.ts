import { test,expect,type Page } from '@playwright/test';
import { Matrix4,PerspectiveCamera,Quaternion,Vector3 } from 'three';
import { PNG } from 'pngjs';
import { mkdir,writeFile } from 'node:fs/promises';

type Marker={id:string;color:number;worldPosition:number[];x:number;y:number;ndcZ:number;drawingBufferWidth:number;drawingBufferHeight:number};
type Snapshot={position:number[];rotation:number[];worldId:string;elapsed:number;movingReference:number[];render:{context:string;passes:number;targetWidth:number;targetHeight:number;mainDrawCalls:number;offscreenDrawCalls:number};};
const cameraFov=65;
async function ready(page:Page){
 await page.goto('/?test=1');
 await page.waitForFunction(()=>window.__THRESHOLD__?.snapshot().ready===true);
 await page.evaluate(()=>{window.__THRESHOLD__!.pause(true);window.__THRESHOLD__!.runtime.elapsed=0;});
 await page.addStyleTag({content:'header,.help,.diag,.crosshair,.debug-overlay,.touch-controls{visibility:hidden!important}'});
}
function predictedMarker(snapshot:Snapshot,position:number[],width:number,height:number){
 // Independent construction from fixed scene door poses and committed player data.
 const source=new Matrix4().makeTranslation(0,1.45,-8);
 const destination=new Matrix4().makeRotationY(Math.PI/2).setPosition(32,1.45,0);
 const mapping=new Matrix4().multiplyMatrices(destination,new Matrix4().makeRotationY(Math.PI)).multiply(source.invert());
 const mainWorld=new Matrix4().compose(new Vector3().fromArray(snapshot.position).add(new Vector3(0,.68,0)),new Quaternion().fromArray(snapshot.rotation),new Vector3(1,1,1));
 const targetWorld=snapshot.worldId==='A'?new Matrix4().multiplyMatrices(mapping,mainWorld):mainWorld;
 const camera=new PerspectiveCamera(cameraFov,width/height,.015,120);
 camera.matrixWorld.copy(targetWorld);camera.matrixWorldInverse.copy(targetWorld).invert();
 const targetPosition=new Vector3().fromArray(position);
 const cameraPosition=new Vector3().setFromMatrixPosition(targetWorld);
 const ray=targetPosition.clone().sub(cameraPosition);
 const t=(32-cameraPosition.x)/ray.x;
 const planeHit=cameraPosition.clone().addScaledVector(ray,t);
 const frameHits=[31.725,32,32.275].map(x=>cameraPosition.clone().addScaledVector(ray,(x-cameraPosition.x)/ray.x));
 const isVisible=t>0&&t<1&&frameHits.every(hit=>Math.abs(hit.z)<1.11&&hit.y>.1&&hit.y<2.8);
 const viewPosition=targetPosition.clone().applyMatrix4(camera.matrixWorldInverse);
 const projectedRadius=(height/(2*Math.tan(cameraFov*Math.PI/360)))*.085/(-viewPosition.z);
 const projected=targetPosition.project(camera);
 return {projectedRadius,x:(projected.x+1)*width/2,y:(1-projected.y)*height/2,z:projected.z,isVisible,planeHit:planeHit.toArray()};
}
function matchesColor(id:string,r:number,g:number,b:number){
 if(id==='near-red')return r>180&&g<65&&b<65;
 if(id==='green')return g>160&&g>r*1.8&&g>b*1.5;
 if(id==='magenta')return r>170&&b>100&&r>g*1.7&&b>g*1.5&&r>b*1.04;
 if(id==='cyan')return g>140&&b>160&&g>r*1.7&&b>r*1.7;
 return false;
}
function centroid(png:PNG,marker:Pick<Marker,'id'>,predicted:{x:number;y:number}){
 const radius=45;let sx=0,sy=0,count=0;
 for(let y=Math.max(0,Math.floor(predicted.y-radius));y<Math.min(png.height,Math.ceil(predicted.y+radius));y++)for(let x=Math.max(0,Math.floor(predicted.x-radius));x<Math.min(png.width,Math.ceil(predicted.x+radius));x++){
  const offset=(y*png.width+x)*4;
  if(matchesColor(marker.id,png.data[offset],png.data[offset+1],png.data[offset+2])){sx+=x+.5;sy+=y+.5;count++;}
 }
 return {x:sx/count,y:sy/count,count,error:Math.hypot(sx/count-predicted.x,sy/count-predicted.y)};
}
const cases=[
 {name:'front',distance:3,angle:0},
 {name:'oblique-30',distance:3,angle:Math.PI/6},
 {name:'oblique-60',distance:3,angle:Math.PI/3},
 {name:'distance-1m',distance:1,angle:0},
 {name:'distance-0.1m',distance:.1,angle:0},
 {name:'pre-plane-0.005m',distance:.005,angle:0},
 {name:'frame-edge',distance:.4,angle:0,x:.82},
];
for(const pose of cases)test(`portal projection ${pose.name}: real pixels match independent camera`,async({page},testInfo)=>{
 await ready(page);
 const x=pose.x??Math.sin(pose.angle)*pose.distance;
 const z=-8+Math.cos(pose.angle)*pose.distance;
 await page.evaluate(({x,z,yaw})=>{window.__THRESHOLD__!.setPose([x,.89,z],yaw);window.__THRESHOLD__!.render();},{x,z,yaw:pose.angle});
 await page.waitForTimeout(150);
 const snapshot=await page.evaluate(()=>window.__THRESHOLD__!.snapshot()) as unknown as Snapshot;
 const markers=await page.evaluate(()=>window.__THRESHOLD__!.projectMarkers()) as Marker[];
 const buffer=await page.locator('canvas').screenshot();const png=PNG.sync.read(buffer);
 const measurements=[];
 for(const marker of markers){
  const predicted=predictedMarker(snapshot,marker.worldPosition,png.width,png.height);
  // Compare renderer projection against an independent matrix calculation, then real pixels.
  expect(Math.hypot(predicted.x-marker.x,predicted.y-marker.y),`${marker.id} renderer projection`).toBeLessThan(1e-6);
  if(!predicted.isVisible||predicted.projectedRadius>30||predicted.x<45||predicted.x>png.width-45||predicted.y<45||predicted.y>png.height-45)continue;
  const observed=centroid(png,marker,predicted);measurements.push({id:marker.id,predicted,observed});
  expect(observed.count,`${pose.name} ${marker.id}: visible marker pixels`).toBeGreaterThan(4);
  expect(observed.error,`${pose.name} ${marker.id}: center pixel error`).toBeLessThanOrEqual(2);
 }
 expect(measurements.length,'Every pose requires a physically visible marker').toBeGreaterThan(0);
 let leakedProbePixels=0;
 for(let offset=0;offset<png.data.length;offset+=4){const r=png.data[offset],g=png.data[offset+1],b=png.data[offset+2];if(b>200&&r>100&&r<190&&g<35)leakedProbePixels++;}
 expect(leakedProbePixels,'Purple geometry behind the exit must be clipped').toBeLessThan(5);
 expect(snapshot.render.context).toBe('active');expect(snapshot.render.passes).toBe(1);
 expect(snapshot.render.mainDrawCalls).toBeGreaterThan(5);expect(snapshot.render.offscreenDrawCalls).toBeGreaterThan(5);
 await mkdir('evidence',{recursive:true});
 await writeFile(`evidence/visual-${pose.name}.png`,buffer);
 await writeFile(`evidence/visual-${pose.name}.json`,JSON.stringify({pose,snapshot,measurements,leakedProbePixels},null,2));
 await testInfo.attach('projection-measurements',{body:JSON.stringify(measurements,null,2),contentType:'application/json'});
});

test('lateral parallax, live target animation and viewport resizing remain real',async({page})=>{
 test.setTimeout(90000);
 await ready(page);
 await page.evaluate(()=>{window.__THRESHOLD__!.setPose([-.35,.89,-5]);window.__THRESHOLD__!.render();});
 const initial=await page.evaluate(()=>({markers:window.__THRESHOLD__!.projectMarkers(),snapshot:window.__THRESHOLD__!.snapshot()})) as {markers:Marker[];snapshot:Snapshot};
 const first=await page.locator('canvas').screenshot();
 await page.evaluate(()=>{window.__THRESHOLD__!.setPose([.35,.89,-5]);window.__THRESHOLD__!.render();});
 const shifted=await page.evaluate(()=>window.__THRESHOLD__!.projectMarkers()) as Marker[];
 expect(Math.abs(shifted[0].x-initial.markers[0].x)).toBeGreaterThan(50);
 expect((await page.locator('canvas').screenshot()).equals(first)).toBe(false);
 const beforeAnimation=await page.evaluate(()=>window.__THRESHOLD__!.snapshot()) as unknown as Snapshot;
 const beforeAnimationPng=PNG.sync.read(await page.locator('canvas').screenshot());
 await page.evaluate(()=>{window.__THRESHOLD__!.step(120,[0,0,0]);window.__THRESHOLD__!.setPose([.35,.89,-5]);window.__THRESHOLD__!.render();});
 const later=await page.evaluate(()=>window.__THRESHOLD__!.snapshot()) as unknown as Snapshot;
 const afterAnimationBuffer=await page.locator('canvas').screenshot();
 const afterAnimationPng=PNG.sync.read(afterAnimationBuffer);
 expect(later.elapsed).toBeGreaterThan(beforeAnimation.elapsed+1.9);
 expect(later.movingReference).not.toEqual(beforeAnimation.movingReference);
 const beforeCenter=predictedMarker(beforeAnimation,beforeAnimation.movingReference,beforeAnimationPng.width,beforeAnimationPng.height);
 const afterCenter=predictedMarker(later,later.movingReference,afterAnimationPng.width,afterAnimationPng.height);
 const bounds={left:Math.floor(Math.min(beforeCenter.x,afterCenter.x)-75),right:Math.ceil(Math.max(beforeCenter.x,afterCenter.x)+75),top:Math.floor(Math.min(beforeCenter.y,afterCenter.y)-75),bottom:Math.ceil(Math.max(beforeCenter.y,afterCenter.y)+75)};
 let difference=0,changedPixels=0,sampleCount=0;
 for(let y=Math.max(0,bounds.top);y<Math.min(beforeAnimationPng.height,bounds.bottom);y++)for(let x=Math.max(0,bounds.left);x<Math.min(beforeAnimationPng.width,bounds.right);x++){
  const offset=(y*beforeAnimationPng.width+x)*4;
  const d=Math.abs(beforeAnimationPng.data[offset]-afterAnimationPng.data[offset])+Math.abs(beforeAnimationPng.data[offset+1]-afterAnimationPng.data[offset+1])+Math.abs(beforeAnimationPng.data[offset+2]-afterAnimationPng.data[offset+2]);
  difference+=d;sampleCount++;if(d>30)changedPixels++;
 }
 expect(changedPixels,'Visible moving-reference region must change in actual rendered pixels').toBeGreaterThan(200);
 expect(difference/sampleCount).toBeGreaterThan(1);
 await writeFile('evidence/visual-animation-before.png',PNG.sync.write(beforeAnimationPng));
 await writeFile('evidence/visual-animation-after.png',afterAnimationBuffer);
 await writeFile('evidence/visual-animation.json',JSON.stringify({before:beforeAnimation.movingReference,after:later.movingReference,bounds,changedPixels,meanRgbDifference:difference/sampleCount},null,2));
 await page.setViewportSize({width:1280,height:800});
 await expect.poll(async()=>{const resized=await page.evaluate(()=>window.__THRESHOLD__!.snapshot());return Math.abs(resized.render.targetWidth/resized.render.targetHeight-1.6);}).toBeLessThan(.003);
 const webgl=await page.locator('canvas').evaluate(canvas=>(canvas as HTMLCanvasElement).getContext('webgl2') instanceof WebGL2RenderingContext);
 expect(webgl).toBe(true);
 await page.locator('canvas').screenshot({path:'evidence/visual-resized.png'});
});


test('a real fixed-step crossing keeps projected pixels continuous across the portal plane',async({page})=>{
 await ready(page);
 await page.evaluate(()=>{window.__THRESHOLD__!.setPose([0,.89,-7.995]);window.__THRESHOLD__!.render();});
 const before=await page.evaluate(()=>window.__THRESHOLD__!.snapshot()) as unknown as Snapshot;
 const beforeBuffer=await page.locator('canvas').screenshot();const beforePng=PNG.sync.read(beforeBuffer);
 await page.evaluate(()=>{window.__THRESHOLD__!.step(1,[0,0,-.6]);window.__THRESHOLD__!.render();});
 const afterFull=await page.evaluate(()=>window.__THRESHOLD__!.snapshot());const after=afterFull as unknown as Snapshot;
 const afterBuffer=await page.locator('canvas').screenshot();const afterPng=PNG.sync.read(afterBuffer);
 expect(before.worldId).toBe('A');expect(after.worldId).toBe('B');
 expect(afterFull.lastEventId).toBe(1);expect(afterFull.events).toHaveLength(1);
 expect(after.position[0]).toBeGreaterThan(32);expect(after.position[0]).toBeLessThan(32.02);
 const measurements=[];
 for(const marker of [{id:'green',worldPosition:[38,1.55,1.5]},{id:'cyan',worldPosition:[41,.8,0]}]){
  const beforePredicted=predictedMarker(before,marker.worldPosition,beforePng.width,beforePng.height);
  const afterPredicted=predictedMarker(after,marker.worldPosition,afterPng.width,afterPng.height);
  const beforeObserved=centroid(beforePng,marker,beforePredicted);const afterObserved=centroid(afterPng,marker,afterPredicted);
  expect(beforeObserved.count).toBeGreaterThan(4);expect(afterObserved.count).toBeGreaterThan(4);
  expect(beforeObserved.error).toBeLessThanOrEqual(2);expect(afterObserved.error).toBeLessThanOrEqual(2);
  const projectedDelta=Math.hypot(afterPredicted.x-beforePredicted.x,afterPredicted.y-beforePredicted.y);
  const actualDelta=Math.hypot(afterObserved.x-beforeObserved.x,afterObserved.y-beforeObserved.y);
  expect(projectedDelta).toBeLessThan(5);expect(actualDelta).toBeLessThan(5);
  measurements.push({id:marker.id,beforePredicted,afterPredicted,beforeObserved,afterObserved,projectedDelta,actualDelta});
 }
 await writeFile('evidence/visual-cross-plane-before.png',beforeBuffer);
 await writeFile('evidence/visual-cross-plane-after.png',afterBuffer);
 await writeFile('evidence/visual-cross-plane.json',JSON.stringify({before,after:afterFull,measurements},null,2));
});
