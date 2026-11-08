import { afterEach, expect, it } from 'vitest';
import { Vector3 } from 'three';
import layout from '../../chapter/world/atelier-layout.json';
import base from '../../chapter/assets/architecture.generated.json';
import { ChapterPhysics } from '../../chapter/physics/ChapterPhysics';
import { ChapterController } from '../../chapter/physics/ChapterController';

let physics: ChapterPhysics | undefined;
afterEach(() => { physics?.dispose(); physics = undefined; });

it('places furniture on retained floor with no overlap against original solid boxes or the protected route', () => {
  expect(layout.props).toHaveLength(8);
  for (const prop of layout.props) {
    expect([...prop.center, ...prop.size].every(Number.isFinite)).toBe(true);
    const lo = prop.center.map((c, i) => c - prop.size[i] / 2), hi = prop.center.map((c, i) => c + prop.size[i] / 2);
    expect(lo[1]).toBeCloseTo(0);
    for (const box of base.boxes.filter(b => b.world === prop.world)) {
      const overlap = [0, 1, 2].every(i => Math.min(hi[i], box.center[i] + box.size[i] / 2) - Math.max(lo[i], box.center[i] - box.size[i] / 2) > .001);
      expect(overlap, `${prop.id} intersects ${box.id}`).toBe(false);
    }
    // Existing east-side round trip uses x<=8.1 and the central gate uses |x|<2.
    if (prop.kind === 'bench') expect(Math.abs(prop.center[0]) - prop.size[0] / 2).toBeGreaterThan(9.5);
    else expect(Math.abs(prop.center[0]) - prop.size[0] / 2).toBeGreaterThan(5.5);
  }
});

it('real Rapier furniture blocks a walking capsule and uses the shared authored hull', async () => {
  physics = await ChapterPhysics.create();
  const controller = new ChapterController(physics);
  controller.place(new Vector3(8.5, 0, 13), 'A');
  for (let i = 0; i < 120; i++) controller.step(1 / 60, { x: 1, y: 0 });
  expect(controller.state.foot.x).toBeGreaterThan(9.9);
  expect(controller.state.foot.x).toBeLessThan(10.04);
  expect(controller.state.grounded).toBe(true);
  expect(controller.state.errors).toEqual([]);
  const handle = [...physics.metadata].find(([, m]) => m.id === 'ATELIER-BENCH-E3')?.[0];
  expect(handle).toBeDefined();
  const hull = physics.world.getCollider(handle!).halfExtents()!;
  expect(hull.x).toBeCloseTo(.38); expect(hull.y).toBeCloseTo(.26); expect(hull.z).toBeCloseTo(1.42);
});
