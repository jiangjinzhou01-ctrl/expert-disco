import { afterEach, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { ChapterPhysics } from '../../chapter/physics/ChapterPhysics';
import { ChapterController } from '../../chapter/physics/ChapterController';
import { RingChart, buildRibbonVolume } from '../../chapter/physics/SurfaceCharts';
import { SurfaceWalker } from '../../chapter/physics/SurfaceWalker';

let physics:ChapterPhysics;afterEach(()=>physics?.dispose());
it('moves an actual rotated capsule through a 360° ring, stops and reverses without scripted poses',async()=>{
 physics=await ChapterPhysics.create();
 const chart=new RingChart('G01-G02','A',new Vector3(34,4.5,0),4.5,new Vector3(0,-1,0),new Vector3(1,0,0));
 const mesh=buildRibbonVolume(chart);physics.addSupportVolume(chart.id,'A',mesh.vertices,mesh.indices);physics.world.step();
 const c=new ChapterController(physics);c.place(chart.sample(0,0).foot,'A');
 const walker=new SurfaceWalker(physics,[chart]);expect(walker.tryAttach(c.state)).toBe(true);
 const start=c.state.foot.clone();
 const fullTurnSteps=Math.ceil(chart.length/3*60);let minimumUpY=1;
 for(let i=0;i<fullTurnSteps;i++){
  const p=chart.sample(walker.snapshot!.s,0);walker.step(c.state,1/60,p.tangent.clone().multiplyScalar(3));
  minimumUpY=Math.min(minimumUpY,c.state.up.y);
  physics.commit(c.state.position,c.state.bodyRotation,1/60);
 }
 expect(walker.snapshot!.s).toBeGreaterThan(chart.length);expect(minimumUpY).toBeLessThan(-.99);expect(c.state.up.y).toBeGreaterThan(.99);
 const stopped=c.state.foot.clone();for(let i=0;i<30;i++)walker.step(c.state,1/60,new Vector3());
 expect(c.state.foot.distanceTo(stopped)).toBeLessThan(.0001);
 for(let i=0;i<fullTurnSteps;i++){
  const p=chart.sample(walker.snapshot!.s,0);walker.step(c.state,1/60,p.tangent.clone().multiplyScalar(-3));
  physics.commit(c.state.position,c.state.bodyRotation,1/60);
 }
 expect(c.state.foot.distanceTo(start)).toBeLessThan(.01);expect(c.state.up.distanceTo(new Vector3(0,1,0))).toBeLessThan(.01);
 expect(physics.rotationQueries).toBeGreaterThan(1000);
});
