import { AmbientLight, DirectionalLight } from 'three';
import { buildRoomGeometry } from '../engine/portal/PortalGeometry';
export function createRoomB(){
  const room=buildRoomGeometry('B');
  room.scene.add(new AmbientLight('#ffe6bd',2.0));
  const light=new DirectionalLight('#ffe4b8',2.3);light.position.set(44,5,2);room.scene.add(light);
  return room;
}
