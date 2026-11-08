import { Euler, Vector3 } from 'three';
import type { ChapterState } from './ChapterController';
import type { ChapterPhysics } from './ChapterPhysics';
import type { RingChart, ChartPose } from './SurfaceCharts';
import { SKIN } from './GravitySurface';

/** Collision-constrained movement over any registered ribbon. This module never
 * steps the physics world or publishes a portal/world transfer. */
export class SurfaceWalker {
  private contact: { chart: RingChart; s: number; lateral: number } | null = null;
  constructor(private readonly physics: ChapterPhysics, readonly charts: readonly RingChart[]) {}
  get active() { return this.contact !== null; }
  get snapshot() { const c=this.contact;return c?{id:c.chart.id,s:c.s,lateral:c.lateral}:null; }
  detach(): void { this.contact=null; }
  private commit(st:ChapterState,pose:ChartPose,s:number,lateral:number,first=false){
    if(first){
      const local=pose.rotation.clone().invert().multiply(st.rotation);
      const euler=new Euler().setFromQuaternion(local,'YXZ');st.yaw=euler.y;st.pitch=euler.x;
    }
    st.foot.copy(pose.foot);st.up.copy(pose.up);st.bodyRotation.copy(pose.rotation);
    st.supportNormal.copy(pose.up);st.grounded=true;st.mode='ARC';st.locomotion='GROUND_WALK';
    st.position.copy(this.physics.registry.global(pose.foot,st.worldId)).addScaledVector(pose.up,this.physics.centerOffset+SKIN);
    this.contact!.s=s;this.contact!.lateral=lateral;
  }
  tryAttach(st:ChapterState):boolean{
    if(this.contact)return true;
    for(const chart of this.charts){
      if(chart.slot!==st.worldId)continue;
      const c=chart.project(st.foot);if(c.distance>.015||Math.abs(c.lateral)>chart.width/2-.31)continue;
      const pose=chart.sample(c.s,c.lateral);if(pose.up.dot(st.up)<.98)continue;
      const support=this.physics.support(this.physics.registry.global(pose.foot,st.worldId),pose.up,st.worldId);
      if(!support||new Vector3(support.normal.x,support.normal.y,support.normal.z).dot(pose.up)<.98)continue;
      const center=this.physics.registry.global(pose.foot,st.worldId).addScaledVector(pose.up,this.physics.centerOffset+SKIN);
      if(!this.physics.canMove(st.position,st.bodyRotation,center,pose.rotation,pose.up,st.worldId))continue;
      this.contact={chart,s:c.s,lateral:c.lateral};this.commit(st,pose,c.s,c.lateral,true);return true;
    }
    return false;
  }
  step(st:ChapterState,dt:number,move:Vector3):boolean{
    const c=this.contact;if(!c)return false;
    const parts=Math.max(1,Math.ceil(move.length()*dt/.009));
    const tryMove=(ds:number,dl:number)=>{
      const s=c.s+ds,lateral=c.lateral+dl,pose=c.chart.sample(s,lateral);
      const center=this.physics.registry.global(pose.foot,st.worldId).addScaledVector(pose.up,this.physics.centerOffset+SKIN);
      const hit=this.physics.support(this.physics.registry.global(pose.foot,st.worldId),pose.up,st.worldId);
      if(!hit||new Vector3(hit.normal.x,hit.normal.y,hit.normal.z).dot(pose.up)<.98)return false;
      if(!this.physics.canMove(st.position,st.bodyRotation,center,pose.rotation,pose.up,st.worldId))return false;
      this.commit(st,pose,s,lateral);return true;
    };
    for(let i=0;i<parts;i++){
      const pose=c.chart.sample(c.s,c.lateral),ds=move.dot(pose.tangent)*dt/parts,dl=move.dot(pose.lateral)*dt/parts;
      if(!tryMove(ds,dl)){if(Math.abs(ds)>1e-10)tryMove(ds,0);if(Math.abs(dl)>1e-10)tryMove(0,dl);}
    }
    return true;
  }
  /** Airborne gravity follows the authored field orientation. It never edits
   * position or linear velocity, and does not claim a supporting contact. */
  airborneGravity(st:ChapterState):Vector3|null{
    if(!this.contact)return null;
    const p=this.contact.chart.project(st.foot,this.contact.s);
    return this.contact.chart.sample(p.s,p.lateral).up.multiplyScalar(-9.81);
  }
}
