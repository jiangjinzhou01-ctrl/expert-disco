import RAPIER from '@dimforge/rapier3d-compat';
import {Quaternion,Vector3} from 'three';
import data from '../assets/architecture.generated.json';
import atelier from '../world/atelier-layout.json';
import type {Portal} from '../../engine/portal/PortalTypes';
import type {WorldId} from '../../scenes/RoomLayout';
import {WorldRegistry} from '../world/WorldRegistry';
import {SKIN} from './GravitySurface';
import { STANCES, stanceLocalRotation, type Stance } from './Locomotion';
export interface Meta {id:string;worldId:WorldId;walkable?:boolean;glass?:boolean;}
export class ChapterPhysics {
 world:RAPIER.World;body:RAPIER.RigidBody;collider:RAPIER.Collider;character:RAPIER.KinematicCharacterController;
 readonly metadata=new Map<number,Meta>();shape=new RAPIER.Capsule(.57,.3);sweepShape=new RAPIER.Capsule(.57,.302);
 stance:Stance='STAND';private heading=0;
 private readonly floorBoxes:{handle:number;slot:WorldId;top:number}[]=[];
 private localRotation=new Quaternion();private currentRotation=new Quaternion();
 get centerOffset(){return STANCES[this.stance].offset;}
 get eyeHeight(){return STANCES[this.stance].eye;}
 shapeRotation(rotation:Quaternion){return rotation.clone().multiply(this.localRotation);}
 collisionShape=()=>({shape:this.sweepShape,rotation:this.shapeRotation(this.currentRotation),halfSegment:STANCES[this.stance].halfSegment,radius:STANCES[this.stance].radius});
 setTransferRotation=(rotation:Quaternion)=>{this.localRotation.copy(this.currentRotation).invert().multiply(rotation);this.collider.setRotationWrtParent(this.localRotation);};
 readonly witness:RAPIER.RigidBody;readonly witnessCollider:RAPIER.Collider;rotationQueries=0;translationQueries=0;supportQueries=0;lastBlocked:string|null=null;witnessResets=0;
 private queryWorld:WorldId='A';private excluded=new Set<number>();
 restoreShape(stance:Stance,foot:Vector3,rotation:Quaternion,slot:WorldId,yaw:number):boolean{
  this.prepare(slot);const b=STANCES[stance],local=stanceLocalRotation(stance,yaw),q=rotation.clone().multiply(local),shape=new RAPIER.Capsule(b.halfSegment,b.radius);
  const center=foot.clone().addScaledVector(new Vector3(0,1,0).applyQuaternion(rotation),b.offset+SKIN);
  const allowed=this.safeFloorContacts(center,q,b.halfSegment,b.radius);
  if(this.world.intersectionWithShape(center,q,shape,undefined,undefined,this.collider,this.body,c=>this.filter(c)&&!allowed.has(c.handle)))return false;
  this.stance=stance;this.heading=yaw;this.shape=shape;this.sweepShape=new RAPIER.Capsule(b.halfSegment,b.radius+.002);this.localRotation.copy(local);this.collider.setShape(shape);this.setPose(center,rotation);return true;
 }
 private filter=(c:RAPIER.Collider)=>c.handle!==this.collider.handle&&this.metadata.get(c.handle)?.worldId===this.queryWorld&&!this.excluded.has(c.handle);
 private safeFloorContacts(position:Vector3,rotation:Quaternion,halfSegment:number,radius:number){
  const bottom=position.y-radius-halfSegment*Math.abs(new Vector3(0,1,0).applyQuaternion(rotation).y),allowed=new Set<number>();
  // Large cuboid/capsule GJK queries can report near contacts as intersections.
  // Exclude only boxes for which the exact capsule AABB is above the top face;
  // never exempt a floor when the shape actually extends below it.
  for(const b of this.floorBoxes){if(b.slot===this.queryWorld&&this.metadata.has(b.handle)&&bottom>=b.top+.002)allowed.add(b.handle);
  }return allowed;
 }
 private constructor(readonly registry:WorldRegistry){
  // Gravity is explicit per body: the character's support field never changes the witness or other worlds.
  this.world=new RAPIER.World({x:0,y:0,z:0});this.world.timestep=1/60;
  for(const b of [...data.boxes,...atelier.props.map(p=>({...p,walkable:true,glass:false}))]){const worldId:WorldId=b.world==='VESTIBULE'?'A':'B';const off=registry.get(worldId).offset;const c=this.world.createCollider(RAPIER.ColliderDesc.cuboid(b.size[0]/2,b.size[1]/2,b.size[2]/2).setTranslation(b.center[0]+off.x,b.center[1],b.center[2]));this.metadata.set(c.handle,{id:b.id,worldId,walkable:b.walkable,glass:b.glass});if(b.walkable)this.floorBoxes.push({handle:c.handle,slot:worldId,top:b.center[1]+b.size[1]/2});}
  const v=new Float32Array(data.supportVolume.vertices.flat());for(let i=0;i<v.length;i+=3)v[i]+=100;
  const support=this.world.createCollider(RAPIER.ColliderDesc.trimesh(v,new Uint32Array(data.supportVolume.indices)));this.metadata.set(support.handle,{id:'INVERT-CONTINUOUS-SUPPORT',worldId:'B',walkable:true});
  const terminal=this.world.createCollider(RAPIER.ColliderDesc.cuboid(.22,.22,.22).setTranslation(104.5,5.1,-16.5));this.metadata.set(terminal.handle,{id:'INVERT_TERMINAL',worldId:'B'});
  const observatory=this.world.createCollider(RAPIER.ColliderDesc.cuboid(.25,.55,.25).setTranslation(1.62,.95,24));this.metadata.set(observatory.handle,{id:'ORBITAL-OBSERVATION-DEVICE',worldId:'A'});
  this.body=this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0,.87+SKIN,33));
  this.collider=this.world.createCollider(RAPIER.ColliderDesc.capsule(.57,.3),this.body);
  this.character=this.world.createCharacterController(.002);this.character.setSlideEnabled(true);this.character.enableAutostep(.25,.35,true);this.character.setApplyImpulsesToDynamicBodies(false);this.character.setMaxSlopeClimbAngle(Math.PI/3);this.character.setMinSlopeSlideAngle(Math.PI/2);
  this.witness=this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(106.8,4.2,.6).setCanSleep(false));
  this.witnessCollider=this.world.createCollider(RAPIER.ColliderDesc.cuboid(.25,.25,.25).setDensity(1).setRestitution(.24).setFriction(.55),this.witness);
  this.metadata.set(this.witnessCollider.handle,{id:'DYNAMIC_WITNESS',worldId:'B'});this.world.step();
 }
 static async create(registry=new WorldRegistry()){await RAPIER.init();return new ChapterPhysics(registry);}
 addSupportVolume(id:string,slot:WorldId,vertices:Float32Array,indices:Uint32Array){
  const transformed=vertices.slice(),offset=this.registry.get(slot).offset;
  for(let i=0;i<transformed.length;i+=3){transformed[i]+=offset.x;transformed[i+1]+=offset.y;transformed[i+2]+=offset.z;}
  const c=this.world.createCollider(RAPIER.ColliderDesc.trimesh(transformed,indices));
  this.metadata.set(c.handle,{id,worldId:slot,walkable:true});this.world.propagateModifiedBodyPositionsToColliders();return c;
 }
 setPose(position:Vector3,rotation:Quaternion){this.currentRotation.copy(rotation);this.body.setTranslation(position,true);this.body.setRotation(rotation,true);this.body.setNextKinematicTranslation(position);this.body.setNextKinematicRotation(rotation);this.collider.setRotationWrtParent(this.localRotation);this.world.propagateModifiedBodyPositionsToColliders();}
 /** Morph the real shape with the lowest support point anchored at the foot. Every
  * intermediate orientation/size is checked before changing the live collider. */
 tryStance(stance:Stance,foot:Vector3,rotation:Quaternion,up:Vector3,slot:WorldId):boolean{
  if(stance===this.stance)return true;this.prepare(slot);
  const a=STANCES[this.stance],b=STANCES[stance],target=stanceLocalRotation(stance,this.heading);
  // A 12mm collision-checked lift gives the inflated rotational sweep room above
  // its supporting surface; lower the final real capsule only after the morph.
  const lift=up.clone().multiplyScalar(.012),start=foot.clone().addScaledVector(up,a.offset+SKIN),end=foot.clone().addScaledVector(up,b.offset+SKIN);
  const startQ=this.shapeRotation(rotation),endQ=rotation.clone().multiply(target);
  const finalAllowed=this.safeFloorContacts(end,endQ,b.halfSegment,b.radius);
  const finalFilter=(c:RAPIER.Collider)=>this.filter(c)&&!finalAllowed.has(c.handle);
  const finalHit=this.world.intersectionWithShape(end,endQ,new RAPIER.Capsule(b.halfSegment,b.radius),undefined,undefined,this.collider,this.body,finalFilter);
  if(finalHit){this.lastBlocked=`stance-clearance:${this.metadata.get(finalHit.handle)?.id??'obstacle'}`;return false;}
  const upHit=this.world.castShape(start,startQ,lift,this.shape,0,1,false,undefined,undefined,this.collider,this.body,this.filter);
  if(upHit&&upHit.time_of_impact<.999){this.lastBlocked='stance-lift-blocked';return false;}
  const sections=Math.max(48,Math.ceil(this.localRotation.angleTo(target)/.002),Math.ceil(Math.abs(a.halfSegment-b.halfSegment)/.001),Math.ceil(Math.abs(a.radius-b.radius)/.001));
  for(let i=1;i<=sections;i++){
   const t=i/sections,h=a.halfSegment+(b.halfSegment-a.halfSegment)*t,r=a.radius+(b.radius-a.radius)*t;
   const q=this.localRotation.clone().slerp(target,t).premultiply(rotation);
   const axis=new Vector3(0,1,0).applyQuaternion(q);
   const offset=r+h*Math.abs(axis.dot(up));
   const center=foot.clone().addScaledVector(up,offset+SKIN).add(lift);
   const allowed=this.safeFloorContacts(center,q,h,r);
   // <=2mrad rotation and <=1mm shape changes bound intermediate point motion
   // by <6mm. Inflation therefore covers the continuum between samples.
   const hit=this.world.intersectionWithShape(center,q,new RAPIER.Capsule(h,r+.006),undefined,undefined,this.collider,this.body,c=>this.filter(c)&&!allowed.has(c.handle));
   if(hit){this.lastBlocked=`stance-clearance:${this.metadata.get(hit.handle)?.id??'obstacle'}`;return false;}
  }
  const downHit=this.world.castShape(end.clone().add(lift),endQ,lift.clone().negate(),new RAPIER.Capsule(b.halfSegment,b.radius),0,1,true,undefined,undefined,this.collider,this.body,finalFilter);
  if(downHit&&downHit.time_of_impact<.999){this.lastBlocked='stance-settle-blocked';return false;}
  this.stance=stance;this.shape=new RAPIER.Capsule(b.halfSegment,b.radius);this.sweepShape=new RAPIER.Capsule(b.halfSegment,b.radius+.002);
  this.localRotation.copy(target);this.collider.setShape(this.shape);
  this.setPose(foot.clone().addScaledVector(up,b.offset+SKIN),rotation);this.lastBlocked=null;return true;
 }
 tryHeading(yaw:number,position:Vector3,rotation:Quaternion,slot:WorldId):boolean{
  if(this.stance!=='PRONE'){this.heading=yaw;return true;}
  this.prepare(slot);const next=stanceLocalRotation(this.stance,yaw),n=Math.max(1,Math.ceil(this.localRotation.angleTo(next)/.0034));
  for(let i=1;i<=n;i++){
   const q=this.localRotation.clone().slerp(next,i/n).premultiply(rotation);
   const b=STANCES[this.stance],allowed=this.safeFloorContacts(position,q,b.halfSegment,b.radius);
   if(this.world.intersectionWithShape(position,q,this.sweepShape,undefined,undefined,this.collider,this.body,c=>this.filter(c)&&!allowed.has(c.handle)))return false;
  }
  this.heading=yaw;this.localRotation.copy(next);this.collider.setRotationWrtParent(next);return true;
 }
 private prepare(slot:WorldId,portal?:Portal){this.queryWorld=slot;this.excluded.clear();if(!portal)return;const n=new Vector3(0,0,1).applyQuaternion(portal.rotation);for(const [h,m]of this.metadata){if(m.worldId!==slot)continue;const c=this.world.getCollider(h);const half=c.halfExtents();if(!half)continue;const p=c.translation();if(new Vector3(p.x,p.y,p.z).sub(portal.position).dot(n)+Math.abs(n.x)*half.x+Math.abs(n.y)*half.y+Math.abs(n.z)*half.z<-.000001)this.excluded.add(h);}}
 constrainMovement(position:Vector3,delta:Vector3,worldId:WorldId,sourceClipPortal?:Portal){this.prepare(worldId,sourceClipPortal);this.setPose(position,this.currentRotation);this.character.setUp(new Vector3(0,1,0).applyQuaternion(this.currentRotation));this.character.computeColliderMovement(this.collider,delta,undefined,undefined,this.filter);const m=this.character.computedMovement();return {displacement:new Vector3(m.x,m.y,m.z),grounded:this.character.computedGrounded()};}
 allowsExitContact(c:RAPIER.Collider,position:Vector3){if(!this.metadata.get(c.handle)?.walkable)return false;const half=c.halfExtents();if(!half)return false;const top=c.translation().y+half.y;const axis=new Vector3(0,1,0).applyQuaternion(this.shapeRotation(this.currentRotation));const profile=STANCES[this.stance];return position.y-profile.radius-profile.halfSegment*Math.abs(axis.y)>=top-.0001;}
 moveOriented(position:Vector3,delta:Vector3,rotation:Quaternion,up:Vector3,slot:WorldId){this.prepare(slot);this.setPose(position,rotation);this.character.setUp(up);this.character.computeColliderMovement(this.collider,delta,undefined,undefined,this.filter);const m=this.character.computedMovement();const normals:Vector3[]=[];for(let i=0;i<this.character.numComputedCollisions();i++){const c=this.character.computedCollision(i);if(c)normals.push(new Vector3(c.normal1.x,c.normal1.y,c.normal1.z));}return {displacement:new Vector3(m.x,m.y,m.z),grounded:this.character.computedGrounded(),normals};}
 support(foot:Vector3,up:Vector3,slot:WorldId){this.queryWorld=slot;this.supportQueries++;const hit=this.world.castRayAndGetNormal(new RAPIER.Ray(foot.clone().addScaledVector(up,.12),up.clone().negate()),.28,true,undefined,undefined,this.collider,this.body,c=>this.metadata.get(c.handle)?.worldId===slot&&this.metadata.get(c.handle)?.walkable===true);return hit&&Math.abs(hit.timeOfImpact-.12)<.018?hit:null;}
 /** Conservative rotational sweep: substeps <= 0.01m and inflated full capsules bound intermediate rotations. */
 canMove(from:Vector3,oldRotation:Quaternion,to:Vector3,rotation:Quaternion,up:Vector3,slot:WorldId){
  this.prepare(slot);const delta=to.clone().sub(from);
  // A capsule is a segment swept by a sphere. At <= .0034rad, its .57m half-segment
  // deviates by <=1.938mm; the 2mm inflation bounds every intermediate rotation.
  const oldShapeRotation=this.shapeRotation(oldRotation),newShapeRotation=this.shapeRotation(rotation);
  const sections=Math.max(1,Math.ceil(oldShapeRotation.angleTo(newShapeRotation)/.0034),Math.ceil(delta.length()/.01001));
  const previous=from.clone(),current=from.clone(),q=oldShapeRotation.clone(),next=q.clone();
  for(let i=1;i<=sections;i++){
   current.lerpVectors(from,to,i/sections);next.slerpQuaternions(oldShapeRotation,newShapeRotation,i/sections);const movement=current.clone().sub(previous);
   this.rotationQueries++;this.translationQueries++;
   const hit=this.world.castShape(previous,q,movement,this.sweepShape,0,1,true,undefined,undefined,this.collider,this.body,this.filter);
   if(hit&&hit.time_of_impact<.999){this.lastBlocked=this.metadata.get(hit.collider.handle)?.id??'shape-sweep';return false;}
   const overlap=this.world.intersectionWithShape(current,next,this.sweepShape,undefined,undefined,this.collider,this.body,this.filter);
   if(overlap){this.lastBlocked=this.metadata.get(overlap.handle)?.id??'rotation-overlap';return false;}
   previous.copy(current);q.copy(next);
  }
  this.setPose(from,rotation);this.character.setUp(up);this.character.computeColliderMovement(this.collider,delta,undefined,undefined,this.filter);const d=this.character.computedMovement();
  if(new Vector3(d.x,d.y,d.z).distanceTo(delta)>.003){this.lastBlocked='character-contact';return false;}
  this.lastBlocked=null;return true;
 }
 commit(position:Vector3,rotation:Quaternion,dt:number){this.body.setTranslation(position,true);this.body.setNextKinematicTranslation(position);this.body.setRotation(rotation,true);this.body.setNextKinematicRotation(rotation);this.body.setLinvel({x:0,y:0,z:0},true);this.world.timestep=dt;
  this.witness.resetForces(true);this.witness.addForce({x:this.witness.mass()*9.81,y:0,z:0},true);this.world.step();
 }
 resetWitness(){this.witness.setTranslation({x:106.8,y:4.2,z:.6},true);this.witness.setLinvel({x:0,y:0,z:0},true);this.witness.setAngvel({x:0,y:0,z:0},true);this.witnessResets++;}
 dispose(){this.world.free();}
}
