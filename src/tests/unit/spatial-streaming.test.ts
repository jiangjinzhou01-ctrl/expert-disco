import {describe,it,expect} from 'vitest';
import {Box3,BoxGeometry,Frustum,Group,Matrix4,Mesh,MeshBasicMaterial,PerspectiveCamera,Scene,Vector3} from 'three';
import {createStreamingInterests,SpatialStreamingManager,type SpatialChunk,type StreamingInterest} from '../../chapter/streaming/SpatialStreamingManager';
import {WorldRegistry} from '../../chapter/world/WorldRegistry';

function interest(position=new Vector3(),target=new Vector3(0,0,-1)):StreamingInterest{
 const camera=new PerspectiveCamera(60,1,.01,300);camera.position.copy(position);camera.lookAt(target);camera.updateMatrixWorld(true);
 return {worldId:'A',kind:'main',camera,frustum:new Frustum().setFromProjectionMatrix(new Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse))};
}
function chunk(id:string,x:number,z:number,load?:()=>Promise<Group>):SpatialChunk{
 return {id,worldId:'A',bounds:new Box3(new Vector3(x-.5,-.5,z-.5),new Vector3(x+.5,.5,z+.5)),proxy:new Group(),bytes:10,load:load??(async()=>new Group())};
}
describe('real spatial residency and portal interests',()=>{
 it('does not request detailed GLBs behind the player; retains only their proxy',async()=>{
  const manager=new SpatialStreamingManager({A:new Scene(),B:new Scene()},[chunk('front',0,-20),chunk('behind',0,20)]);
  manager.update([interest()],0);await manager.settle();const s=manager.snapshot();
  expect(s.loads).toBe(1);expect(s.chunks.find(c=>c.id==='behind')).toMatchObject({loadCount:0,state:'proxy',lod:'hidden'});expect(s.chunks.find(c=>c.id==='front')?.lod).toBe('high');manager.dispose();
 });
 it('preserves a visible silhouette during loading, then reclaims detail after turning away',async()=>{
  let resolve!:(value:Group)=>void;const promise=new Promise<Group>(r=>{resolve=r;});
  const manager=new SpatialStreamingManager({A:new Scene(),B:new Scene()},[chunk('visible',0,-20,()=>promise)]);
  manager.update([interest()],0);expect(manager.snapshot()).toMatchObject({loading:1,proxy:1});
  resolve(new Group());await manager.settle();expect(manager.snapshot().resident).toBe(1);
  manager.update([interest(new Vector3(),new Vector3(0,0,1))],1);expect(manager.snapshot()).toMatchObject({resident:1,retainedBehind:1});
  manager.update([interest(new Vector3(),new Vector3(0,0,1))],8);expect(manager.snapshot()).toMatchObject({resident:0,evictions:1});manager.dispose();
 });
 it('limits concurrent loads and drains the priority queue deterministically',async()=>{
  const order:string[]=[];const complete:(()=>void)[]=[];
  const chunks=[30,20,10].map(z=>chunk(String(z),0,-z,()=>new Promise<Group>(resolve=>{order.push(String(z));complete.push(()=>resolve(new Group()));})));
  const manager=new SpatialStreamingManager({A:new Scene(),B:new Scene()},chunks,{maxConcurrent:1});manager.update([interest()],0);
  await Promise.resolve();expect(order).toEqual(['10']);complete.shift()!();await new Promise(r=>setTimeout(r,0));expect(order).toEqual(['10','20']);complete.shift()!();await new Promise(r=>setTimeout(r,0));complete.shift()!();await manager.settle();expect(manager.snapshot().loads).toBe(3);manager.dispose();
 });
 it('keeps the proxy on network failure and retries only after backoff',async()=>{
  let attempts=0;const manager=new SpatialStreamingManager({A:new Scene(),B:new Scene()},[chunk('flaky',0,-20,async()=>{if(++attempts===1)throw new Error('HTTP503');return new Group();})]);
  manager.update([interest()],0);await manager.settle();expect(manager.snapshot()).toMatchObject({failed:1,proxy:1});manager.update([interest()],1);expect(attempts).toBe(1);manager.update([interest()],6);await manager.settle();expect(manager.snapshot()).toMatchObject({failed:0,resident:1,loads:1});manager.dispose();
 });
 it('includes cropped mapped-camera destination interest only while the actual door is visible',()=>{
  const registry=new WorldRegistry();const [source,destination]=registry.portals.all();
  const camera=new PerspectiveCamera(50,16/9,.015,1500);camera.position.set(0,1.55,-15);camera.lookAt(0,1.55,-30);camera.updateMatrixWorld(true);
  const views=createStreamingInterests(camera,'A',source,destination);expect(views.map(v=>v.kind)).toEqual(['main','portal']);expect(views[1].worldId).toBe('B');
  const inside=new Box3(new Vector3(99,0,9),new Vector3(101,3,11));expect(views[1].frustum.intersectsBox(inside)).toBe(true);
  const outside=new Box3(new Vector3(123,0,9),new Vector3(125,3,11));expect(views[1].frustum.intersectsBox(outside)).toBe(false);
  camera.lookAt(0,1.55,20);camera.updateMatrixWorld(true);expect(createStreamingInterests(camera,'A',source,destination)).toHaveLength(1);
 });
 it('can dispose while a real asynchronous request is pending without resurrecting geometry',async()=>{
  const scene=new Scene();let resolve!:(value:Group)=>void;const manager=new SpatialStreamingManager({A:scene,B:new Scene()},[chunk('late',0,-20,()=>new Promise(r=>{resolve=r;}))]);manager.update([interest()],0);await Promise.resolve();manager.dispose();const root=new Group();const geometry=new BoxGeometry();let released=false;geometry.addEventListener('dispose',()=>{released=true;});root.add(new Mesh(geometry,new MeshBasicMaterial()));resolve(root);await manager.settle();expect(released).toBe(true);expect(scene.children).toHaveLength(0);expect(manager.snapshot().resident).toBe(0);
 });
 it('rejects invalid chunk bounds and non-finite clocks explicitly',()=>{
  const scenes={A:new Scene(),B:new Scene()};expect(()=>new SpatialStreamingManager(scenes,[{...chunk('bad',0,0),bounds:new Box3()}])).toThrow();const manager=new SpatialStreamingManager(scenes,[]);expect(()=>manager.update([],NaN)).toThrow();manager.dispose();
 });
});
