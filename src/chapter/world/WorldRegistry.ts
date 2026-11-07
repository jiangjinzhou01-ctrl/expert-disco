import {Matrix4,Quaternion,Vector3} from 'three';
import {PortalRegistry} from '../../engine/portal/PortalRegistry';
import type {WorldId} from '../../scenes/RoomLayout';
export interface ChapterWorld {slot:WorldId;id:'VESTIBULE'|'INVERT';root:Matrix4;offset:Vector3;}
export class WorldRegistry {
 readonly worlds:ChapterWorld[]=[{slot:'A',id:'VESTIBULE',root:new Matrix4(),offset:new Vector3()},{slot:'B',id:'INVERT',root:new Matrix4().makeTranslation(100,0,0),offset:new Vector3(100,0,0)}];
 readonly portals=new PortalRegistry([{id:'VESTIBULE-THRESHOLD',worldId:'A',position:new Vector3(0,2.8,-20),rotation:new Quaternion(),width:3.6,height:5.6},{id:'INVERT-THRESHOLD',worldId:'B',position:new Vector3(100,2.8,18.2),rotation:new Quaternion().setFromAxisAngle(new Vector3(0,1,0),Math.PI),width:3.6,height:5.6}],[{sourceId:'VESTIBULE-THRESHOLD',destinationId:'INVERT-THRESHOLD',sourceWorldId:'A',destinationWorldId:'B'},{sourceId:'INVERT-THRESHOLD',destinationId:'VESTIBULE-THRESHOLD',sourceWorldId:'B',destinationWorldId:'A'}]);
 get(slot:WorldId){return this.worlds.find(w=>w.slot===slot)!;}
 local(position:Vector3,slot:WorldId){return position.clone().sub(this.get(slot).offset);}
 global(position:Vector3,slot:WorldId){return position.clone().add(this.get(slot).offset);}
}
