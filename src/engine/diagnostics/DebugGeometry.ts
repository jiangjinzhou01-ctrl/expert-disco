import { BoxGeometry,CapsuleGeometry,Group,Mesh,MeshBasicMaterial,SphereGeometry } from 'three';
import type { RoomScene } from '../portal/PortalGeometry';
import { PLAYER_RADIUS,PLAYER_HEIGHT,roomBoxes,type WorldId } from '../../scenes/RoomLayout';
import type { PlayerState } from '../player/PlayerState';
import type { TransferEvent } from '../portal/PortalTransfer';
/** Visual observation only, enabled through the development diagnostics toggle. */
export class DebugGeometry {
 private groups:Group[]=[];private capsules:Mesh[]=[];private points:Mesh[]=[];
 private box=new BoxGeometry();private capsule=new CapsuleGeometry(PLAYER_RADIUS,PLAYER_HEIGHT-2*PLAYER_RADIUS,4,8);private sphere=new SphereGeometry(.065,8,8);
 private material=new MeshBasicMaterial({color:0x55ffee,wireframe:true,depthTest:false});private pointMaterial=new MeshBasicMaterial({color:0xffbb22,depthTest:false});
 constructor(rooms:Record<WorldId,RoomScene>){for(const world of ['A','B'] as const){const g=new Group();g.visible=false;g.renderOrder=20;for(const spec of roomBoxes(world)){const m=new Mesh(this.box,this.material);m.position.set(...spec.center);m.scale.set(...spec.size);g.add(m);}const p=rooms[world].portal;const plane=new Mesh(this.box,this.material);plane.position.copy(p.position);plane.quaternion.copy(p.rotation);plane.scale.set(p.width,p.height,.01);g.add(plane);const capsule=new Mesh(this.capsule,this.material);g.add(capsule);const point=new Mesh(this.sphere,this.pointMaterial);point.visible=false;g.add(point);this.capsules.push(capsule);this.points.push(point);this.groups.push(g);rooms[world].scene.add(g);}}
 setVisible(visible:boolean){for(const g of this.groups)g.visible=visible;}
 update(state:PlayerState,events:TransferEvent[]){for(let i=0;i<2;i++){this.capsules[i].visible=state.worldId===(i===0?'A':'B');this.capsules[i].position.copy(state.position);}const event=events.at(-1);if(event){const source=event.sourceWorldId==='A'?0:1;const dest=1-source;this.points[source].position.fromArray(event.sourcePosition);this.points[dest].position.fromArray(event.destinationPosition);this.points[source].visible=true;this.points[dest].visible=true;}}
 dispose(){for(const group of this.groups)group.removeFromParent();this.box.dispose();this.capsule.dispose();this.sphere.dispose();this.material.dispose();this.pointMaterial.dispose();}
}
