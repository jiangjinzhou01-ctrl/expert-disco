import {it,expect} from 'vitest';
import {readFileSync,statSync} from 'node:fs';
import {PNG} from 'pngjs';
import architecture from '../../chapter/assets/architecture.generated.json';
interface Gltf {
 materials:{name:string;normalTexture?:{index:number};pbrMetallicRoughness?:{baseColorTexture?:{index:number};metallicRoughnessTexture?:{index:number}}}[];
 meshes:{name:string;primitives:{attributes:{POSITION:number;COLOR_0?:number}}[]}[];
 accessors:{bufferView:number;byteOffset?:number;count:number}[];
 bufferViews:{byteOffset:number;byteLength:number;byteStride?:number}[];
 textures:{source:number}[];images:{bufferView:number}[];nodes:{extras?:{asset_id?:string}}[];
}
it('ships editable Blender, real GLB PBR pixels, baked AO, and the exact collision support vertices',()=>{
 expect(statSync('assets/source/threshold-v02-architecture.blend').size).toBeGreaterThan(100000);
 for(const name of ['vestibule','invert']){
  const bytes=readFileSync(`public/assets/v02/${name}.glb`);
  expect(bytes.readUInt32LE(0)).toBe(0x46546c67);expect(bytes.readUInt32LE(4)).toBe(2);
  const n=bytes.readUInt32LE(12),bin=28+n;
  const doc=JSON.parse(bytes.subarray(20,20+n).toString()) as Gltf;
  expect(doc.meshes.length).toBeGreaterThan(50);
  const texture=(index:number)=>{const view=doc.bufferViews[doc.images[doc.textures[index].source].bufferView];return PNG.sync.read(bytes.subarray(bin+view.byteOffset,bin+view.byteOffset+view.byteLength));};
  for(const material of doc.materials.filter(m=>m.name!=='glass')){
   expect(material.normalTexture,material.name).toBeDefined();
   expect(material.pbrMetallicRoughness?.metallicRoughnessTexture).toBeDefined();
   expect(material.pbrMetallicRoughness?.baseColorTexture).toBeDefined();
   const normal=texture(material.normalTexture!.index),rough=texture(material.pbrMetallicRoughness!.metallicRoughnessTexture!.index);
   // A present but black normal/roughness texture is a broken asset, not a PBR pass.
   const index=(128*normal.width+128)*4;expect(normal.data[index],material.name+' normal R').toBeGreaterThan(115);expect(normal.data[index]).toBeLessThan(140);expect(normal.data[index+2]).toBeGreaterThan(245);
   const expected={mineral:.86,limestone:.78,cold:.88,obsidian:.32,basalt:.72,copper:.42}[material.name as 'cold'];
   expect(Math.abs(rough.data[index+1]/255-expected),material.name+' roughness G').toBeLessThan(.06);
  }
  expect(doc.meshes.some(m=>m.primitives.some(p=>p.attributes.COLOR_0!==undefined))).toBe(true);
  if(name==='invert'){
   expect(doc.nodes.some(n=>n.extras?.asset_id==='I-axis-observation-landing'),'standard GLB retains stable source asset IDs').toBe(true);
   const edges=new Map<string,number>();const ids=architecture.supportVolume.indices;for(let i=0;i<ids.length;i+=3)for(let j=0;j<3;j++){const key=[ids[i+j],ids[i+(j+1)%3]].sort((a,b)=>a-b).join(',');edges.set(key,(edges.get(key)??0)+1);}expect([...edges.values()].every(count=>count===2),'closed support shell must have exactly two triangles per edge').toBe(true);
   const mesh=doc.meshes.find(m=>m.name==='I-continuous-ground-arc-wall')!;expect(mesh).toBeDefined();
   const a=doc.accessors[mesh.primitives[0].attributes.POSITION],view=doc.bufferViews[a.bufferView],points=new Set<string>();
   for(let i=0;i<a.count;i++){const offset=bin+view.byteOffset+(a.byteOffset??0)+i*(view.byteStride??12);points.add([0,4,8].map(k=>bytes.readFloatLE(offset+k).toFixed(4)).join(','));}
   for(const vertex of architecture.support.vertices)expect(points.has(vertex.map(n=>n.toFixed(4)).join(',')),JSON.stringify(vertex)).toBe(true);
  }
 }
});
