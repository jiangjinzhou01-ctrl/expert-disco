import RAPIER from '@dimforge/rapier3d-compat';
import {Quaternion,Vector3} from 'three';
import data from '../assets/architecture.generated.json';
import type {Portal} from '../../engine/portal/PortalTypes';
import type {WorldId} from '../../scenes/RoomLayout';
import {WorldRegistry} from '../world/WorldRegistry';
import {SKIN} from './GravitySurface';
export interface Meta {id:string;worldId:WorldId;walkable?:boolean;glass?:boolean;}
export class ChapterPhysics {
 world:RAPIER.World;body:RAPIER.RigidBody;collider:RAPIER.Collider;character:RAPIER.KinematicCharacterController;
 readonly metadata=new Map<number,Meta>();readonly shape=new RAPIER.Capsule(.57,.3);readonly sweepShape=new RAPIER.Capsule(.57,.302);
 readonly witness:RAPIER.RigidBody;readonly witnessCollider:RAPIER.Collider;rotationQueries=0;translationQueries=0;supportQueries=0;lastBlocked:string|null=null;witnessResets=0;
 private queryWorld:WorldId='A';private excluded=new Set<number>();private readonly identity=new Quaternion();
 private filter=(c:RAPIER.Collider)=>c.handle!==this.collider.handle&&this.metadata.get(c.handle)?.worldId===this.queryWorld&&!this.excluded.has(c.handle);
 private constructor(readonly registry:WorldRegistry){
  // Gravity is explicit per body: the character's support field never changes the witness or other worlds.
  this.world=new RAPIER.World({x:0,y:0,z:0});this.world.timestep=1/60;
  for(const b of data.boxes){const worldId:WorldId=b.world==='VESTIBULE'?'A':'B';const off=registry.get(worldId).offset;const c=this.world.createCollider(RAPIER.ColliderDesc.cuboid(b.size[0]/2,b.size[1]/2,b.size[2]/2).setTranslation(b.center[0]+off.x,b.center[1],b.center[2]));this.metadata.set(c.handle,{id:b.id,worldId,walkable:b.walkable,glass:b.glass});}
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
 setPose(position:Vector3,rotation:Quaternion){this.body.setTranslation(position,true);this.body.setRotation(rotation,true);this.body.setNextKinematicTranslation(position);this.body.setNextKinematicRotation(rotation);this.world.propagateModifiedBodyPositionsToColliders();}
 private prepare(slot:WorldId,portal?:Portal){this.queryWorld=slot;this.excluded.clear();if(!portal)return;const n=new Vector3(0,0,1).applyQuaternion(portal.rotation);for(const [h,m]of this.metadata){if(m.worldId!==slot)continue;const c=this.world.getCollider(h);const half=c.halfExtents();if(!half)continue;const p=c.translation();if(new Vector3(p.x,p.y,p.z).sub(portal.position).dot(n)+Math.abs(n.x)*half.x+Math.abs(n.y)*half.y+Math.abs(n.z)*half.z<-.000001)this.excluded.add(h);}}
 constrainMovement(position:Vector3,delta:Vector3,worldId:WorldId,sourceClipPortal?:Portal){this.prepare(worldId,sourceClipPortal);this.setPose(position,this.identity);this.character.setUp({x:0,y:1,z:0});this.character.computeColliderMovement(this.collider,delta,undefined,undefined,this.filter);const m=this.character.computedMovement();return {displacement:new Vector3(m.x,m.y,m.z),grounded:this.character.computedGrounded()};}
 allowsExitContact(c:RAPIER.Collider,position:Vector3){if(!this.metadata.get(c.handle)?.walkable)return false;const half=c.halfExtents();if(!half)return false;const top=c.translation().y+half.y;return position.y-.87>=top-.0001;}
 moveOriented(position:Vector3,delta:Vector3,rotation:Quaternion,up:Vector3,slot:WorldId){this.prepare(slot);this.setPose(position,rotation);this.character.setUp(up);this.character.computeColliderMovement(this.collider,delta,undefined,undefined,this.filter);const m=this.character.computedMovement();return {displacement:new Vector3(m.x,m.y,m.z),grounded:this.character.computedGrounded()};}
 support(foot:Vector3,up:Vector3,slot:WorldId){this.queryWorld=slot;this.supportQueries++;const hit=this.world.castRayAndGetNormal(new RAPIER.Ray(foot.clone().addScaledVector(up,.12),up.clone().negate()),.28,true,undefined,undefined,this.collider,this.body,c=>this.metadata.get(c.handle)?.worldId===slot&&this.metadata.get(c.handle)?.walkable===true);return hit&&Math.abs(hit.timeOfImpact-.12)<.018?hit:null;}
 /** Conservative rotational sweep: substeps <= 0.01m and inflated full capsules bound intermediate rotations. */
 canMove(from:Vector3,oldRotation:Quaternion,to:Vector3,rotation:Quaternion,up:Vector3,slot:WorldId){
  this.prepare(slot);const delta=to.clone().sub(from);
  // A capsule is a segment swept by a sphere. At <= .0034rad, its .57m half-segment
  // deviates by <=1.938mm; the 2mm inflation bounds every intermediate rotation.
  const sections=Math.max(1,Math.ceil(oldRotation.angleTo(rotation)/.0034),Math.ceil(delta.length()/.01001));
  const previous=from.clone(),current=from.clone(),q=oldRotation.clone(),next=q.clone();
  for(let i=1;i<=sections;i++){
   current.lerpVectors(from,to,i/sections);next.slerpQuaternions(oldRotation,rotation,i/sections);const movement=current.clone().sub(previous);
   this.rotationQueries++;this.translationQueries++;this.setPose(previous,q);
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
