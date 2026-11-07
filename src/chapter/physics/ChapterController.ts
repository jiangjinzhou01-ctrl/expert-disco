import {Euler,Quaternion,Vector3} from 'three';
import {PlayerState} from '../../engine/player/PlayerState';
import {PortalTransfer} from '../../engine/portal/PortalTransfer';
import type {WorldId} from '../../scenes/RoomLayout';
import {CENTER_HEIGHT,EYE_HEIGHT,SKIN,surfacePose} from './GravitySurface';
import {ChapterPhysics} from './ChapterPhysics';
export class ChapterState extends PlayerState {
 foot=new Vector3(0,0,33);up=new Vector3(0,1,0);bodyRotation=new Quaternion();gravity=new Vector3(0,-9.81,0);supportNormal=new Vector3(0,1,0);theta=0;mode:'NORMAL'|'ARC'|'WALL'='NORMAL';s=-1.5;terminal=false;returned=false;errors:string[]=[];rotatedSteps=0;
 constructor(){super();this.position.set(0,.87+SKIN,33);}
}
export class ChapterController {
 readonly state=new ChapterState();readonly transfer:PortalTransfer;
 private checkpoint={foot:new Vector3(0,0,33),slot:'A' as WorldId,s:-1.5,mode:'NORMAL' as ChapterState['mode']};
 private fallVelocity=new Vector3(); private missingSupport=0;private witnessClock=0;
 constructor(readonly physics:ChapterPhysics){this.transfer=new PortalTransfer(physics,this.state,physics.registry.portals);}
 look(dx:number,dy:number){this.state.yaw-=dx*.0025;this.state.pitch=Math.max(-1.4,Math.min(1.4,this.state.pitch-dy*.0025));this.updateView();}
 updateView(){this.state.rotation.copy(this.state.bodyRotation).multiply(new Quaternion().setFromEuler(new Euler(this.state.pitch,this.state.yaw,0,'YXZ')));}
 eye(){return this.physics.registry.global(this.state.foot,this.state.worldId).addScaledVector(this.state.up,EYE_HEIGHT);}
 private applyContact(foot:Vector3,s:number,active:boolean){const st=this.state;st.foot.copy(foot);st.s=s;const pose=surfacePose(active?s:-1,foot.z);st.theta=active?pose.theta:0;st.mode=active?pose.mode:'NORMAL';st.up.copy(active?pose.up:new Vector3(0,1,0));st.bodyRotation.copy(active?pose.rotation:new Quaternion());st.gravity.copy(st.up).multiplyScalar(-9.81);st.position.copy(this.physics.registry.global(st.foot,st.worldId)).addScaledVector(st.up,CENTER_HEIGHT+SKIN);this.updateView();}
 /** Each input step is planar in the player's current physical frame. No waypoint or timed arc movement exists. */
 step(dt:number,input:{x:number;y:number}){
  if(!Number.isFinite(dt+input.x+input.y)||dt<=0||dt>.1)throw new RangeError('Invalid character input');
  const st=this.state;if(!st.position.toArray().every(Number.isFinite)){st.errors.push('non-finite-state');this.reset();return;}
  st.step++;const start=st.position.clone();const move=new Vector3(input.x,0,-input.y);if(move.lengthSq()>1)move.normalize();move.multiplyScalar(3).applyAxisAngle(new Vector3(0,1,0),st.yaw).applyQuaternion(st.bodyRotation);st.movementDirection.copy(move);st.velocity.copy(move);
  const parts=st.worldId==='A'?1:Math.max(1,Math.ceil(3*dt/.01));
  for(let part=0;part<parts;part++){
   const currentPose=surfacePose(st.s,st.foot.z);const tangent=st.mode==='NORMAL'?new Vector3(1,0,0):currentPose.tangent;
   const ds=move.dot(tangent)*dt/parts;const dz=move.z*dt/parts;
   const tryStep=(dx:number,zz:number)=>{
    const oldSlot=st.worldId;let active=st.mode!=='NORMAL';let s=active?st.s:st.foot.x-1.5;s+=dx;
    const z=st.foot.z+zz;
    if(st.worldId==='B'&&!active&&z<-5.001&&z>-8.999&&st.foot.x<=1.501&&1.5+s>=1.5)active=true;
    let pose=surfacePose(s,z);const foot=active?pose.foot:new Vector3(1.5+s,st.foot.y,z);
    if(!active||s<=0){active=false;pose=surfacePose(-1,z);}
    const center=this.physics.registry.global(foot,st.worldId).addScaledVector(pose.up,CENTER_HEIGHT+SKIN);
    const support=this.physics.support(this.physics.registry.global(foot,st.worldId),pose.up,st.worldId);
    if(active&&!support)return false;
    const contact=support?this.physics.registry.local(this.physics.registry.global(foot,st.worldId).addScaledVector(pose.up,.12-support.timeOfImpact),st.worldId):foot;if(active&&s<3.2*Math.PI/2&&s>0){s=3.2*Math.atan2(contact.x-1.5,3.2-contact.y);pose=surfacePose(s,z);foot.copy(pose.foot);}
    const normal=support?new Vector3(support.normal.x,support.normal.y,support.normal.z):new Vector3(0,1,0);if(normal.dot(pose.up)<.98)return false;
    if(!active){
     const desired=center.clone().sub(st.position);if(st.grounded)desired.y-=.5*dt/parts;const result=this.transfer.resolve(st.position,desired,true,st.step);this.state.position.copy(result.position);
     const mappedFoot=this.physics.registry.local(result.position,st.worldId).add(new Vector3(0,-CENTER_HEIGHT-SKIN,0));
     this.applyContact(mappedFoot,mappedFoot.x-1.5,false);
     if(st.worldId!==oldSlot&&st.worldId==='A'&&st.terminal)st.returned=true;
     return true;
    }
    if(!this.physics.canMove(st.position,st.bodyRotation,center,pose.rotation,pose.up,st.worldId))return false;
    this.applyContact(foot,s,active);st.supportNormal.copy(normal);return true;
   };
   const moving=Math.abs(ds)+Math.abs(dz)>1e-10;
   if(moving&&!tryStep(ds,dz)){if(Math.abs(ds)>1e-10)tryStep(ds,0);if(Math.abs(dz)>1e-10)tryStep(0,dz);}
   // Recompute contact even at rest: KCC.computedGrounded belongs to its last query.
   if(!moving&&st.mode==='NORMAL')tryStep(0,0);
  }
  const support=this.physics.support(this.physics.registry.global(st.foot,st.worldId),st.up,st.worldId);st.grounded=!!support||this.physics.character.computedGrounded();if(support){st.supportNormal.set(support.normal.x,support.normal.y,support.normal.z);if(st.mode==='NORMAL'){st.foot.y+=.12-support.timeOfImpact;st.position.copy(this.physics.registry.global(st.foot,st.worldId)).addScaledVector(st.up,CENTER_HEIGHT+SKIN);}}
  if(!st.grounded){this.missingSupport++;this.fallVelocity.addScaledVector(st.gravity,dt);const movement=this.physics.moveOriented(st.position,this.fallVelocity.clone().multiplyScalar(dt),st.bodyRotation,st.up,st.worldId);st.position.add(movement.displacement);st.foot.copy(this.physics.registry.local(st.position,st.worldId)).addScaledVector(st.up,-CENTER_HEIGHT-SKIN);if(this.missingSupport>60||st.foot.y<-7.8){st.errors.push('support-lost-reset');this.reset();}}else{this.fallVelocity.set(0,0,0);this.missingSupport=0;if(st.step%120===0)this.checkpoint={foot:st.foot.clone(),slot:st.worldId,s:st.s,mode:st.mode};}
  if(st.mode!=='NORMAL')st.rotatedSteps++;
  st.velocity.copy(st.position).sub(start).divideScalar(dt);if(this.transfer.events.at(-1)?.step===st.step)st.velocity.copy(move);
  this.physics.commit(st.position,st.bodyRotation,dt);this.witnessClock+=dt;if(this.witnessClock>=8){this.physics.resetWitness();this.witnessClock=0;}
 }
 canInteract(){return this.state.worldId==='B'&&this.state.mode==='WALL'&&this.state.foot.distanceTo(new Vector3(4.7,4,-16.5))<1.25;}
 interact(){if(this.canInteract()){this.state.terminal=true;return true;}return false;}
 reset(){this.transfer.reset();const c=this.checkpoint;this.state.worldId=c.slot;this.state.velocity.set(0,0,0);this.applyContact(c.foot,c.s,c.mode!=='NORMAL');this.physics.setPose(this.state.position,this.state.bodyRotation);this.missingSupport=0;this.fallVelocity.set(0,0,0);}
 restart(){this.checkpoint={foot:new Vector3(0,0,33),slot:'A',s:-1.5,mode:'NORMAL'};this.state.yaw=0;this.state.pitch=0;this.state.terminal=false;this.state.returned=false;this.reset();}
 /** Explicitly test-gated in the browser adapter. */
 place(foot:Vector3,slot:WorldId,s?:number){this.state.worldId=slot;this.transfer.reset();this.applyContact(foot,s??foot.x-1.5,s!==undefined);this.physics.moveOriented(this.state.position,new Vector3(),this.state.bodyRotation,this.state.up,slot);this.state.grounded=false;this.fallVelocity.set(0,0,0);}
 get thetaDegrees(){return this.state.theta*180/Math.PI;}
 get progress(){return this.state.returned?'RETURNED':this.state.terminal?'RETURN_TO_VESTIBULE':this.state.mode==='WALL'?'WALL_WALK':this.state.mode==='ARC'?'GRAVITY_TURN':this.state.worldId==='B'?'INVERT':'ARRIVAL';}
}
