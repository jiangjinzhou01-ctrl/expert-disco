import { AmbientLight, DirectionalLight } from 'three';
import { buildRoomGeometry } from '../engine/portal/PortalGeometry';
export function createRoomA(){
  const room=buildRoomGeometry('A');
  room.scene.add(new AmbientLight('#d9eafa',2.0));
  const light=new DirectionalLight('#e7f4ff',2.3);light.position.set(2,5,2);room.scene.add(light);
  return room;
}
