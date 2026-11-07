import { Quaternion, Vector3 } from 'three';
import type { WorldId } from '../../scenes/RoomLayout';
export class PlayerState {
 position=new Vector3(0,.89,-3); rotation=new Quaternion(); velocity=new Vector3(); movementDirection=new Vector3();
 worldId:WorldId='A'; step=0; grounded=false; yaw=0; pitch=0; discontinuity=0;
 reset(){this.position.set(0,.89,-3);this.rotation.identity();this.velocity.set(0,0,0);this.movementDirection.set(0,0,0);this.worldId='A';this.yaw=0;this.pitch=0;this.grounded=false;this.discontinuity++;}
}
