import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {getBounds} from '@gltf-transform/functions';
import {MeshoptDecoder} from 'meshoptimizer';
import {Mesh,Vector3} from 'three';
import {createOrbitalEnvelope} from '../../chapter/assets/OrbitalArchitecture';

it('decodes every deployed meshopt cell, validates provenance, full topology and finite world bounds',async()=>{
 const manifest=JSON.parse(readFileSync('public/assets/orbital/architecture/manifest.json','utf8')) as {totalBytes:number;totalTriangles:number;chunks:{id:string;file:string;bytes:number;sha256:string;triangles:number;bounds:number[][]}[]};
 await MeshoptDecoder.ready;const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
 let bytes=0,triangles=0;
 for(const chunk of manifest.chunks){
  const path='public/assets/orbital/architecture/'+chunk.file,data=readFileSync(path);bytes+=data.length;
  expect(data.length,chunk.id).toBe(chunk.bytes);expect(createHash('sha256').update(data).digest('hex'),chunk.id).toBe(chunk.sha256);
  const doc=await io.read(path);const bounds=getBounds(doc.getRoot().listScenes()[0]);
  for(let axis=0;axis<3;axis++){
   // Authored rotation bounds are conservative; streaming needs containment,
   // not equality with the tighter bounds of referenced decoded vertices.
   expect(Number.isFinite(bounds.min[axis]+bounds.max[axis]),chunk.id).toBe(true);
   expect(bounds.min[axis],chunk.id+' minimum inside streaming bound').toBeGreaterThanOrEqual(chunk.bounds[0][axis]-.003);
   expect(bounds.max[axis],chunk.id+' maximum inside streaming bound').toBeLessThanOrEqual(chunk.bounds[1][axis]+.003);
  }
  let count=0;for(const mesh of doc.getRoot().listMeshes())for(const primitive of mesh.listPrimitives()){
   expect(primitive.getAttribute('NORMAL'),chunk.id).toBeTruthy();expect(primitive.getAttribute('TEXCOORD_0'),chunk.id).toBeTruthy();count+=primitive.getIndices()!.getCount()/3;
  }
  expect(count,chunk.id).toBe(chunk.triangles);triangles+=count;
 }
 expect(bytes).toBe(manifest.totalBytes);expect(triangles).toBe(manifest.totalTriangles);expect(manifest.chunks).toHaveLength(13);
 expect(manifest.chunks.filter(c=>c.id.includes('-atelier-')).map(c=>c.id).sort()).toEqual(['A-atelier-east','A-atelier-west','B-atelier-surface']);
});

it('permanent pressure glazing leaves the portal aperture clear and stays on existing guarded boundaries',()=>{
 const group=createOrbitalEnvelope(new Vector3());group.updateMatrixWorld(true);let triangles=0;
 group.traverse(o=>{if(!(o instanceof Mesh))return;const p=o.geometry.getAttribute('position');triangles+=(o.geometry.index?.count??p.count)/3;
  for(let i=0;i<p.count;i++){const v=new Vector3().fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);
   expect([v.x,v.y,v.z].every(Number.isFinite)).toBe(true);
   const portalVoid=Math.abs(v.x)<1.799&&v.y>.001&&v.y<5.599&&v.z>-21&&v.z<-19.9;
   expect(portalVoid,'new architecture must never fill the live door').toBe(false);
   const side=Math.abs(v.x)>=15.99&&Math.abs(v.x)<=17.01&&v.z>=-22.01&&v.z<=22.01;
   const entry=Math.abs(v.x)>=1.99&&Math.abs(v.x)<=17.01&&v.z>=21.59&&v.z<=22.41;
   const front=v.z>=-20.99&&v.z<=-19.97&&Math.abs(v.x)<=16.51;
   expect(side||entry||front,JSON.stringify(v.toArray())).toBe(true);
  }
 });expect(triangles).toBeGreaterThan(1000);
});
