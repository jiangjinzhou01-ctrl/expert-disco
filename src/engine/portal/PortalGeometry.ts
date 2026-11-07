import {
  BoxGeometry, Color, Group, Mesh, MeshBasicMaterial, MeshLambertMaterial,
  Object3D, PlaneGeometry, Scene, ShaderMaterial, SphereGeometry,
  Vector2, Vector3,
} from 'three';
import type { Portal } from './PortalTypes';
import type { WorldId } from '../../scenes/RoomLayout';
import { markers, portalA, portalB, roomBoxes } from '../../scenes/RoomLayout';

export interface MarkerSpec { id:string; position:[number,number,number]; color:number }
export interface RoomScene {
  scene:Scene;
  portal:Portal;
  surface:Mesh<PlaneGeometry,ShaderMaterial>;
  movingReference:Object3D|null;
  markers:MarkerSpec[];
  update:(seconds:number)=>void;
  dispose:()=>void;
}

/** Aperture geometry, not a fullscreen composite: frame and room depth occlude it normally. */
export function createPortalSurface(portal:Portal):Mesh<PlaneGeometry,ShaderMaterial>{
  const material=new ShaderMaterial({
    uniforms:{ portalTexture:{value:null}, drawingBufferSize:{value:new Vector2(1,1)} },
    vertexShader:`void main(){
  vec4 clip=projectionMatrix*modelViewMatrix*vec4(position,1.0);
  // A physical aperture remains visible until the eye crosses its plane.
  // Clamp its depth at the near plane rather than losing the surface in the final millimetres.
  if(clip.w>0.0)clip.z=max(clip.z,-clip.w+0.000001);
  gl_Position=clip;
}`,
    fragmentShader:`uniform sampler2D portalTexture;
uniform vec2 drawingBufferSize;
void main(){
  gl_FragColor=texture2D(portalTexture,gl_FragCoord.xy/drawingBufferSize);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`,
    depthWrite:true,depthTest:true,toneMapped:false,
  });
  const surface=new Mesh(new PlaneGeometry(portal.width,portal.height),material);
  surface.name=`${portal.id}-surface`;
  surface.position.copy(portal.position);
  surface.quaternion.copy(portal.rotation);
  surface.frustumCulled=false;
  return surface;
}

/** The exact box descriptors are shared with Rapier; no hidden full doorway wall. */
export function buildRoomGeometry(worldId:WorldId):RoomScene{
  const scene=new Scene();
  scene.name=`ROOM ${worldId}`;
  scene.background=new Color(worldId==='A'?'#23333d':'#73604a');
  const portal=worldId==='A'?portalA:portalB;
  const surface=createPortalSurface(portal);
  scene.add(surface);
  const box=new BoxGeometry(1,1,1);
  const materials=new Map<string,MeshLambertMaterial>();
  for(const spec of roomBoxes(worldId)){
    let material=materials.get(spec.color);
    if(!material){ material=new MeshLambertMaterial({color:spec.color});materials.set(spec.color,material); }
    const mesh=new Mesh(box,material);
    mesh.name=spec.id;mesh.position.set(...spec.center);mesh.scale.set(...spec.size);
    scene.add(mesh);
  }
  // Directional floor chevrons use shared geometry, have no collision volume.
  const stripeMaterial=new MeshBasicMaterial({color:worldId==='A'?'#8ab7c9':'#e8ce8c'});
  const stripes=new Group();
  for(let z=-6;z<=6;z+=2){
    for(const sign of [-1,1]){
      const stripe=new Mesh(box,stripeMaterial);
      stripe.position.set(sign*.18,.006,z);stripe.scale.set(.05,.012,.5);
      stripe.rotation.y=sign*Math.PI/4;
      stripes.add(stripe);
    }
  }
  if(worldId==='B'){stripes.rotation.y=Math.PI/2;stripes.position.x=40;}
  scene.add(stripes);
  const markerGeometry=new SphereGeometry(.085,24,16);
  const markerMaterials:MeshBasicMaterial[]=[];
  const roomMarkers:MarkerSpec[]=worldId==='B'?markers:[];
  for(const marker of roomMarkers){
    const material=new MeshBasicMaterial({color:marker.color,toneMapped:false});
    markerMaterials.push(material);
    const mesh=new Mesh(markerGeometry,material);
    mesh.name=`marker-${marker.id}`;mesh.position.set(...marker.position);scene.add(mesh);
  }
  let movingReference:Mesh|null=null;
  const movingMaterial=new MeshLambertMaterial({color:'#ecb34c'});
  if(worldId==='B'){
    movingReference=new Mesh(new BoxGeometry(.65,.65,.65),movingMaterial);
    movingReference.name='moving-reference';movingReference.position.set(35.8,.8,-1.3);scene.add(movingReference);
    // This visible-color probe is behind the exit plane and must be clipped in the portal pass.
    const probe=new Mesh(box,new MeshBasicMaterial({color:0x9f00ff,toneMapped:false}));
    probe.name='exit-backside-clipping-probe';probe.position.set(31.3,1.55,0);probe.scale.set(.12,2.4,1.8);scene.add(probe);
  }
  const update=(seconds:number)=>{
    if(movingReference){
      movingReference.position.set(35.8,.8+.2*Math.sin(seconds*.9),-1.3+.2*Math.sin(seconds*.65));
      movingReference.rotation.set(seconds*.12,seconds*.35,0);
    }
  };
  const dispose=()=>{
    const geometries=new Set<import('three').BufferGeometry>();
    const sceneMaterials=new Set<import('three').Material>();
    scene.traverse(object=>{
      if(object instanceof Mesh){
        geometries.add(object.geometry);
        for(const material of Array.isArray(object.material)?object.material:[object.material])sceneMaterials.add(material);
      }
    });
    for(const geometry of geometries)geometry.dispose();
    for(const material of sceneMaterials)material.dispose();
    // These may not have entered the graph when creating room A.
    markerGeometry.dispose();movingMaterial.dispose();
    scene.clear();
  };
  return {scene,portal,surface,movingReference,markers:roomMarkers,update,dispose};
}

export const portalNormal=(portal:Portal,target=new Vector3()):Vector3=>target.set(0,0,1).applyQuaternion(portal.rotation);
