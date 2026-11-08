import {Euler,Quaternion,Vector3} from 'three';
import {PlayerState} from '../../engine/player/PlayerState';
import {PortalTransfer} from '../../engine/portal/PortalTransfer';
import type {WorldId} from '../../scenes/RoomLayout';
import {SKIN,surfacePose} from './GravitySurface';
import {ChapterPhysics} from './ChapterPhysics';
import {DEFAULT_MOVEMENT,STANCES,nominalJumpSpeed,validateMovement,type MovementSettings,type MotionInput,type Stance,type LocomotionMode} from './Locomotion';
import {GravityResolver} from './GravityResolver';
export class ChapterState extends PlayerState {
 stance:Stance='STAND';locomotion:LocomotionMode='GROUND_WALK';stanceBlocked:string|null=null;fieldId='architectural-support';
 foot=new Vector3(0,0,33);up=new Vector3(0,1,0);bodyRotation=new Quaternion();gravity=new Vector3(0,-9.81,0);supportNormal=new Vector3(0,1,0);theta=0;mode:'NORMAL'|'ARC'|'WALL'='NORMAL';s=-1.5;terminal=false;returned=false;errors:string[]=[];rotatedSteps=0;
 constructor(){super();this.position.set(0,.87+SKIN,33);}
}
export class ChapterController {
 readonly settings:MovementSettings={...DEFAULT_MOVEMENT};readonly gravityResolver=new GravityResolver();
 private airborne=false;private previousJump=false;private previousCrouch=false;private jumpBuffer=0;private coyote=0;private airTime=0;private stanceIntent:Stance='STAND';
 clearBufferedActions(){this.jumpBuffer=0;this.previousJump=false;this.previousCrouch=false;}
 restoreStance(stance:Stance){this.stanceIntent=stance;this.setStance({x:0,y:0});return this.state.stance===stance;}
 configure(settings:Partial<MovementSettings>){Object.assign(this.settings,validateMovement({...this.settings,...settings}));}
 readonly state=new ChapterState();readonly transfer:PortalTransfer;
 private checkpoint={foot:new Vector3(0,0,33),slot:'A' as WorldId,s:-1.5,mode:'NORMAL' as ChapterState['mode'],stance:'STAND' as Stance,yaw:0};
 private fallVelocity=new Vector3(); private missingSupport=0;private witnessClock=0;
 constructor(readonly physics:ChapterPhysics){this.transfer=new PortalTransfer(physics,this.state,physics.registry.portals);}
 look(dx:number,dy:number){this.state.yaw-=dx*.0025;this.state.pitch=Math.max(-1.4,Math.min(1.4,this.state.pitch-dy*.0025));this.updateView();}
 updateView(){this.state.rotation.copy(this.state.bodyRotation).multiply(new Quaternion().setFromEuler(new Euler(this.state.pitch,this.state.yaw,0,'YXZ')));}
 eye(){return this.physics.registry.global(this.state.foot,this.state.worldId).addScaledVector(this.state.up,this.physics.eyeHeight);}
 private resolveGravity(){const st=this.state;const d=this.gravityResolver.resolve(st.foot,st.worldId,st.up.clone().multiplyScalar(-9.81));st.fieldId=d.id;st.gravity.copy(d.acceleration);if(this.settings.profile==='experiment')st.gravity.multiplyScalar(this.settings.gravityScale);}
 private applyContact(foot:Vector3,s:number,active:boolean){const st=this.state;st.foot.copy(foot);st.s=s;const pose=surfacePose(active?s:-1,foot.z);st.theta=active?pose.theta:0;st.mode=active?pose.mode:'NORMAL';st.up.copy(active?pose.up:new Vector3(0,1,0));st.bodyRotation.copy(active?pose.rotation:new Quaternion());this.resolveGravity();st.position.copy(this.physics.registry.global(st.foot,st.worldId)).addScaledVector(st.up,this.physics.centerOffset+SKIN);this.updateView();}
 private setStance(input:MotionInput){
  const st=this.state;
  if(input.crouch&&!this.previousCrouch&&this.stanceIntent==='CROUCH')this.stanceIntent='STAND';this.previousCrouch=!!input.crouch;
  if(input.pronePressed)this.stanceIntent=this.stanceIntent==='PRONE'?'STAND':'PRONE';
  const wanted=input.crouch?'CROUCH':this.stanceIntent;
  if(wanted===st.stance)return;
  if(this.physics.tryStance(wanted,this.physics.registry.global(st.foot,st.worldId),st.bodyRotation,st.up,st.worldId)){
   st.stance=wanted;st.stanceBlocked=null;st.position.copy(this.physics.registry.global(st.foot,st.worldId)).addScaledVector(st.up,this.physics.centerOffset+SKIN);
  }else st.stanceBlocked='头顶或周围空间不足，保持当前姿态';
 }
 private airStep(dt:number,input:MotionInput,move:Vector3){
  const st=this.state;st.step++;this.airTime+=dt;this.resolveGravity();
  const zero=st.gravity.lengthSq()<1e-10;st.locomotion=zero?'ZERO_G':'AIRBORNE';
  if(zero){
   const thrust=new Vector3(input.x,Number(!!input.jump)-Number(!!input.descend),-input.y);
   if(thrust.lengthSq()>1)thrust.normalize();thrust.applyQuaternion(st.rotation);
   this.fallVelocity.addScaledVector(thrust,6*dt);
   if(input.brake)this.fallVelocity.multiplyScalar(Math.exp(-8*dt));
   this.fallVelocity.clampLength(0,Math.max(this.settings.moveSpeed,1.5));
  }else if(move.lengthSq()>0){
   const current=this.fallVelocity.clone().projectOnPlane(st.up),target=move.clone().projectOnPlane(st.up);
   const correction=target.sub(current).clampLength(0,4*dt);this.fallVelocity.add(correction);
  }
  const desired=this.fallVelocity.clone().multiplyScalar(dt).addScaledVector(st.gravity,.5*dt*dt);
  this.fallVelocity.addScaledVector(st.gravity,dt);st.velocity.copy(this.fallVelocity);st.movementDirection.copy(move);
  const upright=st.mode==='NORMAL'&&st.up.y>.9999;
  if(upright){
   const result=this.transfer.resolve(st.position,desired,false,st.step);st.position.copy(result.position);
   if(result.transferred){this.fallVelocity.copy(st.velocity);if(st.worldId==='A'&&st.terminal)st.returned=true;}
  }else{
   const result=this.physics.moveOriented(st.position,desired,st.bodyRotation,st.up,st.worldId);st.position.add(result.displacement);
  }
  // Remove only velocity into real contact normals; preserve tangential momentum.
  for(let i=0;i<this.physics.character.numComputedCollisions();i++){
   const c=this.physics.character.computedCollision(i);if(!c)continue;const n=new Vector3(c.normal1.x,c.normal1.y,c.normal1.z);
   const into=this.fallVelocity.dot(n);if(into<0)this.fallVelocity.addScaledVector(n,-into);
  }
  st.foot.copy(this.physics.registry.local(st.position,st.worldId)).addScaledVector(st.up,-this.physics.centerOffset-SKIN);
  const support=this.physics.support(this.physics.registry.global(st.foot,st.worldId),st.up,st.worldId);
  st.grounded=!zero&&!!support&&this.fallVelocity.dot(st.up)<=.1&&this.airTime>.08;
  if(st.grounded){
   st.foot.addScaledVector(st.up,.12-support!.timeOfImpact);this.airborne=false;this.airTime=0;this.fallVelocity.set(0,0,0);st.locomotion='REATTACH';
   const s=st.mode==='WALL'?3.2*Math.PI/2+st.foot.y-3.2:3.2*Math.atan2(st.foot.x-1.5,3.2-st.foot.y);
   this.applyContact(st.foot.clone(),st.mode==='NORMAL'?st.foot.x-1.5:s,st.mode!=='NORMAL');
  }
  if(st.foot.y<-12){st.errors.push('support-lost-reset');this.reset();}
  st.velocity.copy(this.fallVelocity);this.physics.commit(st.position,st.bodyRotation,dt);this.updateView();
 }
 /** Each input step is planar in the player's current physical frame. No waypoint or timed arc movement exists. */
 step(dt:number,input:MotionInput){
  if(!Number.isFinite(dt+input.x+input.y)||dt<=0||dt>.1)throw new RangeError('Invalid character input');
  const st=this.state;if(![...st.position.toArray(),...st.foot.toArray(),...st.up.toArray(),...st.bodyRotation.toArray()].every(Number.isFinite)){st.errors.push('non-finite-state');this.reset();return;}
  this.resolveGravity();this.setStance(st.gravity.lengthSq()<1e-10?{...input,crouch:false}:input);this.physics.tryHeading(st.yaw,st.position,st.bodyRotation,st.worldId);
  const speed=Math.min(7,this.settings.moveSpeed*((input.sprint||this.settings.autoSprint)&&st.stance==='STAND'?1.65:1))*STANCES[st.stance].speed;
  const move=new Vector3(input.x,0,-input.y);if(move.lengthSq()>1)move.normalize();move.multiplyScalar(speed).applyAxisAngle(new Vector3(0,1,0),st.yaw).applyQuaternion(st.bodyRotation);
  const jump=!!input.jump;if(input.jumpPressed||(jump&&!this.previousJump))this.jumpBuffer=.1;else this.jumpBuffer=Math.max(0,this.jumpBuffer-dt);this.previousJump=jump;
  let hasSupport=!!this.physics.support(this.physics.registry.global(st.foot,st.worldId),st.up,st.worldId);
  if(!hasSupport&&!this.airborne&&st.mode==='NORMAL'){
   const probe=this.physics.moveOriented(st.position,st.up.clone().multiplyScalar(-.035),st.bodyRotation,st.up,st.worldId);
   if(probe.grounded&&probe.normals.some(n=>n.dot(st.up)>.5)){
    st.position.add(probe.displacement);st.foot.copy(this.physics.registry.local(st.position,st.worldId)).addScaledVector(st.up,-this.physics.centerOffset-SKIN);hasSupport=true;
   }
  }
  if(!this.airborne&&hasSupport)this.coyote=.1;else this.coyote=Math.max(0,this.coyote-dt);
  // A zero-displacement KCC query may retain its previous grounded flag. A
  // missing real support starts ballistic motion immediately, including at rest.
  if(!hasSupport&&!this.airborne){this.airborne=true;this.airTime=0;this.fallVelocity.copy(st.velocity).projectOnPlane(st.up);}
  if(st.gravity.lengthSq()<1e-10){if(!this.airborne)this.fallVelocity.copy(st.velocity);this.airborne=true;}
  else if(this.jumpBuffer>0&&this.coyote>0){this.fallVelocity.copy(move).addScaledVector(st.up,nominalJumpSpeed(this.settings.profile==='experiment'?this.settings.jumpHeight:1.2));this.airborne=true;this.airTime=0;this.jumpBuffer=0;this.coyote=0;}
  if(this.airborne){this.airStep(dt,input,move);return;}
  st.locomotion='GROUND_WALK';st.step++;const start=st.position.clone();st.movementDirection.copy(move);st.velocity.copy(move);
  const parts=st.worldId==='A'?1:Math.max(1,Math.ceil(speed*dt/.01));
  for(let part=0;part<parts;part++){
   const currentPose=surfacePose(st.s,st.foot.z);const tangent=st.mode==='NORMAL'?new Vector3(1,0,0):currentPose.tangent;
   const ds=move.dot(tangent)*dt/parts;const dz=move.z*dt/parts;
   const tryStep=(dx:number,zz:number)=>{
    const oldSlot=st.worldId;let active=st.mode!=='NORMAL';let s=active?st.s:st.foot.x-1.5;s+=dx;
    const z=st.foot.z+zz;
    if(st.worldId==='B'&&!active&&z<-5.001&&z>-8.999&&st.foot.x<=1.501&&1.5+s>=1.5)active=true;
    let pose=surfacePose(s,z);const foot=active?pose.foot:new Vector3(1.5+s,st.foot.y,z);
    if(!active||s<=0){active=false;pose=surfacePose(-1,z);}
    const center=this.physics.registry.global(foot,st.worldId).addScaledVector(pose.up,this.physics.centerOffset+SKIN);
    const support=this.physics.support(this.physics.registry.global(foot,st.worldId),pose.up,st.worldId);
    if(active&&!support)return false;
    const contact=support?this.physics.registry.local(this.physics.registry.global(foot,st.worldId).addScaledVector(pose.up,.12-support.timeOfImpact),st.worldId):foot;if(active&&s<3.2*Math.PI/2&&s>0){s=3.2*Math.atan2(contact.x-1.5,3.2-contact.y);pose=surfacePose(s,z);foot.copy(pose.foot);}
    const normal=support?new Vector3(support.normal.x,support.normal.y,support.normal.z):new Vector3(0,1,0);if(normal.dot(pose.up)<.98)return false;
    if(!active){
     const desired=center.clone().sub(st.position);const result=this.transfer.resolve(st.position,desired,true,st.step);this.state.position.copy(result.position);
     const mappedFoot=this.physics.registry.local(result.position,st.worldId).add(new Vector3(0,-this.physics.centerOffset-SKIN,0));
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
  const support=this.physics.support(this.physics.registry.global(st.foot,st.worldId),st.up,st.worldId);st.grounded=!!support||this.physics.character.computedGrounded();if(support){st.supportNormal.set(support.normal.x,support.normal.y,support.normal.z);if(st.mode==='NORMAL'){st.foot.y+=.12-support.timeOfImpact;st.position.copy(this.physics.registry.global(st.foot,st.worldId)).addScaledVector(st.up,this.physics.centerOffset+SKIN);}}
  if(!st.grounded){this.missingSupport++;this.airborne=true;this.airTime=0;this.fallVelocity.copy(move);}else{this.fallVelocity.set(0,0,0);this.missingSupport=0;if(st.step%120===0)this.checkpoint={foot:st.foot.clone(),slot:st.worldId,s:st.s,mode:st.mode,stance:st.stance,yaw:st.yaw};}
  if(st.mode!=='NORMAL')st.rotatedSteps++;
  st.velocity.copy(st.position).sub(start).divideScalar(dt);if(this.transfer.events.at(-1)?.step===st.step)st.velocity.copy(move);
  this.physics.commit(st.position,st.bodyRotation,dt);this.witnessClock+=dt;if(this.witnessClock>=8){this.physics.resetWitness();this.witnessClock=0;}
 }
 canInteract(){return this.state.worldId==='B'&&this.state.mode==='WALL'&&this.state.foot.distanceTo(new Vector3(4.7,4,-16.5))<1.25;}
 interact(){if(this.canInteract()){this.state.terminal=true;return true;}return false;}
 reset(){
  this.transfer.reset();this.gravityResolver.reset();this.airborne=false;this.airTime=0;this.jumpBuffer=0;this.coyote=0;
  let c=this.checkpoint;let pose=surfacePose(c.mode==='NORMAL'?-1:c.s,c.foot.z);
  if(!this.physics.restoreShape(c.stance,this.physics.registry.global(c.foot,c.slot),pose.rotation,c.slot,c.yaw)){
   this.state.errors.push('recovery-checkpoint-blocked');
   c={foot:new Vector3(0,0,33),slot:'A',s:-1.5,mode:'NORMAL',stance:'STAND',yaw:0};pose=surfacePose(-1,33);
   if(!this.physics.restoreShape('STAND',c.foot,pose.rotation,'A',0))throw new Error('Recovery spawn is blocked');
  }
  this.state.worldId=c.slot;this.state.stance=c.stance;this.state.velocity.set(0,0,0);this.state.yaw=c.yaw;this.stanceIntent=c.stance;
  this.applyContact(c.foot,c.s,c.mode!=='NORMAL');this.physics.setPose(this.state.position,this.state.bodyRotation);
  this.missingSupport=0;this.fallVelocity.set(0,0,0);this.state.locomotion='RECOVER';
 }
 restart(){this.checkpoint={foot:new Vector3(0,0,33),slot:'A',s:-1.5,mode:'NORMAL',stance:'STAND',yaw:0};this.state.yaw=0;this.state.pitch=0;this.state.terminal=false;this.state.returned=false;this.reset();}
 /** Explicitly test-gated in the browser adapter. */
 place(foot:Vector3,slot:WorldId,s?:number){this.state.velocity.set(0,0,0);this.coyote=0;this.previousCrouch=false;this.state.worldId=slot;this.transfer.reset();this.airborne=false;this.airTime=0;this.jumpBuffer=0;this.previousJump=false;this.gravityResolver.reset();this.applyContact(foot,s??foot.x-1.5,s!==undefined);this.physics.moveOriented(this.state.position,new Vector3(),this.state.bodyRotation,this.state.up,slot);this.state.grounded=false;this.fallVelocity.set(0,0,0);}
 get thetaDegrees(){return this.state.theta*180/Math.PI;}
 get progress(){return this.state.returned?'RETURNED':this.state.terminal?'RETURN_TO_VESTIBULE':this.state.mode==='WALL'?'WALL_WALK':this.state.mode==='ARC'?'GRAVITY_TURN':this.state.worldId==='B'?'INVERT':'ARRIVAL';}
}
