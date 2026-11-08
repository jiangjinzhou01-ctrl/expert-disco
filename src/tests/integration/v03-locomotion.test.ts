import { afterEach, describe, expect, it } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import { Vector3 } from 'three';
import { ChapterPhysics } from '../../chapter/physics/ChapterPhysics';
import { ChapterController } from '../../chapter/physics/ChapterController';
import { ARC_LENGTH, surfacePose } from '../../chapter/physics/GravitySurface';
import type { MotionInput } from '../../chapter/physics/Locomotion';
import { mkdirSync, writeFileSync } from 'node:fs';

let physics: ChapterPhysics;
afterEach(() => physics?.dispose());
async function setup() { physics = await ChapterPhysics.create(); return new ChapterController(physics); }
function run(c: ChapterController, n: number, actions: Partial<MotionInput> = {}) {
  for (let i = 0; i < n; i++) c.step(1 / 60, { x: 0, y: 0, ...actions });
}

describe('V03 real locomotion on existing architecture', () => {
  it('moves at both ends of the 1.5–7m/s range and applies stance and sprint limits', async () => {
    const c = await setup();
    for (const speed of [1.5, 3, 7]) {
      c.place(new Vector3(8, 0, -5), 'A'); c.configure({ moveSpeed: speed });
      run(c, 60, { y: 1 }); expect(Math.abs(c.state.foot.z - (-5 - speed))).toBeLessThan(.025);
    }
    c.place(new Vector3(8, 0, -5), 'A'); c.configure({ moveSpeed: 7 });
    run(c, 60, { y: 1, sprint: true }); expect(Math.abs(c.state.foot.z + 12)).toBeLessThan(.025);
    c.place(new Vector3(8, 0, -5), 'A'); c.configure({ moveSpeed: 3 });
    run(c,60,{y:1,crouch:true}); expect(Math.abs(c.state.foot.z + 6.6),JSON.stringify({foot:c.state.foot.toArray(),stance:c.state.stance,locomotion:c.state.locomotion,blocked:physics.lastBlocked})).toBeLessThan(.025);
  });

  it('keeps nominal launch speed at 0.33g, producing the physically higher jump and longer flight', async () => {
    const c = await setup(); const results: { height: number; seconds: number; launch: number }[] = [];
    for (const scale of [1, .33]) {
      c.place(new Vector3(8, 0, -5), 'A'); c.configure({ profile: 'experiment', gravityScale: scale, jumpHeight: 1.2 });
      c.step(1 / 60, { x: 0, y: 0, jumpPressed: true });
      const launch = c.state.velocity.y + 9.81 * scale / 60;
      let height = 0, frames = 1;
      while (!c.state.grounded && frames < 600) { run(c, 1); height = Math.max(height, c.state.foot.y); frames++; }
      expect(c.state.grounded, JSON.stringify(c.state.foot.toArray())).toBe(true);
      expect(height).toBeCloseTo(1.2 / scale, 1);
      results.push({ height, seconds: frames / 60, launch });
    }
    expect(results[0]!.launch).toBeCloseTo(Math.sqrt(2 * 9.81 * 1.2), 6);
    expect(results[1]!.launch).toBeCloseTo(results[0]!.launch, 6);
    expect(results[1]!.seconds).toBeGreaterThan(results[0]!.seconds * 2.8);
    mkdirSync('evidence/v03',{recursive:true});
    writeFileSync('evidence/v03/jump-physics.json',JSON.stringify({fixedDt:1/60,nominalHeight:1.2,gravityScales:[1,.33],results},null,2));
  });

  it('jumps away from the real wall along local up and lands without snapping to the surface in flight', async () => {
    const c = await setup(); const pose = surfacePose(ARC_LENGTH + .8, -12);
    c.place(pose.foot, 'B', ARC_LENGTH + .8);
    c.step(1 / 60, { x: 0, y: 0, jumpPressed: true });
    expect(c.state.velocity.x).toBeLessThan(-4); expect(c.state.locomotion).toBe('AIRBORNE');
    const first = c.state.foot.x; run(c, 5);
    expect(c.state.foot.x).toBeLessThan(first - .1);
    expect(c.state.up.x).toBe(-1); expect(physics.body.rotation().z).toBeCloseTo(Math.SQRT1_2);
    for (let i = 0; i < 150 && !c.state.grounded; i++) run(c, 1);
    expect(c.state.grounded).toBe(true); expect(c.state.foot.x).toBeCloseTo(4.7, 2);
  });

  it('changes the real capsule and camera, refusing an unsafe stand under a ceiling', async () => {
    const c = await setup(); c.place(new Vector3(0, 0, 33), 'A');
    run(c, 1, { crouch: true });
    expect(physics.shape.halfHeight).toBe(.25); expect(c.eye().y).toBeCloseTo(.94);
    const ceiling = physics.world.createCollider(RAPIER.ColliderDesc.cuboid(1, .1, 1).setTranslation(0, 1.3, 33));
    physics.metadata.set(ceiling.handle, { id: 'LOW-CEILING', worldId: 'A' }); physics.world.step();
    run(c, 1); expect(c.state.stance).toBe('CROUCH'); expect(c.state.stanceBlocked).toContain('空间不足');
    physics.world.removeCollider(ceiling, false); physics.metadata.delete(ceiling.handle);
    run(c, 1); expect(c.state.stance).toBe('STAND');
    run(c, 1, { pronePressed: true }); expect(c.state.stance).toBe('PRONE');
    const axis = new Vector3(0, 1, 0).applyQuaternion(physics.shapeRotation(c.state.bodyRotation));
    expect(Math.abs(axis.y)).toBeLessThan(1e-7); expect(physics.shape.radius).toBe(.26);
    expect(c.eye().y).toBeCloseTo(.4); expect(c.state.position.y).toBeCloseTo(.266, 3);
    run(c, 60, { y: 1 }); expect(Math.abs(c.state.foot.z - 32.3)).toBeLessThan(.025);
  });

  it('uses thrust, inertia and braking in zero gravity, then reattaches under restored gravity', async () => {
    const c = await setup(); c.place(new Vector3(8, 0, -5), 'A'); c.configure({ profile: 'experiment', gravityScale: 0 });
    run(c, 30, { jump: true }); expect(c.state.velocity.y).toBeGreaterThan(2.5);
    const vy = c.state.velocity.y, y = c.state.foot.y; run(c, 15);
    expect(c.state.velocity.y).toBeCloseTo(vy, 5); expect(c.state.foot.y).toBeGreaterThan(y + 0.5);
    run(c, 60, { brake: true }); expect(c.state.velocity.length()).toBeLessThan(.002);
    c.configure({ gravityScale: 1 }); for (let i = 0; i < 300 && !c.state.grounded; i++) run(c, 1);
    expect(c.state.grounded).toBe(true); expect(c.state.foot.y).toBeCloseTo(0, 2);
  });

  for (const s of [ARC_LENGTH/2, ARC_LENGTH+.8]) it(`changes stance against the real supported frame s=${s}`, async () => {
    const c=await setup(),pose=surfacePose(s,-7);c.place(pose.foot,'B',s);
    run(c,1,{crouch:true});expect(c.state.stance,physics.lastBlocked??'').toBe('CROUCH');
    run(c,1,{pronePressed:true});expect(c.state.stance,physics.lastBlocked??'').toBe('PRONE');
    expect(c.state.up.distanceTo(pose.up)).toBeLessThan(1e-6);
    expect(c.eye().distanceTo(physics.registry.global(c.state.foot,'B'))).toBeCloseTo(.4,6);
    run(c,1,{pronePressed:true});expect(c.state.stance,physics.lastBlocked??'').toBe('STAND');
  });

  it('honours the coyote window and buffered landing input without repeated held-key jumps', async () => {
    const c=await setup();
    const ledge=physics.world.createCollider(RAPIER.ColliderDesc.cuboid(2,.2,2).setTranslation(30,1.8,0));
    physics.metadata.set(ledge.handle,{id:'JUMP-LEDGE',worldId:'A',walkable:true});physics.world.step();
    c.place(new Vector3(31.9,2,0),'A');run(c,5,{x:1});
    c.step(1/60,{x:1,y:0,jumpPressed:true});expect(c.state.velocity.y).toBeGreaterThan(4);
    c.place(new Vector3(8,.06,-5),'A');run(c,1);expect(c.state.locomotion).toBe('AIRBORNE');
    c.step(1/60,{x:0,y:0,jumpPressed:true});
    let launched=false;
    for(let i=0;i<12;i++){run(c,1);if(c.state.velocity.y>4)launched=true;}
    expect(launched).toBe(true);
    c.place(new Vector3(8,0,-5),'A');run(c,100,{jump:true});
    expect(c.state.grounded).toBe(true);expect(c.state.foot.y).toBeCloseTo(0,2);
  });

  for (const stance of ['CROUCH', 'PRONE'] as const) it(`crosses both directions with the actual ${stance} shape`, async () => {
    const c = await setup(); c.place(new Vector3(0, 0, -19), 'A'); c.restoreStance(stance);
    for (let i = 0; i < 160 && c.state.worldId === 'A'; i++) run(c, 1, { y: 1 });
    expect(c.state.worldId).toBe('B'); expect(c.transfer.events).toHaveLength(1); expect(c.state.stance).toBe(stance);
    run(c, 50, { y: 1 });
    for (let i = 0; i < 300 && c.state.worldId === 'B'; i++) run(c, 1, { y: -1 });
    expect(c.state.worldId).toBe('A'); expect(c.transfer.events).toHaveLength(2); expect(c.state.errors).toEqual([]);
  });

  it('rejects a prone exit that overlaps along the horizontal body axis, then recovers after unblocking',async()=>{
    const c=await setup();c.place(new Vector3(0,0,-19),'A');c.restoreStance('PRONE');c.state.yaw=Math.PI/2;run(c,1);
    const block=physics.world.createCollider(RAPIER.ColliderDesc.cuboid(.12,.4,.12).setTranslation(100.55,.35,18.05));
    physics.metadata.set(block.handle,{id:'PRONE-EXIT-SIDE-BLOCK',worldId:'B'});physics.world.step();
    run(c,140,{x:1});expect(c.state.worldId).toBe('A');expect(c.transfer.events).toHaveLength(0);
    expect(c.transfer.lastRejection).toContain('exit-overlap:PRONE-EXIT-SIDE-BLOCK');
    physics.metadata.delete(block.handle);physics.world.removeCollider(block,false);physics.world.step();
    run(c,140,{x:1});expect(c.state.worldId).toBe('B');expect(c.transfer.events).toHaveLength(1);
    expect(c.state.position.toArray().every(Number.isFinite)).toBe(true);
  });

  it('keeps a reachable recovery point after a jump or fall into the existing lower courtyard',async()=>{
    const c=await setup();c.place(new Vector3(0,-4,4),'A');run(c,250);
    expect(c.state.grounded).toBe(true);expect(c.state.foot.y).toBeCloseTo(-4,2);
    c.reset();expect(c.state.foot.z).toBe(33);expect(c.state.foot.y).toBe(0);
    expect(c.state.position.toArray().every(Number.isFinite)).toBe(true);
  });
});
