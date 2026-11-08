import { describe, expect, it } from 'vitest';
import { DEFAULT_LOOK_SETTINGS, LookResponse } from '../../input/LookResponse';
import { TouchInput } from '../../input/TouchInput';

function gesture(duration: number, width = 768, settings = {}) {
  const response = new LookResponse(settings);
  response.begin(0);
  let yaw = 0;
  for (let i = 1; i <= 16; i++) yaw += response.sample(width / 32, 0, duration * i / 16, width).x;
  return { yaw, diagnostics: response.snapshot };
}

describe('touch look response', () => {
  it('accelerates the same displacement smoothly when the finger moves faster', () => {
    const slow = gesture(1800);
    const fast = gesture(100);
    expect(fast.yaw).toBeGreaterThan(slow.yaw * 1.6);
    expect(slow.diagnostics.horizontalGain).toBeGreaterThanOrEqual(1);
    expect(fast.diagnostics.horizontalGain).toBeLessThanOrEqual(2);
    const middle = gesture(500);
    expect(middle.yaw).toBeGreaterThan(slow.yaw);
    expect(middle.yaw).toBeLessThan(fast.yaw);
  });

  it('has no camera-angle tail after stopping, releasing, or starting another gesture', () => {
    const response = new LookResponse();
    response.begin(0);
    response.sample(300, 20, 16, 768);
    expect(response.sample(0, 0, 32, 768)).toEqual({ x: 0, y: 0 });
    response.end();
    expect(response.snapshot).toMatchObject({ active: false, speedScreensPerSecond: 0, horizontalGain: 1 });
    expect(response.sample(10, 10, 48, 768)).toEqual({ x: 0, y: 0 });
    response.begin(1000);
    const fresh = new LookResponse();
    fresh.begin(1000);
    expect(response.sample(5, 0, 1020, 768)).toEqual(fresh.sample(5, 0, 1020, 768));
  });

  it('supports exact linear response, inversion, and viewport-relative gestures', () => {
    const linear = new LookResponse({ acceleration: 0, invertY: true });
    linear.begin(0);
    expect(linear.sample(100, 40, 20, 768)).toEqual({ x: 130, y: -52 });
    const phone = gesture(500, 390, { acceleration: 0 });
    const tablet = gesture(500, 1024, { acceleration: 0 });
    expect(phone.yaw).toBeCloseTo(tablet.yaw, 10);
    expect(DEFAULT_LOOK_SETTINGS.sensitivity).toBe(1.3);
  });

  it('uses bounded vertical acceleration and reproduces a fixed timed gesture', () => {
    const first = gesture(175);
    expect(gesture(175)).toEqual(first);
    expect(first.diagnostics.verticalGain).toBeLessThan(first.diagnostics.horizontalGain);
    expect(first.diagnostics.verticalGain).toBeLessThanOrEqual(1.7);
  });

  it('rejects invalid settings and malformed samples without propagating NaN', () => {
    for (const sensitivity of [NaN, Infinity, -1, 0, 4]) {
      expect(() => new LookResponse({ sensitivity })).toThrow(RangeError);
    }
    expect(() => new LookResponse({ acceleration: -1 })).toThrow(RangeError);
    const response = new LookResponse();
    response.begin(10);
    for (const sample of [[NaN, 0, 20, 768], [1, Infinity, 20, 768], [1, 2, 20, 0], [1, 2, 9, 768]]) {
      expect(response.sample(...sample as [number, number, number, number])).toEqual({ x: 0, y: 0 });
    }
    expect(response.snapshot.rejectedSamples).toBe(4);
    expect(Number.isFinite(response.sample(4, 2, 30, 768).x)).toBe(true);
    expect(response.sample(Number.MAX_VALUE, 0, 31, 320)).toEqual({ x: 0, y: 0 });
  });
});

class TestCanvas {
  readonly listeners = new Map<string, EventListener>();
  readonly captured = new Set<number>();
  addEventListener(type: string, listener: EventListener) { this.listeners.set(type, listener); }
  removeEventListener(type: string) { this.listeners.delete(type); }
  getBoundingClientRect() { return { left: 0, top: 0, width: 768, height: 400 }; }
  setPointerCapture(id: number) { this.captured.add(id); }
  releasePointerCapture(id: number) { this.captured.delete(id); }
  hasPointerCapture(id: number) { return this.captured.has(id); }
  event(type: string, pointerId: number, clientX: number, clientY: number, timeStamp: number, extra = {}) {
    this.listeners.get(type)?.({ type, pointerId, clientX, clientY, timeStamp,
      pointerType: 'touch', preventDefault() { /* browser gesture prevention */ }, ...extra } as unknown as Event);
  }
}

describe('independent touch pointers', () => {
  it('retains exact legacy linear displacement when the G0 compatibility profile is selected', () => {
    const canvas = new TestCanvas();
    const deltas: number[][] = [];
    const touch = new TouchInput(canvas as unknown as HTMLElement, {
      look: (x, y) => deltas.push([x, y]), reset() {}, toggleDebug() {},
    }, false);
    canvas.event('pointerdown', 2, 650, 200, 0);
    canvas.event('pointermove', 2, 250, 220, 10);
    expect(deltas).toEqual([[-400, 20]]);
    touch.dispose();
  });

  it('processes native coalesced look samples once while movement remains active, then cancels cleanly', () => {
    const canvas = new TestCanvas();
    const deltas: number[][] = [];
    const touch = new TouchInput(canvas as unknown as HTMLElement, {
      look: (x, y) => deltas.push([x, y]), reset() {}, toggleDebug() {},
    });
    touch.setLookSettings({ acceleration: 0 });
    canvas.event('pointerdown', 1, 100, 200, 0);
    canvas.event('pointerdown', 2, 600, 200, 0);
    canvas.event('pointermove', 1, 120, 170, 10);
    canvas.event('pointermove', 2, 630, 205, 20, {
      getCoalescedEvents: () => [
        { clientX: 610, clientY: 202, timeStamp: 10 },
        { clientX: 630, clientY: 205, timeStamp: 20 },
      ],
    });
    expect(deltas).toHaveLength(2);
    expect(deltas.reduce((sum, d) => sum + d[0], 0)).toBeCloseTo(39);
    expect(touch.state).toMatchObject({ moveActive: true, lookActive: true });
    canvas.event('pointercancel', 2, 630, 205, 21);
    expect(touch.lookResponse.snapshot.active).toBe(false);
    expect(touch.state.moveActive).toBe(true);
    canvas.event('pointermove', 2, 700, 205, 30);
    expect(deltas).toHaveLength(2);
    touch.clear();
    expect(touch.movement).toEqual({ x: 0, y: 0 });
    expect(canvas.captured.size).toBe(0);
    touch.dispose();
    expect(canvas.listeners.size).toBe(0);
  });
});
