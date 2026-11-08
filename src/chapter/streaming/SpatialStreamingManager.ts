import {Box3,Frustum,Matrix4,Object3D,PerspectiveCamera,Plane,Scene,Vector3,type Material,type Mesh,type BufferGeometry,type Texture} from 'three';
import {computePortalTransform} from '../../engine/portal/PortalMath';
import type {Portal} from '../../engine/portal/PortalTypes';
import type {WorldId} from '../../scenes/RoomLayout';

export interface SpatialChunk {
  id:string;worldId:WorldId;bounds:Box3;proxy:Object3D;
  load:()=>Promise<Object3D>;bytes?:number;triangles?:number;
}
export interface StreamingInterest {worldId:WorldId;kind:'main'|'portal';camera:PerspectiveCamera;frustum:Frustum;exitPlane?:Plane;}
type ChunkState='proxy'|'queued'|'loading'|'resident'|'error';
interface Entry extends SpatialChunk {state:ChunkState;high:Object3D|null;visible:boolean;distance:number;lastWanted:number;wanted:boolean;loadCount:number;retryAt:number;failure:string|null;}
export interface StreamingOptions {maxConcurrent:number;maxResident:number;maxBytes:number;retentionSeconds:number;detailDistance:number;}
const defaults:StreamingOptions={maxConcurrent:2,maxResident:7,maxBytes:28*1024*1024,retentionSeconds:6,detailDistance:85};

/** Pure interest calculation is shared by real streaming and its deterministic tests.
 * Portal interest uses the projected doorway rectangle, not the whole other world.
 */
export function createStreamingInterests(camera:PerspectiveCamera,worldId:WorldId,source:Portal,destination:Portal):StreamingInterest[]{
  camera.updateMatrixWorld(true);
  const projection=new Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
  const main:StreamingInterest={worldId,kind:'main',camera,frustum:new Frustum().setFromProjectionMatrix(projection)};
  const normal=new Vector3(0,0,1).applyQuaternion(source.rotation);
  const facing=camera.position.clone().sub(source.position).dot(normal);
  const doorBox=new Box3().setFromCenterAndSize(source.position,new Vector3(source.width,source.height,.02));
  // Horizontal rotations are allowed; build actual world bounds from its corners.
  const corners=[[-1,-1],[-1,1],[1,-1],[1,1]].map(([x,y])=>new Vector3(x*source.width/2,y*source.height/2,0).applyQuaternion(source.rotation).add(source.position));
  doorBox.setFromPoints(corners).expandByScalar(.01);
  if(facing<=0||!main.frustum.intersectsBox(doorBox))return [main];
  const virtual=new PerspectiveCamera();
  const mapping=computePortalTransform(source,destination).matrix;
  virtual.matrixWorld.multiplyMatrices(mapping,camera.matrixWorld);
  virtual.matrixWorld.decompose(virtual.position,virtual.quaternion,virtual.scale);
  virtual.fov=camera.fov;virtual.aspect=camera.aspect;virtual.near=camera.near;virtual.far=camera.far;
  virtual.projectionMatrix.copy(camera.projectionMatrix);virtual.projectionMatrixInverse.copy(camera.projectionMatrixInverse);virtual.updateMatrixWorld(true);
  let left=-1,right=1,bottom=-1,top=1;
  // Very close to the plane the doorway can straddle the near plane; retain a full
  // virtual frustum then, preventing disappearing detail in the crossing frame.
  if(facing>.2){
    const ndc=corners.map(p=>p.clone().project(camera));
    left=Math.max(-1,Math.min(...ndc.map(p=>p.x))-.035);right=Math.min(1,Math.max(...ndc.map(p=>p.x))+.035);
    bottom=Math.max(-1,Math.min(...ndc.map(p=>p.y))-.035);top=Math.min(1,Math.max(...ndc.map(p=>p.y))+.035);
  }
  if(right-left<1e-5||top-bottom<1e-5)return [main];
  const crop=new Matrix4().set(2/(right-left),0,0,-(right+left)/(right-left),0,2/(top-bottom),0,-(top+bottom)/(top-bottom),0,0,1,0,0,0,0,1);
  const clippedProjection=new Matrix4().multiplyMatrices(crop,virtual.projectionMatrix).multiply(virtual.matrixWorldInverse);
  const exitPlane=new Plane().setFromNormalAndCoplanarPoint(new Vector3(0,0,1).applyQuaternion(destination.rotation),destination.position);
  return [main,{worldId:worldId==='A'?'B':'A',kind:'portal',camera:virtual,frustum:new Frustum().setFromProjectionMatrix(clippedProjection),exitPlane}];
}

function intersectsExit(box:Box3,plane:Plane){
  const p=new Vector3(plane.normal.x>=0?box.max.x:box.min.x,plane.normal.y>=0?box.max.y:box.min.y,plane.normal.z>=0?box.max.z:box.min.z);
  return plane.distanceToPoint(p)>=-.025;
}

/** Geometry belongs to one chunk. Materials/textures can be shared by the PBR
 * library: eviction frees vertex/index buffers; final scene disposal owns maps.
 */
export function disposeChunkGeometry(root:Object3D){const unique=new Set<BufferGeometry>(),materials=new Set<Material>();root.traverse(o=>{const mesh=o as Mesh;if(!mesh.isMesh)return;unique.add(mesh.geometry);for(const m of Array.isArray(mesh.material)?mesh.material:[mesh.material])if(!m.userData.sharedOrbitalPBR)materials.add(m);});unique.forEach(g=>g.dispose());disposeMaterialLibrary(materials);root.removeFromParent();}

export class SpatialStreamingManager {
  private readonly entries:Entry[]=[];private interests:StreamingInterest[]=[];private now=0;private loading=0;private disposed=false;private changed=false;
  private pending=new Set<Promise<void>>();private loads=0;private evictions=0;
  readonly options:StreamingOptions;
  constructor(private readonly scenes:Record<WorldId,Scene>,chunks:SpatialChunk[],options:Partial<StreamingOptions>={}){
    this.options={...defaults,...options};
    for(const chunk of chunks){
      if(this.entries.some(e=>e.id===chunk.id)||chunk.bounds.isEmpty()||!Number.isFinite(chunk.bounds.min.length()+chunk.bounds.max.length()))throw new Error('Invalid or duplicate streaming chunk: '+chunk.id);
      const entry:Entry={...chunk,state:'proxy',high:null,visible:false,distance:Infinity,lastWanted:-Infinity,wanted:false,loadCount:0,retryAt:0,failure:null};
      entry.proxy.visible=false;scenes[entry.worldId].add(entry.proxy);this.entries.push(entry);
    }
  }
  update(interests:StreamingInterest[],now:number,quality=1){
    if(this.disposed)return;
    if(!Number.isFinite(now)||now<0||!Number.isFinite(quality))throw new Error('Invalid streaming clock/quality');
    this.now=now;this.interests=interests;
    for(const e of this.entries){
      e.visible=false;e.wanted=false;e.distance=Infinity;
      for(const interest of interests){
        if(interest.worldId!==e.worldId)continue;
        const distance=e.bounds.distanceToPoint(interest.camera.position);e.distance=Math.min(e.distance,distance);
        const visible=interest.frustum.intersectsBox(e.bounds)&&(!interest.exitPlane||intersectsExit(e.bounds,interest.exitPlane));
        e.visible ||= visible;
        // Nearby detail is prefetched for a rapid turn. Everything farther behind
        // stays a lightweight proxy, with no detailed GLB request.
        const detailLimit=this.options.detailDistance*(.65+.35*Math.max(.25,Math.min(1,quality)))*(e.high?1.15:1);
        e.wanted ||= (visible&&distance<detailLimit)||(interest.kind==='main'&&distance<5);
      }
      if(e.wanted){e.lastWanted=now;if(e.state==='proxy'||(e.state==='error'&&now>=e.retryAt))e.state='queued';}
      else if(e.state==='queued')e.state='proxy';
      if(e.high&&!e.wanted&&now-e.lastWanted>=this.options.retentionSeconds)this.evict(e);
      e.proxy.visible=e.visible&&!e.high;if(e.high)e.high.visible=e.visible;
    }
    this.enforceBudget();this.pump();
  }
  private pump(){
    if(this.disposed)return;
    const queue=this.entries.filter(e=>e.state==='queued'&&e.wanted).sort((a,b)=>a.distance-b.distance||a.id.localeCompare(b.id));
    for(const e of queue){if(this.loading>=this.options.maxConcurrent)break;this.loading++;e.state='loading';e.loadCount++;
      const job=Promise.resolve().then(()=>e.load()).then(root=>{
        if(this.disposed){disposeChunkGeometry(root);return;}
        e.high=root;root.name='detail:'+e.id;root.visible=e.visible;this.scenes[e.worldId].add(root);e.proxy.visible=false;e.state='resident';e.failure=null;this.loads++;this.changed=true;
      }).catch(error=>{if(this.disposed)return;e.state='error';e.failure=String(error);e.retryAt=this.now+5;e.proxy.visible=e.visible;}).finally(()=>{this.loading--;this.pending.delete(job);this.enforceBudget();this.pump();});
      this.pending.add(job);
    }
  }
  private evict(e:Entry){if(!e.high)return;disposeChunkGeometry(e.high);e.high=null;e.state='proxy';e.proxy.visible=e.visible;this.evictions++;}
  private enforceBudget(){
    if(this.disposed)return;
    const residents=this.entries.filter(e=>e.high);
    let count=residents.length,bytes=residents.reduce((sum,e)=>sum+(e.bytes??0),0);
    const candidates=residents.filter(e=>!e.wanted).sort((a,b)=>a.lastWanted-b.lastWanted||b.distance-a.distance);
    for(const e of candidates){if(count<=this.options.maxResident&&bytes<=this.options.maxBytes)break;this.evict(e);count--;bytes-=e.bytes??0;}
    // Visible geometry is never evicted just to manufacture a smaller metric.
  }
  async settle(){while(this.pending.size)await Promise.all([...this.pending]);}
  consumeChanges(){const changed=this.changed;this.changed=false;return changed;}
  snapshot(){
    const chunks=this.entries.map(e=>({id:e.id,worldId:e.worldId,state:e.state,visible:e.visible,lod:e.high?(e.visible?'high':'hidden'):e.visible?'proxy':'hidden',distance:Number.isFinite(e.distance)?Math.round(e.distance*10)/10:null,lastWanted:Number.isFinite(e.lastWanted)?e.lastWanted:null,loadCount:e.loadCount,bytes:e.bytes??0,triangles:e.triangles??0,failure:e.failure}));
    return {total:chunks.length,resident:chunks.filter(c=>c.state==='resident').length,loading:this.loading,queued:chunks.filter(c=>c.state==='queued').length,proxy:chunks.filter(c=>c.lod==='proxy').length,visible:chunks.filter(c=>c.visible).length,culled:chunks.filter(c=>!c.visible).length,loads:this.loads,evictions:this.evictions,failed:chunks.filter(c=>c.state==='error').length,bytesResident:this.entries.reduce((sum,e)=>sum+(e.high?e.bytes??0:0),0),retainedBehind:this.entries.filter(e=>e.high&&!e.visible).length,interests:this.interests.map(i=>({worldId:i.worldId,kind:i.kind,position:i.camera.position.toArray()})),chunks};
  }
  dispose(){if(this.disposed)return;this.disposed=true;for(const e of this.entries){if(e.high)disposeChunkGeometry(e.high);disposeChunkGeometry(e.proxy);}this.entries.length=0;}
}

/** Dispose a library only on final teardown, never while another chunk uses it. */
export function disposeMaterialLibrary(materials:Iterable<Material>){const textures=new Set<Texture>();for(const material of materials){for(const value of Object.values(material)){if(value&&typeof value==='object'&&(value as Texture).isTexture)textures.add(value as Texture);}material.dispose();}textures.forEach(t=>t.dispose());}
