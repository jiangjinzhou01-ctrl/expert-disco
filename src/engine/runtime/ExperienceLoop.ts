import { Euler, PerspectiveCamera, Vector3, WebGLRenderer } from 'three';
import { createRoomA } from '../../scenes/RoomA';
import { createRoomB } from '../../scenes/RoomB';
import { PortalRenderer } from '../portal/PortalRenderer';
import { PlayerState } from '../player/PlayerState';
import { PerformanceMonitor } from '../diagnostics/PerformanceMonitor';
import { PLAYER_EYE_HEIGHT,PLAYER_HALF_HEIGHT,portals } from '../../scenes/RoomLayout';
import { computeSignedPlaneDistance } from '../portal/PortalMath';
import { PhysicsRuntime } from '../physics/PhysicsRuntime';
import { PlayerController } from '../player/PlayerController';
import { PortalTransfer } from '../portal/PortalTransfer';
import { DebugGeometry } from '../diagnostics/DebugGeometry';
import {releaseFinishResources} from '../rendering/FinishResources';

export interface InputDiagnostics {movement:{x:number;y:number};touchState:{moveActive:boolean;lookActive:boolean;moveX:number;moveY:number};touch:boolean}

/** R3F's one priority-1 callback is the only clock owner. Physics never owns a RAF. */
export class ExperienceLoop {
 readonly state=new PlayerState(); readonly performance=new PerformanceMonitor();
 readonly rooms={A:createRoomA(),B:createRoomB()}; readonly portalRenderer:PortalRenderer;
 physics:PhysicsRuntime|null=null; controller:PlayerController|null=null;transfer:PortalTransfer|null=null;
 elapsed=0; paused=false; accumulator=0; droppedSeconds=0; readonly fixedDt=1/60; readonly maxSteps=5;
 debugGeometry:DebugGeometry|null=null; error:string|null=null; private disposed=false; private movement=new Vector3(); private readonly up=new Vector3(0,1,0);
 input:()=>{x:number;y:number}=()=>({x:0,y:0});
 inputDiagnostics:()=>InputDiagnostics=()=>({movement:{x:0,y:0},touchState:{moveActive:false,lookActive:false,moveX:0,moveY:0},touch:false});
 constructor(readonly gl:WebGLRenderer,readonly camera:PerspectiveCamera){this.portalRenderer=new PortalRenderer(gl,this.rooms,camera);this.portalRenderer.metrics.quality=.85;}
 async initialize(){try{const physics=await PhysicsRuntime.create(this.state);if(this.disposed){physics.dispose();return;}this.physics=physics;this.transfer=new PortalTransfer(physics,this.state);this.controller=new PlayerController(physics,this.state,this.transfer);}catch(error){this.error=String(error);throw error;}}
 advance(delta:number,velocity?:Vector3){
  if(!this.controller||this.disposed)return 0;
  if(!Number.isFinite(delta)||delta<0)throw new Error('Invalid frame delta');
  this.accumulator+=Math.min(delta,.25);this.droppedSeconds+=Math.max(0,delta-.25);
  const start=performance.now();let steps=0;
  while(this.accumulator+1e-10>=this.fixedDt&&steps<this.maxSteps){
   if(velocity)this.movement.copy(velocity);else{const input=this.input();this.movement.set(input.x,0,-input.y);if(this.movement.lengthSq()>1)this.movement.normalize();this.movement.applyAxisAngle(this.up,this.state.yaw).multiplyScalar(3);}
   this.controller.step(this.fixedDt,this.movement);this.accumulator-=this.fixedDt;this.elapsed+=this.fixedDt;steps++;
  }
  if(this.accumulator>=this.fixedDt){const remainder=this.accumulator%this.fixedDt;this.droppedSeconds+=this.accumulator-remainder;this.accumulator=remainder;}
  this.performance.physicsMs=performance.now()-start;return steps;
 }
 stepFrames(frames:number,velocity:number[]=[0,0,0]){if(!Number.isInteger(frames)||frames<0||frames>10000)throw new Error('Invalid frame count');if(!this.controller)throw new Error('Physics not ready');this.movement.fromArray(velocity);for(let i=0;i<frames;i++){this.controller.step(this.fixedDt,this.movement);this.elapsed+=this.fixedDt;}this.syncCamera();this.rooms.A.update(this.elapsed);this.rooms.B.update(this.elapsed);}
 tick(delta:number){if(this.disposed)return;this.performance.record(delta*1000);if(!this.paused)this.advance(delta);this.syncCamera();this.debugGeometry?.update(this.state,this.transfer?.events??[]);this.rooms.A.update(this.elapsed);this.rooms.B.update(this.elapsed);this.portalRenderer.render(this.state.worldId);}
 syncCamera(){this.camera.position.copy(this.state.position);this.camera.position.y+=PLAYER_EYE_HEIGHT-PLAYER_HALF_HEIGHT;this.camera.quaternion.copy(this.state.rotation);this.camera.updateMatrixWorld(true);}
 setPose(position:number[],yaw=0,pitch=0,worldId:'A'|'B'='A'){
  if(position.length!==3||![...position,yaw,pitch].every(Number.isFinite))throw new Error('Invalid debug pose');
  this.controller?.relocate(new Vector3().fromArray(position),worldId,yaw);
  this.state.position.fromArray(position);this.state.worldId=worldId;this.state.yaw=yaw;this.state.pitch=pitch;this.state.rotation.setFromEuler(new Euler(pitch,yaw,0,'YXZ'));this.state.velocity.set(0,0,0);this.syncCamera();
 }
 look(dx:number,dy:number){this.state.yaw-=dx*.0025;this.state.pitch=Math.max(-1.45,Math.min(1.45,this.state.pitch-dy*.0025));this.state.rotation.setFromEuler(new Euler(this.state.pitch,this.state.yaw,0,'YXZ'));}
 snapshot(){return {input:this.inputDiagnostics(),ready:!!this.controller,error:this.error,worldId:this.state.worldId,position:this.state.position.toArray(),rotation:this.state.rotation.toArray(),yaw:this.state.yaw,pitch:this.state.pitch,velocity:this.state.velocity.toArray(),step:this.state.step,grounded:this.state.grounded,events:structuredClone(this.transfer?.events??[]),lastEventId:this.transfer?.lastEventId??0,transferState:this.transfer?.phase??'ARMED',lastRejection:this.transfer?.lastRejection??null,portal:{source:this.state.worldId+'-door',destination:this.state.worldId==='A'?'B-door':'A-door',poses:portals.map(p=>({id:p.id,position:p.position.toArray(),rotation:p.rotation.toArray()})),signedDistance:computeSignedPlaneDistance(this.state.position,portals[this.state.worldId==='A'?0:1]),crossingCondition:this.transfer?.crossingCondition??false},render:{...this.portalRenderer.metrics},performance:this.performance.snapshot(),movingReference:this.rooms.B.movingReference?.position.toArray(),elapsed:this.elapsed,droppedSeconds:this.droppedSeconds};}
 resize(w:number,h:number,dpr:number,quality=1){this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.portalRenderer.resize(w,h,dpr,quality);}
 setDebugGeometry(visible:boolean){if(!import.meta.env.DEV)return;if(visible&&!this.debugGeometry)this.debugGeometry=new DebugGeometry(this.rooms);this.debugGeometry?.setVisible(visible);}
 reset(){this.controller?.reset();if(!this.controller)this.state.reset();this.accumulator=0;this.syncCamera();}
 dispose(){if(this.disposed)return;this.disposed=true;this.physics?.dispose();this.debugGeometry?.dispose();this.portalRenderer.dispose();this.rooms.A.dispose();this.rooms.B.dispose();releaseFinishResources(this.gl);}
}
