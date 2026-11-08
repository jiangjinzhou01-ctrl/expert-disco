import { describe, expect, it } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import { Quaternion, Vector3 } from 'three';
import { RingChart, buildRibbonVolume } from '../../chapter/physics/SurfaceCharts';

describe('reusable multi-axis chart and actual matching Rapier support solid',()=>{
  const charts=[
    new RingChart('innerXY','A',new Vector3(34,4.5,0),4.5,new Vector3(0,-1,0),new Vector3(1,0,0)),
    new RingChart('outerXY','B',new Vector3(25,5.8,8.5),5.8,new Vector3(0,1,0),new Vector3(1,0,0),false),
    new RingChart('spiralYZ','B',new Vector3(52,5.2,9),5.2,new Vector3(0,-1,0),new Vector3(0,0,1),true,3.2,.3),
  ];
  it('maintains a continuous physical frame, closes after 360°, and inverts positions across multiple turns',()=>{
    for(const chart of charts){
      const first=chart.sample(0,0),last=chart.sample(chart.length,0);
      expect(first.foot.distanceTo(last.foot)).toBeLessThan(1e-8);expect(first.rotation.angleTo(last.rotation)).toBeLessThan(1e-7);
      let previous:Quaternion|undefined;
      for(let i=0;i<=1000;i++){
        const s=chart.length*i/1000,p=chart.sample(s,.4),inverse=chart.project(p.foot,s);
        expect(Math.abs(inverse.s-s)).toBeLessThan(1e-6);expect(inverse.distance).toBeLessThan(1e-6);
        expect(new Vector3(0,1,0).applyQuaternion(p.rotation).distanceTo(p.up)).toBeLessThan(1e-7);
        expect(Math.abs(p.up.dot(p.tangent))).toBeLessThan(1e-8);
        if(previous)expect(previous.angleTo(p.rotation)).toBeLessThan(.01);previous=p.rotation;
      }
    }
  });
  it('raycasts the actual triangles at every angle and fits the rotated standing capsule without overlap',async()=>{
    await RAPIER.init();const world=new RAPIER.World({x:0,y:0,z:0});
    try{for(const chart of charts){
      const mesh=buildRibbonVolume(chart);const c=world.createCollider(RAPIER.ColliderDesc.trimesh(mesh.vertices,mesh.indices));world.step();
      for(let i=0;i<72;i++){
        const p=chart.sample(chart.length*i/72,0),start=p.foot.clone().addScaledVector(p.up,.12);
        const hit=world.castRayAndGetNormal(new RAPIER.Ray(start,p.up.clone().negate()),.3,true,undefined,undefined,undefined,undefined,other=>other.handle===c.handle);
        expect(hit,`${chart.id}:${i}`).not.toBeNull();expect(Math.abs(hit!.timeOfImpact-.12)).toBeLessThan(.001);
        expect(new Vector3(hit!.normal.x,hit!.normal.y,hit!.normal.z).dot(p.up)).toBeGreaterThan(.995);
        expect(world.intersectionWithShape(p.foot.clone().addScaledVector(p.up,.876),p.rotation,new RAPIER.Capsule(.57,.3),undefined,undefined,undefined,undefined,other=>other.handle===c.handle)).toBeNull();
      }
      world.removeCollider(c,false);
    }}finally{world.free();}
  });
});
