import {BoxGeometry,BufferGeometry,CapsuleGeometry,EdgesGeometry,Float32BufferAttribute,Group,LineBasicMaterial,LineSegments,Mesh,MeshBasicMaterial} from 'three';
import data from '../assets/architecture.generated.json';
import type {ChapterController} from '../physics/ChapterController';
import type {WorldId} from '../../scenes/RoomLayout';
import type {SceneAsset} from '../assets/ChapterScenes';
/** Development-only observer: never writes a character or physics property. */
export class ChapterDebugGeometry {
 private readonly groups:Record<WorldId,Group>={A:new Group(),B:new Group()};
 private readonly capsule=new Mesh(new CapsuleGeometry(.3,1.14,4,8),new MeshBasicMaterial({color:0xffcc66,wireframe:true,transparent:true,opacity:.8}));
 constructor(scenes:Record<WorldId,SceneAsset>){
  for(const slot of ['A','B'] as const){this.groups[slot].visible=false;scenes[slot].scene.add(this.groups[slot]);}
  for(const box of data.boxes){const slot:WorldId=box.world==='VESTIBULE'?'A':'B';const source=new BoxGeometry(...box.size as [number,number,number]);const edges=new EdgesGeometry(source);source.dispose();const line=new LineSegments(edges,new LineBasicMaterial({color:box.glass?0x55ccff:box.walkable?0x66ffaa:0xff9977,transparent:true,opacity:.5}));line.position.set(box.center[0]+(slot==='B'?100:0),box.center[1],box.center[2]);this.groups[slot].add(line);}
  const support=new BufferGeometry();support.setAttribute('position',new Float32BufferAttribute(data.supportVolume.vertices.flat(),3));support.setIndex(data.supportVolume.indices);const line=new LineSegments(new EdgesGeometry(support),new LineBasicMaterial({color:0x66ffaa,transparent:true,opacity:.8}));support.dispose();line.position.x=100;this.groups.B.add(line);
  this.capsule.name='DEBUG-ACTUAL-CAPSULE';
 }
 get enabled(){return this.groups.A.visible;}
 set enabled(value:boolean){for(const g of Object.values(this.groups))g.visible=value;}
 update(controller:ChapterController){const s=controller.state;this.groups[s.worldId].add(this.capsule);this.capsule.position.copy(s.position);this.capsule.quaternion.copy(s.bodyRotation);}
 dispose(){for(const g of Object.values(this.groups)){g.traverse(o=>{if(o instanceof Mesh||o instanceof LineSegments){o.geometry.dispose();for(const material of Array.isArray(o.material)?o.material:[o.material])material.dispose();}});g.removeFromParent();}this.capsule.geometry.dispose();(this.capsule.material as MeshBasicMaterial).dispose();}
}
