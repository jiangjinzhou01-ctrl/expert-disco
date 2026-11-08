import {AmbientLight,BufferAttribute,Color,DirectionalLight,Fog,HemisphereLight,IcosahedronGeometry,Mesh,MeshStandardMaterial,PCFSoftShadowMap,Scene,TorusGeometry,Vector3,type WebGLRenderer} from 'three';
import {createOrbitalEnvelope} from './OrbitalArchitecture';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createPortalSurface,type RoomScene} from '../../engine/portal/PortalGeometry';
import {WorldRegistry} from '../world/WorldRegistry';
import type {WorldId} from '../../scenes/RoomLayout';
export interface SceneAsset extends RoomScene {model:import('three').Group;device:Mesh;sun:DirectionalLight;}
export async function loadChapterScenes(registry:WorldRegistry):Promise<Record<WorldId,SceneAsset>>{
 const loader=new GLTFLoader();const results=await Promise.all(registry.worlds.map(async(world)=>{
  const scene=new Scene();scene.name=world.id;scene.background=new Color(world.slot==='A'?'#020711':'#7e949f');scene.fog=new Fog(world.slot==='A'?0x0c1723:0x7e949f,70,280);
  const gltf=await loader.loadAsync(`${import.meta.env.BASE_URL}assets/v02/${world.id.toLowerCase()}.glb`);const model=gltf.scene;model.position.copy(world.offset);scene.add(model);
  model.traverse(o=>{if(o instanceof Mesh){o.castShadow=true;o.receiveShadow=true;if(o.material instanceof MeshStandardMaterial){if(o.material.name==='glass'){o.material.transparent=true;o.material.opacity=.17;o.material.depthWrite=false;o.castShadow=false;}o.material.envMapIntensity=.4;}}});
  // Main silhouettes/collision surfaces are always resident. Spatial material
  // batches keep frustum culling meaningful instead of merging a whole world.
  model.traverse(o=>{if(o.name.startsWith('V-compression-')||o.name.startsWith('V-roof-slit-')||o.name.startsWith('V-main-wall-')||o.name.startsWith('V-entry-return-')||o.name.startsWith('V-door-wall-'))o.visible=false;});
  model.updateMatrixWorld(true);
  const batches=new Map<string,{material:import('three').Material;geometries:import('three').BufferGeometry[];ranges:{id:string;start:number;end:number}[]}>();
  const originals:Mesh[]=[];
  model.traverse(o=>{
   if(!(o instanceof Mesh)||!o.visible||['ORIGINAL_AXIS_CANTILEVER','ORIGINAL_AXIS_PIER','RIGHT_ANCHOR','I-continuous-ground-arc-wall'].includes(o.name)||Array.isArray(o.material))return;
   const geometry=o.geometry.clone().applyMatrix4(o.matrixWorld);geometry.computeBoundingBox();
   const center=geometry.boundingBox!.getCenter(new Vector3());const key=`${o.material.uuid}:${Math.floor(center.x/10)}:${Math.floor(center.z/10)}`;
   if(!geometry.getAttribute('uv'))geometry.setAttribute('uv',new BufferAttribute(new Float32Array(geometry.getAttribute('position').count*2),2));
   let batch=batches.get(key);if(!batch){batch={material:o.material,geometries:[],ranges:[]};batches.set(key,batch);}
   const start=batch.ranges.at(-1)?.end??0;batch.ranges.push({id:typeof o.userData.asset_id==='string'?o.userData.asset_id:o.name,start,end:start+(geometry.index?.count??geometry.getAttribute('position').count)/3});
   batch.geometries.push(geometry);originals.push(o);
  });
  for(const [key,batch]of batches){const merged=mergeGeometries(batch.geometries,false);if(merged){const m=new Mesh(merged,batch.material);m.name=`${world.id}-cell-${key}`;m.userData.assetRanges=batch.ranges;m.castShadow=!batch.material.transparent;m.receiveShadow=true;scene.add(m);}batch.geometries.forEach(g=>g.dispose());}
  for(const o of originals){o.removeFromParent();o.geometry.dispose();}
  scene.add(new HemisphereLight(world.slot==='A'?0xc4d8ef:0xc9e6f4,world.slot==='A'?0x5b4f42:0x384953,.9));scene.add(new AmbientLight(0xffffff,.12));
  const sun=new DirectionalLight(world.slot==='A'?0xffe4bd:0xd9efff,3.4);sun.position.copy(world.offset).add(new Vector3(-13,40,12));sun.target.position.copy(world.offset).add(new Vector3(0,0,-5));sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-32;sun.shadow.camera.right=32;sun.shadow.camera.top=40;sun.shadow.camera.bottom=-40;sun.shadow.camera.near=1;sun.shadow.camera.far=100;sun.shadow.bias=-.0003;sun.shadow.normalBias=.025;scene.add(sun,sun.target);
  if(world.slot==='A')scene.add(createOrbitalEnvelope(world.offset));
  const surface=createPortalSurface(registry.portals.forWorld(world.slot)[0]);scene.add(surface);
  const material=new MeshStandardMaterial({color:0x272d2e,metalness:.72,roughness:.3});const device=new Mesh(new IcosahedronGeometry(world.slot==='A'?.95:.22,2),material);device.name=world.slot==='A'?'VESTIBULE_RESONATOR':'INVERT_TERMINAL';device.position.copy(world.offset).add(world.slot==='A'?new Vector3(0,-2,6):new Vector3(4.5,5.1,-16.5));scene.add(device);
  if(world.slot==='B'){const ring=new Mesh(new TorusGeometry(.52,.025,8,48),new MeshStandardMaterial({color:0xb6a087,metalness:.8,roughness:.42}));ring.position.copy(device.position);ring.rotation.y=Math.PI/2;scene.add(ring);}
  const moving=world.slot==='B'?new Mesh(new RoundedBoxGeometry(.5,.5,.5,2,.035),material.clone()):null;if(moving){moving.name='DYNAMIC_WITNESS';scene.add(moving);}
  const dispose=()=>{const g=new Set<import('three').BufferGeometry>();const m=new Set<import('three').Material>();const t=new Set<import('three').Texture>();scene.traverse(o=>{if(o instanceof Mesh){g.add(o.geometry);for(const mat of Array.isArray(o.material)?o.material:[o.material]){m.add(mat);for(const value of Object.values(mat))if(value&&typeof value==='object'&&(value as import('three').Texture).isTexture)t.add(value as import('three').Texture);}}});g.forEach(v=>v.dispose());m.forEach(v=>v.dispose());t.forEach(v=>v.dispose());sun.shadow.dispose();scene.clear();};
  const bundle:SceneAsset={scene,portal:registry.portals.forWorld(world.slot)[0],surface,movingReference:moving,markers:[],model,device,sun,update:()=>{},dispose};return [world.slot,bundle] as const;
 }));return {A:results[0][1] as SceneAsset,B:results[1][1] as SceneAsset};
}
export function prepareStaticShadows(gl:WebGLRenderer,scenes:Record<WorldId,SceneAsset>,camera:import('three').PerspectiveCamera){gl.shadowMap.enabled=true;gl.shadowMap.type=PCFSoftShadowMap;gl.shadowMap.autoUpdate=false;for(const slot of ['A','B'] as const){gl.shadowMap.needsUpdate=true;scenes[slot].surface.visible=false;gl.render(scenes[slot].scene,camera);scenes[slot].surface.visible=true;}gl.shadowMap.needsUpdate=false;}
