import {createStreamingInterests,SpatialStreamingManager} from '../streaming/SpatialStreamingManager';
import {loadOrbitalArchitecture} from '../assets/OrbitalArchitecture';
import {loadOrbitalSky,type OrbitalSky} from '../assets/OrbitalSky';
import {OrbitalMaterials} from '../assets/OrbitalMaterials';
import {createExperienceArtifacts,type ExperienceArtifacts} from '../assets/ExperienceArtifacts';
import {ChapterAudio} from '../experience/ChapterAudio';
import {ChapterPersistence} from '../experience/ChapterPersistence';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {PMREMGenerator,Euler,PerspectiveCamera,Quaternion,Raycaster,Vector2,Vector3,type WebGLRenderer} from 'three';
import {ChapterDebugGeometry} from '../ui/ChapterDebugGeometry';
import {ChapterPhysics} from '../physics/ChapterPhysics';
import {ChapterController} from '../physics/ChapterController';
import {ARC_LENGTH,CENTER_HEIGHT,SKIN,surfacePose} from '../physics/GravitySurface';
import {loadChapterScenes,prepareStaticShadows,type SceneAsset} from '../assets/ChapterScenes';
import {PortalRenderer} from '../../engine/portal/PortalRenderer';
import {PerformanceMonitor} from '../../engine/diagnostics/PerformanceMonitor';
import {WorldRegistry} from '../world/WorldRegistry';
import type {WorldId} from '../../scenes/RoomLayout';
export class ChapterRuntime {
 readonly registry=new WorldRegistry();readonly performance=new PerformanceMonitor();physics!:ChapterPhysics;controller!:ChapterController;scenes!:Record<WorldId,SceneAsset>;renderer!:PortalRenderer;
 debugGeometry:ChapterDebugGeometry|null=null;ready=false;error:string|null=null;paused=false;elapsed=0;accumulator=0;droppedSeconds=0;input:()=>{x:number;y:number}=()=>({x:0,y:0});reducedMotion=false;private restoreShadows=false;private readonly restored=()=>{this.restoreShadows=true;};private environmentTarget:import('three').WebGLRenderTarget|null=null;private environment:import('three').Texture|null=null; private disposed=false;private cameraUp=new Vector3(0,1,0);
 constructor(readonly gl:WebGLRenderer,readonly camera:PerspectiveCamera){gl.domElement.addEventListener('webglcontextrestored',this.restored);}
 readonly audio=new ChapterAudio();readonly persistence=new ChapterPersistence();readonly materials=new OrbitalMaterials();
 streaming!:SpatialStreamingManager;sky:OrbitalSky|null=null;artifacts:ExperienceArtifacts|null=null;
 loading={stage:'正在建立轨道前厅',progress:.05};observed=false;sampleReleased=0;restoredCheckpoint=false;
 private quality=1;private saveAt=0;private streamClock=0;private hidden=false;
 private readonly onVisibility=()=>{this.hidden=document.hidden;if(this.hidden){this.accumulator=0;this.saveCheckpoint();}};
 async initialize(){
  try{
   document.addEventListener('visibilitychange',this.onVisibility);
   this.loading={stage:'正在载入真实建筑与碰撞空间',progress:.15};
   const [physics,scenes]=await Promise.all([ChapterPhysics.create(this.registry),loadChapterScenes(this.registry),this.materials.initialize(import.meta.env.BASE_URL,this.gl)]);
   this.physics=physics;this.scenes=scenes;
   if(this.disposed){physics.dispose();scenes.A.dispose();scenes.B.dispose();this.materials.dispose();return;}
   this.controller=new ChapterController(physics);this.prepareEnvironment();
   this.loading={stage:'正在装配轨道观测环境',progress:.55};
   const [sky,...chunksByWorld]=await Promise.all([loadOrbitalSky(import.meta.env.BASE_URL,new Vector3()),...this.registry.worlds.map(w=>loadOrbitalArchitecture(import.meta.env.BASE_URL,w.slot,w.offset))]);
   this.sky=sky;scenes.A.scene.add(sky.group);this.camera.far=1500;this.camera.updateProjectionMatrix();
   this.materials.apply(scenes.A.scene);this.materials.apply(scenes.B.scene);
   this.artifacts=createExperienceArtifacts();scenes.A.scene.add(this.artifacts.groups.A);scenes.B.scene.add(this.artifacts.groups.B);
   const descriptors=chunksByWorld.flat().map(chunk=>({id:chunk.id,worldId:chunk.slot,bounds:chunk.bounds,proxy:chunk.proxy,bytes:chunk.bytes,triangles:chunk.triangles,load:async()=>{const root=await chunk.load();if(!this.disposed)this.materials.apply(root);return root;}}));
   for(const descriptor of descriptors)this.materials.apply(descriptor.proxy);
   this.streaming=new SpatialStreamingManager({A:scenes.A.scene,B:scenes.B.scene},descriptors);
   this.renderer=new PortalRenderer(this.gl,scenes,this.camera);this.renderer.metrics.quality=this.quality;this.renderer.visibilityCulling=true;this.renderer.adaptiveResolution=false;
   this.restoreCheckpoint();this.sync();this.updateStreaming();
   this.loading={stage:'正在准备光照与实时门界',progress:.85};
   prepareStaticShadows(this.gl,scenes,this.camera);
   if(import.meta.env.DEV||import.meta.env.MODE==='e2e')this.debugGeometry=new ChapterDebugGeometry(scenes);
   if(this.disposed){this.ready=true;this.dispose();return;}
   this.loading={stage:'轨道前厅已就绪',progress:1};this.ready=true;
  }catch(e){this.error=String(e);this.loading={stage:'资源载入失败，可刷新重试',progress:0};throw e;}
 }
 setQuality(q:number){
  if(![1,.75,.4].includes(q))return;this.quality=q;
  if(this.renderer){this.renderer.adaptiveResolution=q!==1;this.resize(this.gl.domElement.clientWidth,this.gl.domElement.clientHeight,this.gl.getPixelRatio(),q);}
 }
 setSound(volume:number,muted:boolean){this.audio.configure({volume,muted});}
 async unlockAudio():Promise<void>{await this.audio.unlock();}
 canObserve(){const s=this.controller?.state;return !!s&&s.worldId==='A'&&s.foot.z>20&&Math.abs(s.foot.x)<1.8;}
 canReleaseSample(){const s=this.controller?.state;return !!s&&s.worldId==='B'&&s.mode==='NORMAL'&&s.foot.z>-3&&s.foot.z<8&&s.foot.x>-2&&s.foot.x<10;}
 observe(){if(!this.canObserve())return false;this.observed=true;return true;}
 releaseSample(){if(!this.canReleaseSample())return false;this.physics.resetWitness();this.sampleReleased++;return true;}
 updateStreaming(now=this.elapsed){
  if(!this.streaming||!this.controller)return;
  const slot=this.controller.state.worldId,source=this.registry.portals.forWorld(slot)[0],destination=this.registry.portals.destination(source.id);
  // A monotonic presentation clock still advances while physics is paused in a menu.
  this.streamClock=Math.max(this.streamClock,now);
  this.streaming.update(createStreamingInterests(this.camera,slot,source,destination),this.streamClock,this.quality);
 }
 private restoreCheckpoint(){
  if(new URLSearchParams(location.search).has('test'))return;
  const c=this.persistence.readCheckpoint();if(!c)return;
  const pose=surfacePose(c.mode==='NORMAL'?-1:c.s,c.foot[2]),foot=new Vector3().fromArray(c.foot);
  const globalFoot=this.registry.global(foot,c.slot),center=globalFoot.clone().addScaledVector(pose.up,CENTER_HEIGHT+SKIN);
  const support=this.physics.support(globalFoot,pose.up,c.slot);
  const overlap=this.physics.world.intersectionWithShape(center,pose.rotation,this.physics.shape,undefined,undefined,this.physics.collider,this.physics.body,collider=>this.physics.metadata.get(collider.handle)?.worldId===c.slot);
  if(!support||overlap){this.persistence.clearCheckpoint();return;}
  this.controller.place(foot,c.slot,c.mode==='NORMAL'?undefined:c.s);this.controller.state.yaw=c.yaw;this.controller.state.pitch=c.pitch;this.controller.state.terminal=c.terminal;this.controller.state.returned=c.returned;this.controller.updateView();this.restoredCheckpoint=true;
 }
 private saveCheckpoint(){
  if(!this.ready||new URLSearchParams(location.search).has('test')||!this.controller.state.grounded)return;
  const s=this.controller.state;this.persistence.writeCheckpoint({version:1,slot:s.worldId,foot:s.foot.toArray() as [number,number,number],mode:s.mode,s:s.s,yaw:s.yaw,pitch:s.pitch,terminal:s.terminal,returned:s.returned,savedAt:Date.now()});
 }
 private prepareEnvironment(){this.environmentTarget?.dispose();const room=new RoomEnvironment();const pmrem=new PMREMGenerator(this.gl);this.environmentTarget=pmrem.fromScene(room);this.environment=this.environmentTarget.texture;room.dispose();pmrem.dispose();for(const scene of [this.scenes.A.scene,this.scenes.B.scene]){scene.environment=this.environment;scene.environmentIntensity=.3;}}
 advance(delta:number){if(!this.ready)return;this.accumulator+=Math.min(delta,.25);this.droppedSeconds+=Math.max(0,delta-.25);let steps=0;const now=performance.now();while(this.accumulator>=1/60&&steps<5){this.controller.step(1/60,this.input());this.elapsed+=1/60;this.accumulator-=1/60;steps++;}if(steps===5&&this.accumulator>=1/60){this.droppedSeconds+=this.accumulator;this.accumulator=0;}this.performance.physicsMs=performance.now()-now;}
 step(n:number,x:number,y:number){if(!this.ready)throw Error('Not ready');if(n>20000||n<0)throw RangeError('Step bound');for(let i=0;i<n;i++){this.controller.step(1/60,{x,y});this.elapsed+=1/60;}this.sync();}
 tick(dt:number){
  if(!this.ready||this.hidden||(this.paused&&dt>0))return;
  this.performance.record(dt*1000);if(!this.paused)this.advance(dt);this.sync();this.streamClock+=Math.max(0,Math.min(dt,.25));this.updateStreaming();
  if(this.restoreShadows||this.streaming.consumeChanges()){if(this.restoreShadows)this.prepareEnvironment();this.restoreShadows=false;prepareStaticShadows(this.gl,this.scenes,this.camera);}
  this.renderer.render(this.controller.state.worldId);
  const s=this.controller.state,forward=new Vector3(0,0,-1).applyQuaternion(s.rotation);
  this.audio.update({slot:s.worldId,foot:s.foot.toArray() as [number,number,number],eye:this.registry.local(this.controller.eye(),s.worldId).toArray() as [number,number,number],forward:forward.toArray() as [number,number,number],up:s.up.toArray() as [number,number,number],speed:Math.min(20,s.velocity.length()),grounded:s.grounded,mode:s.mode,terminal:s.terminal,returned:s.returned,eventId:this.controller.transfer.lastEventId},dt);
  if(this.elapsed-this.saveAt>3){this.saveAt=this.elapsed;this.saveCheckpoint();}
 }
 sync(){if(!this.controller)return;const s=this.controller.state;this.camera.position.copy(this.controller.eye());this.camera.quaternion.copy(s.rotation);
  if(this.reducedMotion){this.cameraUp.lerp(s.up,.18).normalize();const direction=new Vector3(0,0,-1).applyQuaternion(s.rotation);this.camera.up.copy(this.cameraUp);this.camera.lookAt(this.camera.position.clone().add(direction));}else{this.cameraUp.copy(s.up);this.camera.up.copy(s.up);}
  this.camera.updateMatrixWorld(true);this.sky?.update(this.elapsed,s.returned);this.artifacts?.update(this.elapsed,s.returned,this.observed,s.mode);this.debugGeometry?.update(this.controller);const p=this.physics.witness.translation();const q=this.physics.witness.rotation();this.scenes.B.movingReference!.position.set(p.x,p.y,p.z);this.scenes.B.movingReference!.quaternion.set(q.x,q.y,q.z,q.w);
  this.scenes.B.device.rotation.x=this.elapsed*.2;this.scenes.B.device.rotation.z=this.elapsed*.1;
  const active=s.terminal;this.scenes.B.device.scale.setScalar(active?1.25:1);this.scenes.A.device.rotation.y=this.elapsed*(s.returned?.12:.025);this.scenes.A.device.scale.setScalar(s.returned?1.3:1);
  const m=this.scenes.A.device.material as import('three').MeshStandardMaterial;m.color.set(s.returned?0xb6a087:0x272d2e);m.emissive.set(s.returned?0x17110a:0);}
 resize(w:number,h:number,dpr:number,q?:number){this.camera.aspect=w/h;this.camera.updateProjectionMatrix();if(this.renderer)this.renderer.resize(w,h,dpr,q??this.renderer.metrics.quality);}
 snapshot(){if(!this.ready)return {ready:false as const,error:this.error,loading:{...this.loading}};const s=this.controller.state;const r=this.physics.body.rotation();return {ready:true as const,loading:{...this.loading},streaming:this.streaming.snapshot(),audio:this.audio.snapshot(),sky:this.sky?.diagnostics(),materials:this.materials.snapshot(),observed:this.observed,sampleReleased:this.sampleReleased,canObserve:this.canObserve(),canReleaseSample:this.canReleaseSample(),restoredCheckpoint:this.restoredCheckpoint,input:{...this.input()},error:this.error,world:this.registry.get(s.worldId).id,slot:s.worldId,foot:s.foot.toArray(),body:this.registry.local(s.position,s.worldId).toArray(),eye:this.registry.local(this.controller.eye(),s.worldId).toArray(),up:s.up.toArray(),gravity:s.gravity.toArray(),bodyRotation:[r.x,r.y,r.z,r.w],cameraRotation:s.rotation.toArray(),yaw:s.yaw,pitch:s.pitch,theta:s.theta,thetaDegrees:this.controller.thetaDegrees,s:s.s,mode:s.mode,grounded:s.grounded,supportNormal:s.supportNormal.toArray(),velocity:s.velocity.toArray(),step:s.step,progress:this.controller.progress,terminal:s.terminal,returned:s.returned,interactable:this.controller.canInteract(),events:structuredClone(this.controller.transfer.events),transferState:this.controller.transfer.phase,rejection:this.controller.transfer.lastRejection,blocked:this.physics.lastBlocked,rotationQueries:this.physics.rotationQueries,translationQueries:this.physics.translationQueries,supportQueries:this.physics.supportQueries,witness:{position:this.physics.witness.translation(),velocity:this.physics.witness.linvel(),resets:this.physics.witnessResets},render:{...this.renderer.metrics},performance:this.performance.snapshot(),errors:[...s.errors],elapsed:this.elapsed};}
 cameraPose(id:string){let foot:Vector3;let slot:WorldId='B';let target:Vector3;
  if(id==='C1'){foot=new Vector3(0,0,-2);this.controller.place(foot,'B');target=new Vector3(3,1,-7);}
  else if(id==='C2'){const p=surfacePose(ARC_LENGTH/2,-7);foot=p.foot;this.controller.place(foot,'B',ARC_LENGTH/2);target=new Vector3(0,7.8,-14.5);}
  else if(id==='C3'){foot=new Vector3(4.7,4,-12);this.controller.place(foot,'B',ARC_LENGTH+.8);target=new Vector3(2.2,7.6,-18);}
  else if(id==='CROSSING'){slot='A';foot=new Vector3(2.4,0,-15);this.controller.place(foot,slot);target=new Vector3(0,2.7,-20);}
  else{slot='A';foot=new Vector3(8,0,18);this.controller.place(foot,slot);target=new Vector3(-1,5,-10);}
  const camera=new PerspectiveCamera();camera.position.copy(this.controller.eye());camera.up.copy(this.controller.state.up);camera.lookAt(this.registry.global(target,slot));const local=new Quaternion().copy(this.controller.state.bodyRotation).invert().multiply(camera.quaternion);const euler=new Euler().setFromQuaternion(local,'YXZ');this.controller.state.yaw=euler.y;this.controller.state.pitch=euler.x;this.controller.updateView();this.sync();
 }
 visibility(id:string){const scene=this.scenes[this.controller.state.worldId].scene;scene.updateMatrixWorld(true);const target=scene.getObjectByName(id);if(!target)return {id,found:false,visibleSamples:0};const points:Vector3[]=[];target.traverse(o=>{if((o as import('three').Mesh).isMesh){const mesh=o as import('three').Mesh;mesh.geometry.computeBoundingBox();const b=mesh.geometry.boundingBox!;for(let x=0;x<15;x++)for(let y=0;y<15;y++)for(const z of [.01,.99])points.push(new Vector3(b.min.x+(b.max.x-b.min.x)*(x+.5)/15,b.min.y+(b.max.y-b.min.y)*(y+.5)/15,b.min.z+(b.max.z-b.min.z)*z).applyMatrix4(mesh.matrixWorld));}});let visible=0;const ray=new Raycaster();for(const point of points){const ndc=point.clone().project(this.camera);if(Math.abs(ndc.x)>1||Math.abs(ndc.y)>1||ndc.z>1)continue;ray.set(this.camera.position,point.clone().sub(this.camera.position).normalize());const hits=ray.intersectObjects(scene.children,true).filter(hit=>{const mesh=hit.object as import('three').Mesh;return mesh!==this.scenes[this.controller.state.worldId].surface&&!(mesh.material as import('three').Material)?.transparent;});if(hits[0]?.object===target||hits[0]?.object.parent===target)visible++;}return {id,found:true,visibleSamples:visible,samples:points.length};}
 /** Screen-space first-hit coverage complements coarse world-AABB witness sampling. */
 frameVisibility(){const scene=this.scenes[this.controller.state.worldId].scene;scene.updateMatrixWorld(true);const objects:import('three').Object3D[]=[];scene.traverse(o=>{if((o as import('three').Mesh).isMesh&&o.visible&&!(o as import('three').Mesh).material)return;const m=o as import('three').Mesh;if(m.isMesh&&o.visible&&!Array.isArray(m.material)&&!m.material.transparent)objects.push(o);});const ray=new Raycaster(),point=new Vector2();const counts:Record<string,number>={};const width=32,height=18;for(let y=0;y<height;y++)for(let x=0;x<width;x++){point.set(2*(x+.5)/width-1,1-2*(y+.5)/height);ray.setFromCamera(point,this.camera);const hit=ray.intersectObjects(objects,false)[0];if(!hit)continue;let id=hit.object.name;const ranges=hit.object.userData.assetRanges as {id:string;start:number;end:number}[]|undefined;if(ranges&&hit.faceIndex!=null){const range=ranges.find(r=>hit.faceIndex!>=r.start&&hit.faceIndex!<r.end);if(range)id=range.id;}counts[id]=(counts[id]??0)+1;}const stairs=Object.entries(counts).filter(([id])=>id.startsWith('I-axis-stair-')||id.startsWith('I-axis-nosing-')||id==='I-axis-landing-nosing').reduce((sum,[,n])=>sum+n,0);return {width,height,total:width*height,counts,stairs,method:'first opaque real triangle hit per camera ray; batch face identity preserved'};}
 dispose(){
  if(this.disposed&&!this.ready)return;this.saveCheckpoint();this.disposed=true;
  document.removeEventListener('visibilitychange',this.onVisibility);void this.audio.dispose();this.streaming?.dispose();this.artifacts?.dispose();this.sky?.dispose();
  this.renderer?.dispose();this.debugGeometry?.dispose();this.physics?.dispose();this.scenes?.A.dispose();this.scenes?.B.dispose();this.materials.dispose();this.environmentTarget?.dispose();
  this.gl.dispose();this.ready=false;this.gl.domElement.removeEventListener('webglcontextrestored',this.restored);
 }
}
