import {Quaternion,Vector3} from 'three';
export const RADIUS=3.2,ARC_LENGTH=RADIUS*Math.PI/2,CENTER_HEIGHT=.87,EYE_HEIGHT=1.55,SKIN=.006;
export interface SurfacePose {foot:Vector3;center:Vector3;eye:Vector3;up:Vector3;tangent:Vector3;rotation:Quaternion;gravity:Vector3;theta:number;mode:'NORMAL'|'ARC'|'WALL';}
/** A two-dimensional support chart, never a route or an animation clock. s and z are independently input-driven. */
export function surfacePose(s:number,z:number):SurfacePose{
 if(!Number.isFinite(s+z))throw new RangeError('Non-finite support coordinates');
 const theta=Math.max(0,Math.min(Math.PI/2,s/RADIUS));const up=new Vector3(-Math.sin(theta),Math.cos(theta),0);const tangent=new Vector3(Math.cos(theta),Math.sin(theta),0);
 const foot=s<0?new Vector3(1.5+s,0,z):s<=ARC_LENGTH?new Vector3(1.5+RADIUS*Math.sin(theta),RADIUS*(1-Math.cos(theta)),z):new Vector3(4.7,3.2+s-ARC_LENGTH,z);
 return {foot,center:foot.clone().addScaledVector(up,CENTER_HEIGHT),eye:foot.clone().addScaledVector(up,EYE_HEIGHT),up,tangent,rotation:new Quaternion().setFromAxisAngle(new Vector3(0,0,1),theta),gravity:up.clone().multiplyScalar(-9.81),theta,mode:s<=0?'NORMAL':s<ARC_LENGTH?'ARC':'WALL'};
}
export function chartFromCenter(center:Vector3,wall:boolean):number{
 if(wall&&center.y>=3.2)return ARC_LENGTH+center.y-3.2;
 return RADIUS*Math.atan2(center.x-1.5,3.2-center.y);
}
