import { Quaternion, Vector3 } from 'three';
export type WorldId = 'A' | 'B';
export interface BoxSpec { id:string; worldId:WorldId; center:[number,number,number]; size:[number,number,number]; color:string; }
export const PLAYER_RADIUS=.30;
export const PLAYER_HEIGHT=1.74;
export const PLAYER_HALF_HEIGHT=PLAYER_HEIGHT/2;
export const PLAYER_EYE_HEIGHT=1.55;
export const PORTAL_WIDTH=2.4;
export const PORTAL_HEIGHT=2.9;
export const portalA={id:'A-door',worldId:'A',position:new Vector3(0,1.45,-8),rotation:new Quaternion(),width:PORTAL_WIDTH,height:PORTAL_HEIGHT};
export const portalB={id:'B-door',worldId:'B',position:new Vector3(32,1.45,0),rotation:new Quaternion().setFromAxisAngle(new Vector3(0,1,0),Math.PI/2),width:PORTAL_WIDTH,height:PORTAL_HEIGHT};
export const portals=[portalA,portalB];
export function roomBoxes(worldId:WorldId):BoxSpec[]{
 const warm=worldId==='B'; const yaw=warm?Math.PI/2:0;
 const color=warm?'#bba687':'#7c8c97';
 const local:Array<[string,[number,number,number],[number,number,number],string]>=[
 ['floor',[0,-.15,0],[17,.3,17],warm?'#9c896e':'#52616a'],
 ['left',[-8,3,0],[.4,6,16.4],color],['right',[8,3,0],[.4,6,16.4],color],['back',[0,3,8],[16.4,6,.4],color],
 ['door-left',[-4.65,3,-8],[6.7,6,.4],color],['door-right',[4.65,3,-8],[6.7,6,.4],color],['lintel',[0,4.5,-8],[2.6,3,.4],color],
 ['frame-left',[-1.3,1.5,-8],[.2,3,.55],warm?'#4b372a':'#283e49'],['frame-right',[1.3,1.5,-8],[.2,3,.55],warm?'#4b372a':'#283e49'],['frame-top',[0,3,-8],[2.8,.2,.55],warm?'#4b372a':'#283e49'],
 warm?['pillar',[2,1.3,-3],[.65,2.6,1.1],'#22211e']:['red-cube',[-3,.6,-3],[1.2,1.2,1.2],'#d84937']
 ];
 return local.map(([id,c,s,col])=>{const p=new Vector3(...c).applyAxisAngle(new Vector3(0,1,0),yaw);if(warm)p.x+=40;return {id:`${worldId}-${id}`,worldId,center:p.toArray() as [number,number,number],size:(warm?[s[2],s[1],s[0]]:s) as [number,number,number],color:col};});
}
export const markers=[{id:'near-red',position:[33,1.9,-.6] as [number,number,number],color:0xff0000},{id:'green',position:[38,1.55,1.5] as [number,number,number],color:0x00ff44},{id:'magenta',position:[39,2.2,-1] as [number,number,number],color:0xff00dd},{id:'cyan',position:[41,.8,0] as [number,number,number],color:0x00ddff}];
